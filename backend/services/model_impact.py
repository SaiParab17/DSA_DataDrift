"""
DataWatch — ML Model Impact Analysis Service.

Evaluates whether a real supervised classification model (scikit-learn LogisticRegression)
performs differently when evaluated on the current labelled dataset compared with a
held-out reference subset.

Key principles:
- Uses a real scikit-learn pipeline (ColumnTransformer, StandardScaler, OneHotEncoder, LogisticRegression).
- Fitted strictly on the reference training subset (80/20 train/test holdout split).
- Never fits or tunes on current evaluation data (avoids data leakage).
- Excludes the target column and any detected identifier columns from predictors.
- Computes Accuracy, Precision (macro), Recall (macro), and F1-score (macro).
- Measures changes in percentage points (pp).
- Completely optional: fails gracefully with informative status when unrequested or when data is unlabelled.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from models.drift_models import MetricChangesPP, MetricScores, ModelImpactResult

logger = logging.getLogger(__name__)

# Minimum unique values to treat a numeric-dtype column as continuous vs categorical
MIN_NUMERIC_UNIQUE = 5


class ModelImpactAnalyzer:
    """Evaluates ML model performance change across reference and current datasets."""

    def __init__(self, random_state: int = 42, f1_decline_threshold_pp: float = -5.0):
        self.random_state = random_state
        self.f1_decline_threshold_pp = f1_decline_threshold_pp

    def evaluate(
        self,
        reference_df: pd.DataFrame,
        current_df: pd.DataFrame,
        target_column: Optional[str] = None,
        run_model_impact: bool = False,
    ) -> ModelImpactResult:
        """
        Run the supervised ML Model Impact Analysis.
        Returns a ModelImpactResult with status COMPLETED, NOT_REQUESTED, NOT_POSSIBLE, or FAILED.
        """
        if not run_model_impact or not target_column:
            return ModelImpactResult(
                status="NOT_REQUESTED",
                verdict="MODEL IMPACT NOT EVALUATED",
                message="ML Model Impact analysis was not requested.",
            )

        target_col = target_column.strip()

        # 1. Validate target column existence
        if target_col not in reference_df.columns:
            return ModelImpactResult(
                status="NOT_POSSIBLE",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                message=f"Target column '{target_col}' not found in reference dataset.",
            )
        if target_col not in current_df.columns:
            return ModelImpactResult(
                status="NOT_POSSIBLE",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                message=f"Target column '{target_col}' not found in current dataset.",
            )

        # 2. Exclude missing target labels
        ref_missing_targets = int(reference_df[target_col].isna().sum())
        cur_missing_targets = int(current_df[target_col].isna().sum())

        clean_ref_df = reference_df.dropna(subset=[target_col]).copy()
        clean_cur_df = current_df.dropna(subset=[target_col]).copy()

        if len(clean_ref_df) < 5:
            return ModelImpactResult(
                status="NOT_POSSIBLE",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                excluded_reference_rows=ref_missing_targets,
                excluded_current_rows=cur_missing_targets,
                message=f"Reference dataset has insufficient valid target labels ({len(clean_ref_df)} non-null rows).",
            )

        if len(clean_cur_df) == 0:
            return ModelImpactResult(
                status="NOT_POSSIBLE",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                excluded_reference_rows=ref_missing_targets,
                excluded_current_rows=cur_missing_targets,
                message="Current dataset contains no non-null target labels for evaluation.",
            )

        # 3. Validate target classes
        # Convert target to string for clean categorical comparison
        clean_ref_df[target_col] = clean_ref_df[target_col].astype(str).str.strip()
        clean_cur_df[target_col] = clean_cur_df[target_col].astype(str).str.strip()

        ref_classes = sorted(clean_ref_df[target_col].unique().tolist())
        if len(ref_classes) < 2:
            return ModelImpactResult(
                status="NOT_POSSIBLE",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                classes=ref_classes,
                excluded_reference_rows=ref_missing_targets,
                excluded_current_rows=cur_missing_targets,
                message=f"Reference target column '{target_col}' must contain at least 2 distinct classes. Found: {ref_classes}.",
            )

        # 4. Feature selection & Identifier exclusion
        common_cols = [c for c in reference_df.columns if c in current_df.columns and c != target_col]
        
        excluded_ids: list[str] = []
        usable_features: list[str] = []

        for col in common_cols:
            if self._is_identifier_column(col, clean_ref_df[col]):
                excluded_ids.append(col)
            else:
                usable_features.append(col)

        if not usable_features:
            return ModelImpactResult(
                status="NOT_POSSIBLE",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                classes=ref_classes,
                excluded_identifier_columns=excluded_ids,
                excluded_reference_rows=ref_missing_targets,
                excluded_current_rows=cur_missing_targets,
                message="No valid predictor features remain after excluding target and identifier columns.",
            )

        # Partition into numeric and categorical features
        numeric_features: list[str] = []
        categorical_features: list[str] = []

        for col in usable_features:
            ref_series = clean_ref_df[col]
            if pd.api.types.is_numeric_dtype(ref_series) and ref_series.dropna().nunique() >= MIN_NUMERIC_UNIQUE:
                numeric_features.append(col)
            else:
                categorical_features.append(col)

        # 5. Split Reference Dataset (80% train, 20% holdout)
        X_ref = clean_ref_df[usable_features]
        y_ref = clean_ref_df[target_col]

        # Check if stratified split is possible (every class needs at least 2 instances)
        class_counts = y_ref.value_counts()
        can_stratify = bool((class_counts >= 2).all())

        try:
            X_train, X_holdout, y_train, y_holdout = train_test_split(
                X_ref,
                y_ref,
                test_size=0.20,
                random_state=self.random_state,
                stratify=y_ref if can_stratify else None,
            )
        except Exception as split_err:
            return ModelImpactResult(
                status="NOT_POSSIBLE",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                classes=ref_classes,
                features_used=usable_features,
                excluded_identifier_columns=excluded_ids,
                excluded_reference_rows=ref_missing_targets,
                excluded_current_rows=cur_missing_targets,
                message=f"Could not perform reference train/holdout split: {split_err}",
            )

        # 6. Build Preprocessing & Logistic Regression Pipeline
        transformers = []
        if numeric_features:
            num_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="mean")),
                ("scaler", StandardScaler()),
            ])
            transformers.append(("num", num_pipe, numeric_features))

        if categorical_features:
            cat_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ])
            transformers.append(("cat", cat_pipe, categorical_features))

        preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")
        classifier = LogisticRegression(max_iter=1000, random_state=self.random_state)

        pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ])

        # 7. Fit pipeline on Reference Training Subset only
        try:
            pipeline.fit(X_train, y_train)
        except Exception as fit_err:
            logger.exception("Failed to fit classifier pipeline")
            return ModelImpactResult(
                status="FAILED",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                classes=ref_classes,
                features_used=usable_features,
                excluded_identifier_columns=excluded_ids,
                excluded_reference_rows=ref_missing_targets,
                excluded_current_rows=cur_missing_targets,
                message=f"Model training failed: {fit_err}",
            )

        # 8. Evaluate on Reference Holdout Subset
        try:
            y_holdout_pred = pipeline.predict(X_holdout)
            ref_acc = float(accuracy_score(y_holdout, y_holdout_pred))
            ref_prec = float(precision_score(y_holdout, y_holdout_pred, average="macro", zero_division=0))
            ref_rec = float(recall_score(y_holdout, y_holdout_pred, average="macro", zero_division=0))
            ref_f1 = float(f1_score(y_holdout, y_holdout_pred, average="macro", zero_division=0))
        except Exception as eval_ref_err:
            logger.exception("Failed to evaluate holdout reference subset")
            return ModelImpactResult(
                status="FAILED",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                classes=ref_classes,
                features_used=usable_features,
                excluded_identifier_columns=excluded_ids,
                message=f"Reference holdout evaluation failed: {eval_ref_err}",
            )

        # 9. Evaluate the SAME fitted model on Current Labelled Dataset
        X_cur = clean_cur_df[usable_features]
        y_cur = clean_cur_df[target_col]

        # Verify current data classes
        cur_classes = set(y_cur.unique())
        unseen_classes = cur_classes - set(ref_classes)
        if unseen_classes:
            logger.warning("Current dataset contains classes not seen in reference training: %s", unseen_classes)

        try:
            y_cur_pred = pipeline.predict(X_cur)
            cur_acc = float(accuracy_score(y_cur, y_cur_pred))
            cur_prec = float(precision_score(y_cur, y_cur_pred, average="macro", zero_division=0))
            cur_rec = float(recall_score(y_cur, y_cur_pred, average="macro", zero_division=0))
            cur_f1 = float(f1_score(y_cur, y_cur_pred, average="macro", zero_division=0))
        except Exception as eval_cur_err:
            logger.exception("Failed to evaluate current dataset")
            return ModelImpactResult(
                status="FAILED",
                verdict="MODEL IMPACT NOT EVALUATED",
                target_column=target_col,
                classes=ref_classes,
                features_used=usable_features,
                excluded_identifier_columns=excluded_ids,
                message=f"Current dataset evaluation failed: {eval_cur_err}",
            )

        # 10. Metric changes in Percentage Points (current - reference)
        delta_acc_pp = round((cur_acc - ref_acc) * 100.0, 2)
        delta_prec_pp = round((cur_prec - ref_prec) * 100.0, 2)
        delta_rec_pp = round((cur_rec - ref_rec) * 100.0, 2)
        delta_f1_pp = round((cur_f1 - ref_f1) * 100.0, 2)

        # 11. Result Classification & Objective Interpretation
        if delta_f1_pp < self.f1_decline_threshold_pp:
            verdict = "PERFORMANCE DECREASE OBSERVED"
            interpretation = (
                f"Model performance decreased from reference holdout ({ref_f1 * 100:.1f}%) "
                f"to current data ({cur_f1 * 100:.1f}%) by {abs(delta_f1_pp):.2f} percentage points "
                f"in macro F1-score. This change was observed alongside the measured data drift and "
                f"warrants further investigation."
            )
        else:
            verdict = "NO MATERIAL PERFORMANCE DECREASE DETECTED"
            interpretation = (
                f"Model performance is comparable between reference holdout ({ref_f1 * 100:.1f}%) "
                f"and current data ({cur_f1 * 100:.1f}%) (change of {delta_f1_pp:+.2f} percentage points "
                f"in macro F1-score). No material performance degradation was detected under current data conditions."
            )

        return ModelImpactResult(
            status="COMPLETED",
            message=None,
            model_name="LogisticRegression",
            target_column=target_col,
            classes=ref_classes,
            reference_train_rows=int(len(X_train)),
            reference_evaluation_rows=int(len(X_holdout)),
            current_evaluation_rows=int(len(X_cur)),
            excluded_reference_rows=ref_missing_targets,
            excluded_current_rows=cur_missing_targets,
            averaging_strategy="macro",
            features_used=usable_features,
            excluded_identifier_columns=excluded_ids,
            reference_metrics=MetricScores(
                accuracy=round(ref_acc, 4),
                precision=round(ref_prec, 4),
                recall=round(ref_rec, 4),
                f1_score=round(ref_f1, 4),
            ),
            current_metrics=MetricScores(
                accuracy=round(cur_acc, 4),
                precision=round(cur_prec, 4),
                recall=round(cur_rec, 4),
                f1_score=round(cur_f1, 4),
            ),
            metric_changes_percentage_points=MetricChangesPP(
                accuracy=delta_acc_pp,
                precision=delta_prec_pp,
                recall=delta_rec_pp,
                f1_score=delta_f1_pp,
            ),
            verdict=verdict,
            interpretation=interpretation,
        )

    @staticmethod
    def _is_identifier_column(name: str, series: pd.Series) -> bool:
        """
        Conservative heuristic matching DataWatch column-role rules:
        Identifier if name indicates an ID and uniqueness ratio >= 0.8.
        """
        lower = name.lower()
        if (
            lower == "id"
            or lower.endswith("_id")
            or lower in ("customer_id", "customerid", "user_id", "entity_id", "transaction_id")
        ):
            clean = series.dropna()
            if len(clean) == 0:
                return True
            unique_ratio = clean.nunique() / len(clean)
            return unique_ratio >= 0.8
        return False
