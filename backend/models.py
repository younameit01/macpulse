import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Float,
    DateTime,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Host(Base):
    __tablename__ = "hosts"

    id = Column(String(64), primary_key=True, index=True)
    hostname = Column(String(255), nullable=False)
    os_version = Column(String(128), nullable=False)
    agent_version = Column(String(64), nullable=False, default="1.0.0")
    last_seen = Column(DateTime, default=utc_now, nullable=False)
    status = Column(String(32), default="online", nullable=False)  # "online" | "offline"

    volumes = relationship("Volume", back_populates="host", cascade="all, delete-orphan")
    metric_samples = relationship("MetricSample", back_populates="host", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="host", cascade="all, delete-orphan")


class Volume(Base):
    __tablename__ = "volumes"

    # Compound id: e.g. "{host_id}:{mount_path}"
    id = Column(String(255), primary_key=True, index=True)
    host_id = Column(String(64), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String(255), nullable=False)
    mount_path = Column(String(512), nullable=False)
    fs_type = Column(String(64), nullable=False)  # apfs, nfs, etc.
    total_bytes = Column(BigInteger, default=0, nullable=False)
    last_seen = Column(DateTime, default=utc_now, nullable=False)

    host = relationship("Host", back_populates="volumes")
    metric_samples = relationship("MetricSample", back_populates="volume", cascade="all, delete-orphan")


class MetricSample(Base):
    __tablename__ = "metric_samples"

    id = Column(Integer, primary_key=True, autoincrement=True)
    host_id = Column(String(64), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    volume_id = Column(String(255), ForeignKey("volumes.id", ondelete="CASCADE"), nullable=True, index=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
    used_bytes = Column(BigInteger, default=0, nullable=False)
    free_bytes = Column(BigInteger, default=0, nullable=False)
    read_bps = Column(Float, default=0.0, nullable=False)
    write_bps = Column(Float, default=0.0, nullable=False)
    nfs_ops_per_sec = Column(Float, nullable=True)
    nfs_retrans = Column(Integer, nullable=True)

    host = relationship("Host", back_populates="metric_samples")
    volume = relationship("Volume", back_populates="metric_samples")

    __table_args__ = (
        Index("ix_metrics_host_time", "host_id", "timestamp"),
        Index("ix_metrics_vol_time", "volume_id", "timestamp"),
    )


class ProcessEvent(Base):
    __tablename__ = "process_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    host_id = Column(String(64), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    volume_id = Column(String(255), nullable=True, index=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
    process = Column(String(255), nullable=False)
    pid = Column(Integer, nullable=True)
    user = Column(String(128), nullable=True)
    operation = Column(String(64), nullable=True)
    bytes = Column(BigInteger, nullable=True)

    __table_args__ = (
        Index("ix_events_host_time", "host_id", "timestamp"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    host_id = Column(String(64), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    volume_id = Column(String(255), nullable=True, index=True)
    type = Column(String(64), nullable=False)  # capacity_warning, capacity_critical, abnormal_write, agent_offline, nfs_concern
    severity = Column(String(32), nullable=False)  # warning | critical
    status = Column(String(32), default="open", nullable=False)  # open | closed
    opened_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    closed_at = Column(DateTime, nullable=True)
    evidence_json = Column(Text, nullable=False)

    host = relationship("Host", back_populates="alerts")
    explanations = relationship("Explanation", back_populates="alert", cascade="all, delete-orphan")


class Explanation(Base):
    __tablename__ = "explanations"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(64), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    model = Column(String(64), nullable=False)
    prompt_version = Column(String(32), default="v1", nullable=False)
    response_text = Column(Text, nullable=False)
    status = Column(String(32), default="success", nullable=False)  # success | fallback | failed

    alert = relationship("Alert", back_populates="explanations")
