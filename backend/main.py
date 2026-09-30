"""
DataWatch FastAPI application entry point.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.drift import router as drift_router

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
# CORS — allow the local Vite dev server (and an optional env override)
# ---------------------------------------------------------------------------
_frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
_allowed_origins = [_frontend_origin]

# Also allow localhost:5174 which Vite uses if 5173 is busy
if "5173" in _frontend_origin:
    _allowed_origins.append(_frontend_origin.replace("5173", "5174"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(drift_router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Simple health-check endpoint used by the frontend status indicator."""
    return {"status": "ok", "service": "DataWatch Drift Engine"}


# Log CORS origins at import time
logger.debug("DataWatch CORS allowed origins: %s", _allowed_origins)
