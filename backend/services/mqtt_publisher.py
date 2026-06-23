"""
MQTT Publisher — publish detection & SCADA events to an MQTT broker.

This module provides stub implementations when no MQTT broker is available,
and real MQTT publishing when MQTT_HOST is configured.

Environment variables:
    MQTT_HOST     — broker host (e.g. "localhost:1883"), omit to use stubs
    MQTT_USER     — username (optional)
    MQTT_PASSWORD — password (optional)
    MQTT_TOPIC_PREFIX — topic prefix (default: "durian/")
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.request
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

MQTT_HOST: str | None = None
_mqtt_client: Any = None


def _json_default(value: Any) -> Any:
    if hasattr(value, "item"):
        return value.item()
    if hasattr(value, "tolist"):
        return value.tolist()
    return str(value)


def _get_client():
    global _mqtt_client
    if _mqtt_client is not None:
        return _mqtt_client

    import os
    host = os.environ.get("MQTT_HOST")
    if not host:
        logger.debug("[MQTT] No MQTT_HOST configured — using stub mode")
        return None

    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        logger.warning("[MQTT] paho-mqtt not installed — using stub mode")
        return None

    user     = os.environ.get("MQTT_USER", "")
    password = os.environ.get("MQTT_PASSWORD", "")
    prefix   = os.environ.get("MQTT_TOPIC_PREFIX", "durian")

    client = mqtt.Client()
    if user:
        client.username_pw_set(user, password)

    try:
        client.connect(host.split(":")[0], int(host.split(":")[1]) if ":" in host else 1883, 60)
        client.loop_start()
        _mqtt_client = client
        logger.info(f"[MQTT] Connected to {host}")
    except Exception as e:
        logger.warning(f"[MQTT] Could not connect to {host}: {e} — using stub mode")
        _mqtt_client = None

    # Store prefix for later use
    _mqtt_client = (_mqtt_client, prefix) if _mqtt_client else None
    return _mqtt_client


def _publish(topic: str, payload: Dict[str, Any]) -> bool:
    """Send a JSON payload to an MQTT topic. Returns True if sent, False if stubbed."""
    result = _get_client()
    if result is None:
        logger.debug(f"[MQTT stub] {topic}: {json.dumps(payload)}")
        return False

    client, prefix = result
    full_topic = f"{prefix}/{topic}"
    try:
        client.publish(full_topic, json.dumps(payload), qos=1)
        logger.debug(f"[MQTT] {full_topic}: {json.dumps(payload)}")
        return True
    except Exception as e:
        logger.warning(f"[MQTT] Failed to publish {full_topic}: {e}")
        return False


def _post_webhook(payload: Dict[str, Any]) -> bool:
    webhook_url = os.environ.get("SFDS_EVENT_WEBHOOK_URL")
    if not webhook_url:
        return False

    try:
        data = json.dumps(payload, default=_json_default).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as response:
            return 200 <= response.status < 300
    except Exception as e:
        logger.warning(f"[EVENT webhook] Failed to post {webhook_url}: {e}")
        return False


def publish_enterprise_event(
    event_type: str,
    payload: Dict[str, Any],
    *,
    line_id: str = "line_01",
    camera_slot: int | None = None,
    correlation_id: str | None = None,
    topic: str | None = None,
) -> bool:
    event = {
        "event_id": str(uuid4()),
        "event_type": event_type,
        "source": "sfds",
        "version": "1.0",
        "occurred_at": datetime.utcnow().isoformat() + "Z",
        "line_id": line_id,
        "camera_slot": camera_slot,
        "correlation_id": correlation_id,
        "payload": payload,
    }
    event = json.loads(json.dumps(event, default=_json_default))
    mqtt_ok = _publish(topic or event_type.replace(".", "/"), event)
    webhook_ok = _post_webhook(event)
    if not mqtt_ok and not webhook_ok:
        logger.debug(f"[EVENT stub] {event_type}: {json.dumps(event)}")
    return mqtt_ok or webhook_ok


# ── Detection events ───────────────────────────────────────────────────────────

def publish_detection(
    class_name: str,
    confidence: float,
    bbox: Dict[str, float],
    device: str = "cpu",
    session_id: int | None = None,
) -> bool:
    """
    Publish a single fruit detection event.

    Args:
        class_name: "mature" | "immature" | "defective"
        confidence: 0.0–1.0
        bbox: {"x1", "y1", "x2", "y2"}
        device: device identifier
        session_id: optional inspection session ID
    """
    return _publish("detection", {
        "ts": datetime.utcnow().isoformat(),
        "class": class_name,
        "confidence": round(confidence, 4),
        "bbox": {k: round(v, 2) for k, v in bbox.items()},
        "device": device,
        "session_id": session_id,
    })


def publish_reject(
    bbox: Dict[str, float],
    reason: str,
    device: str = "cpu",
    session_id: int | None = None,
) -> bool:
    """
    Publish a reject event when a defective fruit is detected.
    Can trigger SCADA alarm for automatic sorting.
    """
    return _publish("reject", {
        "ts": datetime.utcnow().isoformat(),
        "bbox": {k: round(v, 2) for k, v in bbox.items()},
        "reason": reason,
        "device": device,
        "session_id": session_id,
    })


# ── Alarm events ─────────────────────────────────────────────────────────────

def publish_alarm(
    code: str,
    message: str,
    severity: str = "INFO",  # INFO | WARN | CRITICAL
    device: str = "cpu",
) -> bool:
    """
    Publish a SCADA alarm event.
    severity: INFO (normal), WARN (warning), CRITICAL (emergency)
    """
    return _publish("alarm", {
        "ts": datetime.utcnow().isoformat(),
        "code": code,
        "message": message,
        "severity": severity,
        "device": device,
    })


# ── Session events ────────────────────────────────────────────────────────────

def publish_session_start(
    employee_id: int,
    device: str = "cpu",
    session_id: int | None = None,
) -> bool:
    return _publish("session/start", {
        "ts": datetime.utcnow().isoformat(),
        "employee_id": employee_id,
        "device": device,
        "session_id": session_id,
    })


def publish_session_end(
    employee_id: int,
    session_id: int,
    total_inspected: int,
    mature_count: int,
    immature_count: int,
    defective_count: int,
    avg_confidence: float,
    device: str = "cpu",
) -> bool:
    return _publish("session/end", {
        "ts": datetime.utcnow().isoformat(),
        "employee_id": employee_id,
        "session_id": session_id,
        "total_inspected": total_inspected,
        "mature_count": mature_count,
        "immature_count": immature_count,
        "defective_count": defective_count,
        "avg_confidence": round(avg_confidence, 4),
        "device": device,
    })


# ── OEE events ────────────────────────────────────────────────────────────────

def publish_oee(
    shift_id: int,
    oee: float,
    availability: float,
    performance: float,
    quality: float,
    device: str = "cpu",
) -> bool:
    """
    Publish OEE (Overall Equipment Effectiveness) metrics for a shift.

    Args:
        shift_id: shift/session identifier
        oee: overall OEE percentage (0–100)
        availability: availability percentage (0–100)
        performance: performance percentage (0–100)
        quality: quality percentage (0–100)
    """
    return _publish("oee", {
        "ts": datetime.utcnow().isoformat(),
        "shift_id": shift_id,
        "oee": round(oee, 2),
        "availability": round(availability, 2),
        "performance": round(performance, 2),
        "quality": round(quality, 2),
        "device": device,
    })


# ── Conveyor status ───────────────────────────────────────────────────────────

def publish_conveyor_status(
    speed_rpm: float,
    running: bool,
    direction: str = "forward",  # forward | reverse | stopped
    device: str = "cpu",
) -> bool:
    """
    Publish conveyor belt status for SCADA monitoring.
    """
    return _publish("conveyor/status", {
        "ts": datetime.utcnow().isoformat(),
        "speed_rpm": round(speed_rpm, 2),
        "running": running,
        "direction": direction,
        "device": device,
    })
