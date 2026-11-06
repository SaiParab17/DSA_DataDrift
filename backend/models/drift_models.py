"""
DataWatch Backend — Pydantic models for the drift analysis API.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class DistributionData(BaseModel):
    """Histogram data for rendering the distribution comparison chart."""
    bins: list[float]             # Bin edges (len = n_bins + 1 for numeric; category labels for categorical)
    bin_labels: list[str]         # Human-readable labels for each bin interval
    reference_counts: list[int]   # Raw counts per bin in reference dataset
    current_counts: list[int]     # Raw counts per bin in current dataset
    reference_percents: list[float]
    current_percents: list[float]


class CategoryDistribution(BaseModel):
    """Categorical distribution data."""
    categories: list[str]
    reference_percentages: list[float]
    current_percentages: list[float]


class FeatureResult(BaseModel):
    """Per-feature drift analysis result."""
    name: str
    type: str                       # "numeric" | "categorical"

    # --- Primary drift metric (always present) ---
    psi: Optional[float] = None
    status: str                     # "STABLE" | "WARNING" | "DRIFT"
    severity: str                   # "NEGLIGIBLE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL"

    # --- Numeric-only metrics (None for categorical) ---
    ks_statistic: Optional[float] = None
    ks_p_value: Optional[float] = None
    wasserstein_distance: Optional[float] = None
    reference_mean: Optional[float] = None
    current_mean: Optional[float] = None
    mean_change_percent: Optional[float] = None

    # --- Additional Numerical Profile metrics ---
    reference_median: Optional[float] = None
    current_median: Optional[float] = None
    reference_std: Optional[float] = None
    current_std: Optional[float] = None
    reference_variance: Optional[float] = None
    current_variance: Optional[float] = None
    reference_min: Optional[float] = None
    current_min: Optional[float] = None
    reference_max: Optional[float] = None
    current_max: Optional[float] = None
    reference_q25: Optional[float] = None
    current_q25: Optional[float] = None
    reference_q75: Optional[float] = None
    current_q75: Optional[float] = None
    reference_iqr: Optional[float] = None
    current_iqr: Optional[float] = None

    # --- Categorical & Identifier Profile metrics ---
    reference_unique_count: Optional[int] = None
    current_unique_count: Optional[int] = None
    reference_mode: Optional[str] = None
    current_mode: Optional[str] = None
    reference_mode_count: Optional[int] = None
    current_mode_count: Optional[int] = None
    reference_mode_percent: Optional[float] = None
    current_mode_percent: Optional[float] = None

    # --- Shared metric ---
    js_divergence: Optional[float] = None

    # --- Missing value info ---
    reference_missing_count: int = 0
    reference_missing_percent: float = 0.0
    current_missing_count: int = 0
    current_missing_percent: float = 0.0

    # --- Distribution data for the chart ---
    distribution: Optional[DistributionData] = None
    category_distribution: Optional[CategoryDistribution] = None


from quality.models import QualitySummary

class SchemaInfo(BaseModel):
    """Column intersection / difference info."""
    common_columns: int
    reference_only_columns: list[str]
    current_only_columns: list[str]
    numeric_columns: list[str]
    categorical_columns: list[str]
    identifier_columns: list[str] = []


class DatasetProfile(BaseModel):
    """Dataset-level profile statistics."""
    rows: int
    columns: int
    numeric_columns: int
    categorical_columns: int
    identifier_columns: int
    missing_cells: int
    missing_cell_percent: float
    duplicate_rows: int
    duplicate_row_percent: float
    memory_usage_bytes: int


class ProfileInfo(BaseModel):
    """Reference and current dataset profiles."""
    reference: DatasetProfile
    current: DatasetProfile


class MetricScores(BaseModel):
    """Classification performance metrics (0.0 to 1.0)."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float


class MetricChangesPP(BaseModel):
    """Metric changes in percentage points (current - reference)."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float


class ModelImpactResult(BaseModel):
    """ML Model Impact Analysis results."""
    status: str                     # "COMPLETED" | "NOT_REQUESTED" | "NOT_POSSIBLE" | "FAILED"
    message: Optional[str] = None
    model_name: Optional[str] = None
    target_column: Optional[str] = None
    classes: list[str] = []
    reference_train_rows: int = 0
    reference_evaluation_rows: int = 0
    current_evaluation_rows: int = 0
    excluded_reference_rows: int = 0
    excluded_current_rows: int = 0
    averaging_strategy: str = "macro"
    features_used: list[str] = []
    excluded_identifier_columns: list[str] = []
    reference_metrics: Optional[MetricScores] = None
    current_metrics: Optional[MetricScores] = None
    metric_changes_percentage_points: Optional[MetricChangesPP] = None
    verdict: Optional[str] = None   # "PERFORMANCE DECREASE OBSERVED" | "NO MATERIAL PERFORMANCE DECREASE DETECTED" | "MODEL IMPACT NOT EVALUATED"
    interpretation: Optional[str] = None


class DriftAnalysisResponse(BaseModel):
    """Top-level response from POST /api/drift/analyze."""
    analysis_id: str
    reference_file: str
    current_file: str

    reference_rows: int
    current_rows: int

    features_analyzed: int
    features_drifted: int

    max_psi: Optional[float] = None
    psi_threshold: float
    categorical_js_threshold: float

    overall_status: str             # "DRIFT_DETECTED" | "NO_SIGNIFICANT_DRIFT"
    elapsed_ms: float

    schema: SchemaInfo
    features: list[FeatureResult]
    
    # NEW: Data Quality section
    quality: Optional[QualitySummary] = None

    # NEW: Dataset-level profile section
    profile: Optional[ProfileInfo] = None

    # NEW: ML Model Impact Analysis section
    model_impact: Optional[ModelImpactResult] = None

