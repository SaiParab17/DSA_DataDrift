"""
DataWatch FastAPI application entry point.
"""
from __future__ import annotations

import quality.patch  # MUST be first to monkeypatch pydantic

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from api.drift import router as drift_router
from api.history import router as history_router

try:
    from database import engine
except ImportError:
    from backend.database import engine

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info("DataWatch backend starting up…")
    yield
    logger.info("DataWatch backend shut down.")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="DataWatch — Drift Analysis API",
    description=(
        "Compares reference and current datasets to detect statistical drift "
        "using PSI, KS, Wasserstein distance, and Jensen-Shannon divergence."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow local Vite dev servers and production frontend origins
# ---------------------------------------------------------------------------
raw_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://localhost:5174")
allowed_origins: list[str] = [
    origin.strip() for origin in raw_origins.split(",") if origin.strip()
]

# Ensure localhost:5174 fallback is available if 5173 is configured
if any("5173" in o for o in allowed_origins) and not any("5174" in o for o in allowed_origins):
    allowed_origins.append("http://localhost:5174")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(drift_router)
app.include_router(history_router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Production health check verifying API responsiveness and database connectivity."""
    db_status = "connected"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("Database connectivity check failed: %s", exc)
        db_status = f"disconnected: {exc}"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "service": "DataWatch Drift Engine",
        "database": db_status,
    }


logger.info("DataWatch CORS allowed origins: %s", allowed_origins)
