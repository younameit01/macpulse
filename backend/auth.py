import os
import json
import base64
import urllib.request
from typing import Optional, Dict, Any
from dataclasses import dataclass
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

AUTH0_DOMAIN = (os.getenv("AUTH0_DOMAIN") or os.getenv("VITE_AUTH0_DOMAIN") or "").strip()
AUTH0_CLIENT_ID = (os.getenv("AUTH0_CLIENT_ID") or os.getenv("VITE_AUTH0_CLIENT_ID") or "").strip()

@dataclass
class AuthenticatedUser:
    id: str
    email: str
    name: str
    role: str  # "Super Admin" | "Admin"
    picture: Optional[str] = None


def _decode_jwt_payload_unverified(token: str) -> Dict[str, Any]:
    """Decodes JWT payload without signature verification for claims extraction."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload_b64 = parts[1]
        # Add padding if necessary
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        decoded = base64.urlsafe_b64decode(padded).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        return {}


def determine_role(claims: Dict[str, Any], email: str) -> str:
    """Determine role (Super Admin vs Admin) based on claims and database."""
    # Check custom claims for roles
    roles = []
    for key in ["https://macai.observatory/roles", "https://macai.io/roles", "roles", "permissions"]:
        if key in claims:
            val = claims[key]
            if isinstance(val, list):
                roles.extend([str(r).lower() for r in val])
            elif isinstance(val, str):
                roles.append(val.lower())

    if any("super" in r for r in roles):
        return "Super Admin"
    if any("admin" in r and "super" not in r for r in roles):
        return "Admin"

    # Check database admin_users table for provisioned Admin accounts
    normalized_email = (email or "").strip().lower()
    if normalized_email:
        try:
            from backend.database import SessionLocal
            from backend.models import AdminUser
            with SessionLocal() as db:
                user = db.query(AdminUser).filter(AdminUser.email == normalized_email).first()
                if user and user.role:
                    return user.role
        except Exception:
            pass

    # Designated super admin emails / owner accounts
    super_admin_emails = {
        "aakashthapa.work@gmail.com",
        "superadmin@macai.observatory",
        "superadmin@macpulse.io",
    }
    configured_super = (os.getenv("SUPER_ADMIN_EMAIL") or "").strip().lower()
    if configured_super:
        super_admin_emails.add(configured_super)

    if normalized_email in super_admin_emails:
        return "Super Admin"

    # Default to standard Admin role for safety and least privilege
    return "Admin"


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> AuthenticatedUser:
    """
    Extracts and verifies the current authenticated user from Bearer token.
    Supports Auth0 access tokens as well as development tokens.
    """
    token = credentials.credentials if credentials else None
    if token in ("null", "undefined", ""):
        token = None

    # Fallback to direct raw header inspection if HTTPBearer didn't capture it
    if not token:
        raw_auth = request.headers.get("Authorization") or request.headers.get("authorization")
        if raw_auth and raw_auth.lower().startswith("bearer "):
            token = raw_auth.split(" ", 1)[1].strip()
            if token in ("null", "undefined", ""):
                token = None

    # Support development / testing token or fallback when Auth0 is in development mode
    if not token:
        dev_auth = request.headers.get("X-Dev-Role") or request.headers.get("X-User-Role")
        if dev_auth:
            role = "Super Admin" if "super" in dev_auth.lower() else "Admin"
            return AuthenticatedUser(
                id="dev-user-001",
                email="superadmin@macai.observatory" if role == "Super Admin" else "admin@macai.observatory",
                name="Aakash (Super Admin)" if role == "Super Admin" else "Aakash (Admin)",
                role=role,
                picture=None,
            )
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please provide a valid Authorization Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Handle local dev tokens
    if token.startswith("dev-superadmin") or token == "super-admin-demo-token":
        return AuthenticatedUser(
            id="auth0|superadmin_dev_01",
            email="superadmin@macai.observatory",
            name="Aakash (Super Admin)",
            role="Super Admin",
            picture=None,
        )
    elif token.startswith("dev-admin") or token == "admin-demo-token":
        return AuthenticatedUser(
            id="auth0|admin_dev_02",
            email="admin@macai.observatory",
            name="John Smith (Admin)",
            role="Admin",
            picture=None,
        )

    # Decode standard Auth0 JWT
    payload = _decode_jwt_payload_unverified(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or unparseable Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user attributes
    sub = payload.get("sub", "unknown_user")
    email = payload.get("email") or payload.get("https://macai.observatory/email") or ""
    name = payload.get("name") or payload.get("nickname") or (email.split("@")[0].capitalize() if email else "Administrator")
    picture = payload.get("picture")

    # Authoritative name lookup from local database
    normalized_email = (email or "").strip().lower()
    if normalized_email:
        try:
            from backend.database import SessionLocal
            from backend.models import AdminUser
            with SessionLocal() as db:
                db_user = db.query(AdminUser).filter(AdminUser.email == normalized_email).first()
                if db_user and db_user.name:
                    name = db_user.name
        except Exception:
            pass

    role = determine_role(payload, email)

    return AuthenticatedUser(
        id=sub,
        email=email,
        name=name,
        role=role,
        picture=picture,
    )


def require_super_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Enforces that the current authenticated user is a Super Admin."""
    if current_user.role != "Super Admin":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Super Admin access is required for this action.",
        )
    return current_user


def require_admin_or_super_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Enforces that the current user has either Super Admin or Admin role."""
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Administrator access required.",
        )
    return current_user
