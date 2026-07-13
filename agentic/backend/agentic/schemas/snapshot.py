from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from agentic.utils import utc_now


class SourceStatus(BaseModel):
    status: str = "unknown"
    error: str | None = None


class BackendSnapshot(SourceStatus):
    healthy: bool = False
    service: str | None = None


class ModelSnapshot(SourceStatus):
    loaded: bool = False
    device: str | None = None
    model_format: str | None = None


class DatabaseSnapshot(SourceStatus):
    available: bool = False
    backend: str | None = None
    url: str | None = None


class ScaleSnapshot(SourceStatus):
    online: bool = False
    latest: dict[str, Any] | None = None


class CameraSnapshot(BaseModel):
    camera_id: str
    slot: int
    configured: bool = False
    online: bool = False
    message: str = "unknown"
    url: str = ""
    latency_ms: int | None = None
    width: int | None = None
    height: int | None = None
    last_frame_at: datetime | None = None
    error: str | None = None


class SortingSnapshot(SourceStatus):
    enabled: bool = False
    dry_run: bool = True
    routes: dict[str, Any] = Field(default_factory=dict)
    recent_command_count: int = 0
    recent_failures: int = 0
    esp32_connected: bool = False
    esp32_status: dict[str, Any] = Field(default_factory=dict)


class AuditSnapshot(SourceStatus):
    window_hours: int = 24
    detection_count: int = 0
    sorting_command_count: int = 0
    average_confidence: float = 0.0
    grade_counts: dict[str, int] = Field(default_factory=dict)
    camera_counts: dict[str, int] = Field(default_factory=dict)


class LogSnapshot(SourceStatus):
    path: str | None = None
    recent_lines: list[str] = Field(default_factory=list)


class SystemSnapshot(BaseModel):
    captured_at: datetime = Field(default_factory=utc_now)
    backend: BackendSnapshot = Field(default_factory=BackendSnapshot)
    model: ModelSnapshot = Field(default_factory=ModelSnapshot)
    database: DatabaseSnapshot = Field(default_factory=DatabaseSnapshot)
    scale: ScaleSnapshot = Field(default_factory=ScaleSnapshot)
    cameras: list[CameraSnapshot] = Field(default_factory=list)
    sorting: SortingSnapshot = Field(default_factory=SortingSnapshot)
    audit: AuditSnapshot = Field(default_factory=AuditSnapshot)
    logs: LogSnapshot = Field(default_factory=LogSnapshot)
    partial_errors: list[str] = Field(default_factory=list)
