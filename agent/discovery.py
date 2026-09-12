import os
import socket
import json
import logging
import httpx

logger = logging.getLogger("agent.discovery")

DISCOVERY_PORT = 8765
PING_MAGIC = b"MACAI_DISCOVERY_PING"

def check_url_health(url: str, timeout: float = 1.0) -> bool:
    try:
        r = httpx.get(f"{url.rstrip('/')}/health", timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False

def discover_coordinator_url(default_url: str = "http://localhost:8000") -> str:
    """
    Automatically discover the central MacAI Coordinator on the local network.
    1. If user provided a specific non-localhost URL in env, use it.
    2. Check if a coordinator is running locally (http://localhost:8000).
    3. Broadcast a UDP discovery ping to the LAN.
    4. Fall back to default_url if not found.
    """
    env_url = os.getenv("MACAI_COORDINATOR_URL", "").rstrip("/")
    if env_url and "localhost" not in env_url and "127.0.0.1" not in env_url:
        logger.info(f"Using explicitly configured coordinator URL: {env_url}")
        return env_url

    # Check localhost first
    if check_url_health("http://localhost:8000"):
        logger.info("Found MacAI Coordinator running locally on http://localhost:8000")
        return "http://localhost:8000"

    # Attempt zero-config LAN discovery via UDP broadcast
    logger.info("Local coordinator not found. Broadcasting LAN discovery ping for MacAI Coordinator...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(2.0)

    try:
        # Broadcast to local subnet
        sock.sendto(PING_MAGIC, ("<broadcast>", DISCOVERY_PORT))
        data, addr = sock.recvfrom(1024)
        resp = json.loads(data.decode("utf-8"))
        if resp.get("service") == "macai_coordinator" and "url" in resp:
            discovered_url = resp["url"]
            logger.info(f"[+] AUTO-DISCOVERED coordinator on LAN: {discovered_url} (from {addr[0]})")
            return discovered_url
    except socket.timeout:
        logger.warning(f"No coordinator response to UDP broadcast on port {DISCOVERY_PORT}.")
    except Exception as e:
        logger.debug(f"LAN discovery exception: {e}")
    finally:
        sock.close()

    # Fallback to configured or default URL
    return env_url or default_url
