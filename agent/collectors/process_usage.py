import os
import psutil
import subprocess
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

def collect_active_processes(elevated: bool = False) -> List[Dict[str, Any]]:
    """
    Collect processes engaged in filesystem/IO activity.
    If elevated is True and sudo/fs_usage is available, sample recent filesystem writes.
    Otherwise, inspect user processes via psutil.
    """
    events: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    # 1. If elevated mode is enabled, attempt short fs_usage sample
    if elevated and os.geteuid() == 0:
        try:
            # Run fs_usage for 1 second looking for filesystem write activity
            cmd = ["fs_usage", "-w", "-t", "1", "-f", "filesys"]
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            stdout, _ = proc.communicate(timeout=2)
            
            # Parse top write events
            for line in stdout.splitlines():
                if "WrData" in line or "Write" in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        p_name = parts[-1]
                        events.append({
                            "process": p_name,
                            "pid": None,
                            "user": "root/elevated",
                            "operation": "write",
                            "bytes": None,
                            "timestamp": now.isoformat(),
                        })
                        if len(events) >= 5:
                            break
            if events:
                return events
        except Exception:
            pass

    # 2. Standard mode: inspect running processes with top IO or memory activity
    try:
        candidates = []
        for p in psutil.process_iter(['pid', 'name', 'username']):
            try:
                # Some processes disallow access to io_counters without privileges
                io = p.io_counters() if hasattr(p, 'io_counters') else None
                if io and (io.write_bytes > 0 or io.read_bytes > 0):
                    candidates.append({
                        "process": p.info['name'],
                        "pid": p.info['pid'],
                        "user": p.info['username'],
                        "operation": "io_active",
                        "bytes": io.write_bytes,
                        "timestamp": now.isoformat(),
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        # Sort candidates by write bytes descending
        candidates.sort(key=lambda x: x.get("bytes", 0), reverse=True)
        return candidates[:5]
    except Exception:
        return []
