"""Audit endpoints backed by the offline database."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db import get_db
from db.repositories import (
    get_detection_summary,
    list_detection_events,
    list_sorting_commands,
)

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get("/detections/")
def get_audit_detections(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    camera_slot: int | None = Query(None, ge=0),
    grade: str | None = Query(None),
    date: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    return list_detection_events(
        db,
        limit=limit,
        offset=offset,
        camera_slot=camera_slot,
        grade=grade,
        event_date=date,
    )


@router.get("/sorting-commands/")
def get_audit_sorting_commands(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    return list_sorting_commands(db, limit=limit, offset=offset)


@router.get("/summary/")
def get_audit_summary(
    hours: int = Query(24, ge=1, le=744),
    db: Session = Depends(get_db),
) -> dict:
    return get_detection_summary(db, hours=hours)
