from collections import deque
from threading import Lock
from typing import Any

from app.core.config import settings
from app.schemas.schemas import SFDSEvent


class SFDSEventStore:
    def __init__(self, max_events: int):
        self._events: deque[dict[str, Any]] = deque(maxlen=max_events)
        self._lock = Lock()

    def add(self, event: SFDSEvent) -> dict[str, Any]:
        item = event.model_dump()
        with self._lock:
            self._events.appendleft(item)
        return item

    def list(self, limit: int = 50, event_type: str | None = None) -> list[dict[str, Any]]:
        limit = max(1, min(limit, self._events.maxlen or limit))
        with self._lock:
            events = list(self._events)
        if event_type:
            events = [event for event in events if event.get("event_type") == event_type]
        return events[:limit]


sfds_event_store = SFDSEventStore(settings.sfds_event_retention)
