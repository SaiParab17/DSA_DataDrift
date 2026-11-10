"""
DataWatch — Tests for database persistence, ORM models, and memory-safe streaming upload.
"""
import asyncio
import io
import os
import sys
import tempfile
import uuid
import pytest
from starlette.datastructures import UploadFile

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import quality.patch  # Apply monkeypatch first
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from database import Base
from models.db_models import (
    AnalysisRun,
    FeatureDrift,
    QualitySummary as DbQualitySummary,
    ModelImpactResult as DbModelImpactResult,
)
from models.drift_models import (
    DriftAnalysisResponse,
    FeatureResult,
    SchemaInfo,
    DistributionData,
    ModelImpactResult,
    MetricScores,
    MetricChangesPP,
)
from quality.models import QualitySummary, ExpectationResult
from api.drift import _save_upload_to_temp, _parse_csv_file, _persist_analysis_result


# ---------------------------------------------------------------------------
# Test 1: Verify Table Schemas and Foreign Keys
# ---------------------------------------------------------------------------
def test_database_schema_creation():
    """Verify that all 4 ORM tables compile and create properly."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    table_names = set(Base.metadata.tables.keys())
    assert "analysis_runs" in table_names
    assert "feature_drifts" in table_names
    assert "quality_summaries" in table_names
    assert "model_impact_results" in table_names


# ---------------------------------------------------------------------------
# Test 2: Upload Handler Streaming and Temp File Cleanup
# ---------------------------------------------------------------------------
def test_save_upload_to_temp_success():
    """Verify streaming chunks to a temporary file on disk."""
    async def _run():
        content = b"colA,colB\n1,2\n3,4\n"
        upload = UploadFile(filename="test_dataset.csv", file=io.BytesIO(content))

        temp_path = await _save_upload_to_temp(upload, "Test file")
        try:
            assert os.path.exists(temp_path)
            assert temp_path.endswith(".csv")
            with open(temp_path, "rb") as f:
                saved_content = f.read()
            assert saved_content == content
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    asyncio.run(_run())


def test_save_upload_to_temp_empty_file():
    """Verify that an empty upload file raises 422 and cleans up temp file."""
    async def _run():
        upload = UploadFile(filename="empty.csv", file=io.BytesIO(b""))
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await _save_upload_to_temp(upload, "Empty file")
        assert exc_info.value.status_code == 422
    asyncio.run(_run())


def test_save_upload_to_temp_invalid_extension():
    """Verify that non-CSV file raises 422."""
    async def _run():
        upload = UploadFile(filename="data.xlsx", file=io.BytesIO(b"data"))
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await _save_upload_to_temp(upload, "Invalid file")
        assert exc_info.value.status_code == 422
    asyncio.run(_run())


# ---------------------------------------------------------------------------
# Test 3: CSV Disk Parsing
# ---------------------------------------------------------------------------
def test_parse_csv_file_from_disk():
    """Verify reading and parsing CSV directly from temporary disk file."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w", encoding="utf-8") as tf:
        tf.write("feature_1,feature_2\n10,foo\n20,bar\n")
        temp_name = tf.name

    try:
        df = _parse_csv_file(temp_name, "Disk test")
        assert len(df) == 2
        assert list(df.columns) == ["feature_1", "feature_2"]
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


# ---------------------------------------------------------------------------
# Test 4: ORM Persistence Mapping
# ---------------------------------------------------------------------------
def test_persist_analysis_result_mapping():
    """
    Verify that _persist_analysis_result correctly populates all tables,
    foreign keys, JSON fields, and relationships.
    """
    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

        test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        TestSession = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

        run_id = str(uuid.uuid4())
        mock_response = DriftAnalysisResponse(
            analysis_id=run_id,
            reference_file="ref.csv",
            current_file="cur.csv",
            reference_rows=100,
            current_rows=100,
            features_analyzed=1,
            features_drifted=0,
            max_psi=0.04,
            psi_threshold=0.25,
            categorical_js_threshold=0.10,
            overall_status="NO_SIGNIFICANT_DRIFT",
            elapsed_ms=120.5,
            schema=SchemaInfo(
                common_columns=1,
                reference_only_columns=[],
                current_only_columns=[],
                numeric_columns=["col_num"],
                categorical_columns=[],
            ),
            features=[
                FeatureResult(
                    name="col_num",
                    type="numeric",
                    psi=0.04,
                    status="STABLE",
                    severity="NEGLIGIBLE",
                    ks_statistic=0.05,
                    ks_p_value=0.85,
                    wasserstein_distance=0.12,
                    reference_mean=10.0,
                    current_mean=10.2,
                    mean_change_percent=2.0,
                    reference_min=1.0,
                    current_min=1.0,
                    reference_max=20.0,
                    current_max=20.0,
                    distribution=DistributionData(
                        bins=[0.0, 5.0, 10.0, 15.0, 20.0],
                        bin_labels=["0-5", "5-10", "10-15", "15-20"],
                        reference_counts=[25, 25, 25, 25],
                        current_counts=[24, 26, 25, 25],
                        reference_percents=[25.0, 25.0, 25.0, 25.0],
                        current_percents=[24.0, 26.0, 25.0, 25.0],
                    ),
                )
            ],
            quality=QualitySummary(
                total_expectations=1,
                passed=1,
                failed=0,
                warnings=0,
                success_percent=100.0,
                overall_status="PASSED",
                expectations=[
                    ExpectationResult(
                        expectation="expect_column_values_to_not_be_null",
                        column="col_num",
                        success=True,
                        status="PASS",
                        severity="CRITICAL",
                        observed_value=0.0,
                        expected_value=0.0,
                    )
                ],
            ),
            model_impact=ModelImpactResult(
                status="COMPLETED",
                model_name="HistGradientBoostingClassifier",
                target_column="target",
                reference_metrics=MetricScores(accuracy=0.95, precision=0.94, recall=0.93, f1_score=0.935),
                current_metrics=MetricScores(accuracy=0.94, precision=0.93, recall=0.92, f1_score=0.925),
                metric_changes_percentage_points=MetricChangesPP(
                    accuracy=-1.0, precision=-1.0, recall=-1.0, f1_score=-1.0
                ),
                verdict="NO MATERIAL PERFORMANCE DECREASE DETECTED",
            ),
        )

        # Persist via async session
        async with TestSession() as session:
            await _persist_analysis_result(
                mock_response,
                session,
                reference_file_key="datasets/test/ref.csv",
                current_file_key="datasets/test/cur.csv",
            )

        # Verify insertion in database
        async with TestSession() as session:
            # Check AnalysisRun
            stmt = select(AnalysisRun).where(AnalysisRun.id == run_id)
            res = await session.execute(stmt)
            run = res.scalar_one_or_none()
            assert run is not None
            assert run.reference_file == "ref.csv"
            assert run.current_file == "cur.csv"
            assert run.reference_file_key == "datasets/test/ref.csv"
            assert run.current_file_key == "datasets/test/cur.csv"
            assert run.features_analyzed == 1
            assert run.features_drifted == 0
            assert run.max_psi == 0.04

            # Check FeatureDrift
            stmt_f = select(FeatureDrift).where(FeatureDrift.run_id == run_id)
            res_f = await session.execute(stmt_f)
            feature = res_f.scalar_one_or_none()
            assert feature is not None
            assert feature.feature_name == "col_num"
            assert feature.psi == 0.04
            assert feature.metrics_json["reference_mean"] == 10.0
            assert feature.distribution_json["distribution"]["bin_labels"] == ["0-5", "5-10", "10-15", "15-20"]

            # Check QualitySummary
            stmt_q = select(DbQualitySummary).where(DbQualitySummary.run_id == run_id)
            res_q = await session.execute(stmt_q)
            quality = res_q.scalar_one_or_none()
            assert quality is not None
            assert quality.total_expectations == 1
            assert quality.passed == 1
            assert quality.success_percent == 100.0
            assert len(quality.expectations_json) == 1

            # Check ModelImpactResult
            stmt_m = select(DbModelImpactResult).where(DbModelImpactResult.run_id == run_id)
            res_m = await session.execute(stmt_m)
            model = res_m.scalar_one_or_none()
            assert model is not None
            assert model.model_name == "HistGradientBoostingClassifier"
            assert model.verdict == "NO MATERIAL PERFORMANCE DECREASE DETECTED"
            assert model.reference_metrics_json["accuracy"] == 0.95
            assert model.metric_changes_json["accuracy"] == -1.0

        await test_engine.dispose()
    asyncio.run(_run())
