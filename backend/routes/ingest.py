from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.database import get_db
from backend.models import Host, Volume, MetricSample, ProcessEvent, utc_now
from backend.schemas import MetricsIngestBatch, EventsIngestBatch
from backend.engine import evaluate_capacity_rules, evaluate_abnormal_write_rules, check_agent_liveness

router = APIRouter(prefix="/api/v1/ingest", tags=["ingest"])

@router.post("/metrics")
def ingest_metrics(batch: MetricsIngestBatch, db: Session = Depends(get_db)):
    host = db.query(Host).filter(Host.id == batch.host_id).first()
    if not host:
        # Auto-create host if not yet registered
        host = Host(
            id=batch.host_id,
            hostname=f"mac-{batch.host_id[:8]}",
            os_version="macOS",
            agent_version="1.0.0",
            last_seen=utc_now(),
            status="online",
        )
        db.add(host)
        db.flush()

    now = batch.timestamp if batch.timestamp else utc_now()
    host.last_seen = now
    host.status = "online"

    # 1. Update/insert volumes
    volume_map: Dict[str, Volume] = {}
    for vol in batch.volumes:
        vol_id = f"{batch.host_id}:{vol.mount_path}"
        existing_vol = db.query(Volume).filter(Volume.id == vol_id).first()
        if existing_vol:
            existing_vol.source = vol.source
            existing_vol.fs_type = vol.fs_type
            existing_vol.total_bytes = vol.total_bytes
            existing_vol.last_seen = now
            volume_map[vol.mount_path] = existing_vol
        else:
            new_vol = Volume(
                id=vol_id,
                host_id=batch.host_id,
                source=vol.source,
                mount_path=vol.mount_path,
                fs_type=vol.fs_type,
                total_bytes=vol.total_bytes,
                last_seen=now,
            )
            db.add(new_vol)
            db.flush()
            volume_map[vol.mount_path] = new_vol

        # Evaluate capacity rules for volume
        evaluate_capacity_rules(db, host, volume_map[vol.mount_path], vol.used_bytes, vol.total_bytes)

    # 2. Insert metric samples
    for sample in batch.samples:
        vol_obj = volume_map.get(sample.volume_mount) if sample.volume_mount else None
        ms = MetricSample(
            host_id=batch.host_id,
            volume_id=vol_obj.id if vol_obj else None,
            timestamp=now,
            used_bytes=sample.used_bytes,
            free_bytes=sample.free_bytes,
            read_bps=sample.read_bps,
            write_bps=sample.write_bps,
            nfs_ops_per_sec=sample.nfs_ops_per_sec,
            nfs_retrans=sample.nfs_retrans,
        )
        db.add(ms)

        # Evaluate abnormal write rules
        evaluate_abnormal_write_rules(db, host, vol_obj, sample.write_bps)

    db.commit()
    return {"status": "ok", "ingested_samples": len(batch.samples), "ingested_volumes": len(batch.volumes)}


@router.post("/events")
def ingest_events(batch: EventsIngestBatch, db: Session = Depends(get_db)):
    host = db.query(Host).filter(Host.id == batch.host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    now = utc_now()
    for ev in batch.events:
        vol_id = f"{batch.host_id}:{ev.volume_mount}" if ev.volume_mount else None
        pe = ProcessEvent(
            host_id=batch.host_id,
            volume_id=vol_id,
            timestamp=ev.timestamp if ev.timestamp else now,
            process=ev.process,
            pid=ev.pid,
            user=ev.user,
            operation=ev.operation,
            bytes=ev.bytes,
        )
        db.add(pe)

    db.commit()
    return {"status": "ok", "ingested_events": len(batch.events)}
