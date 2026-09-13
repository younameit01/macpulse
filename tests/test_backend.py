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
    app.dependency_overrides[get_db] = override_get_db
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


def test_alert_deduplication_and_occurrence_count(client):
    # Register host
    client.post("/api/v1/agents/register", json={
        "host_id": "test-mac-dedup",
        "hostname": "dedup-mac",
        "os_version": "macOS 15.2",
        "agent_version": "1.0.0"
    })

    # Ingest metric with 95% capacity utilized
    payload = {
        "host_id": "test-mac-dedup",
        "volumes": [
            {
                "source": "/dev/disk4s1",
                "mount_path": "/Volumes/DedupVol",
                "fs_type": "apfs",
                "total_bytes": 100 * 1024 * 1024 * 1024,
                "used_bytes": 95 * 1024 * 1024 * 1024,
                "free_bytes": 5 * 1024 * 1024 * 1024,
            }
        ],
        "samples": [
            {
                "volume_mount": "/Volumes/DedupVol",
                "used_bytes": 95 * 1024 * 1024 * 1024,
                "free_bytes": 5 * 1024 * 1024 * 1024,
                "read_bps": 1024,
                "write_bps": 1024,
            }
        ]
    }

    # First trigger
    resp1 = client.post("/api/v1/ingest/metrics", json=payload)
    assert resp1.status_code == 200

    alerts1 = client.get("/api/v1/alerts?host_id=test-mac-dedup").json()
    assert len(alerts1) == 1
    assert alerts1[0]["occurrence_count"] == 1
    assert alerts1[0]["last_seen_at"] is not None

    # Second trigger with identical condition
    resp2 = client.post("/api/v1/ingest/metrics", json=payload)
    assert resp2.status_code == 200

    alerts2 = client.get("/api/v1/alerts?host_id=test-mac-dedup").json()
    # Should STILL be 1 alert entry, but with count incremented to 2!
    assert len(alerts2) == 1
    assert alerts2[0]["occurrence_count"] == 2
    assert alerts2[0]["id"] == alerts1[0]["id"]
    assert alerts2[0]["last_seen_at"] >= alerts1[0]["last_seen_at"]


def test_system_resources_telemetry_and_alerts(client):
    # Register host
    client.post("/api/v1/agents/register", json={
        "host_id": "test-mac-sysres",
        "hostname": "macbook-m3-pro",
        "os_version": "macOS 15.3",
        "agent_version": "1.0.0"
    })

    # Ingest metric with system resources and critical memory pressure
    sysres_payload = {
        "host_id": "test-mac-sysres",
        "volumes": [],
        "samples": [],
        "system_resources": {
            "cpu": {
                "usage_pct": 52.4,
                "cores_physical": 12,
                "cores_logical": 12,
                "load_avg": [4.12, 3.80, 3.20]
            },
            "gpu": {
                "usage_pct": 28.5,
                "cores": 18
            },
            "memory": {
                "total_bytes": 36 * 1024 * 1024 * 1024,
                "used_bytes": 32 * 1024 * 1024 * 1024,
                "available_bytes": 4 * 1024 * 1024 * 1024,
                "wired_bytes": 10 * 1024 * 1024 * 1024,
                "usage_pct": 88.9,
                "pressure_pct": 92,
                "pressure_status": "Critical",
                "swap_pct": 82.0,
                "swap_total_bytes": 16 * 1024 * 1024 * 1024,
                "swap_used_bytes": 13 * 1024 * 1024 * 1024
            },
            "thermal": {
                "thermal_state": "Nominal",
                "is_throttled": False
            }
        }
    }

    resp = client.post("/api/v1/ingest/metrics", json=sysres_payload)
    assert resp.status_code == 200

    # Verify host detail returns system_resources
    host_detail = client.get("/api/v1/hosts/test-mac-sysres").json()
    assert "system_resources" in host_detail
    assert host_detail["system_resources"]["cpu"]["usage_pct"] == 52.4
    assert host_detail["system_resources"]["gpu"]["usage_pct"] == 28.5
    assert host_detail["system_resources"]["memory"]["pressure_pct"] == 92

    # Verify memory_exhaustion_critical alert was generated
    alerts = client.get("/api/v1/alerts?host_id=test-mac-sysres").json()
    assert len(alerts) >= 1
    mem_alert = next((a for a in alerts if a["type"] == "memory_exhaustion_critical"), None)
    assert mem_alert is not None
    assert mem_alert["severity"] == "critical"

    # Verify Explain endpoint provides root cause analysis for memory exhaustion
    explain_resp = client.post(f"/api/v1/alerts/{mem_alert['id']}/explain")
    assert explain_resp.status_code == 200
    explain_data = explain_resp.json()
    assert "summary" in explain_data
    assert "likely_interpretation" in explain_data
    assert len(explain_data["recommended_checks"]) > 0


def test_smart_health_alerts(client):
    # Register host
    client.post("/api/v1/agents/register", json={
        "host_id": "test-mac-smart",
        "hostname": "mac-pro-m2-ultra",
        "os_version": "macOS 15.3",
        "agent_version": "1.0.0"
    })

    # Ingest metric with degraded S.M.A.R.T. health attributes (red states)
    smart_payload = {
        "host_id": "test-mac-smart",
        "volumes": [],
        "samples": [],
        "disk_health": {
            "smart_status": "Failing",
            "ssd_wear_pct": 94,
            "temp_celsius": 78.5,
            "available_spare_pct": 12,
            "available_spare_threshold_pct": 20,
            "media_errors": 15,
            "critical_warning": 3,
            "total_tb_written": 450.2,
            "total_tb_read": 820.5,
            "power_on_hours": 12000,
            "unsafe_shutdowns": 14,
            "bus_protocol": "Apple Fabric",
            "is_solid_state": True,
            "device_node": "/dev/disk0",
            "volume_name": "Macintosh HD"
        }
    }

    resp = client.post("/api/v1/ingest/metrics", json=smart_payload)
    assert resp.status_code == 200

    # Verify alerts generated for each red S.M.A.R.T. condition
    alerts = client.get("/api/v1/alerts?host_id=test-mac-smart").json()
    alert_types = {a["type"] for a in alerts}

    # 1. SMART Status Failing
    assert "hardware_smart_failure" in alert_types
    # 2. SSD Wear >= 90%
    assert "ssd_wear_critical" in alert_types
    # 3. Temp >= 75°C
    assert "disk_overheating" in alert_types
    # 4. Media Errors >= 10
    assert "media_errors_critical" in alert_types
    # 5. Spare <= threshold
    assert "nvme_spare_critical" in alert_types
    # 6. Critical Warning flag
    assert "nvme_critical_warning" in alert_types


def test_apfs_multi_volume_storage_accounting(client):
    host_id = "test-mac-apfs-multi"
    client.post("/api/v1/agents/register", json={
        "host_id": host_id,
        "hostname": "mac-apfs-accounting",
        "os_version": "macOS 15.2",
    })

    total_pool = 245107195904  # 245.1 GB
    free_pool = 10771795968    # 10.8 GB free
    system_used = 13659590656  # 13.7 GB
    data_used = 196022030336   # 196.0 GB

    ingest_payload = {
        "host_id": host_id,
        "volumes": [
            {
                "source": "/dev/disk3s1s1",
                "mount_path": "/",
                "fs_type": "apfs",
                "total_bytes": total_pool,
                "used_bytes": system_used,
                "free_bytes": free_pool,
            },
            {
                "source": "/dev/disk3s5",
                "mount_path": "/System/Volumes/Data",
                "fs_type": "apfs",
                "total_bytes": total_pool,
                "used_bytes": data_used,
                "free_bytes": free_pool,
            }
        ],
        "samples": [
            {
                "volume_mount": "/",
                "used_bytes": system_used,
                "free_bytes": free_pool,
                "read_bps": 1000.0,
                "write_bps": 1000.0,
            },
            {
                "volume_mount": "/System/Volumes/Data",
                "used_bytes": data_used,
                "free_bytes": free_pool,
                "read_bps": 5000.0,
                "write_bps": 5000.0,
            }
        ]
    }

    resp = client.post("/api/v1/ingest/metrics", json=ingest_payload)
    assert resp.status_code == 200

    # 1. Verify /api/v1/hosts returns host-level total/used storage matching container pool
    hosts_resp = client.get("/api/v1/hosts").json()
    target_host = next((h for h in hosts_resp if h["id"] == host_id), None)
    assert target_host is not None
    assert target_host["storage_total_bytes"] == total_pool
    # Used must account for all internal volumes (Data + System + other container space)
    expected_used = total_pool - free_pool
    assert target_host["storage_used_bytes"] == expected_used
    assert target_host["storage_used_pct"] == round((expected_used / total_pool * 100.0), 1)

    # 2. Verify /api/v1/hosts/{host_id} shows one volume with exact used + free == total and breakdown
    detail = client.get(f"/api/v1/hosts/{host_id}").json()
    assert len(detail["volumes"]) == 1  # root / is consolidated into single primary volume
    v = detail["volumes"][0]
    assert v["mount_path"] == "/System/Volumes/Data"
    assert v["used_bytes"] + v["free_bytes"] == v["total_bytes"]
    assert v["used_bytes"] == expected_used
    assert v["free_bytes"] == free_pool
    assert v["total_bytes"] == total_pool

    # Verify breakdown
    assert v["breakdown"] is not None
    assert v["breakdown"]["data_bytes"] == data_used
    assert v["breakdown"]["system_bytes"] == system_used
    assert v["breakdown"]["data_bytes"] + v["breakdown"]["system_bytes"] + v["breakdown"]["other_volumes_bytes"] == expected_used

    # 3. Verify /api/v1/volumes/detail
    v_detail = client.get(f"/api/v1/volumes/detail?volume_id={host_id}:/System/Volumes/Data").json()
    assert v_detail["used_bytes"] + v_detail["free_bytes"] == v_detail["total_bytes"]
    assert v_detail["breakdown"] is not None


def test_installer_and_uninstaller_endpoints(client):
    # Test 1-line install script endpoint
    resp_install = client.get("/install")
    assert resp_install.status_code == 200
    assert "#!/usr/bin/env bash" in resp_install.text
    assert "com.macai.storage.agent" in resp_install.text
    assert "launchctl load" in resp_install.text

    # Test 1-line uninstall script endpoint
    resp_uninstall = client.get("/uninstall")
    assert resp_uninstall.status_code == 200
    assert "#!/usr/bin/env bash" in resp_uninstall.text
    assert "launchctl unload" in resp_uninstall.text
    assert "rm -rf" in resp_uninstall.text
