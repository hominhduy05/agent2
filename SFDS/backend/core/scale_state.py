"""
Shared scale state for ESP32 / load-cell readings.

The scale reading is process-local on purpose: SCADA only needs the current
fruit weight in the realtime loop. ESP32 can POST new values whenever the
load cell stabilizes.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import threading
import time
from typing import Any


SCALE_MAX_AGE_SECONDS = 60.0
SAME_FRUIT_WINDOW_SECONDS = 10.0
SAME_FRUIT_WEIGHT_TOLERANCE_KG = 0.2


@dataclass
class ScaleReading:
    weight_kg: float
    raw_value: float
    unit: str
    stable: bool
    fruit_id: str
    source: str
    timestamp: float


_lock = threading.Lock()
_latest: ScaleReading | None = None
_fruit_counter = 0


def _next_fruit_id() -> str:
    global _fruit_counter
    _fruit_counter += 1
    return f"fruit-{_fruit_counter:06d}"


def _first_number(payload: dict[str, Any]) -> tuple[float, str]:
    if "weight_kg" in payload:
        return float(payload["weight_kg"]), "kg"
    if "kg" in payload:
        return float(payload["kg"]), "kg"
    if "grams" in payload:
        return float(payload["grams"]), "g"
    if "gram" in payload:
        return float(payload["gram"]), "g"
    if "g" in payload:
        return float(payload["g"]), "g"
    if "weight" in payload:
        return float(payload["weight"]), str(payload.get("unit", "kg"))
    if "value" in payload:
        return float(payload["value"]), str(payload.get("unit", "kg"))
    raise ValueError("Missing weight value")


def _normalize_to_kg(value: float, unit: str) -> float:
    normalized_unit = (unit or "kg").strip().lower()
    if normalized_unit in {"g", "gram", "grams"}:
        weight_kg = value / 1000.0
    elif normalized_unit in {"kg", "kilogram", "kilograms"}:
        # Some ESP32 sketches send grams as a bare number. Durian fruit should
        # never be dozens of kg, so treat large unitless/kg values as grams.
        weight_kg = value / 1000.0 if value > 80 else value
    else:
        raise ValueError(f"Unsupported weight unit: {unit}")

    if weight_kg < 0 or weight_kg > 100:
        raise ValueError("weight_kg must be between 0 and 100")
    return round(weight_kg, 3)


def update_scale_reading(payload: dict[str, Any]) -> dict[str, Any]:
    raw_value, inferred_unit = _first_number(payload)
    unit = str(payload.get("unit", inferred_unit))
    weight_kg = _normalize_to_kg(raw_value, unit)
    stable = bool(payload.get("stable", True))
    source = str(payload.get("source", "esp32"))
    now = time.time()

    with _lock:
        global _latest
        explicit_fruit_id = payload.get("fruit_id") or payload.get("id")
        if explicit_fruit_id:
            fruit_id = str(explicit_fruit_id)
        elif (
            _latest is not None
            and now - _latest.timestamp <= SAME_FRUIT_WINDOW_SECONDS
            and abs(_latest.weight_kg - weight_kg) <= SAME_FRUIT_WEIGHT_TOLERANCE_KG
        ):
            fruit_id = _latest.fruit_id
        else:
            fruit_id = _next_fruit_id()

        _latest = ScaleReading(
            weight_kg=weight_kg,
            raw_value=raw_value,
            unit="kg",
            stable=stable,
            fruit_id=fruit_id,
            source=source,
            timestamp=now,
        )
        return get_scale_status_locked(now)


def get_scale_status_locked(now: float | None = None) -> dict[str, Any]:
    now = now or time.time()
    if _latest is None:
        return {
            "online": False,
            "latest": None,
            "max_age_seconds": SCALE_MAX_AGE_SECONDS,
            "same_fruit_window_seconds": SAME_FRUIT_WINDOW_SECONDS,
        }

    age = max(0.0, now - _latest.timestamp)
    latest = asdict(_latest)
    latest["age_seconds"] = round(age, 2)
    latest["timestamp_ms"] = int(_latest.timestamp * 1000)
    return {
        "online": age <= SCALE_MAX_AGE_SECONDS,
        "latest": latest,
        "max_age_seconds": SCALE_MAX_AGE_SECONDS,
        "same_fruit_window_seconds": SAME_FRUIT_WINDOW_SECONDS,
    }


def get_scale_status() -> dict[str, Any]:
    with _lock:
        return get_scale_status_locked()


def get_scale_snapshot() -> dict[str, Any] | None:
    status = get_scale_status()
    if not status.get("online"):
        return None
    latest = status.get("latest")
    return latest if isinstance(latest, dict) else None


def reset_scale_reading() -> dict[str, Any]:
    with _lock:
        global _latest
        _latest = None
        return get_scale_status_locked()


def visual_grade_for_class(class_name: str | None) -> str | None:
    mapping = {
        "mature": "A",
        "immature": "B",
        "defective": "C",
        "demo_grade_a": "A",
        "demo_grade_b": "B",
        "demo_grade_c": "C",
        "demo_grade_d": "D",
        "A": "A",
        "B": "B",
        "C": "C",
        "D": "D",
    }
    return mapping.get(class_name or "")


def weight_grade_for_kg(weight_kg: float | None) -> str | None:
    if weight_kg is None or weight_kg <= 0:
        return None
    if weight_kg >= 3.0:
        return "A"
    if weight_kg >= 2.0:
        return "B"
    if weight_kg >= 1.0:
        return "C"
    return "D"


def attach_scale_to_detections(detections: list[dict], scale: dict[str, Any] | None) -> list[dict]:
    if not scale:
        return detections

    weight_kg = scale.get("weight_kg")
    weight_grade = weight_grade_for_kg(float(weight_kg)) if weight_kg is not None else None
    for det in detections:
        visual_grade = visual_grade_for_class(det.get("class_name"))
        det["weight_kg"] = weight_kg
        det["weight_unit"] = "kg"
        det["fruit_id"] = scale.get("fruit_id")
        det["scale_age_seconds"] = scale.get("age_seconds")
        det["scale_stable"] = scale.get("stable")
        det["visual_grade"] = visual_grade
        det["weight_grade"] = weight_grade
        det["final_grade"] = visual_grade or weight_grade
        det["classification_source"] = "vision_scale" if visual_grade and weight_grade else (
            "vision" if visual_grade else "scale"
        )
    return detections
