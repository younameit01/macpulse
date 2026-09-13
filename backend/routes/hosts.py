import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from backend.database import get_db
from backend.models import Host, Volume, MetricSample, ProcessEvent, Alert, utc_now
from backend.schemas import HostDetailResponse, VolumeSummary, AlertSummary, MetricPoint
from backend.alert_utils import deduplicate_alerts

router = APIRouter(prefix="/api/v1/hosts", tags=["hosts"])

def compute_host_storage(host: Host, db: Session):
    """
    Computes accurate host-level total storage, used storage, and percentage
    by consolidating APFS containers and accounting for all internal volumes.
    """
    has_data_v = any(cv.mount_path == "/System/Volumes/Data" for cv in host.volumes)
    h_storage_total = 0
    h_storage_used = 0

    for cv in host.volumes:
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
    return h_storage_total, h_storage_used, h_storage_pct


@router.get("", response_model=List[Dict[str, Any]])
def list_hosts(db: Session = Depends(get_db)):
    hosts = db.query(Host).all()
    result = []
    for h in hosts:
        latest = db.query(MetricSample).filter(
            MetricSample.host_id == h.id
        ).order_by(desc(MetricSample.timestamp)).first()

        disk_health = None
        if h.disk_health_json:
            try:
                disk_health = json.loads(h.disk_health_json)
            except Exception:
                pass

        system_resources = None
        if h.system_resources_json:
            try:
                system_resources = json.loads(h.system_resources_json)
            except Exception:
                pass

        last_seen_dt = h.last_seen
        if last_seen_dt and last_seen_dt.tzinfo is None:
            last_seen_dt = last_seen_dt.replace(tzinfo=timezone.utc)

        has_data = any(v.mount_path == "/System/Volumes/Data" for v in h.volumes)
        active_count = sum(
            1 for v in h.volumes
            if not (v.mount_path == "/" and has_data)
            and (v.fs_type or "").lower() not in ("nullfs", "devfs", "autofs", "procfs")
            and "/AppTranslocation/" not in v.mount_path
            and not v.mount_path.startswith("/private/var/folders/")
            and not v.mount_path.startswith("/Volumes/Recovery")
            and not ((v.fs_type or "").lower() == "hfs" and v.mount_path.startswith("/Volumes/"))
        )

        h_storage_total, h_storage_used, h_storage_pct = compute_host_storage(h, db)

        result.append({
            "id": h.id,
            "hostname": h.hostname,
            "os_version": h.os_version,
            "agent_version": h.agent_version,
            "status": h.status,
            "last_seen": last_seen_dt,
            "volume_count": active_count,
            "current_write_bps": latest.write_bps if latest else 0.0,
            "current_read_bps": latest.read_bps if latest else 0.0,
            "disk_health": disk_health,
            "system_resources": system_resources,
            "storage_total_bytes": h_storage_total,
            "storage_used_bytes": h_storage_used,
            "storage_used_pct": h_storage_pct,
        })
    return result


@router.get("/{host_id}", response_model=HostDetailResponse)
def get_host_detail(host_id: str, db: Session = Depends(get_db)):
    host = db.query(Host).filter(Host.id == host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    # Volumes summary (consolidated to avoid duplicate APFS container pools)
    has_data_vol = any(v.mount_path == "/System/Volumes/Data" for v in host.volumes)
    volume_summaries = []
    for v in host.volumes:
        fs = (v.fs_type or "").lower()
        if fs in ("nullfs", "devfs", "autofs", "procfs"):
            continue
        if "/AppTranslocation/" in v.mount_path or v.mount_path.startswith("/private/var/folders/"):
            continue
        if v.mount_path == "/Volumes/Recovery" or v.mount_path.startswith("/Volumes/Recovery/"):
            continue
        if fs == "hfs" and v.mount_path.startswith("/Volumes/"):
            continue
        if v.mount_path == "/" and has_data_vol:
            continue

        latest_vol_sample = db.query(MetricSample).filter(
            MetricSample.volume_id == v.id
        ).order_by(desc(MetricSample.timestamp)).first()

        used = latest_vol_sample.used_bytes if latest_vol_sample else 0
        free = latest_vol_sample.free_bytes if latest_vol_sample else 0
        total = v.total_bytes if v.total_bytes > 0 else (used + free)
        breakdown = None

        if "apfs" in fs:
            # Multi-volume accounting across the APFS container pool
            root_vol = next((sv for sv in host.volumes if sv.mount_path == "/" and sv.id != v.id), None)
            root_sample = db.query(MetricSample).filter(
                MetricSample.volume_id == root_vol.id
            ).order_by(desc(MetricSample.timestamp)).first() if root_vol else None

            system_used = root_sample.used_bytes if root_sample else 0
            data_used = used

            if total > free and (total - free) > used:
                # Sibling volumes (System, VM, Preboot, Recovery) share this container
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

        used_pct = round((used / total * 100.0), 1) if total > 0 else 0.0

        volume_summaries.append(
            VolumeSummary(
                id=v.id,
                source=v.source,
                mount_path=v.mount_path,
                fs_type=v.fs_type,
                total_bytes=total,
                used_bytes=used,
                free_bytes=free,
                used_pct=used_pct,
                breakdown=breakdown,
                current_read_bps=latest_vol_sample.read_bps if latest_vol_sample else 0.0,
                current_write_bps=latest_vol_sample.write_bps if latest_vol_sample else 0.0,
            )
        )

    # Alerts for this host
    alerts_query = db.query(Alert).filter(Alert.host_id == host.id).order_by(desc(Alert.last_seen_at), desc(Alert.opened_at)).limit(50).all()
    alert_summaries = deduplicate_alerts(alerts_query)

    # Recent process attribution events
    events_query = db.query(ProcessEvent).filter(
        ProcessEvent.host_id == host.id
    ).order_by(desc(ProcessEvent.timestamp)).limit(20).all()
    events_list = [
        {
            "id": e.id,
            "timestamp": e.timestamp,
            "process": e.process,
            "pid": e.pid,
            "user": e.user,
            "operation": e.operation,
            "bytes": e.bytes,
            "volume_id": e.volume_id,
            "volume_mount": e.volume_id.split(":", 1)[1] if (e.volume_id and ":" in e.volume_id) else e.volume_id,
        }
        for e in events_query
    ]

    disk_health = None
    if host.disk_health_json:
        try:
            disk_health = json.loads(host.disk_health_json)
        except Exception:
            pass

    system_resources = None
    if host.system_resources_json:
        try:
            system_resources = json.loads(host.system_resources_json)
        except Exception:
            pass

    last_seen_dt = host.last_seen
    if last_seen_dt and last_seen_dt.tzinfo is None:
        last_seen_dt = last_seen_dt.replace(tzinfo=timezone.utc)

    h_total, h_used, h_pct = compute_host_storage(host, db)

    return HostDetailResponse(
        id=host.id,
        hostname=host.hostname,
        os_version=host.os_version,
        agent_version=host.agent_version,
        status=host.status,
        last_seen=last_seen_dt,
        volumes=volume_summaries,
        recent_alerts=alert_summaries,
        recent_events=events_list,
        disk_health=disk_health,
        system_resources=system_resources,
        storage_total_bytes=h_total,
        storage_used_bytes=h_used,
        storage_used_pct=h_pct,
    )


@router.get("/{host_id}/metrics", response_model=List[MetricPoint])
def get_host_metrics(
    host_id: str,
    minutes: int = Query(15, ge=1, le=1440),
    db: Session = Depends(get_db),
):
    host = db.query(Host).filter(Host.id == host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    cutoff = utc_now() - timedelta(minutes=minutes)
    samples = db.query(MetricSample).filter(
        MetricSample.host_id == host_id,
        MetricSample.timestamp >= cutoff,
    ).order_by(MetricSample.timestamp.asc()).all()

    # Fallback to the latest available samples so host charts are never blank when idle
    if not samples:
        recent = db.query(MetricSample).filter(
            MetricSample.host_id == host_id,
        ).order_by(MetricSample.timestamp.desc()).limit(60).all()
        samples = list(reversed(recent))

    return [
        MetricPoint(
            timestamp=s.timestamp,
            read_bps=s.read_bps,
            write_bps=s.write_bps,
            used_bytes=s.used_bytes,
            free_bytes=s.free_bytes,
        )
        for s in samples
    ]
