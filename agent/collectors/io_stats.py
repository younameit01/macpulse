import time
import psutil
from typing import Dict, Any, Tuple, Optional

class IOSampler:
    def __init__(self):
        self.last_time: Optional[float] = None
        self.last_read_bytes: int = 0
        self.last_write_bytes: int = 0

    def sample(self) -> Dict[str, float]:
        """
        Sample current aggregate disk read/write throughput in bytes per second.
        """
        now = time.time()
        try:
            counters = psutil.disk_io_counters()
            if not counters:
                return {"read_bps": 0.0, "write_bps": 0.0}
            curr_read = counters.read_bytes
            curr_write = counters.write_bytes
        except Exception:
            return {"read_bps": 0.0, "write_bps": 0.0}

        if self.last_time is None:
            self.last_time = now
            self.last_read_bytes = curr_read
            self.last_write_bytes = curr_write
            return {"read_bps": 0.0, "write_bps": 0.0}

        delta_t = now - self.last_time
        if delta_t <= 0.001:
            return {"read_bps": 0.0, "write_bps": 0.0}

        # Calculate bytes per second
        read_delta = max(0, curr_read - self.last_read_bytes)
        write_delta = max(0, curr_write - self.last_write_bytes)

        read_bps = read_delta / delta_t
        write_bps = write_delta / delta_t

        self.last_time = now
        self.last_read_bytes = curr_read
        self.last_write_bytes = curr_write

        return {
            "read_bps": round(read_bps, 2),
            "write_bps": round(write_bps, 2),
        }
