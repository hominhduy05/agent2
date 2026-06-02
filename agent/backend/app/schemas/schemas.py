from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


# ─── Vision ────────────────────────────────────────────────────────────────────

class VisionRequest(BaseModel):
    prompt: str = Field(default="Analyze this image in detail.")
    analysis_type: Literal["general", "dashboard", "error", "camera"] = "general"


class VisionResponse(BaseModel):
    analysis: str
    analysis_type: str
    confidence: Optional[float] = None
    suggestions: list[str] = Field(default_factory=list)


# ─── Report ───────────────────────────────────────────────────────────────────

class ReportGenerateRequest(BaseModel):
    title: str = "Vision Analysis Report"
    content: str
    analysis_type: str = "general"
    format: Literal["pdf", "docx", "html", "all"] = "all"
    metadata: Optional[dict] = Field(default_factory=dict)


class ReportItem(BaseModel):
    report_id: str
    title: str
    analysis_type: str
    format: str
    created_at: str
    size_bytes: Optional[int] = None


class ReportGenerateResponse(BaseModel):
    reports: list[ReportItem]
    message: str


class ReportListResponse(BaseModel):
    reports: list[ReportItem]
    total: int


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: Optional[dict] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    suggestions: list[str] = Field(default_factory=list)


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: str


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatHistoryItem]


# ─── SFDS ─────────────────────────────────────────────────────────────────────

class SFDSProxyResponse(BaseModel):
    source: str
    data: dict
    status_code: int


class SFDSEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    source: str = "sfds"
    version: str = "1.0"
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    line_id: str = "line_01"
    camera_slot: Optional[int] = None
    correlation_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
