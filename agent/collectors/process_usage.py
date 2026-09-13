import os
import psutil
import subprocess
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

def collect_active_processes(elevated: bool = False) -> List[Dict[str, Any]]:
    """
    Collect processes engaged in filesystem/IO activity.
    If elevated is True and sudo/fs_usage is available, sample recent filesystem writes.
    Otherwise, inspect running processes via psutil with macOS fallback (memory RSS, CPU %, open files).
    """
    events: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    # 1. If elevated mode is enabled, attempt short fs_usage sample (macOS root)
    if elevated and os.geteuid() == 0:
        try:
            cmd = ["fs_usage", "-w", "-t", "1", "-f", "filesys"]
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            stdout, _ = proc.communicate(timeout=2)
            
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
                            "volume_mount": None,
                            "timestamp": now.isoformat(),
                        })
                        if len(events) >= 5:
                            break
            if events:
                return events
        except Exception:
            pass

    # 2. Standard mode: inspect running processes via psutil
    try:
        candidates = []
        for p in psutil.process_iter(['pid', 'name', 'username']):
            try:
                p_name = p.info.get('name')
                if not p_name or p_name in ('kernel_task',):
                    continue

                # 2a. Platform with io_counters support (Linux / Windows)
                if hasattr(p, 'io_counters'):
                    try:
                        io = p.io_counters()
                        if io and (io.write_bytes > 0 or io.read_bytes > 0):
                            candidates.append({
                                "process": p_name,
                                "pid": p.info.get('pid'),
                                "user": p.info.get('username'),
                                "operation": "io_active",
                                "bytes": io.write_bytes,
                                "volume_mount": None,
                                "timestamp": now.isoformat(),
                                "score": io.write_bytes,
                            })
                            continue
                    except Exception:
                        pass

                # 2b. macOS fallback: sample memory RSS, CPU %, and open file handles
                try:
                    mem = p.memory_info().rss
                except Exception:
                    mem = 0

                try:
                    cpu = p.cpu_percent(interval=None)
                except Exception:
                    cpu = 0.0

                open_files = []
                vol_mount = None
                try:
                    fls = p.open_files()
                    if fls:
                        open_files = [f.path for f in fls[:10]]
                        for fpath in open_files:
                            if fpath.startswith('/Volumes/'):
                                parts = fpath.split('/')
                                if len(parts) >= 3:
                                    vol_mount = f'/Volumes/{parts[2]}'
                                    break
                            elif fpath.startswith('/tmp/') or fpath.startswith('/private/tmp/'):
                                vol_mount = '/'
                                break
                except Exception:
                    pass

                file_count = len(open_files)
                # Filter to processes with meaningful footprint or activity
                if cpu > 0.5 or file_count > 0 or mem > 30 * 1024 * 1024:
                    if file_count > 0:
                        op = "file_io"
                    elif cpu > 2.0:
                        op = "cpu_active"
                    else:
                        op = "active"

                    # Score prioritizes active file handles, CPU load, and memory RSS
                    score = (cpu * 1_000_000) + (file_count * 500_000) + (mem / 1024)
                    candidates.append({
                        "process": p_name,
                        "pid": p.info.get('pid'),
                        "user": p.info.get('username'),
                        "operation": op,
                        "bytes": mem,
                        "volume_mount": vol_mount,
                        "timestamp": now.isoformat(),
                        "score": score,
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        # Sort candidates by activity score descending
        candidates.sort(key=lambda x: x.get("score", 0), reverse=True)
        return [{k: v for k, v in c.items() if k != "score"} for c in candidates[:8]]
    except Exception:
        return []
