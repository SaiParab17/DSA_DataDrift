"""
DataWatch — FastAPI router for historical analysis and run comparisons.

Endpoints:
- GET /api/drift/runs               Paginated list of historical analysis runs
- GET /api/drift/runs/compare       Side-by-side comparison between two runs
- GET /api/drift/runs/{run_id}      Reconstructed DriftAnalysisResponse for a specific run
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.drift_models import (
    CategoryDistribution,
    DistributionData,
    DriftAnalysisResponse,
    FeatureResult,
    MetricChangesPP,
    MetricScores,
    ModelImpactResult,
    SchemaInfo,
)
from quality.models import ExpectationResult, QualitySummary

try:
    from database import get_db
    from models.db_models import (
        AnalysisRun,
        FeatureDrift,
        QualitySummary as DbQualitySummary,
        ModelImpactResult as DbModelImpactResult,
    )
except ImportError:
    from backend.database import get_db
    from backend.models.db_models import (
        AnalysisRun,
        FeatureDrift,
        QualitySummary as DbQualitySummary,
        ModelImpactResult as DbModelImpactResult,
    )

router = APIRouter(prefix="/api/drift", tags=["history"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. GET /api/drift/runs — List runs
# ---------------------------------------------------------------------------

@router.get("/runs")
async def list_analysis_runs(
    limit: int = Query(10, ge=1, le=100, description="Max runs to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Retrieve a paginated list of historical analysis runs.
    """
    stmt = (
        select(
            AnalysisRun.id,
            AnalysisRun.created_at,
            AnalysisRun.reference_file,
            AnalysisRun.current_file,
            AnalysisRun.overall_status,
            AnalysisRun.max_psi,
            AnalysisRun.features_drifted,
            AnalysisRun.features_analyzed,
            DbQualitySummary.success_percent.label("quality_success_percent"),
        )
        .outerjoin(DbQualitySummary, AnalysisRun.id == DbQualitySummary.run_id)
        .order_by(AnalysisRun.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": row.id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "reference_file": row.reference_file,
            "current_file": row.current_file,
            "overall_status": row.overall_status,
            "max_psi": row.max_psi,
            "features_drifted": row.features_drifted,
            "features_analyzed": row.features_analyzed,
            "quality_success_percent": row.quality_success_percent,
        }
        for row in rows
    ]


# ---------------------------------------------------------------------------
# 2. GET /api/drift/runs/compare — Side-by-side comparison
# ---------------------------------------------------------------------------

@router.get("/runs/compare")
async def compare_analysis_runs(
    run_id_1: str = Query(..., description="First run UUID"),
    run_id_2: str = Query(..., description="Second run UUID"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Compare two historical analysis runs side-by-side.
    """
    stmt = (
        select(AnalysisRun)
        .options(
            selectinload(AnalysisRun.quality),
            selectinload(AnalysisRun.model_impact),
        )
        .where(AnalysisRun.id.in_([run_id_1, run_id_2]))
    )
    res = await db.execute(stmt)
    runs_by_id = {run.id: run for run in res.scalars().all()}

    if run_id_1 not in runs_by_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis run '{run_id_1}' not found.",
        )
    if run_id_2 not in runs_by_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis run '{run_id_2}' not found.",
        )

    run1 = runs_by_id[run_id_1]
    run2 = runs_by_id[run_id_2]

    def _summary(r: AnalysisRun) -> dict:
        return {
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reference_file": r.reference_file,
            "current_file": r.current_file,
            "reference_rows": r.reference_rows,
            "current_rows": r.current_rows,
            "features_analyzed": r.features_analyzed,
            "features_drifted": r.features_drifted,
            "max_psi": r.max_psi,
            "overall_status": r.overall_status,
            "elapsed_ms": r.elapsed_ms,
            "quality_success_percent": r.quality.success_percent if r.quality else None,
            "model_impact_verdict": r.model_impact.verdict if r.model_impact else None,
        }

    # Calculate metrics diff
    max_psi_delta = None
    if run1.max_psi is not None and run2.max_psi is not None:
        max_psi_delta = round(run2.max_psi - run1.max_psi, 4)

    quality_delta = None
    if (
        run1.quality
        and run2.quality
        and run1.quality.success_percent is not None
        and run2.quality.success_percent is not None
    ):
        quality_delta = round(run2.quality.success_percent - run1.quality.success_percent, 2)

    model_diff = None
    if run1.model_impact and run2.model_impact:
        f1_1 = (
            run1.model_impact.current_metrics_json.get("f1_score")
            if run1.model_impact.current_metrics_json
            else None
        )
        f1_2 = (
            run2.model_impact.current_metrics_json.get("f1_score")
            if run2.model_impact.current_metrics_json
            else None
        )
        model_diff = {
            "model_name": run2.model_impact.model_name or run1.model_impact.model_name,
            "f1_score_1": f1_1,
            "f1_score_2": f1_2,
            "f1_delta": round(f1_2 - f1_1, 4) if (f1_1 is not None and f1_2 is not None) else None,
            "verdict_changed": run1.model_impact.verdict != run2.model_impact.verdict,
        }

    return {
        "run_1": _summary(run1),
        "run_2": _summary(run2),
        "diff": {
            "max_psi_delta": max_psi_delta,
            "features_drifted_delta": run2.features_drifted - run1.features_drifted,
            "quality_success_percent_delta": quality_delta,
            "status_changed": run1.overall_status != run2.overall_status,
            "model_impact": model_diff,
        },
    }


# ---------------------------------------------------------------------------
# 3. GET /api/drift/runs/{run_id} — Reconstruct full DriftAnalysisResponse
# ---------------------------------------------------------------------------

@router.get("/runs/{run_id}", response_model=DriftAnalysisResponse)
async def get_analysis_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
) -> DriftAnalysisResponse:
    """
    Reconstruct the exact DriftAnalysisResponse for a saved run, querying
    the normalized tables and rebuilding all nested JSON structures.
    """
    stmt = (
        select(AnalysisRun)
        .options(
            selectinload(AnalysisRun.features),
            selectinload(AnalysisRun.quality),
            selectinload(AnalysisRun.model_impact),
        )
        .where(AnalysisRun.id == run_id)
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis run '{run_id}' not found.",
        )

    # 1. Reconstruct features
    features_list: list[FeatureResult] = []
    numeric_cols: list[str] = []
    categorical_cols: list[str] = []

    for feat in run.features:
        if feat.type == "numeric":
            numeric_cols.append(feat.feature_name)
        else:
            categorical_cols.append(feat.feature_name)

        metrics = feat.metrics_json or {}
        dist_json = feat.distribution_json or {}

        dist_obj: Optional[DistributionData] = None
        if "distribution" in dist_json and dist_json["distribution"]:
            dist_obj = DistributionData(**dist_json["distribution"])

        cat_dist_obj: Optional[CategoryDistribution] = None
        if "category_distribution" in dist_json and dist_json["category_distribution"]:
            cat_dist_obj = CategoryDistribution(**dist_json["category_distribution"])

        f_result = FeatureResult(
            name=feat.feature_name,
            type=feat.type,
            psi=feat.psi,
            status=feat.status,
            severity=feat.severity,
            ks_statistic=feat.ks_statistic,
            ks_p_value=feat.ks_p_value,
            wasserstein_distance=feat.wasserstein_distance,
            mean_change_percent=feat.mean_change_percent,
            reference_mean=metrics.get("reference_mean"),
            current_mean=metrics.get("current_mean"),
            reference_median=metrics.get("reference_median"),
            current_median=metrics.get("current_median"),
            reference_std=metrics.get("reference_std"),
            current_std=metrics.get("current_std"),
            reference_variance=metrics.get("reference_variance"),
            current_variance=metrics.get("current_variance"),
            reference_min=metrics.get("reference_min"),
            current_min=metrics.get("current_min"),
            reference_max=metrics.get("reference_max"),
            current_max=metrics.get("current_max"),
            reference_q25=metrics.get("reference_q25"),
            current_q25=metrics.get("current_q25"),
            reference_q75=metrics.get("reference_q75"),
            current_q75=metrics.get("current_q75"),
            reference_iqr=metrics.get("reference_iqr"),
            current_iqr=metrics.get("current_iqr"),
            reference_unique_count=metrics.get("reference_unique_count"),
            current_unique_count=metrics.get("current_unique_count"),
            reference_mode=metrics.get("reference_mode"),
            current_mode=metrics.get("current_mode"),
            reference_mode_count=metrics.get("reference_mode_count"),
            current_mode_count=metrics.get("current_mode_count"),
            reference_mode_percent=metrics.get("reference_mode_percent"),
            current_mode_percent=metrics.get("current_mode_percent"),
            js_divergence=metrics.get("js_divergence"),
            reference_missing_count=metrics.get("reference_missing_count", 0),
            reference_missing_percent=metrics.get("reference_missing_percent", 0.0),
            current_missing_count=metrics.get("current_missing_count", 0),
            current_missing_percent=metrics.get("current_missing_percent", 0.0),
            distribution=dist_obj,
            category_distribution=cat_dist_obj,
        )
        features_list.append(f_result)

    # Sort features by PSI / JS divergence descending to preserve original drift order
    features_list.sort(
        key=lambda f: (f.psi if f.type == "numeric" else (f.js_divergence or 0.0)) or 0.0,
        reverse=True,
    )

    # 2. Reconstruct quality summary
    quality_obj: Optional[QualitySummary] = None
    if run.quality:
        expectations_list = [
            ExpectationResult(**e) for e in (run.quality.expectations_json or [])
        ]
        quality_obj = QualitySummary(
            total_expectations=run.quality.total_expectations,
            passed=run.quality.passed,
            failed=run.quality.failed,
            warnings=0,
            success_percent=run.quality.success_percent,
            overall_status=run.quality.overall_status,
            expectations=expectations_list,
        )

    # 3. Reconstruct model impact result
    model_impact_obj: Optional[ModelImpactResult] = None
    if run.model_impact:
        ref_m = (
            MetricScores(**run.model_impact.reference_metrics_json)
            if run.model_impact.reference_metrics_json
            else None
        )
        cur_m = (
            MetricScores(**run.model_impact.current_metrics_json)
            if run.model_impact.current_metrics_json
            else None
        )
        chg_m = (
            MetricChangesPP(**run.model_impact.metric_changes_json)
            if run.model_impact.metric_changes_json
            else None
        )

        model_impact_obj = ModelImpactResult(
            status=run.model_impact.status,
            model_name=run.model_impact.model_name,
            target_column=run.model_impact.target_column,
            verdict=run.model_impact.verdict,
            reference_metrics=ref_m,
            current_metrics=cur_m,
            metric_changes_percentage_points=chg_m,
        )

    # 4. Construct final response
    return DriftAnalysisResponse(
        analysis_id=run.id,
        reference_file=run.reference_file,
        current_file=run.current_file,
        reference_rows=run.reference_rows,
        current_rows=run.current_rows,
        features_analyzed=run.features_analyzed,
        features_drifted=run.features_drifted,
        max_psi=run.max_psi,
        psi_threshold=0.25,
        categorical_js_threshold=0.10,
        overall_status=run.overall_status,
        elapsed_ms=run.elapsed_ms,
        schema=SchemaInfo(
            common_columns=len(features_list),
            reference_only_columns=[],
            current_only_columns=[],
            numeric_columns=numeric_cols,
            categorical_columns=categorical_cols,
            identifier_columns=[],
        ),
        features=features_list,
        quality=quality_obj,
        profile=None,
        model_impact=model_impact_obj,
    )

