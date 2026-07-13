from __future__ import annotations

import os

from pydantic import BaseModel


class AgenticThresholds(BaseModel):
    camera_latency_warning_ms: int = 1500
    camera_latency_critical_ms: int = 3000
    confidence_minimum_average: float = 0.75
    confidence_minimum_sample_size: int = 30
    audit_window_hours: int = 24
    sorting_log_tail_lines: int = 80

    @classmethod
    def from_env(cls) -> "AgenticThresholds":
        return cls(
            camera_latency_warning_ms=int(os.getenv("AGENTIC_CAMERA_LATENCY_WARNING_MS", "1500")),
            camera_latency_critical_ms=int(os.getenv("AGENTIC_CAMERA_LATENCY_CRITICAL_MS", "3000")),
            confidence_minimum_average=float(os.getenv("AGENTIC_CONFIDENCE_MIN_AVG", "0.75")),
            confidence_minimum_sample_size=int(os.getenv("AGENTIC_CONFIDENCE_MIN_SAMPLE", "30")),
            audit_window_hours=int(os.getenv("AGENTIC_AUDIT_WINDOW_HOURS", "24")),
            sorting_log_tail_lines=int(os.getenv("AGENTIC_LOG_TAIL_LINES", "80")),
        )

