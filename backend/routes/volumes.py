import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import timedelta
from typing import List

from backend.database import get_db
from backend.models import Volume, MetricSample, Alert, utc_now
from backend.schemas import VolumeDetailResponse, AlertSummary, MetricPoint
from backend.alert_utils import deduplicate_alerts

router = APIRouter(prefix="/api/v1/volumes", tags=["volumes"])

@router.get("/detail", response_model=VolumeDetailResponse)
def get_volume_detail_query(volume_id: str = Query(...), db: Session = Depends(get_db)):
    return get_volume_detail(volume_id=volume_id, db=db)

@router.get("/detail/metrics", response_model=List[MetricPoint])
def get_volume_metrics_query(
    volume_id: str = Query(...),
    minutes: int = Query(15, ge=1, le=1440),
    db: Session = Depends(get_db),
):
    return get_volume_metrics(volume_id=volume_id, minutes=minutes, db=db)

@router.get("/{volume_id:path}", response_model=VolumeDetailResponse)
def get_volume_detail(volume_id: str, db: Session = Depends(get_db)):
    vol = db.query(Volume).filter(Volume.id == volume_id).first()
    if not vol:
        raise HTTPException(status_code=404, detail="Volume not found")

    latest_sample = db.query(MetricSample).filter(
        MetricSample.volume_id == vol.id
    ).order_by(desc(MetricSample.timestamp)).first()

    used = latest_sample.used_bytes if latest_sample else 0
    free = latest_sample.free_bytes if latest_sample else 0
    total = vol.total_bytes if vol.total_bytes > 0 else (used + free)
    used_pct = round((used / total * 100.0), 1) if total > 0 else 0.0

    nfs_stats = None
    if vol.fs_type.lower() == "nfs" and latest_sample:
        nfs_stats = {
            "nfs_ops_per_sec": latest_sample.nfs_ops_per_sec,
            "nfs_retrans": latest_sample.nfs_retrans,
            "server_export": vol.source,
        }

    # Volume alerts
    alerts_query = db.query(Alert).filter(Alert.volume_id == vol.id).order_by(desc(Alert.last_seen_at), desc(Alert.opened_at)).limit(30).all()
    alert_summaries = deduplicate_alerts(alerts_query)

    return VolumeDetailResponse(
        id=vol.id,
        host_id=vol.host_id,
        hostname=vol.host.hostname if vol.host else vol.host_id,
        source=vol.source,
        mount_path=vol.mount_path,
        fs_type=vol.fs_type,
        total_bytes=total,
        used_bytes=used,
        free_bytes=free,
        used_pct=used_pct,
        current_read_bps=latest_sample.read_bps if latest_sample else 0.0,
        current_write_bps=latest_sample.write_bps if latest_sample else 0.0,
        nfs_stats=nfs_stats,
        alerts=alert_summaries,
    )


@router.get("/{volume_id}/metrics", response_model=List[MetricPoint])
def get_volume_metrics(
    volume_id: str,
    minutes: int = Query(15, ge=1, le=1440),
    db: Session = Depends(get_db),
):
    vol = db.query(Volume).filter(Volume.id == volume_id).first()
    if not vol:
        raise HTTPException(status_code=404, detail="Volume not found")

    cutoff = utc_now() - timedelta(minutes=minutes)
    samples = db.query(MetricSample).filter(
        MetricSample.volume_id == volume_id,
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
