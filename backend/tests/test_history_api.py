"""
DataWatch — Tests for historical analysis API endpoints and run reconstruction.
"""
import asyncio
import os
import sys
import uuid
from contextlib import asynccontextmanager

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi import HTTPException

from database import Base
from models.db_models import (
    AnalysisRun,
    FeatureDrift,
    QualitySummary as DbQualitySummary,
    ModelImpactResult as DbModelImpactResult,
)
from api.history import list_analysis_runs, get_analysis_run, compare_analysis_runs


@asynccontextmanager
async def get_test_db():
    """In-memory SQLite async engine and session for history tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionFactory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionFactory() as session:
        yield session

    await engine.dispose()


def test_list_analysis_runs_empty():
    """Empty database returns an empty list."""
    async def _run():
        async with get_test_db() as db:
            runs = await list_analysis_runs(limit=10, offset=0, db=db)
            assert runs == []
    asyncio.run(_run())


def test_list_analysis_runs_populated():
    """Populated database returns paginated runs joined with quality percent."""
    async def _run():
        async with get_test_db() as db:
            run_id = str(uuid.uuid4())
            run = AnalysisRun(
                id=run_id,
                reference_file="baseline.csv",
                current_file="production.csv",
                reference_rows=500,
                current_rows=500,
                features_analyzed=10,
                features_drifted=2,
                max_psi=0.42,
                overall_status="DRIFT_DETECTED",
                elapsed_ms=45.2,
            )
            db.add(run)

            quality = DbQualitySummary(
                run_id=run_id,
                total_expectations=8,
                passed=7,
                failed=1,
                success_percent=87.5,
                overall_status="WARNING",
                expectations_json=[],
            )
            db.add(quality)
            await db.commit()

            runs = await list_analysis_runs(limit=10, offset=0, db=db)
            assert len(runs) == 1
            assert runs[0]["id"] == run_id
            assert runs[0]["reference_file"] == "baseline.csv"
            assert runs[0]["current_file"] == "production.csv"
            assert runs[0]["overall_status"] == "DRIFT_DETECTED"
            assert runs[0]["max_psi"] == 0.42
            assert runs[0]["quality_success_percent"] == 87.5
    asyncio.run(_run())


def test_get_analysis_run_not_found():
    """Non-existent run_id raises 404 HTTPException."""
    async def _run():
        async with get_test_db() as db:
            with pytest.raises(HTTPException) as exc_info:
                await get_analysis_run("00000000-0000-0000-0000-000000000000", db=db)
            assert exc_info.value.status_code == 404
    asyncio.run(_run())


def test_get_analysis_run_reconstruction():
    """Reconstructs the exact DriftAnalysisResponse structure with all nested models."""
    async def _run():
        async with get_test_db() as db:
            run_id = str(uuid.uuid4())
            run = AnalysisRun(
                id=run_id,
                reference_file="ref_v1.csv",
                current_file="cur_v1.csv",
                reference_rows=1000,
                current_rows=1000,
                features_analyzed=2,
                features_drifted=1,
                max_psi=0.35,
                overall_status="DRIFT_DETECTED",
                elapsed_ms=78.5,
            )
            db.add(run)

            feat1 = FeatureDrift(
                run_id=run_id,
                feature_name="age",
                type="numeric",
                psi=0.35,
                status="DRIFT",
                severity="HIGH",
                ks_statistic=0.22,
                ks_p_value=0.001,
                wasserstein_distance=4.5,
                mean_change_percent=15.0,
                metrics_json={"reference_mean": 30.0, "current_mean": 34.5},
                distribution_json={
                    "distribution": {
                        "bins": [20.0, 30.0, 40.0],
                        "bin_labels": ["20-30", "30-40"],
                        "reference_counts": [500, 500],
                        "current_counts": [350, 650],
                        "reference_percents": [50.0, 50.0],
                        "current_percents": [35.0, 65.0],
                    }
                },
            )
            db.add(feat1)

            quality = DbQualitySummary(
                run_id=run_id,
                total_expectations=1,
                passed=1,
                failed=0,
                success_percent=100.0,
                overall_status="PASSED",
                expectations_json=[
                    {
                        "expectation": "expect_column_values_to_not_be_null",
                        "column": "age",
                        "success": True,
                        "status": "PASS",
                        "severity": "CRITICAL",
                        "observed_value": 0.0,
                        "expected_value": 0.0,
                    }
                ],
            )
            db.add(quality)

            impact = DbModelImpactResult(
                run_id=run_id,
                status="COMPLETED",
                model_name="HistGradientBoostingClassifier",
                target_column="churn",
                reference_metrics_json={"accuracy": 0.90, "precision": 0.88, "recall": 0.89, "f1_score": 0.885},
                current_metrics_json={"accuracy": 0.82, "precision": 0.80, "recall": 0.81, "f1_score": 0.805},
                metric_changes_json={"accuracy": -8.0, "precision": -8.0, "recall": -8.0, "f1_score": -8.0},
                verdict="PERFORMANCE DECREASE OBSERVED",
            )
            db.add(impact)
            await db.commit()

            # Reconstruct
            reconstructed = await get_analysis_run(run_id, db=db)

            assert reconstructed.analysis_id == run_id
            assert reconstructed.reference_file == "ref_v1.csv"
            assert reconstructed.current_file == "cur_v1.csv"
            assert reconstructed.overall_status == "DRIFT_DETECTED"
            assert reconstructed.max_psi == 0.35
            assert len(reconstructed.features) == 1
            assert reconstructed.features[0].name == "age"
            assert reconstructed.features[0].reference_mean == 30.0
            assert reconstructed.features[0].distribution.bin_labels == ["20-30", "30-40"]
            assert reconstructed.quality is not None
            assert reconstructed.quality.total_expectations == 1
            assert reconstructed.quality.success_percent == 100.0
            assert reconstructed.model_impact is not None
            assert reconstructed.model_impact.verdict == "PERFORMANCE DECREASE OBSERVED"
            assert reconstructed.model_impact.current_metrics.accuracy == 0.82
    asyncio.run(_run())


def test_compare_analysis_runs():
    """Compares two historical runs and generates a delta diff object."""
    async def _run():
        async with get_test_db() as db:
            id1 = str(uuid.uuid4())
            id2 = str(uuid.uuid4())

            run1 = AnalysisRun(
                id=id1,
                reference_file="ref.csv",
                current_file="day1.csv",
                reference_rows=100,
                current_rows=100,
                features_analyzed=5,
                features_drifted=0,
                max_psi=0.05,
                overall_status="NO_SIGNIFICANT_DRIFT",
                elapsed_ms=50.0,
            )
            run2 = AnalysisRun(
                id=id2,
                reference_file="ref.csv",
                current_file="day2.csv",
                reference_rows=100,
                current_rows=100,
                features_analyzed=5,
                features_drifted=2,
                max_psi=0.38,
                overall_status="DRIFT_DETECTED",
                elapsed_ms=55.0,
            )
            db.add(run1)
            db.add(run2)
            await db.commit()

            comparison = await compare_analysis_runs(run_id_1=id1, run_id_2=id2, db=db)

            assert comparison["run_1"]["id"] == id1
            assert comparison["run_2"]["id"] == id2
            assert comparison["diff"]["features_drifted_delta"] == 2
            assert comparison["diff"]["max_psi_delta"] == 0.33
            assert comparison["diff"]["status_changed"] is True
    asyncio.run(_run())
