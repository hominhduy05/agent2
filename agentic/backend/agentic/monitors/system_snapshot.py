from __future__ import annotations

from agentic.monitors.audit_monitor import collect_audit_snapshot
from agentic.monitors.camera_monitor import collect_camera_snapshots
from agentic.monitors.health_monitor import collect_health_snapshot
from agentic.monitors.log_monitor import collect_log_snapshot
from agentic.monitors.sorting_monitor import collect_sorting_snapshot
from agentic.policies.thresholds import AgenticThresholds
from agentic.schemas.snapshot import SystemSnapshot


def collect_system_snapshot(thresholds: AgenticThresholds | None = None) -> SystemSnapshot:
    thresholds = thresholds or AgenticThresholds.from_env()
    partial_errors: list[str] = []

    backend, model, database, scale, errors = collect_health_snapshot()
    partial_errors.extend(errors)

    cameras, errors = collect_camera_snapshots()
    partial_errors.extend(errors)

    sorting, errors = collect_sorting_snapshot()
    partial_errors.extend(errors)

    audit, errors = collect_audit_snapshot(hours=thresholds.audit_window_hours)
    partial_errors.extend(errors)

    logs, errors = collect_log_snapshot(max_lines=thresholds.sorting_log_tail_lines)
    partial_errors.extend(errors)

    return SystemSnapshot(
        backend=backend,
        model=model,
        database=database,
        scale=scale,
        cameras=cameras,
        sorting=sorting,
        audit=audit,
        logs=logs,
        partial_errors=partial_errors,
    )

