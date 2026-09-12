import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from backend.database import get_db
from backend.models import Host, Volume, MetricSample, ProcessEvent, Alert, utc_now
from backend.schemas import HostDetailResponse, VolumeSummary, AlertSummary, MetricPoint

router = APIRouter(prefix="/api/v1/hosts", tags=["hosts"])

@router.get("", response_model=List[Dict[str, Any]])
def list_hosts(db: Session = Depends(get_db)):
    hosts = db.query(Host).all()
    result = []
    for h in hosts:
        latest = db.query(MetricSample).filter(
            MetricSample.host_id == h.id
        ).order_by(desc(MetricSample.timestamp)).first()
        result.append({
            "id": h.id,
            "hostname": h.hostname,
            "os_version": h.os_version,
            "agent_version": h.agent_version,
            "status": h.status,
            "last_seen": h.last_seen,
            "volume_count": len(h.volumes),
            "current_write_bps": latest.write_bps if latest else 0.0,
            "current_read_bps": latest.read_bps if latest else 0.0,
        })
    return result


@router.get("/{host_id}", response_model=HostDetailResponse)
def get_host_detail(host_id: str, db: Session = Depends(get_db)):
    host = db.query(Host).filter(Host.id == host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    # Volumes summary
    volume_summaries = []
    for v in host.volumes:
        latest_vol_sample = db.query(MetricSample).filter(
            MetricSample.volume_id == v.id
        ).order_by(desc(MetricSample.timestamp)).first()

        used = latest_vol_sample.used_bytes if latest_vol_sample else 0
        free = latest_vol_sample.free_bytes if latest_vol_sample else 0
        total = v.total_bytes if v.total_bytes > 0 else (used + free)
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
                current_read_bps=latest_vol_sample.read_bps if latest_vol_sample else 0.0,
                current_write_bps=latest_vol_sample.write_bps if latest_vol_sample else 0.0,
            )
        )

    # Alerts for this host
    alerts_query = db.query(Alert).filter(Alert.host_id == host.id).order_by(desc(Alert.opened_at)).limit(15).all()
    alert_summaries = []
    for a in alerts_query:
        evidence = {}
        try:
            evidence = json.loads(a.evidence_json)
        except Exception:
            evidence = {}
        alert_summaries.append(
            AlertSummary(
                id=a.id,
                host_id=a.host_id,
                hostname=host.hostname,
                volume_id=a.volume_id,
                volume_mount=evidence.get("volume_mount"),
                type=a.type,
                severity=a.severity,
                status=a.status,
                opened_at=a.opened_at,
                closed_at=a.closed_at,
                message=evidence.get("message", f"{a.type} alert"),
                evidence=evidence,
            )
        )

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
        }
        for e in events_query
    ]

    return HostDetailResponse(
        id=host.id,
        hostname=host.hostname,
        os_version=host.os_version,
        agent_version=host.agent_version,
        status=host.status,
        last_seen=host.last_seen,
        volumes=volume_summaries,
        recent_alerts=alert_summaries,
        recent_events=events_list,
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
