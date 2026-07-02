"""Database engine/session configuration for SFDS."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from sqlalchemy import JSON, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parents[1] / "core"
DB_PATH = BASE_DIR / "durian.db"


def _normalize_database_url(raw: str) -> str:
    value = raw.strip()
    if value.startswith("postgres://"):
        value = "postgresql://" + value[len("postgres://"):]
    if value.startswith("postgresql://"):
        value = "postgresql+psycopg://" + value[len("postgresql://"):]
    return value


def _build_database_url() -> str:
    explicit = os.getenv("SFDS_DATABASE_URL") or os.getenv("DATABASE_URL")
    if explicit:
        return _normalize_database_url(explicit)

    backend = os.getenv("SFDS_DB_BACKEND", "sqlite").strip().lower()
    if backend in {"postgres", "postgresql", "pg"}:
        host = os.getenv("SFDS_POSTGRES_HOST", "127.0.0.1")
        port = os.getenv("SFDS_POSTGRES_PORT", "5432")
        name = os.getenv("SFDS_POSTGRES_DB", "sfds_offline")
        user = os.getenv("SFDS_POSTGRES_USER", "sfds_app")
        password = os.getenv("SFDS_POSTGRES_PASSWORD", "sfds_offline_pass")
        return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"

    return f"sqlite:///{DB_PATH}"


def _safe_database_url(url: str) -> str:
    if "://" not in url or "@" not in url:
        return url
    scheme, rest = url.split("://", 1)
    credentials, host_part = rest.split("@", 1)
    user = credentials.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host_part}"


SQLALCHEMY_DATABASE_URL = _build_database_url()
IS_POSTGRES = SQLALCHEMY_DATABASE_URL.startswith("postgresql")

engine_kwargs: dict[str, Any] = {
    "pool_pre_ping": True,
}
if IS_POSTGRES:
    engine_kwargs.update({
        "pool_size": int(os.getenv("SFDS_DB_POOL_SIZE", "5")),
        "max_overflow": int(os.getenv("SFDS_DB_MAX_OVERFLOW", "10")),
        "pool_recycle": int(os.getenv("SFDS_DB_POOL_RECYCLE_SECONDS", "1800")),
    })
else:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
JsonType = JSON().with_variant(JSONB, "postgresql")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_database_info() -> dict[str, Any]:
    return {
        "backend": "postgresql" if IS_POSTGRES else "sqlite",
        "url": _safe_database_url(SQLALCHEMY_DATABASE_URL),
        "offline_local": True,
    }
