"""
DataWatch Backend — Database configuration and async session management.
"""
from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

try:
    from utils.db_url import DEFAULT_DATABASE_URL, normalize_database_url
except ImportError:
    from backend.utils.db_url import DEFAULT_DATABASE_URL, normalize_database_url

load_dotenv()


def create_configured_async_engine(database_url: str | None = None):
    """
    Resolve, normalize, and build an async SQLAlchemy engine using the shared
    URL normalization logic and driver-appropriate pooling/connect arguments.
    """
    resolved_url = normalize_database_url(
        database_url or os.getenv("DATABASE_URL") or DEFAULT_DATABASE_URL
    )
    kwargs: dict = {}
    if resolved_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # Production connection pool parameters for PostgreSQL
        kwargs.update({
            "pool_size": 10,
            "max_overflow": 20,
            "pool_recycle": 1800,
            "pool_pre_ping": True,
        })
    return resolved_url, create_async_engine(resolved_url, echo=False, **kwargs)


DATABASE_URL, engine = create_configured_async_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an asynchronous database session.
    Automatically handles commit/rollback and ensures session teardown.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

