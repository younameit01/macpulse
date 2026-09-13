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
        return

    # Check for deduplication / cooldown (match active open or acknowledged alert)
    existing_alert = db.query(Alert).filter(
        Alert.host_id == host.id,
        Alert.volume_id == volume.id,
        Alert.type == alert_type,
        Alert.status.in_(["open", "acknowledged"]),
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
        existing_alert.occurrence_count = (existing_alert.occurrence_count or 1) + 1
        existing_alert.last_seen_at = now
        existing_alert.evidence_json = json.dumps(evidence)
    else:
        new_alert = Alert(
            host_id=host.id,
            volume_id=volume.id,
            type=alert_type,
            severity=severity,
            status="open",
            opened_at=now,
            last_seen_at=now,
            occurrence_count=1,
            evidence_json=json.dumps(evidence),
        )
        db.add(new_alert)


def evaluate_abnormal_write_rules(
    db: Session,
    host: Host,
    volume: Optional[Volume],
    current_write_bps: float,
):
    now = utc_now()
    if current_write_bps < ABNORMAL_WRITE_MIN_BPS:
        return

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

        # Deduplicate alert: if one is already active for this host & volume, update it
        existing = db.query(Alert).filter(
            Alert.host_id == host.id,
            Alert.volume_id == (volume.id if volume else None),
            Alert.type == "abnormal_write",
            Alert.status.in_(["open", "acknowledged"]),
        ).order_by(desc(Alert.opened_at)).first()

        if existing:
            existing.occurrence_count = (existing.occurrence_count or 1) + 1
            existing.last_seen_at = now
            existing.severity = severity
            existing.evidence_json = json.dumps(evidence)
        else:
            alert = Alert(
                host_id=host.id,
                volume_id=volume.id if volume else None,
                type="abnormal_write",
                severity=severity,
                status="open",
                opened_at=now,
                last_seen_at=now,
                occurrence_count=1,
                evidence_json=json.dumps(evidence),
            )
            db.add(alert)


def evaluate_nfs_rules(
    db: Session,
    host: Host,
    volume: Volume,
    nfs_ops_per_sec: Optional[float],
    nfs_retrans: Optional[int],
):
    if nfs_retrans is None:
        return

    now = utc_now()
    if nfs_retrans >= 15:
        severity = "critical"
        alert_type = "nfs_retrans_high"
        message = f"Severe NFS RPC retransmissions on {volume.mount_path}: {nfs_retrans} retries (possible network drop or storage bottleneck)"
    elif nfs_retrans >= 5:
        severity = "warning"
        alert_type = "nfs_retrans_high"
        message = f"Elevated NFS RPC retransmissions on {volume.mount_path}: {nfs_retrans} retries"
    else:
        return

    evidence = {
        "host_id": host.id,
        "hostname": host.hostname,
        "volume_mount": volume.mount_path,
        "fs_type": volume.fs_type,
        "server_export": volume.source,
        "nfs_ops_per_sec": nfs_ops_per_sec,
        "nfs_retrans": nfs_retrans,
        "threshold_retrans": 15 if severity == "critical" else 5,
        "rule": f"nfs_retrans >= {15 if severity == 'critical' else 5}",
        "message": message,
    }

    existing = db.query(Alert).filter(
        Alert.host_id == host.id,
        Alert.volume_id == volume.id,
        Alert.type == "nfs_retrans_high",
        Alert.status.in_(["open", "acknowledged"]),
    ).first()

    if existing:
        existing.occurrence_count = (existing.occurrence_count or 1) + 1
        existing.last_seen_at = now
        existing.evidence_json = json.dumps(evidence)
        existing.severity = severity
    else:
        new_alert = Alert(
            host_id=host.id,
            volume_id=volume.id,
            type=alert_type,
            severity=severity,
            status="open",
            opened_at=now,
            last_seen_at=now,
            occurrence_count=1,
            evidence_json=json.dumps(evidence),
        )
        db.add(new_alert)



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
            
            existing_offline = db.query(Alert).filter(
                Alert.host_id == host.id,
                Alert.type == "agent_offline",
                Alert.status.in_(["open", "acknowledged"]),
            ).first()

            if existing_offline:
                existing_offline.occurrence_count = (existing_offline.occurrence_count or 1) + 1
                existing_offline.last_seen_at = now
            else:
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
                    last_seen_at=now,
                    occurrence_count=1,
                    evidence_json=json.dumps(evidence),
                )
                db.add(alert)
        else:
            if host.status == "offline":
                host.status = "online"


def evaluate_hardware_health_rules(
    db: Session,
    host: Host,
    disk_health: Optional[Dict[str, Any]],
):
    if not disk_health:
        return

    now = utc_now()
    alerts_to_evaluate = []

    # 1. S.M.A.R.T. Failure / Degradation Rule
    smart_status = disk_health.get("smart_status")
    if smart_status and smart_status.lower() not in ["verified", "unknown", "unavailable"]:
        alerts_to_evaluate.append({
            "type": "hardware_smart_failure",
            "severity": "critical",
            "rule": "SMARTStatus != Verified",
            "message": f"Hardware S.M.A.R.T. health failure on {host.hostname}: Status '{smart_status}'",
            "evidence": {
                "smart_status": smart_status,
                "bus_protocol": disk_health.get("bus_protocol"),
                "device_node": disk_health.get("device_node"),
            }
        })

    # 2. SSD Endurance Wear Rules (80% warning, 90% critical)
    wear_pct = disk_health.get("ssd_wear_pct")
    if wear_pct is not None:
        if wear_pct >= 90:
            alerts_to_evaluate.append({
                "type": "ssd_wear_critical",
                "severity": "critical",
                "rule": "ssd_wear_pct >= 90%",
                "message": f"Critical SSD endurance degradation on {host.hostname}: {wear_pct:.0f}% lifetime wear used",
                "evidence": {
                    "ssd_wear_pct": wear_pct,
                    "available_spare_pct": disk_health.get("available_spare_pct"),
                    "total_tb_written": disk_health.get("total_tb_written"),
                }
            })
        elif wear_pct >= 80:
            alerts_to_evaluate.append({
                "type": "ssd_wear_warning",
                "severity": "warning",
                "rule": "ssd_wear_pct >= 80%",
                "message": f"Elevated SSD wear on {host.hostname}: {wear_pct:.0f}% lifetime wear used",
                "evidence": {
                    "ssd_wear_pct": wear_pct,
                    "available_spare_pct": disk_health.get("available_spare_pct"),
                    "total_tb_written": disk_health.get("total_tb_written"),
                }
            })

    # 3. NVMe Temperature / Thermal Pressure Rules (65°C warning, 75°C critical)
    temp_c = disk_health.get("temp_celsius")
    if temp_c is not None:
        if temp_c >= 75.0:
            alerts_to_evaluate.append({
                "type": "disk_overheating",
                "severity": "critical",
                "rule": "temp_celsius >= 75°C",
                "message": f"Severe NVMe thermal pressure on {host.hostname}: {temp_c:.1f}°C (risk of thermal throttling)",
                "evidence": {
                    "temp_celsius": temp_c,
                    "bus_protocol": disk_health.get("bus_protocol"),
                    "is_solid_state": disk_health.get("is_solid_state"),
                }
            })
        elif temp_c >= 65.0:
            alerts_to_evaluate.append({
                "type": "disk_temperature_warning",
                "severity": "warning",
                "rule": "temp_celsius >= 65°C",
                "message": f"Elevated NVMe drive temperature on {host.hostname}: {temp_c:.1f}°C",
                "evidence": {
                    "temp_celsius": temp_c,
                    "bus_protocol": disk_health.get("bus_protocol"),
                }
            })

    # 4. Media Flash Errors (Unrecoverable read/write ECC faults)
    media_errors = disk_health.get("media_errors") or 0
    if media_errors >= 10:
        alerts_to_evaluate.append({
            "type": "media_errors_critical",
            "severity": "critical",
            "rule": "media_errors >= 10",
            "message": f"Severe unrecoverable flash media read/write errors on {host.hostname}: {media_errors} errors (risk of data corruption)",
            "evidence": {
                "media_errors": media_errors,
                "power_on_hours": disk_health.get("power_on_hours"),
                "unsafe_shutdowns": disk_health.get("unsafe_shutdowns"),
            }
        })
    elif media_errors > 0:
        alerts_to_evaluate.append({
            "type": "media_errors_detected",
            "severity": "warning",
            "rule": "media_errors > 0",
            "message": f"Unrecoverable flash media read/write errors detected on {host.hostname}: {media_errors} error{'s' if media_errors > 1 else ''}",
            "evidence": {
                "media_errors": media_errors,
                "power_on_hours": disk_health.get("power_on_hours"),
                "unsafe_shutdowns": disk_health.get("unsafe_shutdowns"),
            }
        })

    # 5. NVMe Available Spare Flash Blocks (Reserve block exhaustion)
    spare_pct = disk_health.get("available_spare_pct")
    spare_thresh = disk_health.get("available_spare_threshold_pct") or 20
    if spare_pct is not None:
        if spare_pct <= spare_thresh or spare_pct <= 20:
            alerts_to_evaluate.append({
                "type": "nvme_spare_critical",
                "severity": "critical",
                "rule": f"available_spare_pct <= {spare_thresh}%",
                "message": f"Critical flash reserve block exhaustion on {host.hostname}: {spare_pct}% spare remaining (threshold {spare_thresh}%)",
                "evidence": {
                    "available_spare_pct": spare_pct,
                    "available_spare_threshold_pct": spare_thresh,
                    "ssd_wear_pct": disk_health.get("ssd_wear_pct"),
                }
            })
        elif spare_pct <= 60:
            alerts_to_evaluate.append({
                "type": "nvme_spare_warning",
                "severity": "warning",
                "rule": "available_spare_pct <= 60%",
                "message": f"Degraded flash reserve spare blocks on {host.hostname}: {spare_pct}% spare remaining",
                "evidence": {
                    "available_spare_pct": spare_pct,
                    "available_spare_threshold_pct": spare_thresh,
                }
            })

    # 6. NVMe Hardware Critical Warning Flag
    crit_warn = disk_health.get("critical_warning") or 0
    if crit_warn > 0:
        alerts_to_evaluate.append({
            "type": "nvme_critical_warning",
            "severity": "critical",
            "rule": "critical_warning != 0",
            "message": f"NVMe controller firmware flagged critical hardware warning on {host.hostname} (flag: {crit_warn})",
            "evidence": {
                "critical_warning": crit_warn,
                "smart_status": smart_status,
                "bus_protocol": disk_health.get("bus_protocol"),
            }
        })

    # Deduplicate & record alerts
    for alert_def in alerts_to_evaluate:
        existing_alert = db.query(Alert).filter(
            Alert.host_id == host.id,
            Alert.type == alert_def["type"],
            Alert.status.in_(["open", "acknowledged"]),
        ).first()

        evidence_payload = {
            "host_id": host.id,
            "hostname": host.hostname,
            "rule": alert_def["rule"],
            "message": alert_def["message"],
            **alert_def["evidence"],
            "disk_health": disk_health,
        }

        if existing_alert:
            existing_alert.occurrence_count = (existing_alert.occurrence_count or 1) + 1
            existing_alert.last_seen_at = now
            existing_alert.evidence_json = json.dumps(evidence_payload)
        else:
            new_alert = Alert(
                host_id=host.id,
                type=alert_def["type"],
                severity=alert_def["severity"],
                status="open",
                opened_at=now,
                last_seen_at=now,
                occurrence_count=1,
                evidence_json=json.dumps(evidence_payload),
            )
            db.add(new_alert)


def evaluate_system_resource_rules(db: Session, host: Host, system_resources: Dict[str, Any]):
    """
    Evaluates system resource telemetry: memory exhaustion/pressure and SoC thermal throttling.
    """
    if not system_resources:
        return

    now = utc_now()
    alerts_to_evaluate = []

    memory = system_resources.get("memory", {})
    pressure_pct = memory.get("pressure_pct")
    pressure_status = memory.get("pressure_status", "Normal")
    swap_pct = memory.get("swap_pct", 0)

    # 1. Memory Exhaustion & Pressure Rules
    if pressure_status == "Critical" or (pressure_pct is not None and pressure_pct >= 90) or swap_pct >= 95:
        alerts_to_evaluate.append({
            "type": "memory_exhaustion_critical",
            "severity": "critical",
            "rule": "memory_pressure >= 90% or swap >= 95%",
            "message": f"Critical memory exhaustion on {host.hostname}: {pressure_pct or 'N/A'}% pressure, {swap_pct}% swap used",
            "evidence": {
                "pressure_pct": pressure_pct,
                "pressure_status": pressure_status,
                "swap_pct": swap_pct,
                "used_bytes": memory.get("used_bytes"),
                "total_bytes": memory.get("total_bytes"),
                "wired_bytes": memory.get("wired_bytes"),
            }
        })
    elif pressure_status == "Warning" or (pressure_pct is not None and pressure_pct >= 85) or swap_pct >= 90:
        alerts_to_evaluate.append({
            "type": "memory_pressure_warning",
            "severity": "warning",
            "rule": "memory_pressure >= 85% or swap >= 90%",
            "message": f"Elevated memory pressure on {host.hostname}: {pressure_pct or 'N/A'}% pressure, {swap_pct}% swap used",
            "evidence": {
                "pressure_pct": pressure_pct,
                "pressure_status": pressure_status,
                "swap_pct": swap_pct,
                "used_bytes": memory.get("used_bytes"),
                "total_bytes": memory.get("total_bytes"),
            }
        })

    # 2. Thermal Throttling Rules
    thermal = system_resources.get("thermal", {})
    thermal_state = thermal.get("thermal_state", "Nominal")
    is_throttled = thermal.get("is_throttled", False)

    if thermal_state == "Critical":
        alerts_to_evaluate.append({
            "type": "thermal_throttling_detected",
            "severity": "critical",
            "rule": "thermal_state == 'Critical'",
            "message": f"Critical Apple Silicon thermal state on {host.hostname}: heavy hardware throttling active",
            "evidence": {
                "thermal_state": thermal_state,
                "is_throttled": True,
            }
        })
    elif thermal_state == "Serious" or is_throttled:
        alerts_to_evaluate.append({
            "type": "thermal_throttling_detected",
            "severity": "warning",
            "rule": "thermal_state == 'Serious'",
            "message": f"High thermal pressure on {host.hostname}: system throttling active ({thermal_state})",
            "evidence": {
                "thermal_state": thermal_state,
                "is_throttled": is_throttled,
            }
        })

    # Deduplicate & record alerts
    for alert_def in alerts_to_evaluate:
        existing_alert = db.query(Alert).filter(
            Alert.host_id == host.id,
            Alert.type == alert_def["type"],
            Alert.status.in_(["open", "acknowledged"]),
        ).first()

        evidence_payload = {
            "host_id": host.id,
            "hostname": host.hostname,
            "rule": alert_def["rule"],
            "message": alert_def["message"],
            **alert_def["evidence"],
            "system_resources": system_resources,
        }

        if existing_alert:
            existing_alert.occurrence_count = (existing_alert.occurrence_count or 1) + 1
            existing_alert.last_seen_at = now
            existing_alert.evidence_json = json.dumps(evidence_payload)
        else:
            new_alert = Alert(
                host_id=host.id,
                type=alert_def["type"],
                severity=alert_def["severity"],
                status="open",
                opened_at=now,
                last_seen_at=now,
                occurrence_count=1,
                evidence_json=json.dumps(evidence_payload),
            )
            db.add(new_alert)

