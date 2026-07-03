from __future__ import annotations

import json
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LOG_PATH = PROJECT_ROOT / "logs" / "sfds_sorting.log"

_logger: logging.Logger | None = None


def _get_logger() -> logging.Logger:
    global _logger
    if _logger is not None:
        return _logger

    log_path = Path(os.getenv("SFDS_SORTING_LOG_PATH", str(DEFAULT_LOG_PATH))).expanduser()
    log_path.parent.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("sfds.sorting")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if not logger.handlers:
        handler = RotatingFileHandler(
            log_path,
            maxBytes=2_000_000,
            backupCount=5,
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)

    _logger = logger
    return logger


def log_sorting_event(event: str, **fields: Any) -> None:
    payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event": event,
        **fields,
    }
    try:
        _get_logger().info(json.dumps(payload, ensure_ascii=False, default=str))
    except Exception:
        pass


def sorting_log_path() -> str:
    return str(Path(os.getenv("SFDS_SORTING_LOG_PATH", str(DEFAULT_LOG_PATH))).expanduser())
