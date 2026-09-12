import os
import uuid
import platform
import subprocess
from pathlib import Path

IDENTITY_FILE = Path.home() / ".macai_agent_id"

def get_stable_host_id() -> str:
    """
    Return a stable identifier for this Mac machine.
    First check for a saved id in ~/.macai_agent_id.
    If not found, generate one using hardware UUID or MAC address and persist it.
    """
    if IDENTITY_FILE.exists():
        try:
            stored_id = IDENTITY_FILE.read_text().strip()
            if stored_id:
                return stored_id
        except Exception:
            pass

    # Try macOS ioreg for hardware UUID
    host_id = None
    try:
        cmd = ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"]
        out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            if "IOPlatformUUID" in line:
                host_id = line.split("=")[-1].replace('"', '').strip()
                break
    except Exception:
        pass

    if not host_id:
        # Fallback to node uuid
        host_id = str(uuid.UUID(int=uuid.getnode()))

    try:
        IDENTITY_FILE.write_text(host_id)
    except Exception:
        pass

    return host_id

def get_host_metadata() -> dict:
    return {
        "host_id": get_stable_host_id(),
        "hostname": platform.node() or "Mac-Host",
        "os_version": f"macOS {platform.mac_ver()[0]} ({platform.machine()})",
        "agent_version": "1.0.0",
    }
