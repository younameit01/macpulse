import pytest
from agent.collectors.mounts import discover_mounts
from agent.collectors.io_stats import IOSampler
from agent.identity import get_host_metadata

def test_host_metadata():
    meta = get_host_metadata()
    assert "host_id" in meta
    assert len(meta["host_id"]) > 0
    assert "hostname" in meta
    assert "os_version" in meta
    assert "agent_version" in meta

def test_discover_mounts():
    mounts = discover_mounts()
    assert isinstance(mounts, list)
    assert len(mounts) > 0
    # Root volume should always be present
    root = next((m for m in mounts if m["mount_path"] == "/"), None)
    assert root is not None
    assert root["total_bytes"] > 0
    assert root["used_bytes"] > 0
    assert root["free_bytes"] > 0
    assert len(root["fs_type"]) > 0

def test_io_sampler():
    sampler = IOSampler()
    # First sample sets initial reference
    rates1 = sampler.sample()
    assert "read_bps" in rates1
    assert "write_bps" in rates1
    assert rates1["read_bps"] >= 0.0
    assert rates1["write_bps"] >= 0.0

def test_auto_discovery(monkeypatch):
    from backend.discovery import CoordinatorDiscoveryBeacon
    from agent.discovery import discover_coordinator_url
    monkeypatch.delenv("MACAI_COORDINATOR_URL", raising=False)
    beacon = CoordinatorDiscoveryBeacon(port=8000)
    beacon.start()
    try:
        import time
        time.sleep(0.2)
        url = discover_coordinator_url()
        assert "http" in url
    finally:
        beacon.stop()

def test_collect_active_processes():
    from agent.collectors.process_usage import collect_active_processes
    procs = collect_active_processes()
    assert isinstance(procs, list)
    assert len(procs) > 0
    first = procs[0]
    assert "process" in first
    assert "pid" in first
    assert "operation" in first
    assert "timestamp" in first


def test_collect_disk_health():
    from agent.collectors.smart_stats import collect_disk_health
    health = collect_disk_health()
    assert isinstance(health, dict)
    assert "smart_status" in health
    assert "is_solid_state" in health
    assert health["smart_status"] in ["Verified", "Failing", "Unknown", "Unavailable"]
    if health["temp_celsius"] is not None:
        assert 0 < health["temp_celsius"] < 120
    if health["ssd_wear_pct"] is not None:
        assert 0 <= health["ssd_wear_pct"] <= 100


