from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from agentic.utils import utc_now


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    SUPPRESSED = "SUPPRESSED"


class AlertFinding(BaseModel):
    alert_id: str = Field(default_factory=lambda: str(uuid4()))
    run_id: str | None = None
    code: str
    severity: AlertSeverity
    title: str
    message: str
    source: str
    deduplication_key: str
    camera_slot: int | None = None
    status: AlertStatus = AlertStatus.OPEN
    evidence: dict[str, Any] = Field(default_factory=dict)
    first_seen_at: datetime = Field(default_factory=utc_now)
    last_seen_at: datetime = Field(default_factory=utc_now)
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
