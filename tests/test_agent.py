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

def test_auto_discovery():
    from backend.discovery import CoordinatorDiscoveryBeacon
    from agent.discovery import discover_coordinator_url
    beacon = CoordinatorDiscoveryBeacon(port=8000)
    beacon.start()
    try:
        import time
        time.sleep(0.2)
        url = discover_coordinator_url()
        assert "http://" in url
        assert ":8000" in url
    finally:
        beacon.stop()

