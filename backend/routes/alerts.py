import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from backend.database import get_db
from backend.models import Alert, Explanation, utc_now
from backend.schemas import AlertSummary, ExplainResponse
from backend.services.gemini_service import explain_alert

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

    alerts = query.order_by(desc(Alert.opened_at)).limit(limit).all()
    results = []
    for a in alerts:
        evidence = {}
        try:
            evidence = json.loads(a.evidence_json)
        except Exception:
            evidence = {}

        results.append(
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
                message=evidence.get("message", f"{a.type} alert"),
                evidence=evidence,
            )
        )
    return results


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
        message=evidence.get("message", f"{a.type} alert"),
        evidence=evidence,
    )


@router.post("/{alert_id}/explain", response_model=ExplainResponse)
def explain_alert_endpoint(alert_id: str, db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Check for cached explanation (PRD Section 8.5)
    cached = db.query(Explanation).filter(Explanation.alert_id == alert_id).first()
    if cached:
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

    # Generate explanation
    exp_dict = explain_alert(a)

    # Persist in explanations table
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
