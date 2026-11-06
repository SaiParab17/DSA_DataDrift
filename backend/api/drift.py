"""
DataWatch — FastAPI router for the drift analysis endpoint.

POST /api/drift/analyze
    Accepts two CSV files (multipart/form-data) and an optional
    psi_threshold float.  Returns a DriftAnalysisResponse JSON.
"""
from __future__ import annotations

import io
import logging
from typing import Optional

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from models.drift_models import DriftAnalysisResponse, ModelImpactResult
from services.drift_engine import DriftEngine
from services.model_impact import ModelImpactAnalyzer
from quality.validator import QualityValidator

router = APIRouter(prefix="/api/drift", tags=["drift"])
logger = logging.getLogger(__name__)

# Maximum upload size: 50 MB per file
_MAX_FILE_BYTES = 50 * 1024 * 1024


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _read_csv(upload: UploadFile, label: str) -> pd.DataFrame:
    """
    Read an uploaded CSV into a DataFrame with full validation.

    Raises HTTPException with a user-friendly message on any problem.
    """
    if not upload.filename or not upload.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: only CSV files are supported (received '{upload.filename}').",
        )

    raw = await upload.read()

    if len(raw) > _MAX_FILE_BYTES:
        mb = _MAX_FILE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{label}: file exceeds the {mb} MB upload limit.",
        )

    if len(raw) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: uploaded file is empty.",
        )

    # Attempt to decode and parse
    try:
        text = raw.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: could not decode file — only UTF-8 encoded CSV is supported.",
        )

    try:
        df = pd.read_csv(io.StringIO(text))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: failed to parse CSV — {exc}",
        )

    if df.empty or len(df) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: the uploaded dataset contains no rows.",
        )

    if len(df.columns) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: the CSV has no columns.",
        )

    # Warn about and drop duplicate column names
    if df.columns.duplicated().any():
        dupes = df.columns[df.columns.duplicated()].tolist()
        logger.warning("%s: dropping duplicate columns: %s", label, dupes)
        df = df.loc[:, ~df.columns.duplicated()]

    return df


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=DriftAnalysisResponse)
async def analyze_drift(
    reference_file: UploadFile = File(..., description="Baseline reference CSV"),
    current_file: UploadFile   = File(..., description="Current production CSV"),
    psi_threshold: float       = Form(0.25, ge=0.01, le=1.0,
                                      description="PSI drift detection threshold"),
    run_model_impact: bool     = Form(False, description="Whether to evaluate ML Model Impact"),
    target_column: Optional[str] = Form(None, description="Classification target column name"),
) -> DriftAnalysisResponse:
    """
    Compare two CSV datasets and return per-feature drift metrics, quality validation,
    and optional ML Model Impact Analysis.
    """
    logger.info("Starting DataWatch analysis (model_impact=%s, target=%s)", run_model_impact, target_column)
    
    reference_df = await _read_csv(reference_file, "Reference file")
    logger.info("Reference dataset loaded")
    
    current_df   = await _read_csv(current_file,   "Current file")
    logger.info("Current dataset loaded")

    # Validate column intersection
    common = set(reference_df.columns) & set(current_df.columns)
    if not common:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Reference and current datasets have no compatible columns. "
                f"Reference columns: {list(reference_df.columns)[:10]}. "
                f"Current columns: {list(current_df.columns)[:10]}."
            ),
        )

    logger.info("Running drift analysis")
    engine = DriftEngine(psi_threshold=psi_threshold)

    try:
        result = engine.analyze(
            reference_df,
            current_df,
            ref_name=reference_file.filename or "reference.csv",
            cur_name=current_file.filename or "current.csv",
        )
    except Exception as exc:
        logger.exception("Drift engine error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Drift analysis failed due to an internal error. Check server logs.",
        ) from exc

    logger.info("Running data quality validation")
    try:
        validator = QualityValidator()
        quality_summary = validator.validate(reference_df, current_df)
        result.quality = quality_summary
        logger.info("GX validation complete")
    except Exception as exc:
        logger.exception("Quality validation error")
        # Don't fail the whole request if just GX fails, just skip quality or raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Data quality validation failed: {str(exc)}"
        ) from exc

    # Optional ML Model Impact Analysis
    if run_model_impact and target_column:
        logger.info("Running ML Model Impact Analysis for target: %s", target_column)
        try:
            model_analyzer = ModelImpactAnalyzer()
            impact_result = model_analyzer.evaluate(
                reference_df=reference_df,
                current_df=current_df,
                target_column=target_column,
                run_model_impact=True,
            )
            result.model_impact = impact_result
            logger.info("ML Model Impact complete: status=%s, verdict=%s", impact_result.status, impact_result.verdict)
        except Exception as exc:
            logger.exception("Model impact analysis unexpected error")
            result.model_impact = ModelImpactResult(
                status="FAILED",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_column,
                message=f"Model impact analysis failed: {str(exc)}",
            )
    else:
        result.model_impact = ModelImpactResult(
            status="NOT_REQUESTED",
            verdict="MODEL IMPACT NOT EVALUATED",
            message="ML Model Impact analysis was not requested.",
        )

    logger.info(
        f"Analysis complete. Reference rows: {len(reference_df)}, Current rows: {len(current_df)}, "
        f"Drifted features: {result.features_drifted}, Quality checks: {result.quality.total_expectations}, "
        f"Model impact status: {result.model_impact.status}"
    )

    return result


