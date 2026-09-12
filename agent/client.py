import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger("agent.client")

class CoordinatorClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=5.0)

    def register(self, metadata: Dict[str, Any]) -> bool:
        try:
            url = f"{self.base_url}/api/v1/agents/register"
            resp = self.client.post(url, json=metadata)
            if resp.status_code == 200:
                logger.info(f"Successfully registered with coordinator at {self.base_url}")
                return True
            else:
                logger.warning(f"Registration returned status {resp.status_code}: {resp.text}")
                return False
        except Exception as e:
            logger.warning(f"Could not connect to coordinator at {self.base_url}: {e}")
            return False

    def heartbeat(self, host_id: str) -> bool:
        try:
            url = f"{self.base_url}/api/v1/agents/{host_id}/heartbeat"
            resp = self.client.post(url)
            return resp.status_code == 200
        except Exception as e:
            logger.debug(f"Heartbeat failed: {e}")
            return False

    def send_metrics(self, payload: Dict[str, Any]) -> bool:
        try:
            url = f"{self.base_url}/api/v1/ingest/metrics"
            resp = self.client.post(url, json=payload)
            return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Failed to post metric batch: {e}")
            return False

    def send_events(self, payload: Dict[str, Any]) -> bool:
        try:
            url = f"{self.base_url}/api/v1/ingest/events"
            resp = self.client.post(url, json=payload)
            return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Failed to post events batch: {e}")
            return False
