"""
Sorting controller for grade-based actuator commands.

The backend decides what should happen to a classified fruit, then emits a
single command event for a PLC/relay controller to execute. Direct GPIO/relay
control stays outside the inference process so the system remains auditable,
configurable, and fail-safe in production deployments.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
import json
import os
import threading
import time
from typing import Any
from uuid import uuid4

from services.esp32_relay_controller import send_sorting_command
from services.mqtt_publisher import publish_enterprise_event
from services.sfds_logger import log_sorting_event


DEFAULT_GRADE_ROUTES: dict[str, dict[str, Any]] = {
    "A": {
        "route": "lane_a",
        "actuator": "cylinder_1",
        "relay_channel": 1,
        "pulse_ms": 2000,
        "delay_ms": 2000,
    },
    "B": {
        "route": "lane_b",
        "actuator": "cylinder_2",
        "relay_channel": 2,
        "pulse_ms": 2000,
        "delay_ms": 2000,
    },
    "C": {
        "route": "lane_c",
        "actuator": "cylinder_3",
        "relay_channel": 3,
        "pulse_ms": 2000,
        "delay_ms": 2000,
    },
    "D": {
        "route": "pass_through",
        "actuator": None,
        "relay_channel": None,
        "pulse_ms": 0,
        "delay_ms": 0,
    },
}

CLASS_TO_GRADE = {
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


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _load_grade_routes() -> dict[str, dict[str, Any]]:
    routes = deepcopy(DEFAULT_GRADE_ROUTES)
    raw = os.getenv("SORTING_GRADE_ROUTES_JSON", "").strip()
    if raw:
        try:
            custom = json.loads(raw)
            if isinstance(custom, dict):
                for grade, cfg in custom.items():
                    grade_key = str(grade).upper()
                    if grade_key in routes and isinstance(cfg, dict):
                        routes[grade_key].update(cfg)
        except json.JSONDecodeError:
            pass

    for grade in ("A", "B", "C"):
        prefix = f"SORTING_GRADE_{grade}_"
        relay = os.getenv(prefix + "RELAY")
        actuator = os.getenv(prefix + "ACTUATOR")
        delay_ms = os.getenv(prefix + "DELAY_MS")
        pulse_ms = os.getenv(prefix + "PULSE_MS")
        if relay is not None:
            try:
                routes[grade]["relay_channel"] = int(relay)
            except ValueError:
                pass
        if actuator:
            routes[grade]["actuator"] = actuator
        if delay_ms is not None:
            routes[grade]["delay_ms"] = _env_int(prefix + "DELAY_MS", int(routes[grade]["delay_ms"]))
        if pulse_ms is not None:
            routes[grade]["pulse_ms"] = _env_int(prefix + "PULSE_MS", int(routes[grade]["pulse_ms"]))

    return routes


@dataclass(frozen=True)
class SortingSettings:
    enabled: bool
    dry_run: bool
    min_confidence: float
    dedupe_ttl_seconds: float
    vote_required: int
    cameras_per_room: int
    same_fruit_window_seconds: float
    incomplete_timeout_seconds: float
    incomplete_grade: str | None
    defect_veto: bool
    early_defect_veto: bool
    line_id: str
    routes: dict[str, dict[str, Any]]


def get_sorting_settings() -> SortingSettings:
    same_fruit_window_seconds = _env_float("SORTING_SAME_FRUIT_WINDOW_SECONDS", 2.5)
    incomplete_grade = _normalize_grade(os.getenv("SORTING_INCOMPLETE_GRADE", "C"))
    return SortingSettings(
        enabled=_env_bool("SORTING_ENABLED", False),
        dry_run=_env_bool("SORTING_DRY_RUN", True),
        min_confidence=_env_float("SORTING_MIN_CONFIDENCE", 0.25),
        dedupe_ttl_seconds=_env_float("SORTING_DEDUPE_TTL_SECONDS", 30.0),
        vote_required=max(1, _env_int("SORTING_VOTE_REQUIRED", 5)),
        cameras_per_room=max(1, _env_int("SORTING_CAMERAS_PER_ROOM", 5)),
        same_fruit_window_seconds=same_fruit_window_seconds,
        incomplete_timeout_seconds=_env_float("SORTING_INCOMPLETE_TIMEOUT_SECONDS", same_fruit_window_seconds),
        incomplete_grade=incomplete_grade,
        defect_veto=_env_bool("SORTING_DEFECT_VETO", True),
        early_defect_veto=_env_bool("SORTING_EARLY_DEFECT_VETO", True),
        line_id=os.getenv("SORTING_LINE_ID", "line_01"),
        routes=_load_grade_routes(),
    )


_lock = threading.Lock()
_recent_keys: dict[str, float] = {}
_recent_commands: list[dict[str, Any]] = []
MAX_RECENT_COMMANDS = 200


@dataclass
class VoteItem:
    camera_slot: int
    grade: str
    confidence: float
    detection: dict[str, Any]
    updated_at: float
    image_width: int = 0
    image_height: int = 0


@dataclass
class VoteSession:
    key: str
    room_id: int
    created_at: float
    updated_at: float
    batch_id: str | None = None
    votes: dict[int, VoteItem] = field(default_factory=dict)
    finalized: bool = False
    final_grade: str | None = None
    command_id: str | None = None


_vote_sessions: dict[str, VoteSession] = {}
_active_window_by_room: dict[int, tuple[str, float]] = {}
_batch_attempts: dict[str, dict[int, dict[str, Any]]] = {}


def _normalize_grade(value: Any) -> str | None:
    if value is None:
        return None
    grade = str(value).strip().upper()
    return grade if grade in {"A", "B", "C", "D"} else None


def resolve_detection_grade(det: dict[str, Any]) -> str | None:
    return (
        _normalize_grade(det.get("final_grade"))
        or _normalize_grade(det.get("visual_grade"))
        or _normalize_grade(det.get("weight_grade"))
        or CLASS_TO_GRADE.get(str(det.get("class_name", "")).strip())
    )


def _fruit_key(slot: int, det: dict[str, Any], grade: str) -> str:
    fruit_id = det.get("fruit_id")
    if fruit_id:
        return f"slot:{slot}:fruit:{fruit_id}:grade:{grade}"

    track_id = det.get("track_id")
    if track_id is not None:
        return f"slot:{slot}:track:{track_id}:grade:{grade}"

    display_id = det.get("display_id")
    if display_id is not None:
        return f"slot:{slot}:display:{display_id}:grade:{grade}"

    x1 = round(float(det.get("x1", 0.0)) / 25.0)
    y1 = round(float(det.get("y1", 0.0)) / 25.0)
    x2 = round(float(det.get("x2", 0.0)) / 25.0)
    y2 = round(float(det.get("y2", 0.0)) / 25.0)
    return f"slot:{slot}:box:{x1}:{y1}:{x2}:{y2}:grade:{grade}"


def _is_duplicate(key: str, now: float, ttl: float) -> bool:
    with _lock:
        expired = [k for k, ts in _recent_keys.items() if now - ts > ttl]
        for k in expired:
            _recent_keys.pop(k, None)
        if key in _recent_keys:
            return True
        _recent_keys[key] = now
        return False


def _remember_command(command: dict[str, Any]) -> None:
    with _lock:
        _recent_commands.insert(0, command)
        del _recent_commands[MAX_RECENT_COMMANDS:]


def get_recent_sorting_commands(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        return deepcopy(_recent_commands[: max(1, min(limit, MAX_RECENT_COMMANDS))])


def get_sorting_config() -> dict[str, Any]:
    settings = get_sorting_settings()
    return {
        "enabled": settings.enabled,
        "dry_run": settings.dry_run,
        "min_confidence": settings.min_confidence,
        "dedupe_ttl_seconds": settings.dedupe_ttl_seconds,
        "vote_required": settings.vote_required,
        "cameras_per_room": settings.cameras_per_room,
        "same_fruit_window_seconds": settings.same_fruit_window_seconds,
        "incomplete_timeout_seconds": settings.incomplete_timeout_seconds,
        "incomplete_grade": settings.incomplete_grade,
        "defect_veto": settings.defect_veto,
        "early_defect_veto": settings.early_defect_veto,
        "line_id": settings.line_id,
        "routes": settings.routes,
    }


def _room_for_slot(camera_slot: int, settings: SortingSettings) -> int:
    return max(0, int(camera_slot)) // settings.cameras_per_room


def _vote_session_key(
    *,
    camera_slot: int,
    det: dict[str, Any],
    now: float,
    settings: SortingSettings,
    batch_id: str | None = None,
) -> tuple[str, int]:
    room_id = _room_for_slot(camera_slot, settings)
    if batch_id:
        return f"batch:{batch_id}", room_id

    fruit_id = det.get("fruit_id")
    if fruit_id:
        return f"fruit:{fruit_id}", room_id

    active = _active_window_by_room.get(room_id)
    if active and now - active[1] <= settings.same_fruit_window_seconds:
        key = active[0]
    else:
        key = f"room:{room_id}:window:{int(now * 1000)}"
    _active_window_by_room[room_id] = (key, now)
    return key, room_id


def _vote_counts(votes: dict[int, VoteItem]) -> dict[str, int]:
    counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    for vote in votes.values():
        counts[vote.grade] = counts.get(vote.grade, 0) + 1
    return counts


def _calculate_final_vote(
    votes: dict[int, VoteItem],
    settings: SortingSettings,
) -> str | None:
    if not votes:
        return None

    counts = _vote_counts(votes)
    if settings.defect_veto and counts["D"] > 0:
        return "D"

    if len(votes) < settings.vote_required and settings.incomplete_grade:
        return settings.incomplete_grade

    majority_threshold = settings.vote_required // 2 + 1
    for grade in ("A", "B", "C"):
        if counts[grade] >= majority_threshold:
            return grade

    # No clear majority, e.g. 1A + 1B in two-camera testing: route to the
    # configured fallback grade instead of choosing one camera over the other.
    if settings.incomplete_grade:
        return settings.incomplete_grade

    for grade in ("C", "B", "A"):
        if counts[grade] > 0:
            return grade
    return None


def _session_ready(session: VoteSession, settings: SortingSettings, now: float) -> bool:
    counts = _vote_counts(session.votes)
    if settings.defect_veto and settings.early_defect_veto and counts["D"] > 0:
        return True
    if len(session.votes) >= settings.vote_required:
        return True
    if settings.incomplete_grade and session.votes:
        return now - session.created_at >= settings.incomplete_timeout_seconds
    return False


def _best_vote(votes: dict[int, VoteItem], final_grade: str) -> VoteItem:
    same_grade = [vote for vote in votes.values() if vote.grade == final_grade]
    candidates = same_grade or list(votes.values())
    return max(candidates, key=lambda vote: vote.confidence)


def _vote_summary(session: VoteSession) -> dict[str, Any]:
    counts = _vote_counts(session.votes)
    return {
        "session_key": session.key,
        "batch_id": session.batch_id,
        "room_id": session.room_id,
        "votes_required": get_sorting_settings().vote_required,
        "votes_received": len(session.votes),
        "counts": counts,
        "cameras": [
            {
                "camera_slot": vote.camera_slot,
                "grade": vote.grade,
                "confidence": vote.confidence,
                "track_id": vote.detection.get("track_id"),
                "fruit_id": vote.detection.get("fruit_id"),
                "class_name": vote.detection.get("class_name"),
            }
            for vote in sorted(session.votes.values(), key=lambda item: item.camera_slot)
        ],
    }


def _command_summary(command: dict[str, Any] | None) -> dict[str, Any] | None:
    if not command:
        return None
    return {
        "command_id": command.get("command_id"),
        "grade": command.get("grade"),
        "action": command.get("action"),
        "actuator": command.get("actuator"),
        "relay_channel": command.get("relay_channel"),
        "enabled": command.get("enabled"),
        "dry_run": command.get("dry_run"),
        "hardware": command.get("hardware") or {},
    }


def record_sorting_batch_camera_processed(
    batch_id: str | None,
    *,
    camera_slot: int,
    detection_count: int,
    raw_detection_count: int | None = None,
    image_width: int | None = None,
    image_height: int | None = None,
    error: str | None = None,
) -> None:
    batch = str(batch_id or "").strip()
    if not batch:
        return
    with _lock:
        attempts = _batch_attempts.setdefault(batch, {})
        attempts[int(camera_slot)] = {
            "camera_slot": int(camera_slot),
            "processed": True,
            "detection_count": int(detection_count),
            "raw_detection_count": int(raw_detection_count if raw_detection_count is not None else detection_count),
            "image_width": image_width,
            "image_height": image_height,
            "error": error,
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }
    log_sorting_event(
        "camera_processed",
        batch_id=batch,
        camera_slot=int(camera_slot),
        detection_count=int(detection_count),
        raw_detection_count=int(raw_detection_count if raw_detection_count is not None else detection_count),
        image_width=image_width,
        image_height=image_height,
        error=error,
    )


def get_sorting_batch_status(batch_id: str) -> dict[str, Any]:
    batch = str(batch_id or "").strip()
    settings = get_sorting_settings()
    session_key = f"batch:{batch}"
    with _lock:
        session = deepcopy(_vote_sessions.get(session_key))
        attempts = deepcopy(_batch_attempts.get(batch, {}))
        latest_command = next(
            (
                deepcopy(command)
                for command in _recent_commands
                if command.get("batch_id") == batch
            ),
            None,
        )

    votes = session.votes if session else {}
    counts = _vote_counts(votes) if votes else {"A": 0, "B": 0, "C": 0, "D": 0}
    can_finalize = bool(session and votes and not session.finalized)
    if session and not session.finalized:
        can_finalize = _calculate_final_vote(votes, settings) is not None

    return {
        "batch_id": batch,
        "processed_camera_count": len(attempts),
        "processed_cameras": [
            attempts[slot] for slot in sorted(attempts)
        ],
        "votes_required": settings.vote_required,
        "votes_received": len(votes),
        "counts": counts,
        "ready_to_sort": bool(session and session.finalized),
        "can_activate_cylinder": bool(
            latest_command
            and latest_command.get("action") == "relay_pulse"
            and latest_command.get("relay_channel") is not None
            and latest_command.get("enabled")
            and not latest_command.get("dry_run")
        ),
        "final_grade": session.final_grade if session else None,
        "finalized": bool(session and session.finalized),
        "command": _command_summary(latest_command),
    }


def _emit_sorting_command(
    *,
    session: VoteSession,
    best_vote: VoteItem,
    final_grade: str,
    settings: SortingSettings,
    now: float,
    source: str,
    image_width: int,
    image_height: int,
    confidence_threshold: float,
    quality: dict[str, Any] | None = None,
    scale: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    route = settings.routes.get(final_grade)
    if not route:
        log_sorting_event(
            "sorting_command_skipped",
            reason="missing_route",
            batch_id=session.batch_id,
            final_grade=final_grade,
        )
        return None

    fruit_key = f"sorting:{session.key}:grade:{final_grade}"
    if _is_duplicate(fruit_key, now, settings.dedupe_ttl_seconds):
        log_sorting_event(
            "sorting_command_skipped",
            reason="duplicate",
            batch_id=session.batch_id,
            final_grade=final_grade,
            fruit_key=fruit_key,
        )
        return None

    relay_channel = route.get("relay_channel")
    should_pulse = final_grade != "D" and relay_channel is not None
    if not settings.enabled:
        action = "disabled"
        pulse_ms = 0
    else:
        action = "relay_pulse" if should_pulse else "pass_through"
        pulse_ms = int(route.get("pulse_ms") or 0) if should_pulse else 0

    command = {
        "command_id": str(uuid4()),
        "issued_at": datetime.utcnow().isoformat() + "Z",
        "source": source,
        "line_id": settings.line_id,
        "camera_slot": best_vote.camera_slot,
        "batch_id": session.batch_id,
        "fruit_key": fruit_key,
        "fruit_id": best_vote.detection.get("fruit_id"),
        "track_id": best_vote.detection.get("track_id"),
        "display_id": best_vote.detection.get("display_id"),
        "grade": final_grade,
        "class_name": best_vote.detection.get("class_name"),
        "confidence": best_vote.confidence,
        "route": route.get("route"),
        "action": action,
        "actuator": route.get("actuator"),
        "relay_channel": relay_channel,
        "delay_ms": int(route.get("delay_ms") or 0),
        "pulse_ms": pulse_ms,
        "enabled": settings.enabled,
        "dry_run": settings.dry_run,
        "image": {"width": image_width, "height": image_height},
        "confidence_threshold": confidence_threshold,
        "vote": _vote_summary(session),
        "quality": quality or {},
        "scale": scale or {},
    }
    if action == "relay_pulse" and not settings.dry_run:
        command["hardware"] = send_sorting_command(command)
    elif action == "relay_pulse":
        command["hardware"] = {
            "sent": False,
            "reason": "SORTING_DRY_RUN is enabled",
        }

    _remember_command(command)
    log_sorting_event(
        "sorting_command_created",
        command_id=command["command_id"],
        batch_id=session.batch_id,
        final_grade=final_grade,
        action=action,
        actuator=command.get("actuator"),
        relay_channel=relay_channel,
        enabled=settings.enabled,
        dry_run=settings.dry_run,
        vote=command.get("vote"),
        hardware=command.get("hardware"),
    )
    publish_enterprise_event(
        "sorting.command",
        command,
        line_id=settings.line_id,
        camera_slot=best_vote.camera_slot,
        correlation_id=command["command_id"],
        topic="sorting/command",
    )
    return command


def dispatch_sorting_commands(
    *,
    camera_slot: int,
    detections: list[dict[str, Any]],
    image_width: int,
    image_height: int,
    source: str,
    confidence_threshold: float,
    batch_id: str | None = None,
    quality: dict[str, Any] | None = None,
    scale: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    settings = get_sorting_settings()
    commands: list[dict[str, Any]] = []
    now = time.time()

    for det in detections:
        grade = resolve_detection_grade(det)
        if grade is None:
            log_sorting_event(
                "vote_ignored",
                reason="no_grade",
                batch_id=batch_id,
                camera_slot=camera_slot,
                class_name=det.get("class_name"),
                final_grade=det.get("final_grade"),
                confidence=det.get("confidence"),
            )
            continue

        confidence = float(det.get("confidence", 0.0))
        if confidence < settings.min_confidence:
            log_sorting_event(
                "vote_ignored",
                reason="low_confidence",
                batch_id=batch_id,
                camera_slot=camera_slot,
                grade=grade,
                confidence=confidence,
                min_confidence=settings.min_confidence,
            )
            continue

        session_key, room_id = _vote_session_key(
            camera_slot=camera_slot,
            det=det,
            now=now,
            settings=settings,
            batch_id=batch_id,
        )
        with _lock:
            session = _vote_sessions.get(session_key)
            if session is None:
                session = VoteSession(
                    key=session_key,
                    room_id=room_id,
                    created_at=now,
                    updated_at=now,
                    batch_id=batch_id,
                )
                _vote_sessions[session_key] = session
            elif batch_id and not session.batch_id:
                session.batch_id = batch_id
            if session.finalized:
                continue
            session.updated_at = now
            session.votes[camera_slot] = VoteItem(
                camera_slot=camera_slot,
                grade=grade,
                confidence=confidence,
                detection=deepcopy(det),
                updated_at=now,
                image_width=image_width,
                image_height=image_height,
            )
            vote_count = len(session.votes)
            vote_counts = _vote_counts(session.votes)
            ready = _session_ready(session, settings, now)
            log_sorting_event(
                "vote_recorded",
                batch_id=batch_id,
                session_key=session_key,
                camera_slot=camera_slot,
                grade=grade,
                confidence=confidence,
                votes_received=vote_count,
                votes_required=settings.vote_required,
                counts=vote_counts,
                ready_to_sort=ready,
            )
            if not ready:
                continue
            final_grade = _calculate_final_vote(session.votes, settings)
            if final_grade is None:
                continue
            session.finalized = True
            session.final_grade = final_grade
            best_vote = _best_vote(session.votes, final_grade)

        command = _emit_sorting_command(
            session=session,
            best_vote=best_vote,
            final_grade=final_grade,
            settings=settings,
            now=now,
            source=source,
            image_width=image_width,
            image_height=image_height,
            confidence_threshold=confidence_threshold,
            quality=quality,
            scale=scale,
        )
        if command:
            commands.append(command)

    return commands


def finalize_sorting_batch(
    batch_id: str,
    *,
    source: str = "scada_batch_finalize",
    confidence_threshold: float = 0.25,
    quality: dict[str, Any] | None = None,
    scale: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    batch = str(batch_id or "").strip()
    if not batch:
        log_sorting_event("batch_finalize_skipped", reason="missing_batch_id")
        return []

    settings = get_sorting_settings()
    now = time.time()
    session_key = f"batch:{batch}"

    with _lock:
        session = _vote_sessions.get(session_key)
        if session is None or session.finalized or not session.votes:
            log_sorting_event(
                "batch_finalize_skipped",
                reason="no_open_votes" if session is None or not session.votes else "already_finalized",
                batch_id=batch,
            )
            return []

        final_grade = _calculate_final_vote(session.votes, settings)
        if final_grade is None:
            log_sorting_event(
                "batch_finalize_skipped",
                reason="not_enough_votes",
                batch_id=batch,
                votes_received=len(session.votes),
                votes_required=settings.vote_required,
                counts=_vote_counts(session.votes),
            )
            return []
        session.finalized = True
        session.final_grade = final_grade
        best_vote = _best_vote(session.votes, final_grade)

    command = _emit_sorting_command(
        session=session,
        best_vote=best_vote,
        final_grade=final_grade,
        settings=settings,
        now=now,
        source=source,
        image_width=best_vote.image_width,
        image_height=best_vote.image_height,
        confidence_threshold=confidence_threshold,
        quality=quality,
        scale=scale,
    )
    return [command] if command else []
