import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.models import Base
from backend.database import get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "ok"

def test_agent_registration_and_heartbeat(client):
    # 1. Register agent
    payload = {
        "host_id": "test-mac-01",
        "hostname": "test-host-mini",
        "os_version": "macOS 15.1",
        "agent_version": "1.0.0"
    }
    reg_resp = client.post("/api/v1/agents/register", json=payload)
    assert reg_resp.status_code == 200
    assert reg_resp.json()["status"] == "registered"

    # 2. Heartbeat
    hb_resp = client.post("/api/v1/agents/test-mac-01/heartbeat")
    assert hb_resp.status_code == 200
    assert hb_resp.json()["status"] == "ok"

def test_metric_ingestion_and_capacity_alert(client):
    # Register host
    client.post("/api/v1/agents/register", json={
        "host_id": "test-mac-02",
        "hostname": "studio-m2",
        "os_version": "macOS 15.2",
        "agent_version": "1.0.0"
    })

    # Ingest metric with 92% capacity utilized (should trigger capacity_critical)
    total_bytes = 1000 * 1024 * 1024 * 1024  # 1TB
    used_bytes = 920 * 1024 * 1024 * 1024   # 920GB (92%)
    free_bytes = total_bytes - used_bytes

    ingest_payload = {
        "host_id": "test-mac-02",
        "volumes": [
            {
                "source": "/dev/disk3s1",
                "mount_path": "/System/Volumes/Data",
                "fs_type": "apfs",
                "total_bytes": total_bytes,
                "used_bytes": used_bytes,
                "free_bytes": free_bytes,
            }
        ],
        "samples": [
            {
                "volume_mount": "/System/Volumes/Data",
                "used_bytes": used_bytes,
                "free_bytes": free_bytes,
                "read_bps": 1024 * 1024,
                "write_bps": 2 * 1024 * 1024,
            }
        ]
    }

    resp = client.post("/api/v1/ingest/metrics", json=ingest_payload)
    assert resp.status_code == 200

    # Verify overview shows critical alert
    overview = client.get("/api/v1/overview").json()
    assert overview["hosts_online"] == 1
    assert overview["critical_alerts"] >= 1
    assert len(overview["recent_alerts"]) >= 1

    alert = overview["recent_alerts"][0]
    assert alert["type"] == "capacity_critical"
    assert alert["severity"] == "critical"

    # Test Explain endpoint on this alert (should return structured explanation with local fallback)
    alert_id = alert["id"]
    explain_resp = client.post(f"/api/v1/alerts/{alert_id}/explain")
    assert explain_resp.status_code == 200
    explain_data = explain_resp.json()
    assert "summary" in explain_data
    assert len(explain_data["evidence"]) >= 1
    assert "likely_interpretation" in explain_data
    assert len(explain_data["recommended_checks"]) >= 1
    assert "risk" in explain_data

def test_stream_overview(client):
    with client.stream("GET", "/api/v1/stream/overview?limit=1") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        text = response.read().decode("utf-8")
        assert "event: overview" in text
        assert "data: {" in text

