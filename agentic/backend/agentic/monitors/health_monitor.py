from __future__ import annotations

from agentic.schemas.snapshot import BackendSnapshot, DatabaseSnapshot, ModelSnapshot, ScaleSnapshot


def collect_health_snapshot() -> tuple[BackendSnapshot, ModelSnapshot, DatabaseSnapshot, ScaleSnapshot, list[str]]:
    errors: list[str] = []
    backend = BackendSnapshot(status="ok", healthy=True, service="scada")
    model = ModelSnapshot(status="unknown")
    database = DatabaseSnapshot(status="unknown")
    scale = ScaleSnapshot(status="unknown")

    try:
        from core.shared import device_name, engine_obj, model_format, model_loaded

        model = ModelSnapshot(
            status="ok" if model_loaded else "degraded",
            loaded=bool(model_loaded),
            device=str(getattr(engine_obj, "device", device_name)),
            model_format=model_format,
        )
    except Exception as exc:
        errors.append(f"model health unavailable: {exc}")
        model = ModelSnapshot(status="unavailable", loaded=False, error=str(exc))

    try:
        from db import get_database_info

        info = get_database_info()
        database = DatabaseSnapshot(
            status="ok",
            available=True,
            backend=info.get("backend"),
            url=info.get("url"),
        )
    except Exception as exc:
        errors.append(f"database health unavailable: {exc}")
        database = DatabaseSnapshot(status="unavailable", available=False, error=str(exc))

    try:
        from services.serial_scale_reader import get_serial_scale_status

        info = get_serial_scale_status()
        scale = ScaleSnapshot(
            status="ok",
            online=bool(info.get("online")),
            latest=info.get("latest"),
        )
    except Exception as exc:
        errors.append(f"scale health unavailable: {exc}")
        scale = ScaleSnapshot(status="unavailable", online=False, error=str(exc))

    return backend, model, database, scale, errors

