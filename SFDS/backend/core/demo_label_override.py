"""
Demo-only detection label override.

Purpose:
- Keep the trained model and normal detection pipeline running.
- For demo runs, replace accepted detections with a fixed visible grade order:
  first fruit -> B, second fruit -> A, third fruit -> C, fourth fruit -> D.
- All 5 camera slots share one fruit label. A new label is assigned only when
  the same camera slot sees the next fruit after the same-fruit time window.

Enable by default after backend restart by setting:
  DURIAN_DEMO_LABEL_OVERRIDE=1

Tune the same-fruit grouping window by setting:
  DURIAN_DEMO_SAME_FRUIT_WINDOW_SECONDS=2

Tune the maximum time to wait for other camera slots in the same fruit event:
  DURIAN_DEMO_EVENT_MAX_SECONDS=10

Tune how many camera slots share one fruit label:
  DURIAN_DEMO_CAMERA_GROUP_SIZE=5

This module is intentionally separate from the model code so the override can be
removed by deleting the import/use sites marked "DEMO ONLY" in scada_router.py.
"""
from __future__ import annotations

import os
import threading
import time
from copy import deepcopy


DEMO_SEQUENCE = [
    ("demo_grade_b", 901),
    ("demo_grade_a", 902),
    ("demo_grade_c", 903),
    ("demo_grade_d", 904),
]
DEMO_SAME_FRUIT_WINDOW_SECONDS = float(
    os.getenv("DURIAN_DEMO_SAME_FRUIT_WINDOW_SECONDS", "2")
)
DEMO_EVENT_MAX_SECONDS = float(os.getenv("DURIAN_DEMO_EVENT_MAX_SECONDS", "10"))
DEMO_CAMERA_GROUP_SIZE = max(1, int(os.getenv("DURIAN_DEMO_CAMERA_GROUP_SIZE", "5")))

_lock = threading.Lock()
_demo_enabled = os.getenv("DURIAN_DEMO_LABEL_OVERRIDE", "0").strip().lower() in {
    "1",
    "true",
    "on",
    "yes",
}
_fruit_counter = 0
_events_by_group: dict[int, dict] = {}
_track_labels_by_group: dict[int, dict[int, tuple[str, int, int]]] = {}


def is_demo_enabled() -> bool:
    with _lock:
        return _demo_enabled


def reset_demo_sequence() -> None:
    global _fruit_counter, _events_by_group, _track_labels_by_group
    with _lock:
        _fruit_counter = 0
        _events_by_group = {}
        _track_labels_by_group = {}


def set_demo_enabled(enabled: bool, *, reset_sequence: bool = True) -> bool:
    global _demo_enabled, _fruit_counter, _events_by_group, _track_labels_by_group
    with _lock:
        _demo_enabled = enabled
        if reset_sequence:
            _fruit_counter = 0
            _events_by_group = {}
            _track_labels_by_group = {}
    return enabled


def get_demo_status() -> dict:
    with _lock:
        return {
            "enabled": _demo_enabled,
            "same_fruit_window_seconds": DEMO_SAME_FRUIT_WINDOW_SECONDS,
            "event_max_seconds": DEMO_EVENT_MAX_SECONDS,
            "camera_group_size": DEMO_CAMERA_GROUP_SIZE,
            "sequence": [name for name, _ in DEMO_SEQUENCE],
        }


def mark_demo_slot_empty(slot: int | None) -> None:
    if slot is None:
        return
    group = _group_for_slot(slot)
    with _lock:
        if not _demo_enabled:
            return
        event = _events_by_group.get(group)
        if not event:
            return
        seen_slots = event.setdefault("seen_slots", set())
        if slot in seen_slots:
            event.setdefault("empty_slots", set()).add(slot)


def clear_demo_track_labels(slot: int | None) -> None:
    """Clear active track-label bindings for a slot group after the fruit leaves."""
    if slot is None:
        return
    group = _group_for_slot(slot)
    with _lock:
        _track_labels_by_group.pop(group, None)


def _next_demo_event() -> tuple[str, int, int]:
    global _fruit_counter
    seq_index = _fruit_counter
    _fruit_counter += 1
    class_name, class_id = DEMO_SEQUENCE[seq_index % len(DEMO_SEQUENCE)]
    return class_name, class_id, seq_index + 1


def _group_for_slot(slot: int | None) -> int:
    if slot is None:
        return 0
    return max(0, int(slot)) // DEMO_CAMERA_GROUP_SIZE


def _current_demo_label(slot: int | None) -> tuple[str, int, int]:
    global _events_by_group
    now = time.monotonic()
    group = _group_for_slot(slot)
    event = _events_by_group.get(group)
    seen_slots = set(event.get("seen_slots", set())) if event else set()
    empty_slots = set(event.get("empty_slots", set())) if event else set()
    event_age = now - float(event["created_at"]) if event else 0.0
    slot_already_seen = slot is not None and slot in seen_slots
    slot_was_empty_after_seen = slot is not None and slot in empty_slots
    group_slots_seen = len(seen_slots) >= DEMO_CAMERA_GROUP_SIZE
    should_start_new = (
        event is None
        or slot_was_empty_after_seen
        or event_age > DEMO_EVENT_MAX_SECONDS
        or (
            slot_already_seen
            and now - float(event["last_seen"]) > DEMO_SAME_FRUIT_WINDOW_SECONDS
        )
        or (
            group_slots_seen
            and now - float(event["last_seen"]) > DEMO_SAME_FRUIT_WINDOW_SECONDS
        )
    )

    if should_start_new:
        class_name, class_id, demo_index = _next_demo_event()
        event = {
            "class_name": class_name,
            "class_id": class_id,
            "demo_index": demo_index,
            "created_at": now,
            "last_seen": now,
            "seen_slots": set(),
            "empty_slots": set(),
        }
        _events_by_group[group] = event
    else:
        event["last_seen"] = now

    if slot is not None:
        event.setdefault("seen_slots", set()).add(slot)

    return (
        str(event["class_name"]),
        int(event["class_id"]),
        int(event["demo_index"]),
    )


def _current_demo_label_for_track(slot: int | None, track_id: int | None) -> tuple[str, int, int]:
    if track_id is None:
        return _current_demo_label(slot)

    group = _group_for_slot(slot)
    labels_for_group = _track_labels_by_group.setdefault(group, {})
    if track_id not in labels_for_group:
        # A YOLO/SORT track can fragment while the same physical fruit is still
        # in view. Reuse the active fruit event label so one fruit cannot turn
        # into two demo grades just because its internal track_id changed.
        labels_for_group[track_id] = _current_demo_label(slot)
    return labels_for_group[track_id]


def apply_demo_label_override(detections: list[dict], *, slot: int | None = None) -> list[dict]:
    """Return copied detections with demo class labels applied in fixed order."""
    if not detections:
        return detections

    with _lock:
        if not _demo_enabled:
            return detections
        labels = [
            _current_demo_label_for_track(
                slot,
                int(det["track_id"]) if det.get("track_id") is not None else None,
            )
            for det in detections
        ]

    output = deepcopy(detections)

    for det, (class_name, class_id, demo_index) in zip(output, labels):
        det["class_name"] = class_name
        det["class_id"] = class_id
        det["demo_override"] = True
        det["demo_sequence_index"] = demo_index

    return output
