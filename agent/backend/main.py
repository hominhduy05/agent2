"""Backward-compatible ASGI entrypoint.

Prefer running ``uvicorn app.main:app`` from the ``backend`` directory. This
shim keeps the older ``uvicorn main:app`` command working.
"""

from app.main import app
