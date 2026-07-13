from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from pydantic import BaseModel, Field

from agentic.utils import utc_now


class Recommendation(BaseModel):
    recommendation_id: str = Field(default_factory=lambda: str(uuid4()))
    alert_id: str | None = None
    priority: int = 3
    recommendation: str
    action_key: str | None = None
    requires_confirmation: bool = False
    evidence_keys: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
