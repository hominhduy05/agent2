"""Shared inference queue for snapshot detection."""
from __future__ import annotations

import asyncio
import os
from typing import Any, Callable


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


DETECT_CONCURRENCY = max(1, _env_int("SCADA_DETECT_CONCURRENCY", 2))
_inference_semaphore = asyncio.Semaphore(DETECT_CONCURRENCY)


def get_detect_concurrency() -> int:
    return DETECT_CONCURRENCY


async def run_inference(
    predict_fn: Callable[..., Any],
    *args: Any,
    **kwargs: Any,
) -> Any:
    async with _inference_semaphore:
        return await asyncio.to_thread(predict_fn, *args, **kwargs)
