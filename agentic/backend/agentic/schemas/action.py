from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from agentic.utils import utc_now


class RiskLevel(str, Enum):
    SAFE_READ = "SAFE_READ"
    SAFE_WRITE = "SAFE_WRITE"
    CONFIRM_REQUIRED = "CONFIRM_REQUIRED"
    FORBIDDEN = "FORBIDDEN"


class ActionStatus(str, Enum):
    PROPOSED = "PROPOSED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTING = "EXECUTING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class ActionRequest(BaseModel):
    action_key: str
    payload: dict[str, Any] = Field(default_factory=dict)
    requested_by: str = "system"
    approved: bool = False


class ActionDefinition(BaseModel):
    action_key: str
    title: str
    description: str
    risk_level: RiskLevel
    requires_confirmation: bool = False


class ActionResult(BaseModel):
    action_id: str = Field(default_factory=lambda: str(uuid4()))
    action_key: str
    risk_level: RiskLevel
    status: ActionStatus
    message: str
    result: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
