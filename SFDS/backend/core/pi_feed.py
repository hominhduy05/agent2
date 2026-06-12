import base64
import threading
import time
from datetime import datetime
from typing import Any


_lock = threading.Lock()
_feeds: dict[str, dict[str, Any]] = {}
_updated_at: dict[str, float] = {}
FEED_ONLINE_TTL_SECONDS = 5.0
DEFAULT_CAPACITY = 4


def update_pi_feed(
    *,
    pi_id: str,
    source_camera_id: int,
    feed_slot: int | None,
    image_bytes: bytes,
    image_width: int,
    image_height: int,
    detections: list[dict],
    conf: float,
    model_format: str,
) -> dict[str, Any]:
    channel_id = f"{pi_id}:{source_camera_id}"
    payload = {
        "type": "pi_feed",
        "channel_id": channel_id,
        "slot_index": source_camera_id if feed_slot is None else feed_slot,
        "pi_id": pi_id,
        "source_camera_id": source_camera_id,
        "timestamp": datetime.utcnow().isoformat(),
        "image_data_url": "data:image/jpeg;base64," + base64.b64encode(image_bytes).decode("ascii"),
        "image_width": image_width,
        "image_height": image_height,
        "detections": detections,
        "detection_count": len(detections),
        "confidence_threshold": conf,
        "model_format": model_format,
    }
    with _lock:
        _feeds[channel_id] = payload
        _updated_at[channel_id] = time.monotonic()
    return payload


def _with_status(channel_id: str, feed: dict[str, Any], now: float) -> dict[str, Any]:
    age_seconds = max(0.0, now - _updated_at.get(channel_id, 0.0))
    return {
        **feed,
        "online": age_seconds <= FEED_ONLINE_TTL_SECONDS,
        "age_seconds": round(age_seconds, 2),
    }


def get_pi_feeds(*, capacity: int = DEFAULT_CAPACITY) -> dict[str, Any]:
    with _lock:
        now = time.monotonic()
        feeds = [
            _with_status(channel_id, feed, now)
            for channel_id, feed in _feeds.items()
        ]
        feeds.sort(key=lambda item: (int(item.get("slot_index", 999)), str(item.get("channel_id", ""))))
        return {
            "type": "pi_feed_list",
            "capacity": capacity,
            "feeds": feeds,
            "online_count": sum(1 for item in feeds if item.get("online")),
        }


def get_latest_pi_feed() -> dict[str, Any]:
    feed_list = get_pi_feeds(capacity=DEFAULT_CAPACITY)
    feeds = feed_list["feeds"]
    online_feeds = [feed for feed in feeds if feed.get("online")]
    if not online_feeds:
        return {
            "type": "pi_feed",
            "slot_index": 0,
            "online": False,
            "message": "No Raspberry Pi frame received yet.",
        }
    return online_feeds[0]
