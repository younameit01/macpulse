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

def get_apfs_container_stats() -> Dict[str, Dict[str, Any]]:
    """
    Parses native macOS 'diskutil apfs list' to discover all APFS containers and accurately
    calculate total used space by summing all internal volumes (Data, System, VM, Preboot, Recovery).
    Returns mapping from mount point and device node to container storage metrics.
    """
    try:
        out = subprocess.check_output(["diskutil", "apfs", "list"], text=True, stderr=subprocess.DEVNULL)
    except Exception:
        return {}

    containers = {}
    current_container_id = None
    lines = out.splitlines()

    i = 0
    while i < len(lines):
        line = lines[i]
        c_match = re.search(r"Container\s+(disk\d+)", line)
        if c_match and ("APFS Container Reference" in line or "+-- Container" in line):
            current_container_id = c_match.group(1)
            if current_container_id not in containers:
                containers[current_container_id] = {
                    "container_id": current_container_id,
                    "capacity_ceiling": 0,
                    "capacity_in_use": 0,
                    "capacity_free": 0,
                    "volumes": [],
                }
            i += 1
            continue

        if current_container_id:
            c_data = containers[current_container_id]
            ceil_m = re.search(r"Size \(Capacity Ceiling\):\s+(\d+)\s+B", line)
            if ceil_m:
                c_data["capacity_ceiling"] = int(ceil_m.group(1))

            use_m = re.search(r"Capacity In Use By Volumes:\s+(\d+)\s+B", line)
            if use_m:
                c_data["capacity_in_use"] = int(use_m.group(1))

            free_m = re.search(r"Capacity Not Allocated:\s+(\d+)\s+B", line)
            if free_m:
                c_data["capacity_free"] = int(free_m.group(1))

            v_match = re.search(r"APFS Volume Disk \(Role\):\s+(disk\w+)\s+\((.+?)\)", line)
            if v_match:
                v_disk = v_match.group(1)
                v_role = v_match.group(2)
                vol_info = {
                    "disk": v_disk,
                    "role": v_role,
                    "name": "",
                    "mount": "",
                    "consumed_bytes": 0,
                }
                j = i + 1
                while j < len(lines) and not re.search(r"APFS Volume Disk \(Role\):", lines[j]) and not re.search(r"\+-- Container", lines[j]):
                    nm = re.search(r"Name:\s+(.+?)(?:\s+\(|$)", lines[j])
                    if nm and not vol_info["name"]:
                        vol_info["name"] = nm.group(1).strip()
                    mm = re.search(r"(?:Snapshot )?Mount Point:\s+(.+)", lines[j])
                    if mm and not vol_info["mount"]:
                        mp = mm.group(1).strip()
                        if mp != "Not Mounted":
                            vol_info["mount"] = mp
                    cm = re.search(r"Capacity Consumed:\s+(\d+)\s+B", lines[j])
                    if cm and vol_info["consumed_bytes"] == 0:
                        vol_info["consumed_bytes"] = int(cm.group(1))
                    j += 1
                c_data["volumes"].append(vol_info)

        i += 1

    mount_map = {}
    for c_id, c in containers.items():
        total = c["capacity_ceiling"]
        sum_consumed = sum(v["consumed_bytes"] for v in c["volumes"])
        used = c["capacity_in_use"] if c["capacity_in_use"] > 0 else sum_consumed
        free = c["capacity_free"] if c["capacity_free"] > 0 else (total - used if total > used else 0)

        # Build detailed multi-volume breakdown
        breakdown = {
            "data_bytes": sum(v["consumed_bytes"] for v in c["volumes"] if v.get("role") == "Data"),
            "system_bytes": sum(v["consumed_bytes"] for v in c["volumes"] if v.get("role") == "System"),
            "vm_bytes": sum(v["consumed_bytes"] for v in c["volumes"] if v.get("role") == "VM"),
            "preboot_bytes": sum(v["consumed_bytes"] for v in c["volumes"] if v.get("role") == "Preboot"),
            "recovery_bytes": sum(v["consumed_bytes"] for v in c["volumes"] if v.get("role") == "Recovery"),
        }
        known_sum = sum(breakdown.values())
        breakdown["other_volumes_bytes"] = max(0, used - known_sum)

        for v in c["volumes"]:
            entry = {
                "container_id": c_id,
                "total_bytes": total,
                "used_bytes": used,
                "free_bytes": free,
                "volume_consumed_bytes": v["consumed_bytes"],
                "breakdown": breakdown,
                "all_volumes": c["volumes"],
            }
            if v["mount"]:
                mount_map[v["mount"]] = entry
            mount_map[f"/dev/{v['disk']}"] = entry

    return mount_map

def discover_mounts() -> List[Dict[str, Any]]:
    """
    Discover active filesystems on macOS and their storage capacity.
    Distinguishes APFS, NFS, and other local/remote filesystems.
    """
    results = []
    seen_paths = set()
    disk_image_mounts = get_disk_image_mounts()
    apfs_stats = get_apfs_container_stats()

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
        breakdown = None

        # Query native APFS container metrics to sum all internal volumes (System, Data, VM, Preboot, Recovery)
        if mount_path in apfs_stats or source in apfs_stats:
            c_info = apfs_stats.get(mount_path) or apfs_stats.get(source)
            total_bytes = c_info["total_bytes"]
            used_bytes = c_info["used_bytes"]
            free_bytes = c_info["free_bytes"]
            breakdown = c_info.get("breakdown")
        else:
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
            "breakdown": breakdown,
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
