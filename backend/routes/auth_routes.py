import os
import re
import uuid
import secrets
import logging
from typing import Optional
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session


from backend.database import get_db
from backend.models import AdminUser, utc_now
from backend.schemas import (
    CreateAdminRequest,
    CreateAdminResponse,
    UserMeResponse,
    LoginRequest,
    SignupRequest,
    AuthTokenResponse,
    InviteInfoResponse,
    AcceptInviteRequest,
)
from backend.auth import (
    get_current_user,
    require_super_admin,
    AuthenticatedUser,
    _decode_jwt_payload_unverified,
    determine_role,
)

router = APIRouter(prefix="/api/v1", tags=["authentication"])
logger = logging.getLogger("macpulse.auth")

EMAIL_REGEX = re.compile(r"^[^@]+@[^@]+\.[^@]+$")

AUTH0_DOMAIN = (os.getenv("AUTH0_DOMAIN") or os.getenv("VITE_AUTH0_DOMAIN") or "").strip()
AUTH0_CLIENT_ID = (os.getenv("AUTH0_CLIENT_ID") or os.getenv("VITE_AUTH0_CLIENT_ID") or "").strip()
AUTH0_MGMT_CLIENT_ID = os.getenv("AUTH0_MANAGEMENT_CLIENT_ID", "").strip()
AUTH0_MGMT_CLIENT_SECRET = os.getenv("AUTH0_MANAGEMENT_CLIENT_SECRET", "").strip()


def get_frontend_base_url(request: Request) -> str:
    """
    Returns the frontend origin:
    - If running locally (localhost / 127.0.0.1), automatically uses http://localhost:3000
    - If on domain (macpulse.tech or custom production domain), automatically uses https://<domain>
    """
    origin = request.headers.get("origin")
    if origin:
        origin_clean = origin.rstrip("/")
        if "localhost" in origin_clean or "127.0.0.1" in origin_clean:
            return "http://localhost:3000"
        return origin_clean

    referer = request.headers.get("referer")
    if referer:
        try:
            from urllib.parse import urlparse
            p = urlparse(referer)
            if p.scheme and p.netloc:
                if "localhost" in p.netloc or "127.0.0.1" in p.netloc:
                    return "http://localhost:3000"
                return f"{p.scheme}://{p.netloc}"
        except Exception:
            pass

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if "localhost" in host or "127.0.0.1" in host:
        return "http://localhost:3000"

    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    if host:
        return f"{proto}://{host}"

    return os.getenv("FRONTEND_URL", "https://macpulse.tech").rstrip("/")


async def _create_auth0_user(name: str, email: str, base_url: str = "https://macpulse.tech") -> tuple[Optional[str], Optional[str]]:
    """
    Calls Auth0 Management API to create user, assign Admin role,
    and generate password change / invitation ticket.
    Returns (auth0_user_id, setup_link).
    """
    if not (AUTH0_DOMAIN and AUTH0_MGMT_CLIENT_ID and AUTH0_MGMT_CLIENT_SECRET):
        # Local / dev fallback: return simulated Auth0 ID and secure setup ticket
        ticket = secrets.token_urlsafe(32)
        setup_url = f"{base_url}/?invite={ticket}&email={email}"
        return f"auth0|mock_{uuid.uuid4().hex[:12]}", setup_url

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Fetch Management API Token
            token_res = await client.post(
                f"https://{AUTH0_DOMAIN}/oauth/token",
                json={
                    "grant_type": "client_credentials",
                    "client_id": AUTH0_MGMT_CLIENT_ID,
                    "client_secret": AUTH0_MGMT_CLIENT_SECRET,
                    "audience": f"https://{AUTH0_DOMAIN}/api/v2/",
                },
            )
            if token_res.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail="Failed to authenticate with Auth0 Management service.",
                )
            mgmt_token = token_res.json().get("access_token")

            # 2. Create User in Auth0
            headers = {"Authorization": f"Bearer {mgmt_token}"}
            temp_password = f"MacAI!{secrets.token_urlsafe(12)}#"
            create_res = await client.post(
                f"https://{AUTH0_DOMAIN}/api/v2/users",
                headers=headers,
                json={
                    "connection": "Username-Password-Authentication",
                    "email": email,
                    "name": name,
                    "password": temp_password,
                    "email_verified": False,
                    "app_metadata": {"role": "Admin"},
                },
            )
            if create_res.status_code == 409:
                raise HTTPException(
                    status_code=409,
                    detail="An account already exists for this email address.",
                )
            elif create_res.status_code not in (200, 201):
                raise HTTPException(
                    status_code=502,
                    detail=f"Auth0 user creation failed: {create_res.text}",
                )

            user_data = create_res.json()
            user_id = user_data.get("user_id")

            # 3. Generate Password Reset / Setup Ticket
            ticket_res = await client.post(
                f"https://{AUTH0_DOMAIN}/api/v2/tickets/password-change",
                headers=headers,
                json={
                    "user_id": user_id,
                    "result_url": f"{base_url}/login",
                    "ttl_sec": 86400 * 7,  # 7 days
                },
            )
            ticket_url = (
                ticket_res.json().get("ticket")
                if ticket_res.status_code in (200, 201)
                else None
            )

            return user_id, ticket_url
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Error interacting with identity provider: {str(err)}",
        )


@router.get("/me", response_model=UserMeResponse)
def get_current_user_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Returns trusted authentication and role information for the current user.
    """
    return UserMeResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        picture=current_user.picture,
    )


@router.post("/admins", response_model=CreateAdminResponse, status_code=status.HTTP_201_CREATED)
@router.post("/auth/create-admin", response_model=CreateAdminResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(
    req: CreateAdminRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Super Admin only: Creates a new Admin account.
    Assigns Auth0 Admin role and returns one-time onboarding setup link.
    """
    email_clean = req.email.strip().lower()
    name_clean = req.name.strip()

    if not name_clean:
        raise HTTPException(status_code=422, detail="Full Name is required.")

    if not email_clean or not EMAIL_REGEX.match(email_clean):
        raise HTTPException(status_code=422, detail="A valid email address is required.")

    # Check local admin_users table for existing email
    existing_local = db.query(AdminUser).filter(AdminUser.email == email_clean).first()
    if existing_local:
        raise HTTPException(
            status_code=409,
            detail="An account already exists for this email address.",
        )

    # Generate a secure, unique one-time invitation token
    invite_token = secrets.token_urlsafe(32)
    base_url = get_frontend_base_url(request)
    setup_url = f"{base_url}/?invite={invite_token}"

    new_admin = AdminUser(
        id=str(uuid.uuid4()),
        email=email_clean,
        name=name_clean,
        role="Admin",
        auth0_user_id=f"auth0|{uuid.uuid4().hex[:12]}",
        setup_link=setup_url,
        invite_token=invite_token,
        created_by=current_user.email,
        created_at=utc_now(),
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return CreateAdminResponse(
        id=new_admin.id,
        name=new_admin.name,
        email=new_admin.email,
        role="Admin",
        setup_link=new_admin.setup_link,
        temp_password=None,
        created_at=new_admin.created_at,
    )


@router.get("/auth/invite-info", response_model=InviteInfoResponse)
def get_invite_info(token: str, db: Session = Depends(get_db)):
    """
    Validates an admin invitation token and returns invitee details for the onboarding screen.
    """
    token_clean = (token or "").strip()
    if not token_clean:
        return InviteInfoResponse(valid=False, error="Invitation token is required.")

    admin = db.query(AdminUser).filter(AdminUser.invite_token == token_clean).first()
    if not admin:
        return InviteInfoResponse(valid=False, error="This invitation link is invalid or has already been accepted.")

    return InviteInfoResponse(
        valid=True,
        name=admin.name,
        email=admin.email,
        role=admin.role or "Admin",
        invited_by=admin.created_by,
    )


@router.post("/auth/accept-invite", response_model=AuthTokenResponse)
async def accept_invite(req: AcceptInviteRequest, db: Session = Depends(get_db)):
    """
    Accepts an administrator invitation:
    Sets the admin's chosen password, provisions their Auth0 account,
    clears the invite token, and returns an authenticated session.
    """
    token_clean = req.invite_token.strip()
    password = req.password

    if not token_clean:
        raise HTTPException(status_code=400, detail="Invitation token is required.")

    if not password or len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters long.")

    admin = db.query(AdminUser).filter(AdminUser.invite_token == token_clean).first()
    if not admin:
        raise HTTPException(
            status_code=404,
            detail="This invitation link is invalid or has already been used. Please sign in or request a new invitation.",
        )

    # 1. Dev / mock fallback when Auth0 is not configured
    if not (AUTH0_DOMAIN and AUTH0_CLIENT_ID):
        admin.invite_token = None
        db.commit()
        token = f"dev-admin-{secrets.token_hex(8)}"
        user = UserMeResponse(
            id=admin.id,
            email=admin.email,
            name=admin.name,
            role=admin.role or "Admin",
            picture=None,
        )
        return AuthTokenResponse(
            access_token=token,
            id_token=token,
            token_type="Bearer",
            expires_in=86400,
            user=user,
        )

    # 2. Register user with their chosen password in Auth0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            signup_res = await client.post(
                f"https://{AUTH0_DOMAIN}/dbconnections/signup",
                json={
                    "client_id": AUTH0_CLIENT_ID,
                    "email": admin.email,
                    "password": password,
                    "connection": "Username-Password-Authentication",
                    "name": admin.name,
                },
            )
            signup_data = signup_res.json() if signup_res.text else {}
            if signup_res.status_code not in (200, 201) and "already exists" not in str(signup_res.text).lower():
                desc = signup_data.get("description") or signup_data.get("message") or signup_res.text
                if "PasswordStrengthError" in str(signup_res.text) or "password" in str(desc).lower():
                    policy = signup_data.get("policy", "")
                    msg = f"Password requirement: {policy}" if policy else f"{desc}"
                    raise HTTPException(status_code=400, detail=msg)
                logger.warning(f"Auth0 registration during invite accept: {signup_res.text}")

            # Authenticate the user with their chosen password
            login_req = LoginRequest(email=admin.email, password=password)
            token_resp = await login_user(login_req)

            # Invalidate one-time invitation token
            admin.invite_token = None
            db.commit()

            return token_resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to activate account: {str(e)}")


@router.post("/auth/login", response_model=AuthTokenResponse)
async def login_user(req: LoginRequest):
    email_clean = req.email.strip().lower()
    password = req.password

    if not email_clean or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    # 1. Dev / local mock fallback when Auth0 is not configured
    if not (AUTH0_DOMAIN and AUTH0_CLIENT_ID):
        role = "Super Admin" if "super" in email_clean else "Admin"
        token = f"dev-superadmin-{secrets.token_hex(8)}" if role == "Super Admin" else f"dev-admin-{secrets.token_hex(8)}"
        user = UserMeResponse(
            id=f"dev-user-{secrets.token_hex(4)}",
            email=email_clean,
            name=email_clean.split("@")[0].capitalize(),
            role=role,
            picture=None,
        )
        return AuthTokenResponse(
            access_token=token,
            id_token=token,
            token_type="Bearer",
            expires_in=86400,
            user=user,
        )

    # 2. Authenticate directly via Auth0 ROPC
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"https://{AUTH0_DOMAIN}/oauth/token",
                json={
                    "grant_type": "http://auth0.com/oauth/grant-type/password-realm",
                    "username": email_clean,
                    "password": password,
                    "client_id": AUTH0_CLIENT_ID,
                    "realm": "Username-Password-Authentication",
                    "scope": "openid profile email",
                },
            )
            data = res.json()
            if res.status_code != 200:
                err_desc = data.get("error_description") or data.get("error") or "Authentication failed."
                if "Grant type" in err_desc and "not allowed" in err_desc:
                    err_desc = "Auth0 Password Grant is not yet enabled. Please check 'Password' in Auth0 Dashboard -> Applications -> Advanced Settings -> Grant Types."
                elif "Wrong email or password" in err_desc or data.get("error") == "invalid_grant":
                    err_desc = "Invalid email or password. Please verify your credentials and try again."
                elif "not configured with default connection" in err_desc:
                    err_desc = "Database directory configuration error in Auth0. Please ensure 'Username-Password-Authentication' is enabled for this application."
                raise HTTPException(status_code=401, detail=err_desc)

            access_token = data.get("access_token")
            id_token = data.get("id_token") or access_token
            expires_in = data.get("expires_in", 86400)

            # Extract user attributes and role from ID token claims
            claims = _decode_jwt_payload_unverified(id_token)
            sub = claims.get("sub", f"auth0|{secrets.token_hex(8)}")
            name = claims.get("name") or claims.get("nickname") or email_clean.split("@")[0].capitalize()

            # Authoritative name lookup from local database
            try:
                from backend.database import SessionLocal
                from backend.models import AdminUser
                with SessionLocal() as db_session:
                    db_user = db_session.query(AdminUser).filter(AdminUser.email == email_clean).first()
                    if db_user and db_user.name:
                        name = db_user.name
            except Exception:
                pass

            role = determine_role(claims, email_clean)
            picture = claims.get("picture")

            user = UserMeResponse(
                id=sub,
                email=email_clean,
                name=name,
                role=role,
                picture=picture,
            )

            return AuthTokenResponse(
                access_token=id_token,
                id_token=id_token,
                token_type="Bearer",
                expires_in=expires_in,
                user=user,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication service error: {str(e)}")


@router.post("/auth/signup", response_model=AuthTokenResponse)
async def signup_user(req: SignupRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    password = req.password
    name_clean = (req.name or "").strip() or email_clean.split("@")[0].capitalize()

    if not email_clean or not EMAIL_REGEX.match(email_clean):
        raise HTTPException(status_code=422, detail="A valid email address is required.")

    if not password:
        raise HTTPException(status_code=422, detail="Password is required.")

    # 1. Dev fallback if Auth0 is not configured
    if not (AUTH0_DOMAIN and AUTH0_CLIENT_ID):
        role = "Admin"
        token = f"dev-admin-{secrets.token_hex(8)}"
        user = UserMeResponse(
            id=f"dev-user-{secrets.token_hex(4)}",
            email=email_clean,
            name=name_clean,
            role=role,
            picture=None,
        )
        return AuthTokenResponse(
            access_token=token,
            id_token=token,
            token_type="Bearer",
            expires_in=86400,
            user=user,
        )

    # 2. Call Auth0 dbconnections/signup
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            signup_res = await client.post(
                f"https://{AUTH0_DOMAIN}/dbconnections/signup",
                json={
                    "client_id": AUTH0_CLIENT_ID,
                    "email": email_clean,
                    "password": password,
                    "connection": "Username-Password-Authentication",
                    "name": name_clean,
                },
            )
            signup_data = signup_res.json()
            if signup_res.status_code != 200:
                desc = signup_data.get("description") or signup_data.get("message") or signup_data.get("error")
                if isinstance(desc, dict):
                    policy = signup_data.get("policy", "")
                    desc = f"Password requirement not met:\n{policy.strip()}"
                elif "user already exists" in str(desc).lower():
                    desc = "An account with this email address already exists. Please sign in instead."
                raise HTTPException(status_code=400, detail=str(desc))

            # Auto-login newly registered user
            login_req = LoginRequest(email=email_clean, password=password)
            return await login_user(login_req)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signup service error: {str(e)}")
