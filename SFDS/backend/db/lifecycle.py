"""Database lifecycle and common query helpers."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from db.models import Employee, InspectionLog, KPITarget
from db.session import Base, SessionLocal, engine


def init_db() -> None:
    """Create all tables and seed default records when the database is empty."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(KPITarget).count() == 0:
            defaults = [
                KPITarget(metric_name="daily_inspections", display_name="So kiem tra / ngay",
                          target_value=500, period="daily", unit="count"),
                KPITarget(metric_name="quality_rate", display_name="Ty le dat chat luong",
                          target_value=90.0, period="daily", unit="percent"),
                KPITarget(metric_name="weekly_inspections", display_name="So kiem tra / tuan",
                          target_value=3000, period="weekly", unit="count"),
                KPITarget(metric_name="monthly_inspections", display_name="So kiem tra / thang",
                          target_value=12000, period="monthly", unit="count"),
            ]
            db.add_all(defaults)
            db.commit()
            print("[DB] Seeded default KPI targets.")

        if db.query(Employee).count() == 0:
            import bcrypt
            password_hash = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
            db.add(Employee(
                username="admin",
                password_hash=password_hash,
                full_name="Quan tri vien",
                role="admin",
                is_active=True,
            ))
            db.commit()
            print("[DB] Created default admin user: admin / admin123")
    finally:
        db.close()


def get_today_inspections(db: Session, employee_id: Optional[int] = None):
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    query = db.query(InspectionLog).filter(
        InspectionLog.timestamp >= start,
        InspectionLog.timestamp < end,
    )
    if employee_id:
        query = query.filter(InspectionLog.employee_id == employee_id)
    return query.all()


def get_date_range_inspections(
    db: Session,
    start_date: datetime,
    end_date: datetime,
    employee_id: Optional[int] = None,
):
    query = db.query(InspectionLog).filter(
        InspectionLog.timestamp >= start_date,
        InspectionLog.timestamp <= end_date,
    )
    if employee_id:
        query = query.filter(InspectionLog.employee_id == employee_id)
    return query.all()
