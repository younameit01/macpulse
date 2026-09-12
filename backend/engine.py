import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from backend.models import Host, Volume, MetricSample, ProcessEvent, Alert, utc_now
from backend.config import (
    CAPACITY_WARNING_PCT,
    CAPACITY_CRITICAL_PCT,
    ABNORMAL_WRITE_MULTIPLIER,
    ABNORMAL_WRITE_MIN_BPS,
    MACAI_HEARTBEAT_TIMEOUT_SECONDS,
)

ALERT_COOLDOWN_SECONDS = 60

def evaluate_capacity_rules(
    db: Session,
    host: Host,
    volume: Volume,
    used_bytes: int,
    total_bytes: int,
):
    if total_bytes <= 0:
        return

    used_pct = (used_bytes / total_bytes) * 100.0
    now = utc_now()

    if used_pct >= CAPACITY_CRITICAL_PCT:
        alert_type = "capacity_critical"
        severity = "critical"
        message = f"Critical storage utilization on {volume.mount_path}: {used_pct:.1f}% used"
    elif used_pct >= CAPACITY_WARNING_PCT:
        alert_type = "capacity_warning"
        severity = "warning"
        message = f"High storage utilization on {volume.mount_path}: {used_pct:.1f}% used"
    else:
        # Auto-resolve any existing open capacity alert for this volume if it dropped below threshold
        open_alerts = db.query(Alert).filter(
            Alert.host_id == host.id,
            Alert.volume_id == volume.id,
            Alert.type.in_(["capacity_warning", "capacity_critical"]),
            Alert.status == "open",
        ).all()
        for a in open_alerts:
            a.status = "closed"
            a.closed_at = now
        return

    # Check for deduplication / cooldown
    existing_alert = db.query(Alert).filter(
        Alert.host_id == host.id,
        Alert.volume_id == volume.id,
        Alert.type == alert_type,
        Alert.status == "open",
    ).order_by(desc(Alert.opened_at)).first()

    evidence = {
        "host_id": host.id,
        "hostname": host.hostname,
        "volume_mount": volume.mount_path,
        "fs_type": volume.fs_type,
        "used_bytes": used_bytes,
        "total_bytes": total_bytes,
        "used_pct": round(used_pct, 2),
        "threshold_pct": CAPACITY_CRITICAL_PCT if severity == "critical" else CAPACITY_WARNING_PCT,
        "rule": f"used_pct >= {CAPACITY_CRITICAL_PCT if severity == 'critical' else CAPACITY_WARNING_PCT}%",
        "message": message,
    }

    if existing_alert:
        existing_alert.evidence_json = json.dumps(evidence)
    else:
        new_alert = Alert(
            host_id=host.id,
            volume_id=volume.id,
            type=alert_type,
            severity=severity,
            status="open",
            opened_at=now,
            evidence_json=json.dumps(evidence),
        )
        db.add(new_alert)


def evaluate_abnormal_write_rules(
    db: Session,
    host: Host,
    volume: Optional[Volume],
    current_write_bps: float,
):
    if current_write_bps < ABNORMAL_WRITE_MIN_BPS:
        return

    now = utc_now()
    cutoff = now - timedelta(seconds=60)

    # Query recent samples for this host to compute rolling baseline
    recent_query = db.query(MetricSample.write_bps).filter(
        MetricSample.host_id == host.id,
        MetricSample.timestamp >= cutoff,
    )
    if volume:
        recent_query = recent_query.filter(MetricSample.volume_id == volume.id)

    samples = recent_query.limit(20).all()
    if not samples or len(samples) < 3:
        # Not enough history to establish baseline yet
        return

    write_rates = [s[0] for s in samples[:-1]]  # exclude current sample
    if not write_rates:
        return
    baseline_write_bps = sum(write_rates) / len(write_rates)
    
    # Avoid zero-division: minimum baseline floor is 512 KB/s
    effective_baseline = max(baseline_write_bps, 512 * 1024)

    ratio = current_write_bps / effective_baseline
    if ratio >= ABNORMAL_WRITE_MULTIPLIER and current_write_bps >= ABNORMAL_WRITE_MIN_BPS:
        severity = "critical" if (ratio >= 5.0 or current_write_bps >= 50 * 1024 * 1024) else "warning"
        
        # Check latest process attribution event within last 30s
        recent_event = db.query(ProcessEvent).filter(
            ProcessEvent.host_id == host.id,
            ProcessEvent.timestamp >= now - timedelta(seconds=30),
        ).order_by(desc(ProcessEvent.timestamp)).first()

        evidence = {
            "host_id": host.id,
            "hostname": host.hostname,
            "volume_mount": volume.mount_path if volume else "Aggregate/System",
            "current_write_bps": current_write_bps,
            "baseline_write_bps": baseline_write_bps,
            "spike_multiplier": round(ratio, 1),
            "threshold_multiplier": ABNORMAL_WRITE_MULTIPLIER,
            "rule": f"current_write_bps >= max({ABNORMAL_WRITE_MIN_BPS / (1024*1024):.0f}MB/s, {ABNORMAL_WRITE_MULTIPLIER}x baseline)",
            "process_attribution": {
                "process": recent_event.process if recent_event else "Unavailable",
                "pid": recent_event.pid if recent_event else None,
                "user": recent_event.user if recent_event else None,
                "confidence": "Process observed" if recent_event else "Unavailable",
            },
            "message": f"Abnormal write spike: {current_write_bps / (1024*1024):.1f} MB/s ({ratio:.1f}x baseline {baseline_write_bps / (1024*1024):.1f} MB/s)",
        }

        # Deduplicate alert if one is already open in the last cooldown period
        existing = db.query(Alert).filter(
            Alert.host_id == host.id,
            Alert.type == "abnormal_write",
            Alert.status == "open",
            Alert.opened_at >= now - timedelta(seconds=ALERT_COOLDOWN_SECONDS),
        ).first()

        if existing:
            existing.evidence_json = json.dumps(evidence)
        else:
            alert = Alert(
                host_id=host.id,
                volume_id=volume.id if volume else None,
                type="abnormal_write",
                severity=severity,
                status="open",
                opened_at=now,
                evidence_json=json.dumps(evidence),
            )
            db.add(alert)


def check_agent_liveness(db: Session):
    now = utc_now()
    threshold = now - timedelta(seconds=MACAI_HEARTBEAT_TIMEOUT_SECONDS)

    hosts = db.query(Host).all()
    for host in hosts:
        # Convert naive datetime or ensure timezone-aware comparison
        last_seen = host.last_seen
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)

        if last_seen < threshold:
            if host.status != "offline":
                host.status = "offline"
                evidence = {
                    "host_id": host.id,
                    "hostname": host.hostname,
                    "last_seen": host.last_seen.isoformat(),
                    "timeout_seconds": MACAI_HEARTBEAT_TIMEOUT_SECONDS,
                    "rule": f"no heartbeat for > {MACAI_HEARTBEAT_TIMEOUT_SECONDS}s",
                    "message": f"Agent {host.hostname} stopped reporting heartbeats.",
                }
                alert = Alert(
                    host_id=host.id,
                    type="agent_offline",
                    severity="warning",
                    status="open",
                    opened_at=now,
                    evidence_json=json.dumps(evidence),
                )
                db.add(alert)
        else:
            if host.status == "offline":
                host.status = "online"
                # Close open agent_offline alert
                open_alert = db.query(Alert).filter(
                    Alert.host_id == host.id,
                    Alert.type == "agent_offline",
                    Alert.status == "open",
                ).first()
                if open_alert:
                    open_alert.status = "closed"
                    open_alert.closed_at = now
