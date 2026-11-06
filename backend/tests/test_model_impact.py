"""
DataWatch — Tests for ML Model Impact Analysis.

Verifies:
1. Supervised classification pipeline training on reference train split only.
2. Evaluation on reference holdout and current labelled data.
3. Macro-averaged Accuracy, Precision, Recall, and F1 calculations.
4. Percentage-point changes calculation.
5. Exclusion of identifier columns from predictors.
6. Exclusion and tracking of missing target rows.
7. Handling of invalid/insufficient targets (1 class, missing target, insufficient data).
8. Graceful handling when current labels are missing.
9. Multiclass classification support.
"""
import numpy as np
import pandas as pd
import pytest

from services.model_impact import ModelImpactAnalyzer


@pytest.fixture
def binary_classification_dfs():
    np.random.seed(42)
    n = 200

    # Reference dataset
    ref_df = pd.DataFrame({
        "customer_id": [f"ID_{i}" for i in range(n)],
        "tenure": np.random.randint(1, 60, size=n),
        "monthly_charges": np.random.normal(50, 15, size=n),
        "contract": np.random.choice(["Month", "Year"], size=n),
        "churn": np.random.choice(["Yes", "No"], size=n, p=[0.4, 0.6]),
    })

    # Current dataset (shifted distribution)
    cur_df = pd.DataFrame({
        "customer_id": [f"ID_{1000 + i}" for i in range(n)],
        "tenure": np.random.randint(1, 40, size=n),
        "monthly_charges": np.random.normal(70, 20, size=n),
        "contract": np.random.choice(["Month", "Year"], size=n, p=[0.7, 0.3]),
        "churn": np.random.choice(["Yes", "No"], size=n, p=[0.6, 0.4]),
    })

    return ref_df, cur_df


class TestModelImpactAnalyzer:
    def test_unrequested_returns_not_requested(self, binary_classification_dfs):
        ref_df, cur_df = binary_classification_dfs
        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df, cur_df, target_column="churn", run_model_impact=False)

        assert res.status == "NOT_REQUESTED"
        assert res.verdict == "MODEL IMPACT NOT EVALUATED"
        assert res.reference_metrics is None

    def test_missing_target_column_name_returns_not_requested(self, binary_classification_dfs):
        ref_df, cur_df = binary_classification_dfs
        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df, cur_df, target_column=None, run_model_impact=True)

        assert res.status == "NOT_REQUESTED"

    def test_target_not_in_datasets_returns_not_possible(self, binary_classification_dfs):
        ref_df, cur_df = binary_classification_dfs
        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df, cur_df, target_column="non_existent_target", run_model_impact=True)

        assert res.status == "NOT_POSSIBLE"
        assert "not found" in res.message.lower()

    def test_successful_binary_evaluation(self, binary_classification_dfs):
        ref_df, cur_df = binary_classification_dfs
        analyzer = ModelImpactAnalyzer(random_state=42)
        res = analyzer.evaluate(ref_df, cur_df, target_column="churn", run_model_impact=True)

        assert res.status == "COMPLETED"
        assert res.model_name == "LogisticRegression"
        assert res.target_column == "churn"
        assert sorted(res.classes) == ["No", "Yes"]

        # Train/holdout split: 200 * 0.8 = 160 train, 40 holdout
        assert res.reference_train_rows == 160
        assert res.reference_evaluation_rows == 40
        assert res.current_evaluation_rows == 200

        # Identifier must be excluded from predictor features
        assert "customer_id" in res.excluded_identifier_columns
        assert "customer_id" not in res.features_used
        assert set(res.features_used) == {"tenure", "monthly_charges", "contract"}

        # Reference metrics check
        assert res.reference_metrics is not None
        assert 0.0 <= res.reference_metrics.accuracy <= 1.0
        assert 0.0 <= res.reference_metrics.precision <= 1.0
        assert 0.0 <= res.reference_metrics.recall <= 1.0
        assert 0.0 <= res.reference_metrics.f1_score <= 1.0

        # Current metrics check
        assert res.current_metrics is not None
        assert 0.0 <= res.current_metrics.accuracy <= 1.0
        assert 0.0 <= res.current_metrics.precision <= 1.0
        assert 0.0 <= res.current_metrics.recall <= 1.0
        assert 0.0 <= res.current_metrics.f1_score <= 1.0

        # Percentage points diff check
        assert res.metric_changes_percentage_points is not None
        expected_f1_diff = round((res.current_metrics.f1_score - res.reference_metrics.f1_score) * 100.0, 2)
        assert abs(res.metric_changes_percentage_points.f1_score - expected_f1_diff) < 0.01

        # Verdict must be objective
        assert res.verdict in ("PERFORMANCE DECREASE OBSERVED", "NO MATERIAL PERFORMANCE DECREASE DETECTED")
        assert "percentage points" in res.interpretation

    def test_missing_targets_are_excluded_and_counted(self, binary_classification_dfs):
        ref_df, cur_df = binary_classification_dfs
        # Introduce NaN targets
        ref_df_missing = ref_df.copy()
        ref_df_missing.loc[0:4, "churn"] = np.nan

        cur_df_missing = cur_df.copy()
        cur_df_missing.loc[0:9, "churn"] = np.nan

        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df_missing, cur_df_missing, target_column="churn", run_model_impact=True)

        assert res.status == "COMPLETED"
        assert res.excluded_reference_rows == 5
        assert res.excluded_current_rows == 10
        assert res.current_evaluation_rows == 190

    def test_single_class_target_returns_not_possible(self, binary_classification_dfs):
        ref_df, cur_df = binary_classification_dfs
        ref_df_single = ref_df.copy()
        ref_df_single["churn"] = "Yes"  # Only 1 class

        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df_single, cur_df, target_column="churn", run_model_impact=True)

        assert res.status == "NOT_POSSIBLE"
        assert "at least 2 distinct classes" in res.message

    def test_current_dataset_with_no_labels_returns_not_possible(self, binary_classification_dfs):
        ref_df, cur_df = binary_classification_dfs
        cur_df_nolabel = cur_df.copy()
        cur_df_nolabel["churn"] = np.nan  # All missing

        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df, cur_df_nolabel, target_column="churn", run_model_impact=True)

        assert res.status == "NOT_POSSIBLE"
        assert "no non-null target labels" in res.message.lower()

    def test_multiclass_classification_support(self):
        np.random.seed(42)
        n = 150
        classes = ["Tier_1", "Tier_2", "Tier_3"]

        ref_df = pd.DataFrame({
            "feature_a": np.random.normal(10, 2, n),
            "feature_b": np.random.choice(["High", "Low"], n),
            "tier": np.random.choice(classes, n),
        })

        cur_df = pd.DataFrame({
            "feature_a": np.random.normal(12, 3, n),
            "feature_b": np.random.choice(["High", "Low"], n),
            "tier": np.random.choice(classes, n),
        })

        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df, cur_df, target_column="tier", run_model_impact=True)

        assert res.status == "COMPLETED"
        assert len(res.classes) == 3
        assert res.averaging_strategy == "macro"
        assert 0.0 <= res.reference_metrics.f1_score <= 1.0
        assert 0.0 <= res.current_metrics.f1_score <= 1.0

    def test_no_usable_predictor_features_returns_not_possible(self):
        # Dataset with only ID and target
        ref_df = pd.DataFrame({
            "user_id": [f"U_{i}" for i in range(50)],
            "target": ["A", "B"] * 25,
        })
        cur_df = pd.DataFrame({
            "user_id": [f"U_{100 + i}" for i in range(50)],
            "target": ["A", "B"] * 25,
        })

        analyzer = ModelImpactAnalyzer()
        res = analyzer.evaluate(ref_df, cur_df, target_column="target", run_model_impact=True)

        assert res.status == "NOT_POSSIBLE"
        assert "no valid predictor features" in res.message.lower()
