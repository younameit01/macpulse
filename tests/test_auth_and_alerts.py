import pytest
import uuid
from backend.models import Host, Alert, utc_now
from tests.test_backend import client, setup_db, TestingSessionLocal



def test_unauthenticated_me_rejected(client):
    res = client.get("/api/v1/me")
    assert res.status_code == 401

def test_super_admin_me_profile(client):
    res = client.get("/api/v1/me", headers={"Authorization": "Bearer dev-superadmin"})
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "Super Admin"
    assert "@" in data["email"]

def test_admin_me_profile(client):
    res = client.get("/api/v1/me", headers={"Authorization": "Bearer dev-admin"})
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "Admin"
    assert "admin" in data["email"]

def test_admin_cannot_create_admin(client):
    payload = {"name": "Test User", "email": "test.user@example.com"}
    res = client.post(
        "/api/v1/admins",
        headers={"Authorization": "Bearer dev-admin"},
        json=payload,
    )
    assert res.status_code == 403
    assert "Super Admin access is required" in res.json()["detail"]

def test_super_admin_can_create_admin(client):
    payload = {"name": "Dev Admin", "email": "dev.admin@example.com"}
    res = client.post(
        "/api/v1/admins",
        headers={"Authorization": "Bearer dev-superadmin"},
        json=payload,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Dev Admin"
    assert data["email"] == "dev.admin@example.com"
    assert data["role"] == "Admin"
    assert data["setup_link"] is not None

def test_create_admin_duplicate_email(client):
    payload = {"name": "Duplicate User", "email": "dup@example.com"}
    res1 = client.post(
        "/api/v1/admins",
        headers={"Authorization": "Bearer dev-superadmin"},
        json=payload,
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/admins",
        headers={"Authorization": "Bearer dev-superadmin"},
        json=payload,
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]

def test_create_admin_invalid_email(client):
    payload = {"name": "Invalid Email", "email": "not-an-email"}
    res = client.post(
        "/api/v1/admins",
        headers={"Authorization": "Bearer dev-superadmin"},
        json=payload,
    )
    assert res.status_code == 422

def test_alert_acknowledge_and_resolve_lifecycle(client):
    # 1. Create a host and open alert in DB
    db = TestingSessionLocal()
    host = Host(
        id="host-lifecycle-01",
        hostname="Mac-Studio-M2",
        os_version="macOS 15.2",
        agent_version="1.0.0",
        last_seen=utc_now(),
        status="online",
    )
    db.add(host)
    db.commit()

    alert_id = str(uuid.uuid4())
    alert = Alert(
        id=alert_id,
        host_id=host.id,
        type="abnormal_write",
        severity="critical",
        status="open",
        evidence_json='{"message": "Write spike detected on Data volume", "volume_mount": "/System/Volumes/Data"}',
    )
    db.add(alert)
    db.commit()
    db.close()

    # 2. Acknowledge alert
    ack_res = client.post(
        f"/api/v1/alerts/{alert_id}/acknowledge",
        headers={"Authorization": "Bearer dev-admin"},
        json={"note": "Investigating write pressure"},
    )
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["status"] == "acknowledged"
    assert ack_data["acknowledged_by"] is not None
    assert ack_data["acknowledged_at"] is not None
    events = [h["event"] for h in ack_data["history"]]
    assert any("Alert generated" in e for e in events)
    assert any("Acknowledged by" in e for e in events)

    # 3. Resolve alert with required resolution note
    resolve_res = client.post(
        f"/api/v1/alerts/{alert_id}/resolve",
        headers={"Authorization": "Bearer dev-superadmin"},
        json={"resolution_note": "Stopped rogue background compilation task."},
    )
    assert resolve_res.status_code == 200
    resolve_data = resolve_res.json()
    assert resolve_data["status"] == "closed"
    assert resolve_data["resolved_by"] is not None
    assert resolve_data["resolution_note"] == "Stopped rogue background compilation task."
    res_events = [h["event"] for h in resolve_data["history"]]
    assert any("Resolved by" in e for e in res_events)


def test_auth_login_validation(client):
    # Empty request
    res = client.post("/api/v1/auth/login", json={"email": "", "password": ""})
    assert res.status_code == 400
    assert "Email and password are required" in res.json()["detail"]


def test_auth_signup_validation(client):
    # Missing password
    res = client.post("/api/v1/auth/signup", json={"email": "valid@example.com", "password": ""})
    assert res.status_code == 422

    # Malformed email
    res2 = client.post("/api/v1/auth/signup", json={"email": "invalid-email", "password": "securepassword12345"})
    assert res2.status_code == 422

