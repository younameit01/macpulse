import subprocess
import re
from typing import Dict, Any, Optional

RPC_INFO_PATTERN = re.compile(
    r"RPC Info:\s*\n\s*TimedOut\s+Invalid\s+X Replies\s+Retries\s+Requests\s*\n\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)",
    re.MULTILINE
)

def collect_nfs_stats() -> Optional[Dict[str, Any]]:
    """
    Query macOS nfsstat for client RPC statistics.
    Returns retry count, timeouts, and requests.
    Gracefully returns None if NFS client stats are not available.
    """
    try:
        out = subprocess.check_output(["nfsstat", "-c"], text=True, stderr=subprocess.DEVNULL)
    except Exception:
        return None

    match = RPC_INFO_PATTERN.search(out)
    if not match:
        return None

    try:
        timed_out = int(match.group(1))
        invalid = int(match.group(2))
        x_replies = int(match.group(3))
        retries = int(match.group(4))
        requests = int(match.group(5))

        return {
            "timed_out": timed_out,
            "invalid": invalid,
            "x_replies": x_replies,
            "retries": retries,
            "requests": requests,
        }
    except Exception:
        return None
