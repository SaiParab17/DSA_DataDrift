"""
DataWatch — SQLAlchemy ORM models for database persistence.

Maps the audited statistical drift, Great Expectations data quality,
and ML model impact domain models to normalized relational tables.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, Any

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    func,
)
from sqlalchemy.orm import relationship

try:
    from database import Base
except ImportError:
    from backend.database import Base


class AnalysisRun(Base):
    """
    Primary metadata record for a single dataset comparison execution.
    """
    __tablename__ = "analysis_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    reference_file = Column(String(255), nullable=False)
    current_file = Column(String(255), nullable=False)
    reference_file_key = Column(String(500), nullable=True)
    current_file_key = Column(String(500), nullable=True)
    reference_rows = Column(Integer, nullable=False)
    current_rows = Column(Integer, nullable=False)
    features_analyzed = Column(Integer, nullable=False)
    features_drifted = Column(Integer, nullable=False)
    max_psi = Column(Float, nullable=True)
    overall_status = Column(String(50), nullable=False)
    elapsed_ms = Column(Float, nullable=False)

    # Relationships
    features = relationship(
        "FeatureDrift",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    quality = relationship(
        "QualitySummary",
        back_populates="run",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    model_impact = relationship(
        "ModelImpactResult",
        back_populates="run",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class FeatureDrift(Base):
    """
    Individual feature statistical drift metrics and distributions.
    """
    __tablename__ = "feature_drifts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(
        String(36),
        ForeignKey("analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feature_name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # "numeric" | "categorical"
    psi = Column(Float, nullable=True)
    status = Column(String(50), nullable=False)  # "STABLE" | "WARNING" | "DRIFT"
    severity = Column(String(50), nullable=False)  # "NEGLIGIBLE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
    ks_statistic = Column(Float, nullable=True)
    ks_p_value = Column(Float, nullable=True)
    wasserstein_distance = Column(Float, nullable=True)
    mean_change_percent = Column(Float, nullable=True)
    metrics_json = Column(JSON, nullable=True)
    distribution_json = Column(JSON, nullable=True)

    run = relationship("AnalysisRun", back_populates="features")


class QualitySummary(Base):
    """
    Great Expectations validation run summary and per-expectation results.
    """
    __tablename__ = "quality_summaries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(
        String(36),
        ForeignKey("analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    total_expectations = Column(Integer, nullable=False)
    passed = Column(Integer, nullable=False)
    failed = Column(Integer, nullable=False)
    success_percent = Column(Float, nullable=False)
    overall_status = Column(String(50), nullable=False)
    expectations_json = Column(JSON, nullable=True)

    run = relationship("AnalysisRun", back_populates="quality")


class ModelImpactResult(Base):
    """
    Machine Learning performance impact evaluation between reference and current data.
    """
    __tablename__ = "model_impact_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(
        String(36),
        ForeignKey("analysis_runs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    status = Column(String(50), nullable=False)
    model_name = Column(String(255), nullable=True)
    target_column = Column(String(255), nullable=True)
    reference_metrics_json = Column(JSON, nullable=True)
    current_metrics_json = Column(JSON, nullable=True)
    metric_changes_json = Column(JSON, nullable=True)
    verdict = Column(String(100), nullable=True)

    run = relationship("AnalysisRun", back_populates="model_impact")

