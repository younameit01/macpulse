import socket
import json
import threading
import logging

logger = logging.getLogger("coordinator.discovery")

DISCOVERY_PORT = 8765
PING_MAGIC = b"MACAI_DISCOVERY_PING"

def get_lan_ip() -> str:
    """Get this host's primary LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not actually connect or send data, just queries routing table
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

class CoordinatorDiscoveryBeacon:
    def __init__(self, port: int = 8000):
        self.port = port
        self.running = False
        self.thread = None
        self.sock = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        lan_ip = get_lan_ip()
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            # macOS SO_REUSEPORT for multiple bindings if needed
            if hasattr(socket, "SO_REUSEPORT"):
                try:
                    self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
                except Exception:
                    pass
            self.sock.bind(("0.0.0.0", DISCOVERY_PORT))
            self.sock.settimeout(1.0)
            logger.info(f"Coordinator auto-discovery beacon listening on UDP 0.0.0.0:{DISCOVERY_PORT} (LAN: {lan_ip})")

            while self.running:
                try:
                    data, addr = self.sock.recvfrom(1024)
                    if data == PING_MAGIC:
                        response = json.dumps({
                            "service": "macai_coordinator",
                            "url": f"http://{lan_ip}:{self.port}",
                        }).encode("utf-8")
                        self.sock.sendto(response, addr)
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        logger.debug(f"Discovery beacon error: {e}")
        except Exception as e:
            logger.warning(f"Could not start UDP discovery beacon: {e}")
        finally:
            if self.sock:
                try:
                    self.sock.close()
                except Exception:
                    pass

    def stop(self):
        self.running = False
