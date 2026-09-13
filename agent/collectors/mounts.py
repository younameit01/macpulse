import re
import os
import subprocess
import shutil
import psutil
import plistlib
from typing import List, Dict, Any, Set

# Regex to parse macOS 'mount' command lines:
# e.g.: /dev/disk3s1s1 on / (apfs, sealed, local, read-only, journaled)
# or: 192.168.1.10:/shared on /Volumes/nfs_test (nfs, nodev, nosuid)
MOUNT_PATTERN = re.compile(r"^(.+?)\s+on\s+(.+?)\s+\((.+?)\)$")

# Filesystem types to ignore (virtual or pseudo filesystems)
IGNORED_FS_TYPES = {"devfs", "autofs", "procfs", "nullfs"}

def get_disk_image_mounts() -> Set[str]:
    """Identify mounted disk images (.dmg) so temporary installer images are not treated as active storage."""
    mounts = set()
    try:
        out = subprocess.check_output(["hdiutil", "info", "-plist"], text=True, stderr=subprocess.DEVNULL)
        pl = plistlib.loads(out.encode("utf-8"))
        for img in pl.get("images", []):
            for ent in img.get("system-entities", []):
                mp = ent.get("mount-point")
                if mp:
                    mounts.add(mp)
    except Exception:
        pass
    return mounts

def discover_mounts() -> List[Dict[str, Any]]:
    """
    Discover active filesystems on macOS and their storage capacity.
    Distinguishes APFS, NFS, and other local/remote filesystems.
    """
    results = []
    seen_paths = set()
    disk_image_mounts = get_disk_image_mounts()

    try:
        cmd = ["mount"]
        output = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
        lines = output.strip().splitlines()
    except Exception:
        lines = []

    for line in lines:
        match = MOUNT_PATTERN.match(line.strip())
        if not match:
            continue

        source = match.group(1).strip()
        mount_path = match.group(2).strip()
        options_str = match.group(3).strip()

        # Split options to find the primary filesystem type
        options = [opt.strip().lower() for opt in options_str.split(",")]
        fs_type = options[0] if options else "unknown"

        if fs_type in IGNORED_FS_TYPES:
            continue

        # Skip duplicate mount paths
        if mount_path in seen_paths:
            continue
        seen_paths.add(mount_path)

        # Ignore mounted disk images identified via hdiutil (.dmg installers)
        if mount_path in disk_image_mounts:
            continue

        # Ignore macOS AppTranslocation sandboxes and private temp folders
        if "/AppTranslocation/" in mount_path or mount_path.startswith("/private/var/folders/"):
            continue

        # Ignore internal macOS virtual partitions unless they are primary data or volumes
        if mount_path.startswith("/System/Volumes/") and mount_path not in ("/System/Volumes/Data",):
            continue

        # Ignore internal Apple Recovery partitions
        if mount_path == "/Volumes/Recovery" or mount_path.startswith("/Volumes/Recovery/"):
            continue

        # Ignore read-only DMG disk images mounted under /Volumes/
        if mount_path.startswith("/Volumes/") and "read-only" in options and fs_type in ("hfs", "apfs", "udif"):
            continue

        total_bytes = 0
        used_bytes = 0
        free_bytes = 0

        try:
            usage = psutil.disk_usage(mount_path)
            total_bytes = usage.total
            used_bytes = usage.used
            free_bytes = usage.free
        except Exception:
            try:
                stat = os.statvfs(mount_path)
                total_bytes = stat.f_blocks * stat.f_frsize
                free_bytes = stat.f_bavail * stat.f_frsize
                used_bytes = total_bytes - free_bytes
            except Exception:
                pass

        results.append({
            "source": source,
            "mount_path": mount_path,
            "fs_type": fs_type,
            "total_bytes": total_bytes,
            "used_bytes": used_bytes,
            "free_bytes": free_bytes,
        })

    # Fallback to psutil.disk_partitions if mount parsing returned nothing
    if not results:
        for part in psutil.disk_partitions(all=False):
            if part.fstype in IGNORED_FS_TYPES:
                continue
            if part.mountpoint in disk_image_mounts:
                continue
            if "/AppTranslocation/" in part.mountpoint or part.mountpoint.startswith("/private/var/folders/"):
                continue
            if part.mountpoint.startswith("/System/Volumes/") and part.mountpoint not in ("/System/Volumes/Data",):
                continue
            if part.mountpoint == "/Volumes/Recovery" or part.mountpoint.startswith("/Volumes/Recovery/"):
                continue
            try:
                u = psutil.disk_usage(part.mountpoint)
                results.append({
                    "source": part.device,
                    "mount_path": part.mountpoint,
                    "fs_type": part.fstype,
                    "total_bytes": u.total,
                    "used_bytes": u.used,
                    "free_bytes": u.free,
                })
            except Exception:
                pass

    return results
