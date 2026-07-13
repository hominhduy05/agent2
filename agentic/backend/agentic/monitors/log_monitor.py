from __future__ import annotations

from collections import deque
from pathlib import Path

from agentic.schemas.snapshot import LogSnapshot


def collect_log_snapshot(max_lines: int = 80) -> tuple[LogSnapshot, list[str]]:
    errors: list[str] = []
    try:
        from services.sfds_logger import sorting_log_path

        path = Path(sorting_log_path())
        if not path.exists():
            return LogSnapshot(status="missing", path=str(path), recent_lines=[]), errors
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            recent = deque(handle, maxlen=max(1, max_lines))
        return LogSnapshot(
            status="ok",
            path=str(path),
            recent_lines=[line.rstrip("\n") for line in recent],
        ), errors
    except Exception as exc:
        errors.append(f"log monitor unavailable: {exc}")
        return LogSnapshot(status="unavailable", error=str(exc)), errors

