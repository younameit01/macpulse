from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# --- Agent Ingestion Schemas ---

class AgentRegisterRequest(BaseModel):
    host_id: str
    hostname: str
    os_version: str
    agent_version: str = "1.0.0"

class AgentRegisterResponse(BaseModel):
    status: str = "registered"
    host_id: str

class HeartbeatResponse(BaseModel):
    status: str = "ok"
    host_id: str
    last_seen: datetime

class VolumeDiscoveryItem(BaseModel):
    source: str
    mount_path: str
    fs_type: str
    total_bytes: int
    used_bytes: int = 0
    free_bytes: int = 0

class MetricSampleItem(BaseModel):
    volume_mount: Optional[str] = None
    used_bytes: int = 0
    free_bytes: int = 0
    read_bps: float = 0.0
    write_bps: float = 0.0
    nfs_ops_per_sec: Optional[float] = None
    nfs_retrans: Optional[int] = None

class MetricsIngestBatch(BaseModel):
    host_id: str
    timestamp: Optional[datetime] = None
    volumes: List[VolumeDiscoveryItem] = []
    samples: List[MetricSampleItem] = []

class ProcessEventItem(BaseModel):
    process: str
    pid: Optional[int] = None
    user: Optional[str] = None
    operation: Optional[str] = None
    bytes: Optional[int] = None
    volume_mount: Optional[str] = None
    timestamp: Optional[datetime] = None

class EventsIngestBatch(BaseModel):
    host_id: str
    events: List[ProcessEventItem] = []

# --- Dashboard Query Schemas ---

class VolumeSummary(BaseModel):
    id: str
    source: str
    mount_path: str
    fs_type: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    used_pct: float
    current_read_bps: float = 0.0
    current_write_bps: float = 0.0

class HostSummary(BaseModel):
    id: str
    hostname: str
    os_version: str
    agent_version: str
    status: str
    last_seen: datetime
    volume_count: int = 0
    current_write_bps: float = 0.0
    current_read_bps: float = 0.0
    hottest_volume: Optional[str] = None
    capacity_warning: bool = False
    latest_alert: Optional[str] = None

class AlertSummary(BaseModel):
    id: str
    host_id: str
    hostname: str
    volume_id: Optional[str] = None
    volume_mount: Optional[str] = None
    type: str
    severity: str
    status: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    message: str
    evidence: Dict[str, Any]

class OverviewResponse(BaseModel):
    hosts_online: int
    hosts_total: int
    volumes_monitored: int
    critical_alerts: int
    warning_alerts: int
    aggregate_write_bps: float
    aggregate_read_bps: float
    hosts: List[HostSummary]
    recent_alerts: List[AlertSummary]

class MetricPoint(BaseModel):
    timestamp: datetime
    read_bps: float
    write_bps: float
    used_bytes: int
    free_bytes: int

class HostDetailResponse(BaseModel):
    id: str
    hostname: str
    os_version: str
    agent_version: str
    status: str
    last_seen: datetime
    volumes: List[VolumeSummary]
    recent_alerts: List[AlertSummary]
    recent_events: List[Dict[str, Any]]

class VolumeDetailResponse(BaseModel):
    id: str
    host_id: str
    hostname: str
    source: str
    mount_path: str
    fs_type: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    used_pct: float
    current_read_bps: float
    current_write_bps: float
    nfs_stats: Optional[Dict[str, Any]] = None
    alerts: List[AlertSummary] = []

class ExplainResponse(BaseModel):
    alert_id: str
    summary: str
    evidence: List[str]
    likely_interpretation: str
    recommended_checks: List[str]
    risk: str
    model: str
    status: str
