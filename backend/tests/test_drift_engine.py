"""
DataWatch — Tests for the DriftEngine statistical calculations.

These tests use synthetic CSV data so they work independently of
any real dataset.  Run with: pytest tests/ -v
"""
from __future__ import annotations

import io
import math
import numpy as np
import pandas as pd
import pytest

# Add backend root to path for imports
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.drift_engine import DriftEngine
from utils.statistics import (
    calculate_psi_from_proportions,
    build_numeric_bins,
    proportions_from_bins,
    js_divergence,
    classify_psi_severity,
    categorical_proportions,
)


# ============================================================================
# Utility / statistics tests
# ============================================================================

class TestPSI:
    def test_identical_distributions_zero_psi(self):
        p = np.array([0.2, 0.3, 0.3, 0.2])
        psi = calculate_psi_from_proportions(p, p)
        assert psi == pytest.approx(0.0, abs=1e-6)

    def test_small_drift_low_psi(self):
        p = np.array([0.25, 0.25, 0.25, 0.25])
        q = np.array([0.24, 0.26, 0.24, 0.26])
        psi = calculate_psi_from_proportions(p, q)
        assert psi < 0.1

    def test_large_drift_high_psi(self):
        p = np.array([0.70, 0.20, 0.05, 0.05])
        q = np.array([0.05, 0.05, 0.20, 0.70])
        psi = calculate_psi_from_proportions(p, q)
        assert psi > 0.25

    def test_zero_proportions_handled(self):
        p = np.array([0.5, 0.5, 0.0, 0.0])
        q = np.array([0.0, 0.0, 0.5, 0.5])
        # Should not raise; epsilon substitution prevents log(0)
        psi = calculate_psi_from_proportions(p, q)
        assert math.isfinite(psi)
        assert psi > 0


class TestBinning:
    def test_returns_correct_number_of_edges(self):
        data = np.random.normal(0, 1, 1000)
        edges = build_numeric_bins(data, n_bins=10)
        # Unique edges may be fewer than 11 for discrete data, but ≥ 2
        assert len(edges) >= 2

    def test_first_edge_is_neg_inf(self):
        data = np.arange(100, dtype=float)
        edges = build_numeric_bins(data, n_bins=5)
        assert edges[0] == -np.inf

    def test_last_edge_is_pos_inf(self):
        data = np.arange(100, dtype=float)
        edges = build_numeric_bins(data, n_bins=5)
        assert edges[-1] == np.inf

    def test_proportions_sum_to_one(self):
        data = np.random.normal(50, 10, 500)
        edges = build_numeric_bins(data, n_bins=10)
        prop = proportions_from_bins(data, edges)
        assert prop.sum() == pytest.approx(1.0, abs=1e-6)


class TestJSDivergence:
    def test_identical_distributions_zero_jsd(self):
        p = np.array([0.25, 0.25, 0.25, 0.25])
        assert js_divergence(p, p) == pytest.approx(0.0, abs=1e-6)

    def test_completely_different_distributions_max_jsd(self):
        p = np.array([1.0, 0.0])
        q = np.array([0.0, 1.0])
        jsd = js_divergence(p, q)
        # Max JS divergence is ln(2) ≈ 0.693
        assert jsd == pytest.approx(math.log(2), abs=0.01)

    def test_result_bounded(self):
        for _ in range(10):
            p = np.random.dirichlet(np.ones(5))
            q = np.random.dirichlet(np.ones(5))
            jsd = js_divergence(p, q)
            assert 0.0 <= jsd <= math.log(2) + 1e-9


class TestSeverity:
    def test_stable_below_point_one(self):
        status, sev = classify_psi_severity(0.05, 0.25)
        assert status == "STABLE"

    def test_warning_between_point_one_and_threshold(self):
        status, sev = classify_psi_severity(0.15, 0.25)
        assert status == "WARNING"

    def test_drift_at_threshold(self):
        status, sev = classify_psi_severity(0.25, 0.25)
        assert status == "DRIFT"

    def test_critical_well_above_threshold(self):
        status, sev = classify_psi_severity(0.5, 0.25)
        assert sev == "CRITICAL"

    def test_custom_threshold(self):
        status, sev = classify_psi_severity(0.12, 0.10)
        assert status == "DRIFT"


# ============================================================================
# DriftEngine integration tests (using synthetic DataFrames)
# ============================================================================

def _make_ref_df() -> pd.DataFrame:
    np.random.seed(42)
    return pd.DataFrame({
        "age":      np.random.normal(35, 10, 1000).astype(int),
        "salary":   np.random.normal(50000, 15000, 1000),
        "tenure":   np.random.uniform(0, 40, 1000),
        "dept":     np.random.choice(["eng", "sales", "hr"], 1000),
        "contract": np.random.choice(["full-time", "part-time"], 1000),
    })


def _make_cur_no_drift_df() -> pd.DataFrame:
    np.random.seed(99)
    return pd.DataFrame({
        "age":      np.random.normal(35, 10, 1000).astype(int),
        "salary":   np.random.normal(50000, 15000, 1000),
        "tenure":   np.random.uniform(0, 40, 1000),
        "dept":     np.random.choice(["eng", "sales", "hr"], 1000),
        "contract": np.random.choice(["full-time", "part-time"], 1000),
    })


def _make_cur_drift_df() -> pd.DataFrame:
    """Heavily shifted salary and different dept distribution."""
    np.random.seed(7)
    return pd.DataFrame({
        "age":      np.random.normal(35, 10, 1000).astype(int),
        "salary":   np.random.normal(80000, 20000, 1000),   # large shift
        "tenure":   np.random.uniform(0, 40, 1000),
        "dept":     np.random.choice(["eng", "sales", "hr"],
                                     1000, p=[0.8, 0.1, 0.1]),  # new dist
        "contract": np.random.choice(["full-time", "part-time"], 1000),
    })


class TestDriftEngineNumeric:
    def test_identical_data_no_drift(self):
        ref = _make_ref_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, ref.copy())
        assert result.overall_status == "NO_SIGNIFICANT_DRIFT"
        assert result.features_drifted == 0

    def test_no_drift_dataset_stable(self):
        ref = _make_ref_df()
        cur = _make_cur_no_drift_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        # Small samples — allow a tiny amount of random drift
        assert result.max_psi < 0.25 or result.features_drifted <= 1

    def test_large_salary_drift_detected(self):
        ref = _make_ref_df()
        cur = _make_cur_drift_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        salary_feat = next(f for f in result.features if f.name == "salary")
        assert salary_feat.psi > 0.25
        assert salary_feat.status == "DRIFT"

    def test_numeric_feature_has_required_fields(self):
        ref = _make_ref_df()
        cur = _make_cur_drift_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        salary_feat = next(f for f in result.features if f.name == "salary")
        assert salary_feat.ks_statistic is not None
        assert salary_feat.ks_p_value is not None
        assert salary_feat.wasserstein_distance is not None
        assert salary_feat.reference_mean is not None
        assert salary_feat.current_mean is not None
        assert salary_feat.distribution.reference_counts

    def test_features_sorted_by_psi_descending(self):
        ref = _make_ref_df()
        cur = _make_cur_drift_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        metrics = [f.psi if f.psi is not None else f.js_divergence for f in result.features]
        assert metrics == sorted(metrics, reverse=True)

    def test_missing_values_handled(self):
        ref = _make_ref_df().copy()
        cur = _make_cur_drift_df().copy()
        # Inject 10% NaN into salary columns
        ref.loc[ref.sample(frac=0.1).index, "salary"] = np.nan
        cur.loc[cur.sample(frac=0.1).index, "salary"] = np.nan
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        salary_feat = next(f for f in result.features if f.name == "salary")
        assert salary_feat.reference_missing_count > 0
        assert math.isfinite(salary_feat.psi)

    def test_constant_column_graceful(self):
        ref = pd.DataFrame({"value": [42.0] * 100, "group": ["a"] * 100})
        cur = pd.DataFrame({"value": [42.0] * 100, "group": ["b"] * 100})
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        # Should not raise; constant column returns STABLE
        const_feat = next(f for f in result.features if f.name == "value")
        assert const_feat.status == "STABLE"


class TestDriftEngineCategorical:
    def test_same_categorical_distribution_stable(self):
        ref = _make_ref_df()
        cur = _make_cur_no_drift_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        dept_feat = next(f for f in result.features if f.name == "dept")
        assert dept_feat.type == "categorical"
        assert dept_feat.js_divergence < 0.1

    def test_shifted_categorical_detected(self):
        ref = _make_ref_df()
        cur = _make_cur_drift_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        dept_feat = next(f for f in result.features if f.name == "dept")
        assert dept_feat.type == "categorical"
        assert dept_feat.js_divergence > 0.05   # should at least show notable drift

    def test_new_category_handled(self):
        ref = pd.DataFrame({"cat": ["a", "b", "a", "b"] * 25})
        cur = pd.DataFrame({"cat": ["a", "b", "c", "c"] * 25})  # 'c' is new
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        cat_feat = next(f for f in result.features if f.name == "cat")
        assert math.isfinite(cat_feat.js_divergence)
        assert math.isfinite(cat_feat.js_divergence)

    def test_missing_category_handled(self):
        ref = pd.DataFrame({"cat": ["a", "b", "c"] * 33})
        cur = pd.DataFrame({"cat": ["a", "b", "a"] * 33})  # 'c' missing
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        cat_feat = next(f for f in result.features if f.name == "cat")
        assert math.isfinite(cat_feat.js_divergence)


class TestDriftEngineResponse:
    def test_response_fields_present(self):
        ref = _make_ref_df()
        cur = _make_cur_drift_df()
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur, "ref.csv", "cur.csv")
        assert result.reference_file == "ref.csv"
        assert result.current_file == "cur.csv"
        assert result.reference_rows == 1000
        assert result.current_rows == 1000
        assert result.features_analyzed == 5
        assert isinstance(result.elapsed_ms, float)
        assert result.schema.common_columns == 5

    def test_schema_only_columns_reported(self):
        ref = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6], "old": [7, 8, 9]})
        cur = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6], "new": [10, 11, 12]})
        engine = DriftEngine(psi_threshold=0.25)
        result = engine.analyze(ref, cur)
        assert result.schema.reference_only_columns == ["old"]
        assert result.schema.current_only_columns == ["new"]
        assert result.schema.common_columns == 2


class TestNumericalProfiling:
    def test_numerical_profile_statistics_accuracy(self):
        # Known numbers: 10, 20, 30, 40, 50
        # Mean = 30.0, Median = 30.0
        # Sample std (ddof=1) = sqrt(250) ≈ 15.8114, Sample variance = 250.0
        # Min = 10.0, Max = 50.0
        # Q25 = 20.0, Q75 = 40.0, IQR = 20.0
        ref = pd.DataFrame({"val": [10.0, 20.0, 30.0, 40.0, 50.0]})
        cur = pd.DataFrame({"val": [15.0, 25.0, 35.0, 45.0, 55.0]})
        engine = DriftEngine()
        result = engine.analyze(ref, cur)
        f = next(x for x in result.features if x.name == "val")
        assert f.reference_mean == pytest.approx(30.0, abs=1e-3)
        assert f.reference_median == pytest.approx(30.0, abs=1e-3)
        assert f.reference_std == pytest.approx(15.8114, abs=1e-3)
        assert f.reference_variance == pytest.approx(250.0, abs=1e-3)
        assert f.reference_min == 10.0
        assert f.reference_max == 50.0
        assert f.reference_q25 == pytest.approx(20.0, abs=1e-3)
        assert f.reference_q75 == pytest.approx(40.0, abs=1e-3)
        assert f.reference_iqr == pytest.approx(20.0, abs=1e-3)

    def test_all_missing_numeric_column_returns_none(self):
        ref = pd.DataFrame({"val": [np.nan, np.nan, np.nan]})
        cur = pd.DataFrame({"val": [np.nan, np.nan, np.nan]})
        engine = DriftEngine()
        result = engine.analyze(ref, cur)
        f = next(x for x in result.features if x.name == "val")
        assert f.reference_mean is None
        assert f.reference_std is None
        assert f.reference_variance is None
        assert f.reference_median is None
        assert f.reference_min is None
        assert f.reference_max is None

    def test_single_value_sample_std_returns_none(self):
        stats = DriftEngine._compute_numeric_stats(pd.Series([42.0]))
        assert stats["mean"] == 42.0
        assert stats["std"] is None
        assert stats["variance"] is None


class TestCategoricalProfiling:
    def test_categorical_profile_statistics(self):
        # 6 items: "A", "A", "A", "B", "B", "C"
        # Unique count: 3
        # Mode: "A", Mode count: 3, Mode percent: 3/6 = 50.0%
        ref = pd.DataFrame({"group": ["A", "A", "A", "B", "B", "C"]})
        cur = pd.DataFrame({"group": ["B", "B", "B", "B", "A", "C"]})
        engine = DriftEngine()
        result = engine.analyze(ref, cur)
        f = next(x for x in result.features if x.name == "group")
        assert f.reference_unique_count == 3
        assert f.reference_mode == "A"
        assert f.reference_mode_count == 3
        assert f.reference_mode_percent == 50.0
        assert f.current_mode == "B"
        assert f.current_mode_count == 4
        assert f.current_mode_percent == pytest.approx(66.67, abs=0.01)

    def test_categorical_mode_alphabetical_tie_breaker(self):
        # Tied: "Z" and "A" both have count 2
        ref = pd.DataFrame({"group": ["Z", "Z", "A", "A"]})
        cur = pd.DataFrame({"group": ["Z", "Z", "A", "A"]})
        engine = DriftEngine()
        result = engine.analyze(ref, cur)
        f = next(x for x in result.features if x.name == "group")
        assert f.reference_mode == "A"
        assert f.reference_mode_count == 2
        assert f.reference_mode_percent == 50.0


class TestDatasetLevelProfiling:
    def test_dataset_profile_metrics(self):
        ref = pd.DataFrame({
            "id": [1, 2, 3, 4, 5, 6],
            "num": [10.0, 20.0, 30.0, 40.0, 50.0, np.nan],
            "cat": ["x", "y", "x", "y", "x", np.nan],
        })
        cur = pd.DataFrame({
            "id": [1, 1, 2, 3, 4, 5],
            "num": [10.0, 10.0, 20.0, 30.0, 40.0, 50.0],
            "cat": ["x", "x", "y", "z", "x", "y"],
        })
        engine = DriftEngine()
        result = engine.analyze(ref, cur)
        assert result.profile is not None
        ref_p = result.profile.reference
        cur_p = result.profile.current

        assert ref_p.rows == 6
        assert ref_p.columns == 3
        assert ref_p.numeric_columns == 1
        assert ref_p.categorical_columns == 1
        assert ref_p.identifier_columns == 1
        # Total cells = 6 * 3 = 18. Missing cells = 2 (1 in num, 1 in cat).
        assert ref_p.missing_cells == 2
        assert ref_p.missing_cell_percent == pytest.approx(11.11, abs=0.01)
        assert ref_p.duplicate_rows == 0
        assert ref_p.duplicate_row_percent == 0.0
        assert ref_p.memory_usage_bytes > 0

        assert cur_p.rows == 6
        assert cur_p.duplicate_rows == 1
        assert cur_p.duplicate_row_percent == pytest.approx(16.67, abs=0.01)
        assert cur_p.missing_cells == 0
        assert cur_p.missing_cell_percent == 0.0

