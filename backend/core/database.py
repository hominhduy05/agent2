"""
SQLite database setup using SQLAlchemy ORM.
Tables: employees, inspection_logs, kpi_targets
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, create_engine, text,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

# ---------------------------------------------------------------------------
# DB path
# ---------------------------------------------------------------------------
BASE_DIR   = Path(__file__).parent
DB_PATH    = BASE_DIR / "durian.db"

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine   = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Employee(Base):
    __tablename__ = "employees"

    id           = Column(Integer, primary_key=True, index=True)
    username     = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name    = Column(String(100), nullable=False)
    role         = Column(String(20), nullable=False, default="inspector")  # admin | inspector
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    logs = relationship("InspectionLog", back_populates="employee", cascade="all, delete-orphan")


class InspectionLog(Base):
    __tablename__ = "inspection_logs"

    id              = Column(Integer, primary_key=True, index=True)
    employee_id     = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    timestamp       = Column(DateTime, default=datetime.utcnow, index=True)
    total_inspected = Column(Integer, default=0)
    mature_count    = Column(Integer, default=0)
    immature_count  = Column(Integer, default=0)
    defective_count = Column(Integer, default=0)
    avg_confidence  = Column(Float, default=0.0)
    device          = Column(String(20), default="cpu")
    notes           = Column(String(500), nullable=True)

    employee = relationship("Employee", back_populates="logs")


class KPITarget(Base):
    __tablename__ = "kpi_targets"

    id           = Column(Integer, primary_key=True, index=True)
    metric_name  = Column(String(100), unique=True, nullable=False)  # daily_inspections, quality_rate, etc.
    display_name = Column(String(200), nullable=False)
    target_value = Column(Float, nullable=False)
    period       = Column(String(20), default="daily")   # daily | weekly | monthly
    unit         = Column(String(20), default="count")   # count | percent | hours
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# SCADA / MES Models
# ---------------------------------------------------------------------------

class Shift(Base):
    """Production shift / ca sản xuất."""
    __tablename__ = "shifts"

    id            = Column(Integer, primary_key=True, index=True)
    shift_name     = Column(String(10), nullable=False)   # Ca 1, Ca 2, Ca 3
    employee_id    = Column(Integer, ForeignKey("employees.id"), nullable=True)
    started_at     = Column(DateTime, default=datetime.utcnow)
    ended_at      = Column(DateTime, nullable=True)
    total_inspected = Column(Integer, default=0)
    good_count    = Column(Integer, default=0)    # mature
    reject_count  = Column(Integer, default=0)    # defective
    oee           = Column(Float, default=0.0)
    quality_rate  = Column(Float, default=0.0)
    is_active     = Column(Boolean, default=True)


class AlarmLog(Base):
    """SCADA alarm log."""
    __tablename__ = "alarm_logs"

    id         = Column(Integer, primary_key=True, index=True)
    code       = Column(String(20), nullable=False)
    message    = Column(String(500), nullable=False)
    severity   = Column(String(10), default="INFO")   # INFO | WARN | CRITICAL
    is_active  = Column(Boolean, default=True)
    acknowledged_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)

    ack_employee = relationship("Employee")


class TraceLog(Base):
    """Per-fruit traceability record."""
    __tablename__ = "trace_logs"

    id              = Column(Integer, primary_key=True, index=True)
    shift_id        = Column(Integer, ForeignKey("shifts.id"), nullable=True, index=True)
    session_id      = Column(Integer, ForeignKey("inspection_logs.id"), nullable=True)
    employee_id     = Column(Integer, ForeignKey("employees.id"), nullable=True)
    grade           = Column(String(20), nullable=False)   # mature | immature | defective
    confidence      = Column(Float, nullable=False)
    is_rejected     = Column(Boolean, default=False)
    reject_reason   = Column(String(200), nullable=True)
    camera_timestamp = Column(DateTime, default=datetime.utcnow)
    batch_id        = Column(String(50), nullable=True)


# ---------------------------------------------------------------------------
# DB lifecycle
# ---------------------------------------------------------------------------

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables and seed default KPI targets if empty."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(KPITarget).count() == 0:
            defaults = [
                KPITarget(metric_name="daily_inspections", display_name="Số kiểm tra / ngày",
                          target_value=500, period="daily", unit="count"),
                KPITarget(metric_name="quality_rate",      display_name="Tỷ lệ đạt chất lượng",
                          target_value=90.0, period="daily", unit="percent"),
                KPITarget(metric_name="weekly_inspections", display_name="Số kiểm tra / tuần",
                          target_value=3000, period="weekly", unit="count"),
                KPITarget(metric_name="monthly_inspections", display_name="Số kiểm tra / tháng",
                          target_value=12000, period="monthly", unit="count"),
            ]
            db.add_all(defaults)
            db.commit()
            print("[DB] Seeded default KPI targets.")

        if db.query(Employee).count() == 0:
            import bcrypt
            pw = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
            db.add(Employee(
                username="admin",
                password_hash=pw,
                full_name="Quản trị viên",
                role="admin",
                is_active=True,
            ))
            db.commit()
            print("[DB] Created default admin user: admin / admin123")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Convenience query helpers
# ---------------------------------------------------------------------------

def get_today_inspections(db: Session, employee_id: Optional[int] = None):
    today = datetime.utcnow().date()
    q = db.query(InspectionLog).filter(
        text("date(timestamp) = :today").bindparams(today=str(today))
    )
    if employee_id:
        q = q.filter(InspectionLog.employee_id == employee_id)
    return q.all()


def get_date_range_inspections(db: Session, start_date: datetime, end_date: datetime,
                                employee_id: Optional[int] = None):
    q = db.query(InspectionLog).filter(
        InspectionLog.timestamp >= start_date,
        InspectionLog.timestamp <= end_date,
    )
    if employee_id:
        q = q.filter(InspectionLog.employee_id == employee_id)
    return q.all()
