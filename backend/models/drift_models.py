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


class FeatureResult(BaseModel):
    """Per-feature drift analysis result."""
    name: str
    type: str                       # "numeric" | "categorical"

    # --- Primary drift metric (always present) ---
    psi: float
    status: str                     # "STABLE" | "WARNING" | "DRIFT"
    severity: str                   # "NEGLIGIBLE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL"

    # --- Numeric-only metrics (None for categorical) ---
    ks_statistic: Optional[float] = None
    ks_p_value: Optional[float] = None
    wasserstein_distance: Optional[float] = None
    reference_mean: Optional[float] = None
    current_mean: Optional[float] = None
    mean_change_percent: Optional[float] = None

    # --- Shared metric ---
    js_divergence: float

    # --- Missing value info ---
    reference_missing_count: int = 0
    reference_missing_percent: float = 0.0
    current_missing_count: int = 0
    current_missing_percent: float = 0.0

    # --- Distribution data for the chart ---
    distribution: DistributionData


class SchemaInfo(BaseModel):
    """Column intersection / difference info."""
    common_columns: int
    reference_only_columns: list[str]
    current_only_columns: list[str]
    numeric_columns: list[str]
    categorical_columns: list[str]


class DriftAnalysisResponse(BaseModel):
    """Top-level response from POST /api/drift/analyze."""
    analysis_id: str
    reference_file: str
    current_file: str

    reference_rows: int
    current_rows: int

    features_analyzed: int
    features_drifted: int

    max_psi: float
    psi_threshold: float

    overall_status: str             # "DRIFT_DETECTED" | "NO_SIGNIFICANT_DRIFT"
    elapsed_ms: float

    schema: SchemaInfo
    features: list[FeatureResult]
