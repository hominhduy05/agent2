"""Backward-compatible database exports.

New code should import from the `db` package. This module stays in place so
existing routers and auth helpers continue to work during the refactor.
"""
from db import *  # noqa: F401,F403
