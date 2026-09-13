import os
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from backend.database import get_db
from backend.models import Alert, Explanation, utc_now
from backend.schemas import AlertSummary, ExplainResponse, AcknowledgeAlertRequest, ResolveAlertRequest
from backend.services.gemini_service import explain_alert
from backend.alert_utils import deduplicate_alerts
from backend.auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertSummary])
def list_alerts(
    status: Optional[str] = Query(None, description="Filter by open or closed"),
    severity: Optional[str] = Query(None, description="Filter by warning or critical"),
    host_id: Optional[str] = Query(None, description="Filter by host id"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    if severity:
        query = query.filter(Alert.severity == severity)
    if host_id:
        query = query.filter(Alert.host_id == host_id)

    alerts = query.order_by(desc(Alert.last_seen_at), desc(Alert.opened_at)).all()
    results = deduplicate_alerts(alerts)
    return results[:limit]


@router.get("/{alert_id}", response_model=AlertSummary)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")

    evidence = {}
    try:
        evidence = json.loads(a.evidence_json)
    except Exception:
        evidence = {}

    history = [
        {
            "event": "Alert generated",
            "timestamp": a.opened_at,
            "actor": "MacPulse Telemetry Engine",
            "note": None,
        }
    ]
    if a.acknowledged_at:
        history.append({
            "event": f"Acknowledged by {a.acknowledged_by or 'Administrator'}",
            "timestamp": a.acknowledged_at,
            "actor": a.acknowledged_by or "Administrator",
            "note": None,
        })
    if a.closed_at:
        history.append({
            "event": f"Resolved by {a.resolved_by or 'Administrator'}",
            "timestamp": a.closed_at,
            "actor": a.resolved_by or "Administrator",
            "note": a.resolution_note,
        })

    return AlertSummary(
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
        acknowledged_at=a.acknowledged_at,
        acknowledged_by=a.acknowledged_by,
        resolved_by=a.resolved_by,
        resolution_note=a.resolution_note,
        occurrence_count=a.occurrence_count or 1,
        last_seen_at=a.last_seen_at or a.opened_at,
        message=evidence.get("message", f"{a.type} alert"),
        evidence=evidence,
        history=history,
    )



from starlette.concurrency import run_in_threadpool

@router.post("/{alert_id}/explain", response_model=ExplainResponse)
async def explain_alert_endpoint(
    alert_id: str,
    force: bool = Query(False, description="Force re-generation with Gemini"),
    db: Session = Depends(get_db)
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Check for cached explanation (PRD Section 8.5)
    cached = db.query(Explanation).filter(Explanation.alert_id == alert_id).first()
    api_key = os.getenv("GEMINI_API_KEY", "")
    if cached and (cached.status == "success" or not api_key) and not force:
        try:
            cached_data = json.loads(cached.response_text)
            return ExplainResponse(
                alert_id=alert_id,
                summary=cached_data.get("summary", ""),
                evidence=cached_data.get("evidence", []),
                likely_interpretation=cached_data.get("likely_interpretation", ""),
                recommended_checks=cached_data.get("recommended_checks", []),
                risk=cached_data.get("risk", ""),
                model=cached.model,
                status=cached.status,
            )
        except Exception:
            pass

    # Generate explanation via threadpool so LLM call never blocks other endpoints
    exp_dict = await run_in_threadpool(explain_alert, a)

    # Persist or update in explanations table
    if cached:
        cached.created_at = utc_now()
        cached.model = exp_dict.get("model", "unknown")
        cached.response_text = json.dumps(exp_dict)
        cached.status = exp_dict.get("status", "success")
    else:
        new_exp = Explanation(
            alert_id=alert_id,
            created_at=utc_now(),
            model=exp_dict.get("model", "unknown"),
            prompt_version="v1",
            response_text=json.dumps(exp_dict),
            status=exp_dict.get("status", "success"),
        )
        db.add(new_exp)
    db.commit()

    return ExplainResponse(
        alert_id=alert_id,
        summary=exp_dict.get("summary", ""),
        evidence=exp_dict.get("evidence", []),
        likely_interpretation=exp_dict.get("likely_interpretation", ""),
        recommended_checks=exp_dict.get("recommended_checks", []),
        risk=exp_dict.get("risk", ""),
        model=exp_dict.get("model", "unknown"),
        status=exp_dict.get("status", "success"),
    )


@router.post("/{alert_id}/acknowledge", response_model=AlertSummary)
def acknowledge_alert(
    alert_id: str,
    req: Optional[AcknowledgeAlertRequest] = None,
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    now = utc_now()
    ack_by = current_user.name if current_user else "Administrator"
    alert.status = "acknowledged"
    alert.acknowledged_at = now
    alert.acknowledged_by = ack_by

    # Also update any open alerts for this same host + volume + type
    same_incident_filter = [
        Alert.host_id == alert.host_id,
        Alert.type == alert.type,
        Alert.status == "open",
    ]
    if alert.volume_id is not None:
        same_incident_filter.append(Alert.volume_id == alert.volume_id)
    else:
        same_incident_filter.append(Alert.volume_id.is_(None))

    db.query(Alert).filter(*same_incident_filter).update({
        Alert.status: "acknowledged",
        Alert.acknowledged_at: now,
        Alert.acknowledged_by: ack_by,
    }, synchronize_session=False)

    db.commit()
    db.refresh(alert)

    evidence = {}
    try:
        evidence = json.loads(alert.evidence_json) if alert.evidence_json else {}
    except Exception:
        evidence = {}

    history = [
        {
            "event": "Alert generated",
            "timestamp": alert.opened_at,
            "actor": "MacPulse Telemetry Engine",
            "note": None,
        },
        {
            "event": f"Acknowledged by {alert.acknowledged_by}",
            "timestamp": alert.acknowledged_at,
            "actor": alert.acknowledged_by,
            "note": req.note if req else None,
        }
    ]

    return AlertSummary(
        id=alert.id,
        host_id=alert.host_id,
        hostname=alert.host.hostname if alert.host else alert.host_id,
        volume_id=alert.volume_id,
        volume_mount=evidence.get("volume_mount"),
        type=alert.type,
        severity=alert.severity,
        status=alert.status,
        opened_at=alert.opened_at,
        closed_at=alert.closed_at,
        acknowledged_at=alert.acknowledged_at,
        acknowledged_by=alert.acknowledged_by,
        resolved_by=alert.resolved_by,
        resolution_note=alert.resolution_note,
        occurrence_count=alert.occurrence_count or 1,
        last_seen_at=alert.last_seen_at or alert.opened_at,
        message=evidence.get("message", f"{alert.type} alert"),
        evidence=evidence,
        history=history,
    )


@router.post("/{alert_id}/resolve", response_model=AlertSummary)
def resolve_alert(
    alert_id: str,
    req: Optional[ResolveAlertRequest] = None,
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    note = (req.resolution_note.strip() if req and req.resolution_note else None)
    now = utc_now()
    resolved_by = current_user.name if current_user else "Administrator"
    alert.status = "closed"
    alert.closed_at = now
    alert.resolved_by = resolved_by
    if note:
        alert.resolution_note = note

    # Also close any open or acknowledged alerts for the same host + volume + type
    same_incident_filter = [
        Alert.host_id == alert.host_id,
        Alert.type == alert.type,
        Alert.status.in_(["open", "acknowledged"]),
    ]
    if alert.volume_id is not None:
        same_incident_filter.append(Alert.volume_id == alert.volume_id)
    else:
        same_incident_filter.append(Alert.volume_id.is_(None))

    db.query(Alert).filter(*same_incident_filter).update({
        Alert.status: "closed",
        Alert.closed_at: now,
        Alert.resolved_by: resolved_by,
        Alert.resolution_note: note,
    }, synchronize_session=False)

    db.commit()
    db.refresh(alert)

    evidence = {}
    try:
        evidence = json.loads(alert.evidence_json) if alert.evidence_json else {}
    except Exception:
        evidence = {}

    history = [
        {
            "event": "Alert generated",
            "timestamp": alert.opened_at,
            "actor": "MacPulse Telemetry Engine",
            "note": None,
        }
    ]
    if alert.acknowledged_at:
        history.append({
            "event": f"Acknowledged by {alert.acknowledged_by or 'Administrator'}",
            "timestamp": alert.acknowledged_at,
            "actor": alert.acknowledged_by or "Administrator",
            "note": None,
        })
    history.append({
        "event": f"Resolved by {alert.resolved_by}",
        "timestamp": alert.closed_at,
        "actor": alert.resolved_by,
        "note": alert.resolution_note,
    })

    return AlertSummary(
        id=alert.id,
        host_id=alert.host_id,
        hostname=alert.host.hostname if alert.host else alert.host_id,
        volume_id=alert.volume_id,
        volume_mount=evidence.get("volume_mount"),
        type=alert.type,
        severity=alert.severity,
        status=alert.status,
        opened_at=alert.opened_at,
        closed_at=alert.closed_at,
        acknowledged_at=alert.acknowledged_at,
        acknowledged_by=alert.acknowledged_by,
        resolved_by=alert.resolved_by,
        resolution_note=alert.resolution_note,
        occurrence_count=alert.occurrence_count or 1,
        last_seen_at=alert.last_seen_at or alert.opened_at,
        message=evidence.get("message", f"{alert.type} alert"),
        evidence=evidence,
        history=history,
    )

