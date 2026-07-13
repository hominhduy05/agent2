from __future__ import annotations

from agentic.schemas.snapshot import CameraSnapshot


def collect_camera_snapshots(timeout_ms: int = 1200) -> tuple[list[CameraSnapshot], list[str]]:
    errors: list[str] = []
    try:
        from db.repositories import list_camera_configs
        from routers.scada_router import SCADA_CAMERA_COUNT, _check_camera_slot

        configs = list_camera_configs()
        cameras: list[CameraSnapshot] = []
        for slot in range(SCADA_CAMERA_COUNT):
            try:
                result = _check_camera_slot(slot, configs.get(slot, ""), timeout_ms=timeout_ms)
                cameras.append(CameraSnapshot(
                    camera_id=f"camera_{slot}",
                    slot=slot,
                    configured=bool(result.get("configured")),
                    online=bool(result.get("online")),
                    message=str(result.get("message", "unknown")),
                    url=str(result.get("url", "")),
                    latency_ms=result.get("latency_ms"),
                    width=result.get("width"),
                    height=result.get("height"),
                ))
            except Exception as exc:
                errors.append(f"camera {slot} health unavailable: {exc}")
                cameras.append(CameraSnapshot(
                    camera_id=f"camera_{slot}",
                    slot=slot,
                    message="unavailable",
                    error=str(exc),
                ))
        return cameras, errors
    except Exception as exc:
        errors.append(f"camera monitor unavailable: {exc}")
        return [], errors

