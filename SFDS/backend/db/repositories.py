"""Repository helpers for realtime persistence and audit queries."""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from db.models import CameraConfig, DetectionEvent, SortingCommandLog
from db.session import SessionLocal


def _parse_iso_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return datetime.utcnow()
    return datetime.utcnow()


def _date_bounds(value: str | None) -> tuple[datetime, datetime] | None:
    if not value:
        return None
    parsed = date.fromisoformat(value)
    start = datetime.combine(parsed, time.min)
    return start, start + timedelta(days=1)


def serialize_detection_event(event: DetectionEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "event_id": event.event_id,
        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
        "source": event.source,
        "line_id": event.line_id,
        "camera_slot": event.camera_slot,
        "batch_id": event.batch_id,
        "fruit_id": event.fruit_id,
        "track_id": event.track_id,
        "class_name": event.class_name,
        "visual_grade": event.visual_grade,
        "weight_grade": event.weight_grade,
        "final_grade": event.final_grade,
        "confidence": event.confidence,
        "weight_kg": event.weight_kg,
        "detection_count": event.detection_count,
        "raw_detection_count": event.raw_detection_count,
        "image_width": event.image_width,
        "image_height": event.image_height,
        "image_path": event.image_path,
        "quality": event.quality or {},
        "scale": event.scale or {},
        "detections": event.detections or [],
        "sorting_commands": event.sorting_commands or [],
    }


def serialize_sorting_command(command: SortingCommandLog) -> dict[str, Any]:
    return {
        "id": command.id,
        "command_id": command.command_id,
        "issued_at": command.issued_at.isoformat() if command.issued_at else None,
        "source": command.source,
        "line_id": command.line_id,
        "camera_slot": command.camera_slot,
        "fruit_key": command.fruit_key,
        "fruit_id": command.fruit_id,
        "track_id": command.track_id,
        "grade": command.grade,
        "class_name": command.class_name,
        "confidence": command.confidence,
        "route": command.route,
        "action": command.action,
        "actuator": command.actuator,
        "relay_channel": command.relay_channel,
        "delay_ms": command.delay_ms,
        "pulse_ms": command.pulse_ms,
        "enabled": command.enabled,
        "dry_run": command.dry_run,
        "hardware": command.hardware or {},
        "vote": command.vote or {},
        "quality": command.quality or {},
        "scale": command.scale or {},
        "payload": command.payload or {},
    }


def save_detection_event(
    *,
    slot: int,
    detections: list[dict[str, Any]],
    width: int,
    height: int,
    confidence_threshold: float,
    raw_detection_count: int | None = None,
    quality: dict[str, Any] | None = None,
    scale: dict[str, Any] | None = None,
    sorting_commands: list[dict[str, Any]] | None = None,
    source: str = "scada",
) -> None:
    best = detections[0] if detections else {}
    db = SessionLocal()
    try:
        db.add(DetectionEvent(
            source=source,
            camera_slot=slot,
            fruit_id=best.get("fruit_id"),
            track_id=best.get("track_id"),
            class_name=best.get("class_name"),
            visual_grade=best.get("visual_grade"),
            weight_grade=best.get("weight_grade"),
            final_grade=best.get("final_grade") or best.get("visual_grade") or best.get("class_name"),
            confidence=float(best.get("confidence", confidence_threshold)) if best else confidence_threshold,
            weight_kg=best.get("weight_kg"),
            detection_count=len(detections),
            raw_detection_count=raw_detection_count if raw_detection_count is not None else len(detections),
            image_width=width,
            image_height=height,
            quality=quality or {},
            scale=scale or {},
            detections=detections,
            sorting_commands=sorting_commands or [],
        ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def save_sorting_command(command: dict[str, Any]) -> None:
    db = SessionLocal()
    try:
        db.add(SortingCommandLog(
            command_id=command["command_id"],
            issued_at=_parse_iso_datetime(command.get("issued_at")),
            source=command.get("source"),
            line_id=command.get("line_id"),
            camera_slot=command.get("camera_slot"),
            fruit_key=command.get("fruit_key"),
            fruit_id=command.get("fruit_id"),
            track_id=command.get("track_id"),
            grade=command.get("grade"),
            class_name=command.get("class_name"),
            confidence=command.get("confidence"),
            route=command.get("route"),
            action=command.get("action"),
            actuator=command.get("actuator"),
            relay_channel=command.get("relay_channel"),
            delay_ms=command.get("delay_ms"),
            pulse_ms=command.get("pulse_ms"),
            enabled=bool(command.get("enabled", False)),
            dry_run=bool(command.get("dry_run", True)),
            hardware=command.get("hardware") or {},
            vote=command.get("vote") or {},
            quality=command.get("quality") or {},
            scale=command.get("scale") or {},
            payload=command,
        ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def upsert_camera_config(slot: int, url: str, *, source_type: str = "rtsp") -> None:
    db = SessionLocal()
    try:
        config = db.query(CameraConfig).filter(CameraConfig.slot == slot).first()
        if config is None:
            config = CameraConfig(slot=slot)
            db.add(config)
        config.url = url
        config.source_type = source_type
        config.is_enabled = bool(url)
        config.updated_at = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def list_camera_configs() -> dict[int, str]:
    db = SessionLocal()
    try:
        return {
            int(config.slot): str(config.url or "")
            for config in db.query(CameraConfig).all()
        }
    finally:
        db.close()


def update_camera_health_status(slot: int, online: bool) -> None:
    db = SessionLocal()
    try:
        config = db.query(CameraConfig).filter(CameraConfig.slot == slot).first()
        if config is None:
            config = CameraConfig(slot=slot, url="", is_enabled=False)
            db.add(config)
        config.last_online = bool(online)
        config.last_checked_at = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def list_detection_events(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
    camera_slot: int | None = None,
    grade: str | None = None,
    event_date: str | None = None,
) -> dict[str, Any]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    query = db.query(DetectionEvent)

    if camera_slot is not None:
        query = query.filter(DetectionEvent.camera_slot == camera_slot)
    if grade:
        query = query.filter(DetectionEvent.final_grade == grade)
    bounds = _date_bounds(event_date)
    if bounds:
        start, end = bounds
        query = query.filter(DetectionEvent.timestamp >= start, DetectionEvent.timestamp < end)

    total = query.count()
    rows = (
        query.order_by(desc(DetectionEvent.timestamp))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [serialize_detection_event(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def list_sorting_commands(
    db: Session,
    *,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    query = db.query(SortingCommandLog)
    total = query.count()
    rows = (
        query.order_by(desc(SortingCommandLog.issued_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [serialize_sorting_command(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def get_detection_summary(db: Session, *, hours: int = 24) -> dict[str, Any]:
    since = datetime.utcnow() - timedelta(hours=max(1, min(hours, 24 * 31)))
    rows = db.query(DetectionEvent).filter(DetectionEvent.timestamp >= since).all()
    grades = Counter((row.final_grade or row.class_name or "unknown") for row in rows)
    camera_counts = Counter(str(row.camera_slot) for row in rows if row.camera_slot is not None)
    confidence_values = [row.confidence for row in rows if row.confidence is not None]
    avg_confidence = sum(confidence_values) / len(confidence_values) if confidence_values else 0.0
    sorting_count = (
        db.query(func.count(SortingCommandLog.id))
        .filter(SortingCommandLog.issued_at >= since)
        .scalar()
        or 0
    )
    return {
        "window_hours": hours,
        "total_detections": len(rows),
        "total_sorting_commands": int(sorting_count),
        "avg_confidence": avg_confidence,
        "grade_counts": dict(grades),
        "camera_counts": dict(camera_counts),
    }
