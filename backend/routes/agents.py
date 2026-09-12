from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.models import Host, utc_now
from backend.schemas import AgentRegisterRequest, AgentRegisterResponse, HeartbeatResponse
from backend.engine import check_agent_liveness

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])

@router.post("/register", response_model=AgentRegisterResponse)
def register_agent(payload: AgentRegisterRequest, db: Session = Depends(get_db)):
    host = db.query(Host).filter(Host.id == payload.host_id).first()
    now = utc_now()
    if host:
        host.hostname = payload.hostname
        host.os_version = payload.os_version
        host.agent_version = payload.agent_version
        host.last_seen = now
        host.status = "online"
    else:
        host = Host(
            id=payload.host_id,
            hostname=payload.hostname,
            os_version=payload.os_version,
            agent_version=payload.agent_version,
            last_seen=now,
            status="online",
        )
        db.add(host)
    db.commit()
    return AgentRegisterResponse(status="registered", host_id=host.id)

@router.post("/{host_id}/heartbeat", response_model=HeartbeatResponse)
def heartbeat(host_id: str, db: Session = Depends(get_db)):
    host = db.query(Host).filter(Host.id == host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host not registered")
    
    now = utc_now()
    host.last_seen = now
    host.status = "online"
    db.commit()
    
    # Evaluate liveness across all agents
    check_agent_liveness(db)
    db.commit()
    
    return HeartbeatResponse(status="ok", host_id=host.id, last_seen=now)
