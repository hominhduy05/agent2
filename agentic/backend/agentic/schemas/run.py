from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from agentic.utils import utc_now


class AgentRunStatus(str, Enum):
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class AgentRun(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid4()))
    started_at: datetime = Field(default_factory=utc_now)
    finished_at: datetime | None = None
    status: AgentRunStatus = AgentRunStatus.RUNNING
    trigger_source: str = "manual"
    trigger_event_id: str | None = None
    correlation_id: str | None = None
    summary: str = ""
    snapshot: dict[str, Any] = Field(default_factory=dict)
    anomalies_found: int = 0
    recommendations_found: int = 0
    error: str | None = None
