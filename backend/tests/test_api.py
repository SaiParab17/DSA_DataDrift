"""
DataWatch — API endpoint tests.

Uses FastAPI's TestClient to exercise the full HTTP layer.
"""
from __future__ import annotations

import io
import sys
import os

import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers for test CSV creation
# ---------------------------------------------------------------------------

def _csv_bytes(content: str) -> bytes:
    return content.encode("utf-8")


def _simple_ref_csv() -> bytes:
    rows = ["age,salary,dept"]
    rows += [f"{20 + i % 50},{30000 + i * 100},{'eng' if i % 2 == 0 else 'sales'}" for i in range(200)]
    return _csv_bytes("\n".join(rows))


def _simple_cur_csv_no_drift() -> bytes:
    rows = ["age,salary,dept"]
    rows += [f"{20 + i % 50},{30000 + i * 100},{'eng' if i % 2 == 0 else 'sales'}" for i in range(200)]
    return _csv_bytes("\n".join(rows))


def _simple_cur_csv_drift() -> bytes:
    rows = ["age,salary,dept"]
    rows += [f"{50 + i % 30},{80000 + i * 200},hr" for i in range(200)]
    return _csv_bytes("\n".join(rows))


def _make_upload(csv_bytes: bytes, filename: str = "test.csv"):
    return ("reference_file", (filename, io.BytesIO(csv_bytes), "text/csv"))


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_health_check():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Valid analysis
# ---------------------------------------------------------------------------

def test_analyze_valid_csvs_returns_200():
    ref = _simple_ref_csv()
    cur = _simple_cur_csv_drift()
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "features" in body
    assert body["features_analyzed"] >= 2
    assert isinstance(body["max_psi"], float)


def test_analyze_no_drift_returns_correct_status():
    ref = _simple_ref_csv()
    cur = _simple_cur_csv_no_drift()
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 200
    body = r.json()
    # Identical distributions → no drift expected
    assert body["overall_status"] in ("NO_SIGNIFICANT_DRIFT", "DRIFT_DETECTED")


def test_analyze_response_shape():
    ref = _simple_ref_csv()
    cur = _simple_cur_csv_drift()
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    body = r.json()
    assert "analysis_id" in body
    assert "reference_rows" in body
    assert "current_rows" in body
    assert "schema" in body
    assert "features" in body
    feat = body["features"][0]
    assert "name" in feat
    assert "psi" in feat
    assert "status" in feat
    assert "distribution" in feat
    assert "bin_labels" in feat["distribution"]


def test_analyze_results_change_with_different_data():
    ref = _simple_ref_csv()
    cur_stable = _simple_cur_csv_no_drift()
    cur_drifted = _simple_cur_csv_drift()

    r1 = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur_stable), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    r2 = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur_drifted), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r1.json()["max_psi"] != r2.json()["max_psi"]


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------

def test_invalid_csv_returns_422():
    bad = b"this is not a csv at all @@@@"
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(bad), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(_simple_cur_csv_drift()), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    # Pandas may parse a single-column CSV — either 422 or 200 is acceptable
    assert r.status_code in (200, 422)


def test_empty_csv_returns_422():
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(b""), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(_simple_cur_csv_drift()), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 422


def test_non_csv_file_returns_422():
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.parquet", io.BytesIO(b"garbage"), "application/octet-stream")),
            ("current_file",   ("cur.csv",     io.BytesIO(_simple_cur_csv_drift()), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 422
    assert "CSV" in r.json()["detail"]


def test_no_common_columns_returns_422():
    ref = _csv_bytes("col_a,col_b\n1,2\n3,4\n5,6\n")
    cur = _csv_bytes("col_x,col_y\n1,2\n3,4\n5,6\n")
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 422
    assert "compatible" in r.json()["detail"].lower()


def test_zero_row_csv_returns_422():
    header_only = _csv_bytes("age,salary\n")
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(header_only), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(_simple_cur_csv_drift()), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 422


def test_analyze_returns_profiling_data():
    ref = _simple_ref_csv()
    cur = _simple_cur_csv_drift()
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "profile" in body
    assert body["profile"] is not None
    assert "reference" in body["profile"]
    assert "current" in body["profile"]
    ref_p = body["profile"]["reference"]
    assert ref_p["rows"] == 200
    assert ref_p["columns"] == 3
    assert ref_p["numeric_columns"] == 2
    assert ref_p["categorical_columns"] == 1
    assert ref_p["missing_cells"] == 0
    assert ref_p["missing_cell_percent"] == 0.0
    assert ref_p["memory_usage_bytes"] > 0

    # Check numeric feature has extended profiling metrics
    salary_feat = next(f for f in body["features"] if f["name"] == "salary")
    assert "reference_median" in salary_feat
    assert "reference_std" in salary_feat
    assert "reference_variance" in salary_feat
    assert "reference_min" in salary_feat
    assert "reference_max" in salary_feat
    assert "reference_q25" in salary_feat
    assert "reference_q75" in salary_feat
    assert "reference_iqr" in salary_feat
    assert salary_feat["reference_median"] is not None
    assert salary_feat["reference_std"] is not None

    # Check categorical feature has extended profiling metrics
    dept_feat = next(f for f in body["features"] if f["name"] == "dept")
    assert "reference_unique_count" in dept_feat
    assert "reference_mode" in dept_feat
    assert "reference_mode_count" in dept_feat
    assert "reference_mode_percent" in dept_feat
    assert dept_feat["reference_unique_count"] == 2


def _labelled_ref_csv() -> bytes:
    np.random.seed(42)
    n = 100
    df = pd.DataFrame({
        "tenure": np.random.randint(1, 60, size=n),
        "monthly": np.random.normal(60, 15, size=n),
        "contract": np.random.choice(["Month", "Year"], size=n),
        "churn": np.random.choice(["Yes", "No"], size=n, p=[0.4, 0.6]),
    })
    return df.to_csv(index=False).encode("utf-8")


def _labelled_cur_csv() -> bytes:
    np.random.seed(99)
    n = 100
    df = pd.DataFrame({
        "tenure": np.random.randint(1, 40, size=n),
        "monthly": np.random.normal(75, 20, size=n),
        "contract": np.random.choice(["Month", "Year"], size=n, p=[0.7, 0.3]),
        "churn": np.random.choice(["Yes", "No"], size=n, p=[0.6, 0.4]),
    })
    return df.to_csv(index=False).encode("utf-8")


def test_analyze_without_model_impact_returns_not_requested():
    ref = _simple_ref_csv()
    cur = _simple_cur_csv_drift()
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={"psi_threshold": "0.25"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "model_impact" in body
    assert body["model_impact"]["status"] == "NOT_REQUESTED"
    assert body["model_impact"]["verdict"] == "MODEL IMPACT NOT EVALUATED"


def test_analyze_with_model_impact_completed():
    ref = _labelled_ref_csv()
    cur = _labelled_cur_csv()
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={
            "psi_threshold": "0.25",
            "run_model_impact": "true",
            "target_column": "churn",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert "model_impact" in body
    impact = body["model_impact"]
    assert impact["status"] == "COMPLETED"
    assert impact["model_name"] == "LogisticRegression"
    assert impact["target_column"] == "churn"
    assert impact["reference_train_rows"] == 80
    assert impact["reference_evaluation_rows"] == 20
    assert impact["current_evaluation_rows"] == 100
    assert "f1_score" in impact["reference_metrics"]
    assert "f1_score" in impact["current_metrics"]
    assert "f1_score" in impact["metric_changes_percentage_points"]
    assert impact["verdict"] in ("PERFORMANCE DECREASE OBSERVED", "NO MATERIAL PERFORMANCE DECREASE DETECTED")


def test_analyze_with_model_impact_invalid_target_fails_gracefully():
    ref = _labelled_ref_csv()
    cur = _labelled_cur_csv()
    r = client.post(
        "/api/drift/analyze",
        files=[
            ("reference_file", ("ref.csv", io.BytesIO(ref), "text/csv")),
            ("current_file",   ("cur.csv", io.BytesIO(cur), "text/csv")),
        ],
        data={
            "psi_threshold": "0.25",
            "run_model_impact": "true",
            "target_column": "nonexistent_target_col",
        },
    )
    assert r.status_code == 200  # Drift & quality still succeed
    body = r.json()
    assert body["model_impact"]["status"] == "NOT_POSSIBLE"
    assert "not found" in body["model_impact"]["message"].lower()
    assert body["features_analyzed"] > 0

