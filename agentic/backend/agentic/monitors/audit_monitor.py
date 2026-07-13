from __future__ import annotations

from agentic.schemas.snapshot import AuditSnapshot


def collect_audit_snapshot(hours: int = 24) -> tuple[AuditSnapshot, list[str]]:
    errors: list[str] = []
    try:
        from db import SessionLocal, get_detection_summary

        db = SessionLocal()
        try:
            summary = get_detection_summary(db, hours=hours)
        finally:
            db.close()
        return AuditSnapshot(
            status="ok",
            window_hours=int(summary.get("window_hours", hours)),
            detection_count=int(summary.get("total_detections", 0)),
            sorting_command_count=int(summary.get("total_sorting_commands", 0)),
            average_confidence=float(summary.get("avg_confidence", 0.0)),
            grade_counts=summary.get("grade_counts", {}),
            camera_counts=summary.get("camera_counts", {}),
        ), errors
    except Exception as exc:
        errors.append(f"audit monitor unavailable: {exc}")
        return AuditSnapshot(status="unavailable", error=str(exc)), errors

