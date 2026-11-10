"""
DataWatch — FastAPI router for the drift analysis endpoint.

POST /api/drift/analyze
    Accepts two CSV files (multipart/form-data), optional thresholds,
    and optional ML model impact settings. Performs streaming ingestion,
    calculates drift/quality/impact metrics, and persists the results.
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

import quality.patch  # MUST be before validator for Pydantic v1 compatibility
from models.drift_models import DriftAnalysisResponse, ModelImpactResult
from services.drift_engine import DriftEngine
from services.model_impact import ModelImpactAnalyzer

try:
    from database import AsyncSessionLocal, get_db
    from models.db_models import (
        AnalysisRun,
        FeatureDrift,
        QualitySummary as DbQualitySummary,
        ModelImpactResult as DbModelImpactResult,
    )
    from services.storage import upload_csv_to_s3
except ImportError:
    from backend.database import AsyncSessionLocal, get_db
    from backend.models.db_models import (
        AnalysisRun,
        FeatureDrift,
        QualitySummary as DbQualitySummary,
        ModelImpactResult as DbModelImpactResult,
    )
    from backend.services.storage import upload_csv_to_s3

router = APIRouter(prefix="/api/drift", tags=["drift"])
logger = logging.getLogger(__name__)

# Maximum upload size: 50 MB per file
_MAX_FILE_BYTES = 50 * 1024 * 1024
_CHUNK_SIZE = 1024 * 1024  # 1 MB streaming chunks


# ---------------------------------------------------------------------------
# Helpers for Streaming File Ingestion & Parsing
# ---------------------------------------------------------------------------

async def _save_upload_to_temp(upload: UploadFile, label: str) -> str:
    """
    Stream upload chunks directly to a temporary file on disk.
    Prevents RAM exhaustion by avoiding loading full raw byte buffers or strings into memory.

    Raises HTTPException on validation or size limit failure.
    """
    if not upload.filename or not upload.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: only CSV files are supported (received '{upload.filename}').",
        )

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    total_bytes = 0

    try:
        while True:
            chunk = await upload.read(_CHUNK_SIZE)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > _MAX_FILE_BYTES:
                mb = _MAX_FILE_BYTES // (1024 * 1024)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"{label}: file exceeds the {mb} MB upload limit.",
                )
            temp_file.write(chunk)
        temp_file.flush()
    except Exception:
        temp_file.close()
        if os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
            except Exception:
                pass
        raise
    finally:
        temp_file.close()

    if total_bytes == 0:
        if os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label}: uploaded file is empty.",
        )

    return temp_file.name


def _parse_csv_file(file_path: str, label: str) -> pd.DataFrame:
    """
    Parse CSV file directly from temporary disk path.
    """
    try:
        df = pd.read_csv(file_path, encoding="utf-8")
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(file_path, encoding="latin1")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{label}: could not decode file — only UTF-8 encoded CSV is supported.",
            )
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
# Database Persistence Helper
# ---------------------------------------------------------------------------

async def _persist_analysis_result(
    result: DriftAnalysisResponse,
    session: AsyncSession,
    reference_file_key: Optional[str] = None,
    current_file_key: Optional[str] = None,
) -> None:
    """
    Persist an audited DriftAnalysisResponse into relational database tables.
    """
    # 1. Primary AnalysisRun record
    db_run = AnalysisRun(
        id=result.analysis_id,
        reference_file=result.reference_file,
        current_file=result.current_file,
        reference_file_key=reference_file_key,
        current_file_key=current_file_key,
        reference_rows=result.reference_rows,
        current_rows=result.current_rows,
        features_analyzed=result.features_analyzed,
        features_drifted=result.features_drifted,
        max_psi=result.max_psi,
        overall_status=result.overall_status,
        elapsed_ms=result.elapsed_ms,
    )
    session.add(db_run)

    # 2. Individual FeatureDrift records
    for feat in result.features:
        metrics_dict = {
            "reference_mean": feat.reference_mean,
            "current_mean": feat.current_mean,
            "reference_median": feat.reference_median,
            "current_median": feat.current_median,
            "reference_std": feat.reference_std,
            "current_std": feat.current_std,
            "reference_variance": feat.reference_variance,
            "current_variance": feat.current_variance,
            "reference_min": feat.reference_min,
            "current_min": feat.current_min,
            "reference_max": feat.reference_max,
            "current_max": feat.current_max,
            "reference_q25": feat.reference_q25,
            "current_q25": feat.current_q25,
            "reference_q75": feat.reference_q75,
            "current_q75": feat.current_q75,
            "reference_iqr": feat.reference_iqr,
            "current_iqr": feat.current_iqr,
            "reference_unique_count": feat.reference_unique_count,
            "current_unique_count": feat.current_unique_count,
            "reference_mode": feat.reference_mode,
            "current_mode": feat.current_mode,
            "reference_mode_count": feat.reference_mode_count,
            "current_mode_count": feat.current_mode_count,
            "reference_mode_percent": feat.reference_mode_percent,
            "current_mode_percent": feat.current_mode_percent,
            "js_divergence": feat.js_divergence,
            "reference_missing_count": feat.reference_missing_count,
            "reference_missing_percent": feat.reference_missing_percent,
            "current_missing_count": feat.current_missing_count,
            "current_missing_percent": feat.current_missing_percent,
        }

        dist_dict = {}
        if feat.distribution:
            dist_dict["distribution"] = feat.distribution.model_dump()
        if feat.category_distribution:
            dist_dict["category_distribution"] = feat.category_distribution.model_dump()

        db_feat = FeatureDrift(
            run_id=result.analysis_id,
            feature_name=feat.name,
            type=feat.type,
            psi=feat.psi,
            status=feat.status,
            severity=feat.severity,
            ks_statistic=feat.ks_statistic,
            ks_p_value=feat.ks_p_value,
            wasserstein_distance=feat.wasserstein_distance,
            mean_change_percent=feat.mean_change_percent,
            metrics_json=metrics_dict,
            distribution_json=dist_dict if dist_dict else None,
        )
        session.add(db_feat)

    # 3. QualitySummary record
    if result.quality:
        db_quality = DbQualitySummary(
            run_id=result.analysis_id,
            total_expectations=result.quality.total_expectations,
            passed=result.quality.passed,
            failed=result.quality.failed,
            success_percent=result.quality.success_percent,
            overall_status=result.quality.overall_status,
            expectations_json=[e.model_dump() for e in result.quality.expectations],
        )
        session.add(db_quality)

    # 4. ModelImpactResult record
    if result.model_impact:
        ref_metrics = (
            result.model_impact.reference_metrics.model_dump()
            if result.model_impact.reference_metrics
            else None
        )
        cur_metrics = (
            result.model_impact.current_metrics.model_dump()
            if result.model_impact.current_metrics
            else None
        )
        chg_metrics = (
            result.model_impact.metric_changes_percentage_points.model_dump()
            if result.model_impact.metric_changes_percentage_points
            else None
        )

        db_model = DbModelImpactResult(
            run_id=result.analysis_id,
            status=result.model_impact.status,
            model_name=result.model_impact.model_name,
            target_column=result.model_impact.target_column,
            reference_metrics_json=ref_metrics,
            current_metrics_json=cur_metrics,
            metric_changes_json=chg_metrics,
            verdict=result.model_impact.verdict,
        )
        session.add(db_model)

    await session.commit()
    logger.info("Successfully persisted analysis run %s to database.", result.analysis_id)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=DriftAnalysisResponse)
async def analyze_drift(
    reference_file: UploadFile = File(..., description="Baseline reference CSV"),
    current_file: UploadFile = File(..., description="Current production CSV"),
    psi_threshold: float = Form(
        0.25, ge=0.01, le=1.0, description="PSI drift detection threshold"
    ),
    run_model_impact: bool = Form(False, description="Whether to evaluate ML Model Impact"),
    target_column: Optional[str] = Form(None, description="Classification target column name"),
    db: Optional[AsyncSession] = Depends(get_db),
) -> DriftAnalysisResponse:
    """
    Compare two CSV datasets and return per-feature drift metrics, quality validation,
    and optional ML Model Impact Analysis, with persistent database storage.
    """
    logger.info(
        "Starting DataWatch analysis (model_impact=%s, target=%s)",
        run_model_impact,
        target_column,
    )

    ref_temp_path: Optional[str] = None
    cur_temp_path: Optional[str] = None

    try:
        # Stream uploads directly to temporary files on disk
        ref_temp_path = await _save_upload_to_temp(reference_file, "Reference file")
        logger.info("Reference dataset saved to temporary storage")

        cur_temp_path = await _save_upload_to_temp(current_file, "Current file")
        logger.info("Current dataset saved to temporary storage")

        # Asynchronously upload both CSVs to AWS S3 storage in parallel before heavy compute
        ref_key, cur_key = await asyncio.gather(
            upload_csv_to_s3(ref_temp_path, reference_file.filename or "reference.csv"),
            upload_csv_to_s3(cur_temp_path, current_file.filename or "current.csv"),
            return_exceptions=False,
        )

        # Parse CSVs from disk
        reference_df = _parse_csv_file(ref_temp_path, "Reference file")
        logger.info("Reference dataset loaded into DataFrame")

        current_df = _parse_csv_file(cur_temp_path, "Current file")
        logger.info("Current dataset loaded into DataFrame")

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

        # Execute Statistical Drift Engine
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

        # Execute Great Expectations Data Quality Validation
        logger.info("Running data quality validation")
        try:
            from quality.validator import QualityValidator
            validator = QualityValidator()
            quality_summary = validator.validate(reference_df, current_df)
            result.quality = quality_summary
            logger.info("GX validation complete")
        except Exception as exc:
            logger.exception("Quality validation error")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Data quality validation failed: {str(exc)}",
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
                logger.info(
                    "ML Model Impact complete: status=%s, verdict=%s",
                    impact_result.status,
                    impact_result.verdict,
                )
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
            "Analysis complete. Reference rows: %d, Current rows: %d, "
            "Drifted features: %d, Quality checks: %d, Model impact status: %s",
            len(reference_df),
            len(current_df),
            result.features_drifted,
            result.quality.total_expectations if result.quality else 0,
            result.model_impact.status if result.model_impact else "N/A",
        )

        # Database persistence with failure isolation
        try:
            if db is not None:
                await _persist_analysis_result(
                    result,
                    db,
                    reference_file_key=ref_key,
                    current_file_key=cur_key,
                )
            else:
                async with AsyncSessionLocal() as session:
                    await _persist_analysis_result(
                        result,
                        session,
                        reference_file_key=ref_key,
                        current_file_key=cur_key,
                    )
        except Exception as exc:
            logger.exception(
                "Database persistence failed for analysis %s (non-fatal): %s",
                result.analysis_id,
                exc,
            )

        return result

    finally:
        # Guarantee cleanup of all temporary upload files on disk
        for path in (ref_temp_path, cur_temp_path):
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                    logger.debug("Cleaned up temporary file: %s", path)
                except Exception as exc:
                    logger.warning("Failed to clean up temporary file %s: %s", path, exc)
