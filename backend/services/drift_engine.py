"""
DataWatch Drift Engine — core statistical drift analysis.

This module is intentionally decoupled from FastAPI so it can be
tested independently.  It accepts pandas DataFrames and returns
structured result objects defined in models/drift_models.py.
"""
from __future__ import annotations

import math
import time
import uuid
import logging
from typing import Optional

import numpy as np
import pandas as pd
from scipy.stats import ks_2samp
from scipy.stats import wasserstein_distance as scipy_wasserstein

from models.drift_models import (
    DriftAnalysisResponse,
    FeatureResult,
    DistributionData,
    CategoryDistribution,
    SchemaInfo,
)
from utils.statistics import (
    build_numeric_bins,
    proportions_from_bins,
    calculate_psi_from_proportions,
    categorical_proportions,
    js_divergence,
    classify_psi_severity,
    classify_js_severity,
)

logger = logging.getLogger(__name__)

# How many histogram bins to use for numeric features.
N_BINS = 10

# Minimum distinct non-null values a column must have to be treated as numeric.
# Columns below this threshold are treated as categorical.
MIN_NUMERIC_UNIQUE = 5


class DriftEngine:
    """
    Main analysis class.

    Usage:
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(reference_df, current_df,
                                ref_name="ref.csv", cur_name="cur.csv")
    """

    def __init__(self, psi_threshold: float = 0.25, js_threshold: float = 0.1) -> None:
        if psi_threshold <= 0:
            raise ValueError("psi_threshold must be positive.")
        if js_threshold <= 0:
            raise ValueError("js_threshold must be positive.")
        self.psi_threshold = psi_threshold
        self.js_threshold = js_threshold

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(
        self,
        reference_df: pd.DataFrame,
        current_df: pd.DataFrame,
        ref_name: str = "reference.csv",
        cur_name: str = "current.csv",
    ) -> DriftAnalysisResponse:
        """Run full drift analysis and return a structured response."""
        t_start = time.perf_counter()

        schema = self._build_schema(reference_df, current_df)

        feature_results: list[FeatureResult] = []
        for col in schema.numeric_columns + schema.categorical_columns:
            try:
                result = self._analyze_column(col, reference_df, current_df, schema)
                feature_results.append(result)
            except Exception as exc:  # pragma: no cover — defensive
                logger.warning("Skipping column '%s': %s", col, exc)

        # Sort descending by primary metric (PSI for numeric, JSD for categorical)
        feature_results.sort(key=lambda f: f.psi if f.psi is not None else f.js_divergence, reverse=True)

        drifted = [f for f in feature_results if f.status == "DRIFT"]
        
        # max_psi only considers numerical features
        numeric_psis = [f.psi for f in feature_results if f.type == "numeric" and f.psi is not None]
        max_psi = max(numeric_psis) if numeric_psis else None
        overall_status = (
            "DRIFT_DETECTED" if drifted else "NO_SIGNIFICANT_DRIFT"
        )

        elapsed_ms = (time.perf_counter() - t_start) * 1000

        return DriftAnalysisResponse(
            analysis_id=str(uuid.uuid4())[:8],
            reference_file=ref_name,
            current_file=cur_name,
            reference_rows=len(reference_df),
            current_rows=len(current_df),
            features_analyzed=len(feature_results),
            features_drifted=len(drifted),
            max_psi=max_psi if max_psi is None else round(max_psi, 6),
            psi_threshold=self.psi_threshold,
            categorical_js_threshold=self.js_threshold,
            overall_status=overall_status,
            elapsed_ms=round(elapsed_ms, 2),
            schema=schema,
            features=feature_results,
        )

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------

    def _build_schema(
        self,
        reference_df: pd.DataFrame,
        current_df: pd.DataFrame,
    ) -> SchemaInfo:
        ref_cols = set(reference_df.columns)
        cur_cols = set(current_df.columns)
        common = ref_cols & cur_cols

        numeric_cols: list[str] = []
        categorical_cols: list[str] = []

        for col in sorted(common):
            ref_series = reference_df[col]
            # Determine type from the reference column
            if self._is_numeric_column(ref_series):
                numeric_cols.append(col)
            else:
                categorical_cols.append(col)

        return SchemaInfo(
            common_columns=len(common),
            reference_only_columns=sorted(ref_cols - cur_cols),
            current_only_columns=sorted(cur_cols - ref_cols),
            numeric_columns=numeric_cols,
            categorical_columns=categorical_cols,
        )

    def _is_numeric_column(self, series: pd.Series) -> bool:
        """
        Heuristic: treat a column as numeric if it has a numeric dtype and
        at least MIN_NUMERIC_UNIQUE distinct non-null values in the reference.
        Otherwise treat as categorical (handles binary flags, ordinal codes, etc.).
        """
        if not pd.api.types.is_numeric_dtype(series):
            return False
        n_unique = series.dropna().nunique()
        return n_unique >= MIN_NUMERIC_UNIQUE

    # ------------------------------------------------------------------
    # Per-column dispatch
    # ------------------------------------------------------------------

    def _analyze_column(
        self,
        col: str,
        reference_df: pd.DataFrame,
        current_df: pd.DataFrame,
        schema: SchemaInfo,
    ) -> FeatureResult:
        if col in schema.numeric_columns:
            return self._analyze_numeric(col, reference_df[col], current_df[col])
        return self._analyze_categorical(col, reference_df[col], current_df[col])

    # ------------------------------------------------------------------
    # Numeric analysis
    # ------------------------------------------------------------------

    def _analyze_numeric(
        self,
        name: str,
        ref_series: pd.Series,
        cur_series: pd.Series,
    ) -> FeatureResult:
        # Missing value stats
        ref_missing, ref_miss_pct, ref_clean = self._missing_stats(ref_series)
        cur_missing, cur_miss_pct, cur_clean = self._missing_stats(cur_series)

        # Degenerate: constant reference column
        if ref_clean.nunique() < 2:
            return self._constant_column_result(
                name, "numeric",
                ref_missing, ref_miss_pct, cur_missing, cur_miss_pct,
            )

        ref_vals = ref_clean.to_numpy(dtype=float)
        cur_vals = cur_clean.to_numpy(dtype=float)

        # --- Bins anchored to reference distribution ---
        edges = build_numeric_bins(ref_vals, n_bins=N_BINS)
        if len(edges) < 2:
            return self._constant_column_result(
                name, "numeric",
                ref_missing, ref_miss_pct, cur_missing, cur_miss_pct,
            )

        ref_prop = proportions_from_bins(ref_vals, edges)
        cur_prop = proportions_from_bins(cur_vals, edges)

        psi = calculate_psi_from_proportions(ref_prop, cur_prop)
        jsd = js_divergence(ref_prop, cur_prop)

        # KS test
        ks_stat, ks_pval = ks_2samp(ref_vals, cur_vals)

        # Wasserstein distance
        wass = float(scipy_wasserstein(ref_vals, cur_vals))

        # Mean statistics
        ref_mean = float(np.mean(ref_vals))
        cur_mean = float(np.mean(cur_vals))
        if ref_mean != 0:
            mean_change_pct = ((cur_mean - ref_mean) / abs(ref_mean)) * 100.0
        else:
            mean_change_pct = float("inf") if cur_mean != 0 else 0.0

        status, severity = classify_psi_severity(psi, self.psi_threshold)

        distribution = self._build_numeric_distribution(
            ref_vals, cur_vals, edges,
        )

        return FeatureResult(
            name=name,
            type="numeric",
            psi=round(psi, 6),
            js_divergence=round(jsd, 6),
            ks_statistic=round(float(ks_stat), 6),
            ks_p_value=round(float(ks_pval), 6),
            wasserstein_distance=round(wass, 4),
            reference_mean=round(ref_mean, 4),
            current_mean=round(cur_mean, 4),
            mean_change_percent=round(mean_change_pct, 2),
            reference_missing_count=ref_missing,
            reference_missing_percent=round(ref_miss_pct, 4),
            current_missing_count=cur_missing,
            current_missing_percent=round(cur_miss_pct, 4),
            status=status,
            severity=severity,
            distribution=distribution,
        )

    def _build_numeric_distribution(
        self,
        ref_vals: np.ndarray,
        cur_vals: np.ndarray,
        edges: np.ndarray,
    ) -> DistributionData:
        """Build DistributionData from real bin counts."""
        # Replace ±inf edges with actual data extremes for display
        display_edges = edges.copy()
        all_vals = np.concatenate([ref_vals, cur_vals])
        if np.isinf(display_edges[0]):
            display_edges[0] = float(np.min(all_vals))
        if np.isinf(display_edges[-1]):
            display_edges[-1] = float(np.max(all_vals))

        ref_counts, _ = np.histogram(ref_vals, bins=edges)
        cur_counts, _ = np.histogram(cur_vals, bins=edges)

        n_ref = max(len(ref_vals), 1)
        n_cur = max(len(cur_vals), 1)

        labels = [
            f"{display_edges[i]:.2g}–{display_edges[i+1]:.2g}"
            for i in range(len(display_edges) - 1)
        ]

        return DistributionData(
            bins=[round(float(e), 4) for e in display_edges],
            bin_labels=labels,
            reference_counts=ref_counts.tolist(),
            current_counts=cur_counts.tolist(),
            reference_percents=[round(c / n_ref * 100, 2) for c in ref_counts],
            current_percents=[round(c / n_cur * 100, 2) for c in cur_counts],
        )

    # ------------------------------------------------------------------
    # Categorical analysis
    # ------------------------------------------------------------------

    def _analyze_categorical(
        self,
        name: str,
        ref_series: pd.Series,
        cur_series: pd.Series,
    ) -> FeatureResult:
        ref_missing, ref_miss_pct, ref_clean = self._missing_stats(ref_series)
        cur_missing, cur_miss_pct, cur_clean = self._missing_stats(cur_series)

        ref_vals = ref_clean.astype(str).to_numpy()
        cur_vals = cur_clean.astype(str).to_numpy()

        # Union of categories
        categories = sorted(set(ref_vals) | set(cur_vals))

        ref_prop = categorical_proportions(ref_vals, categories)
        cur_prop = categorical_proportions(cur_vals, categories)

        psi = None  # Categorical uses JS divergence instead
        jsd = js_divergence(ref_prop, cur_prop)

        status, severity = classify_js_severity(jsd, self.js_threshold)

        cat_dist = self._build_categorical_distribution(
            ref_counts=ref_prop, # We can just pass the counts... wait, _build_categorical_distribution does its own counts. Let's fix that below.
            ref_vals=ref_vals,
            cur_vals=cur_vals,
            categories=categories,
        )

        return FeatureResult(
            name=name,
            type="categorical",
            psi=None,
            ks_statistic=None,
            ks_p_value=None,
            wasserstein_distance=None,
            js_divergence=round(jsd, 6),
            reference_missing_count=ref_missing,
            reference_missing_percent=round(ref_miss_pct, 4),
            current_missing_count=cur_missing,
            current_missing_percent=round(cur_miss_pct, 4),
            status=status,
            severity=severity,
            category_distribution=cat_dist,
        )

    def _build_categorical_distribution(
        self,
        ref_counts,
        ref_vals: np.ndarray,
        cur_vals: np.ndarray,
        categories: list[str],
    ) -> CategoryDistribution:
        n_ref = max(len(ref_vals), 1)
        n_cur = max(len(cur_vals), 1)

        ref_counts_dict = pd.Series(ref_vals).value_counts()
        cur_counts_dict = pd.Series(cur_vals).value_counts()

        ref_counts_list = [int(ref_counts_dict.get(c, 0)) for c in categories]
        cur_counts_list = [int(cur_counts_dict.get(c, 0)) for c in categories]

        return CategoryDistribution(
            categories=list(categories),
            reference_percentages=[round(c / n_ref * 100, 2) for c in ref_counts_list],
            current_percentages=[round(c / n_cur * 100, 2) for c in cur_counts_list],
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _missing_stats(
        series: pd.Series,
    ) -> tuple[int, float, pd.Series]:
        """Return (missing_count, missing_percent, clean_series)."""
        total = len(series)
        missing = int(series.isna().sum())
        pct = (missing / total * 100.0) if total > 0 else 0.0
        return missing, pct, series.dropna()

    def _constant_column_result(
        self,
        name: str,
        col_type: str,
        ref_missing: int,
        ref_miss_pct: float,
        cur_missing: int,
        cur_miss_pct: float,
    ) -> FeatureResult:
        """Return a NOT_APPLICABLE result for constant/degenerate columns."""
        if col_type == "numeric":
            return FeatureResult(
                name=name,
                type=col_type,
                psi=0.0,
                js_divergence=0.0,
                reference_missing_count=ref_missing,
                reference_missing_percent=round(ref_miss_pct, 4),
                current_missing_count=cur_missing,
                current_missing_percent=round(cur_miss_pct, 4),
                status="STABLE",
                severity="NEGLIGIBLE",
                distribution=DistributionData(
                    bins=[], bin_labels=[],
                    reference_counts=[], current_counts=[],
                    reference_percents=[], current_percents=[],
                ),
            )
        else:
            return FeatureResult(
                name=name,
                type=col_type,
                psi=None,
                js_divergence=0.0,
                reference_missing_count=ref_missing,
                reference_missing_percent=round(ref_miss_pct, 4),
                current_missing_count=cur_missing,
                current_missing_percent=round(cur_miss_pct, 4),
                status="STABLE",
                severity="NEGLIGIBLE",
                category_distribution=CategoryDistribution(
                    categories=[], reference_percentages=[], current_percentages=[]
                ),
            )
