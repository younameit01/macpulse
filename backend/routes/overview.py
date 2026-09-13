import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime, timedelta, timezone

from backend.database import get_db
from backend.models import Host, Volume, MetricSample, Alert, utc_now
from backend.schemas import OverviewResponse, HostSummary, AlertSummary, ActiveVolumeItem

# (router and get_overview logic continues...)
from backend.engine import check_agent_liveness
from backend.alert_utils import deduplicate_alerts

router = APIRouter(prefix="/api/v1/overview", tags=["overview"])

@router.get("", response_model=OverviewResponse)
def get_overview(db: Session = Depends(get_db)):
    # 1. Evaluate agent liveness
    check_agent_liveness(db)
    db.commit()

    now = utc_now()
    cutoff_active = now - timedelta(seconds=15)

    hosts = db.query(Host).all()
    hosts_total = len(hosts)
    hosts_online = sum(1 for h in hosts if h.status == "online")


    # Evaluate distinct open and acknowledged alerts
    open_alerts_all = db.query(Alert).filter(Alert.status == "open").order_by(desc(Alert.last_seen_at), desc(Alert.opened_at)).all()
    ack_alerts_all = db.query(Alert).filter(Alert.status == "acknowledged").order_by(desc(Alert.acknowledged_at), desc(Alert.last_seen_at)).all()
    distinct_open_summaries = deduplicate_alerts(open_alerts_all)
    distinct_ack_summaries = deduplicate_alerts(ack_alerts_all)
    critical_alerts = sum(1 for s in distinct_open_summaries if s.severity == "critical")
    warning_alerts = sum(1 for s in distinct_open_summaries if s.severity == "warning")

    aggregate_write_bps = 0.0
    aggregate_read_bps = 0.0

    host_summaries = []
    for h in hosts:
        # Get latest metric sample for this host
        latest_sample = db.query(MetricSample).filter(
            MetricSample.host_id == h.id
        ).order_by(desc(MetricSample.timestamp)).first()

        current_write = latest_sample.write_bps if latest_sample else 0.0
        current_read = latest_sample.read_bps if latest_sample else 0.0

        if h.status == "online":
            aggregate_write_bps += current_write
            aggregate_read_bps += current_read

        # Determine hottest volume (by write rate, active alert, or capacity usage)
        hottest_vol = None
        hottest_metric = None

        # Check candidate volumes for this host
        candidate_vols = db.query(Volume).filter(Volume.host_id == h.id).all()
        if candidate_vols:
            best_vol = None
            max_write = 0.0
            max_pct = 0.0
            best_write_vol = None
            best_pct_vol = None

            for v in candidate_vols:
                latest_v_sample = db.query(MetricSample).filter(
                    MetricSample.volume_id == v.id
                ).order_by(desc(MetricSample.timestamp)).first()

                write_rate = latest_v_sample.write_bps if latest_v_sample else 0.0
                if write_rate > max_write:
                    max_write = write_rate
                    best_write_vol = v

                if v.total_bytes > 0:
                    used = latest_v_sample.used_bytes if latest_v_sample else 0
                    pct = (used / v.total_bytes) * 100.0
                    if pct > max_pct:
                        max_pct = pct
                        best_pct_vol = v

            # If any volume has active write rate >= 1 MB/s, it's hottest by I/O write burst
            if max_write >= 1024 * 1024 and best_write_vol:
                hottest_vol = best_write_vol.mount_path
                hottest_metric = f"{max_write / (1024 * 1024):.1f} MB/s write"
            elif max_write >= 50 * 1024 and best_write_vol:
                hottest_vol = best_write_vol.mount_path
                hottest_metric = f"{max_write / 1024:.0f} KB/s write"
            elif best_pct_vol and max_pct >= 80.0:
                hottest_vol = best_pct_vol.mount_path
                hottest_metric = f"{max_pct:.1f}% capacity"
            elif candidate_vols:
                # Default to volume with highest usage or primary data partition
                if best_pct_vol and max_pct > 0:
                    hottest_vol = best_pct_vol.mount_path
                    hottest_metric = f"{max_pct:.1f}% capacity"
                else:
                    primary = next((cv for cv in candidate_vols if "Data" in cv.mount_path), candidate_vols[0])
                    hottest_vol = primary.mount_path
                    hottest_metric = "Idle"

        # Check for open capacity alert or latest alert
        latest_alert = db.query(Alert).filter(
            Alert.host_id == h.id, Alert.status == "open"
        ).order_by(desc(Alert.opened_at)).first()

        capacity_alert = db.query(Alert).filter(
            Alert.host_id == h.id,
            Alert.status == "open",
            Alert.type.in_(["capacity_warning", "capacity_critical"])
        ).first()

        h_disk_health = None
        if h.disk_health_json:
            try:
                h_disk_health = json.loads(h.disk_health_json)
            except Exception:
                pass

        h_system_resources = None
        if h.system_resources_json:
            try:
                h_system_resources = json.loads(h.system_resources_json)
            except Exception:
                pass

        has_data_v = any(cv.mount_path == "/System/Volumes/Data" for cv in h.volumes)
        h_active_vol_count = sum(
            1 for cv in h.volumes
            if not (cv.mount_path == "/" and has_data_v)
            and (cv.fs_type or "").lower() not in ("nullfs", "devfs", "autofs", "procfs")
            and "/AppTranslocation/" not in cv.mount_path
            and not cv.mount_path.startswith("/private/var/folders/")
            and not cv.mount_path.startswith("/Volumes/Recovery")
            and not ((cv.fs_type or "").lower() == "hfs" and cv.mount_path.startswith("/Volumes/"))
        )

        # Calculate accurate host-level storage used and total
        h_storage_total = 0
        h_storage_used = 0
        for cv in h.volumes:
            if cv.mount_path == "/" and has_data_v:
                continue
            fs_lower = (cv.fs_type or "").lower()
            if fs_lower in ("nullfs", "devfs", "autofs", "procfs"):
                continue
            if "/AppTranslocation/" in cv.mount_path or cv.mount_path.startswith("/private/var/folders/"):
                continue
            if cv.mount_path.startswith("/Volumes/Recovery"):
                continue
            if fs_lower == "hfs" and cv.mount_path.startswith("/Volumes/"):
                continue

            l_sample = db.query(MetricSample).filter(
                MetricSample.volume_id == cv.id
            ).order_by(desc(MetricSample.timestamp)).first()

            v_used = l_sample.used_bytes if l_sample else 0
            v_free = l_sample.free_bytes if l_sample else 0
            v_tot = cv.total_bytes or 0
            if "apfs" in fs_lower and v_tot > v_free and (v_tot - v_free) > v_used:
                v_used = v_tot - v_free

            h_storage_total += v_tot
            h_storage_used += v_used

        h_storage_pct = round((h_storage_used / h_storage_total * 100.0), 1) if h_storage_total > 0 else 0.0

        host_summaries.append(
            HostSummary(
                id=h.id,
                hostname=h.hostname,
                os_version=h.os_version,
                agent_version=h.agent_version,
                status=h.status,
                last_seen=h.last_seen,
                volume_count=h_active_vol_count,
                current_write_bps=current_write,
                current_read_bps=current_read,
                hottest_volume=hottest_vol,
                hottest_volume_metric=hottest_metric,
                capacity_warning=capacity_alert is not None,
                latest_alert=latest_alert.type if latest_alert else None,
                disk_health=h_disk_health,
                system_resources=h_system_resources,
                storage_total_bytes=h_storage_total,
                storage_used_bytes=h_storage_used,
                storage_used_pct=h_storage_pct,
            )
        )

    # Recent alerts: distinct open alerts guaranteed first, followed by acknowledged, followed by distinct recent closed alerts
    top_open = distinct_open_summaries[:15]
    top_ack = distinct_ack_summaries[:15]
    closed_limit = max(0, 35 - len(top_open) - len(top_ack))
    closed_alerts_raw = db.query(Alert).filter(Alert.status == "closed").order_by(desc(Alert.closed_at)).limit(50).all() if closed_limit > 0 else []
    distinct_closed_summaries = deduplicate_alerts(closed_alerts_raw)[:closed_limit]
    recent_alert_summaries = top_open + top_ack + distinct_closed_summaries

    # Volume breakdown and fleet storage capacity
    all_volumes = db.query(Volume).all()
    total_storage = 0
    used_storage = 0
    apfs_count = 0
    nfs_count = 0
    active_vol_items = []

    # Map host names and identify online hosts
    host_map = {h.id: h.hostname for h in hosts}
    online_host_ids = {h.id for h in hosts if h.status == "online"}

    now_naive = now.replace(tzinfo=None)
    vol_cutoff = now_naive - timedelta(minutes=5)

    # Filter for valid, currently active storage partitions:
    # 1. Belonging to online hosts (or all hosts if no hosts are online yet)
    # 2. Reported within active heartbeat window
    # 3. Exclude pseudo-filesystems (nullfs), sandboxes (AppTranslocation), Recovery, and read-only DMG installers
    valid_active_volumes = []
    for v in all_volumes:
        if online_host_ids and v.host_id not in online_host_ids:
            continue

        vl = v.last_seen.replace(tzinfo=None) if v.last_seen else None
        if online_host_ids and vl and vl < vol_cutoff:
            continue

        fs = (v.fs_type or "").lower()
        if fs in ("nullfs", "devfs", "autofs", "procfs"):
            continue
        if "/AppTranslocation/" in v.mount_path or v.mount_path.startswith("/private/var/folders/"):
            continue
        if v.mount_path == "/Volumes/Recovery" or v.mount_path.startswith("/Volumes/Recovery/"):
            continue
        if fs == "hfs" and v.mount_path.startswith("/Volumes/"):
            continue

        valid_active_volumes.append(v)

    # Track hosts that have /System/Volumes/Data so we avoid double-counting APFS container storage with root /
    hosts_with_data_partition = {
        v.host_id for v in valid_active_volumes if v.mount_path == "/System/Volumes/Data"
    }

    # Deduplicate APFS container entries: On macOS, / and /System/Volumes/Data share the exact
    # same physical container. /System/Volumes/Data contains all user data, applications, and writes.
    # We exclude the read-only / system snapshot so users see their single physical drive.
    active_storage_volumes = [
        v for v in valid_active_volumes
        if not (v.mount_path == "/" and v.host_id in hosts_with_data_partition)
    ]
    volumes_monitored = len(active_storage_volumes)

    for v in valid_active_volumes:
        fs = (v.fs_type or "").lower()

        latest_sample = db.query(MetricSample).filter(
            MetricSample.volume_id == v.id
        ).order_by(desc(MetricSample.timestamp)).first()

        used = latest_sample.used_bytes if latest_sample else 0
        free = latest_sample.free_bytes if latest_sample else 0
        total = v.total_bytes or 0
        breakdown = None

        if "apfs" in fs:
            root_vol = next((sv for sv in all_volumes if sv.host_id == v.host_id and sv.mount_path == "/" and sv.id != v.id), None)
            root_sample = db.query(MetricSample).filter(
                MetricSample.volume_id == root_vol.id
            ).order_by(desc(MetricSample.timestamp)).first() if root_vol else None

            system_used = root_sample.used_bytes if root_sample else 0
            data_used = used

            if total > free and (total - free) > used:
                total_used = total - free
                other_used = max(0, total_used - data_used - system_used)
                used = total_used
                breakdown = {
                    "data_bytes": data_used,
                    "system_bytes": system_used,
                    "other_volumes_bytes": other_used,
                }
            else:
                breakdown = {
                    "data_bytes": data_used,
                    "system_bytes": system_used,
                    "other_volumes_bytes": max(0, used - data_used - system_used),
                }

        pct = round((used / total * 100.0), 1) if total > 0 else 0.0

        # Avoid double-counting APFS container total between / and /System/Volumes/Data:
        # If /System/Volumes/Data is present, it accurately represents user data usage & capacity
        if v.mount_path == "/" and v.host_id in hosts_with_data_partition:
            pass  # Container pool already accounted for by /System/Volumes/Data
        else:
            total_storage += total
            used_storage += used
            if "apfs" in fs:
                apfs_count += 1
            elif "nfs" in fs:
                nfs_count += 1

        # For the Active Volumes card: exclude the read-only root system snapshot if Data partition is present
        if v.mount_path == "/" and v.host_id in hosts_with_data_partition:
            continue

        is_warn = pct >= 80.0
        active_vol_items.append(
            ActiveVolumeItem(
                id=v.id,
                mount_path=v.mount_path,
                fs_type=(v.fs_type or "APFS").upper(),
                host_id=v.host_id,
                hostname=host_map.get(v.host_id, "Mac"),
                total_bytes=total,
                used_bytes=used,
                used_pct=pct,
                is_warning=is_warn,
                warning_label="Warning" if is_warn else None,
                breakdown=breakdown,
            )
        )

    # Sort active volumes:
    # 1. Real storage warnings first (used_pct >= 80)
    # 2. Network NFS shares (crucial for cluster data pipelines)
    # 3. Primary Data partitions before root /
    # 4. Usage percentage descending
    def volume_sort_key(item: ActiveVolumeItem):
        is_warn = 1 if item.is_warning else 0
        is_nfs = 1 if "NFS" in item.fs_type else 0
        is_data = 1 if "Data" in item.mount_path else 0
        return (is_warn, is_nfs, is_data, item.used_pct)

    active_vol_items.sort(key=volume_sort_key, reverse=True)

    storage_pct = round((used_storage / total_storage * 100.0), 1) if total_storage > 0 else 0.0

    return OverviewResponse(
        hosts_online=hosts_online,
        hosts_total=hosts_total,
        volumes_monitored=volumes_monitored,
        critical_alerts=critical_alerts,
        warning_alerts=warning_alerts,
        aggregate_write_bps=aggregate_write_bps,
        aggregate_read_bps=aggregate_read_bps,
        hosts=host_summaries,
        recent_alerts=recent_alert_summaries,
        total_storage_bytes=total_storage,
        used_storage_bytes=used_storage,
        storage_used_pct=storage_pct,
        apfs_volume_count=apfs_count,
        nfs_volume_count=nfs_count,
        active_volumes=active_vol_items,
    )
