import json
from typing import List
from backend.models import Alert
from backend.schemas import AlertSummary

def deduplicate_alerts(alerts: List[Alert]) -> List[AlertSummary]:
    """
    Deduplicates raw Alert ORM instances across identical incidents
    (host_id, volume_id, volume_mount, type, severity, status).
    Aggregates occurrence counts, preserves the earliest opened_at and
    latest last_seen_at, and returns distinct AlertSummary objects sorted
    by latest activity descending.
    """
    groups = {}
    for a in alerts:
        evidence = {}
        try:
            evidence = json.loads(a.evidence_json) if a.evidence_json else {}
        except Exception:
            evidence = {}

        vol_mount = evidence.get("volume_mount") or ""
        key = (a.host_id, a.volume_id, vol_mount, a.type, a.severity, a.status)
        count = max(1, a.occurrence_count or 1)
        last_seen = a.last_seen_at or a.opened_at
        msg = evidence.get("message", f"{a.type} on {a.host.hostname if a.host else a.host_id}")

        if key not in groups:
            groups[key] = {
                "alert": a,
                "evidence": evidence,
                "message": msg,
                "occurrence_count": count,
                "first_opened_at": a.opened_at,
                "latest_last_seen_at": last_seen,
                "closed_at": a.closed_at,
                "acknowledged_at": a.acknowledged_at,
                "acknowledged_by": a.acknowledged_by,
                "resolved_by": a.resolved_by,
                "resolution_note": a.resolution_note,
            }
        else:
            existing = groups[key]
            existing["occurrence_count"] += count
            if last_seen and existing["latest_last_seen_at"] and last_seen > existing["latest_last_seen_at"]:
                existing["alert"] = a
                existing["evidence"] = evidence
                existing["message"] = msg
                existing["latest_last_seen_at"] = last_seen
                if a.closed_at:
                    existing["closed_at"] = a.closed_at
                if a.acknowledged_at:
                    existing["acknowledged_at"] = a.acknowledged_at
                if a.acknowledged_by:
                    existing["acknowledged_by"] = a.acknowledged_by
                if a.resolved_by:
                    existing["resolved_by"] = a.resolved_by
                if a.resolution_note:
                    existing["resolution_note"] = a.resolution_note
            if a.opened_at and existing["first_opened_at"] and a.opened_at < existing["first_opened_at"]:
                existing["first_opened_at"] = a.opened_at

    summaries = []
    for g in groups.values():
        a = g["alert"]
        history = []
        opened = g["first_opened_at"]
        if opened:
            history.append({
                "event": "Alert generated",
                "timestamp": opened,
                "actor": "MacPulse Telemetry Engine",
                "note": None,
            })
        if g.get("acknowledged_at"):
            history.append({
                "event": f"Acknowledged by {g.get('acknowledged_by') or 'Administrator'}",
                "timestamp": g["acknowledged_at"],
                "actor": g.get("acknowledged_by") or "Administrator",
                "note": None,
            })
        if g.get("closed_at"):
            history.append({
                "event": f"Resolved by {g.get('resolved_by') or 'Administrator'}",
                "timestamp": g["closed_at"],
                "actor": g.get("resolved_by") or "Administrator",
                "note": g.get("resolution_note"),
            })

        summaries.append(
            AlertSummary(
                id=a.id,
                host_id=a.host_id,
                hostname=a.host.hostname if a.host else a.host_id,
                volume_id=a.volume_id,
                volume_mount=g["evidence"].get("volume_mount"),
                type=a.type,
                severity=a.severity,
                status=a.status,
                opened_at=g["first_opened_at"],
                closed_at=g["closed_at"],
                acknowledged_at=g.get("acknowledged_at"),
                acknowledged_by=g.get("acknowledged_by"),
                resolved_by=g.get("resolved_by"),
                resolution_note=g.get("resolution_note"),
                occurrence_count=g["occurrence_count"],
                last_seen_at=g["latest_last_seen_at"],
                message=g["message"],
                evidence=g["evidence"],
                history=history,
            )
        )

    summaries.sort(key=lambda s: s.last_seen_at or s.opened_at, reverse=True)
    return summaries

