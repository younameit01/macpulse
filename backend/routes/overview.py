import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime, timedelta, timezone

from backend.database import get_db
from backend.models import Host, Volume, MetricSample, Alert, utc_now
from backend.schemas import OverviewResponse, HostSummary, AlertSummary
from backend.engine import check_agent_liveness

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

    volumes_monitored = db.query(Volume).count()

    critical_alerts = db.query(Alert).filter(Alert.status == "open", Alert.severity == "critical").count()
    warning_alerts = db.query(Alert).filter(Alert.status == "open", Alert.severity == "warning").count()

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

        # Determine hottest volume (by write rate or usage)
        hottest_vol = None
        top_vol = db.query(Volume).filter(Volume.host_id == h.id).first()
        if top_vol:
            hottest_vol = top_vol.mount_path

        # Check for open capacity alert or latest alert
        latest_alert = db.query(Alert).filter(
            Alert.host_id == h.id, Alert.status == "open"
        ).order_by(desc(Alert.opened_at)).first()

        capacity_alert = db.query(Alert).filter(
            Alert.host_id == h.id,
            Alert.status == "open",
            Alert.type.in_(["capacity_warning", "capacity_critical"])
        ).first()

        host_summaries.append(
            HostSummary(
                id=h.id,
                hostname=h.hostname,
                os_version=h.os_version,
                agent_version=h.agent_version,
                status=h.status,
                last_seen=h.last_seen,
                volume_count=len(h.volumes),
                current_write_bps=current_write,
                current_read_bps=current_read,
                hottest_volume=hottest_vol,
                capacity_warning=capacity_alert is not None,
                latest_alert=latest_alert.type if latest_alert else None,
            )
        )

    # Recent open and closed alerts
    recent_alerts_query = db.query(Alert).order_by(desc(Alert.opened_at)).limit(10).all()
    recent_alert_summaries = []
    for a in recent_alerts_query:
        evidence = {}
        try:
            evidence = json.loads(a.evidence_json)
        except Exception:
            evidence = {}

        msg = evidence.get("message", f"{a.type} on {a.host.hostname if a.host else a.host_id}")
        recent_alert_summaries.append(
            AlertSummary(
                id=a.id,
                host_id=a.host_id,
                hostname=a.host.hostname if a.host else a.host_id,
                volume_id=a.volume_id,
                volume_mount=evidence.get("volume_mount"),
                type=a.type,
                severity=a.severity,
                status=a.status,
                opened_at=a.opened_at,
                closed_at=a.closed_at,
                message=msg,
                evidence=evidence,
            )
        )

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
    )
