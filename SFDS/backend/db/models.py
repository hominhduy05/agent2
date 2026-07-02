"""SQLAlchemy ORM models for SFDS."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from db.session import Base, JsonType


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="inspector")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    logs = relationship("InspectionLog", back_populates="employee", cascade="all, delete-orphan")


class InspectionLog(Base):
    __tablename__ = "inspection_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    total_inspected = Column(Integer, default=0)
    mature_count = Column(Integer, default=0)
    immature_count = Column(Integer, default=0)
    defective_count = Column(Integer, default=0)
    avg_confidence = Column(Float, default=0.0)
    device = Column(String(20), default="cpu")
    notes = Column(String(500), nullable=True)

    employee = relationship("Employee", back_populates="logs")


class KPITarget(Base):
    __tablename__ = "kpi_targets"

    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(200), nullable=False)
    target_value = Column(Float, nullable=False)
    period = Column(String(20), default="daily")
    unit = Column(String(20), default="count")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    shift_name = Column(String(10), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    total_inspected = Column(Integer, default=0)
    good_count = Column(Integer, default=0)
    reject_count = Column(Integer, default=0)
    oee = Column(Float, default=0.0)
    quality_rate = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)


class AlarmLog(Base):
    __tablename__ = "alarm_logs"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False)
    message = Column(String(500), nullable=False)
    severity = Column(String(10), default="INFO")
    is_active = Column(Boolean, default=True)
    acknowledged_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)

    ack_employee = relationship("Employee")


class TraceLog(Base):
    __tablename__ = "trace_logs"

    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True, index=True)
    session_id = Column(Integer, ForeignKey("inspection_logs.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    grade = Column(String(20), nullable=False)
    confidence = Column(Float, nullable=False)
    is_rejected = Column(Boolean, default=False)
    reject_reason = Column(String(200), nullable=True)
    camera_timestamp = Column(DateTime, default=datetime.utcnow)
    batch_id = Column(String(50), nullable=True)


class CameraConfig(Base):
    __tablename__ = "camera_configs"

    id = Column(Integer, primary_key=True, index=True)
    slot = Column(Integer, nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=True)
    source_type = Column(String(20), default="rtsp")
    url = Column(String(1000), nullable=False, default="")
    is_enabled = Column(Boolean, default=True, index=True)
    last_online = Column(Boolean, nullable=True)
    last_checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DetectionEvent(Base):
    __tablename__ = "detection_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(36), nullable=False, unique=True, default=lambda: str(uuid4()))
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    source = Column(String(50), nullable=False, default="scada")
    line_id = Column(String(50), nullable=True, index=True)
    camera_slot = Column(Integer, nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True, index=True)
    batch_id = Column(String(50), nullable=True, index=True)
    fruit_id = Column(String(100), nullable=True, index=True)
    track_id = Column(Integer, nullable=True, index=True)
    class_name = Column(String(50), nullable=True, index=True)
    visual_grade = Column(String(20), nullable=True, index=True)
    weight_grade = Column(String(20), nullable=True, index=True)
    final_grade = Column(String(20), nullable=True, index=True)
    confidence = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    detection_count = Column(Integer, default=0)
    raw_detection_count = Column(Integer, default=0)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    image_path = Column(String(1000), nullable=True)
    quality = Column(JsonType, nullable=True)
    scale = Column(JsonType, nullable=True)
    detections = Column(JsonType, nullable=True)
    sorting_commands = Column(JsonType, nullable=True)


class SortingCommandLog(Base):
    __tablename__ = "sorting_command_logs"

    id = Column(Integer, primary_key=True, index=True)
    command_id = Column(String(36), nullable=False, unique=True)
    issued_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    source = Column(String(50), nullable=True)
    line_id = Column(String(50), nullable=True, index=True)
    camera_slot = Column(Integer, nullable=True, index=True)
    fruit_key = Column(String(200), nullable=True, index=True)
    fruit_id = Column(String(100), nullable=True, index=True)
    track_id = Column(Integer, nullable=True)
    grade = Column(String(20), nullable=True, index=True)
    class_name = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    route = Column(String(100), nullable=True)
    action = Column(String(50), nullable=True, index=True)
    actuator = Column(String(100), nullable=True)
    relay_channel = Column(Integer, nullable=True)
    delay_ms = Column(Integer, nullable=True)
    pulse_ms = Column(Integer, nullable=True)
    enabled = Column(Boolean, default=False)
    dry_run = Column(Boolean, default=True)
    hardware = Column(JsonType, nullable=True)
    vote = Column(JsonType, nullable=True)
    quality = Column(JsonType, nullable=True)
    scale = Column(JsonType, nullable=True)
    payload = Column(JsonType, nullable=True)


class DatasetAsset(Base):
    __tablename__ = "dataset_assets"
    __table_args__ = (
        UniqueConstraint("category", "class_name", "item_id", "face", name="uq_dataset_asset_face"),
    )

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(String(80), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    class_name = Column(String(100), nullable=False, index=True)
    face = Column(String(20), nullable=False)
    image_path = Column(String(1000), nullable=False)
    label_path = Column(String(1000), nullable=True)
    boxes = Column(JsonType, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


Index("ix_inspection_logs_employee_timestamp", InspectionLog.employee_id, InspectionLog.timestamp)
Index("ix_shifts_active_started_at", Shift.started_at, postgresql_where=Shift.is_active.is_(True))
Index("ix_alarm_logs_active_severity", AlarmLog.severity, AlarmLog.created_at, postgresql_where=AlarmLog.is_active.is_(True))
Index("ix_trace_logs_shift_camera_timestamp", TraceLog.shift_id, TraceLog.camera_timestamp)
Index("ix_detection_events_camera_timestamp", DetectionEvent.camera_slot, DetectionEvent.timestamp)
Index("ix_detection_events_grade_timestamp", DetectionEvent.final_grade, DetectionEvent.timestamp)
Index("ix_sorting_command_logs_grade_issued_at", SortingCommandLog.grade, SortingCommandLog.issued_at)
