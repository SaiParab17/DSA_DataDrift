# DataWatch — Database Architecture & Deployment Readiness Audit

**Audit Date:** November 6, 2026  
**Auditor Roles:** Senior Backend Architect, Lead Database Engineer, Principal DevOps Engineer  
**Audit Scope:** Codebase Inspection, Data Pipeline Flow, State & Persistence Lifecycle, Metric Engines, Dependency Tree, Database Feasibility, and Cloud Deployment Readiness.  
**Execution Policy:** Strictly read-only audit. No source code modified, no packages installed, no files altered.

---

## 1. Executive Summary

DataWatch is a full-stack, data monitoring and statistical drift platform designed to compare a baseline reference dataset against an observed production dataset. It identifies statistical distribution shifts, validates structural data quality using Great Expectations (GX), generates dataset profiles, and evaluates ML model performance degradation using scikit-learn.

### Key Audit Findings
1. **Algorithmic Engine Health:** The core drift calculations (Population Stability Index, Kolmogorov-Smirnov test, Wasserstein distance, Jensen-Shannon divergence) and the supervised ML Model Impact pipeline are mathematically sound, dynamically computed, fully decoupled from HTTP presentation, and backed by passing automated test suites (`test_drift_engine.py` and `test_model_impact.py`).
2. **Architecture Reality vs. Documentation Discrepancy:** The `README.md` claims the frontend is built using React and TypeScript in a separate `frontend/` directory. In reality, the codebase is a pure **Vanilla JavaScript (ES Modules)** single-page application built on top of **Vite 8.3** and styled using Tailwind CSS tokens at the project root (`index.html`, `src/`).
3. **Stateless Ephemerality:** There is currently **zero database persistence**. Datasets are processed in-memory and immediately garbage-collected by Python. On the frontend, results reside in memory with a truncated snapshot (omitting distribution arrays) saved to browser `sessionStorage`. All historical records vanish upon browser closure, and page refreshes strip visualization distributions.
4. **Critical Deployment Blocker:** `great-expectations` is **completely missing from `backend/requirements.txt`**. Any deployment pipeline executing `pip install -r requirements.txt` will fail immediately with `ModuleNotFoundError`. Furthermore, Great Expectations version 0.18.22 requires an invasive monkeypatch (`backend/quality/patch.py`) to bypass Python 3.14 runtime type-check errors, and attempts outbound usage telemetry that hangs network-restricted execution environments.
5. **Memory Amplification Risk:** File ingestion in `backend/api/drift.py` loads raw CSV bytes into memory, decodes them to UTF-8 strings, and loads them into Pandas DataFrames simultaneously, creating a 3x–5x RAM footprint. On free-tier cloud containers (512 MB RAM), a 30–50 MB CSV upload will trigger an immediate Out-Of-Memory (OOM) termination.

---

## 2. Actual Project Architecture

### Directory Tree & Boundary Map
```text
DataWatch/
├── backend/                         # FastAPI Application Root
│   ├── api/
│   │   ├── drift.py                 # POST /api/drift/analyze endpoint
│   ├── models/
│   │   └── drift_models.py          # Pydantic v2 schemas
│   ├── quality/
│   │   ├── models.py                # ExpectationResult & QualitySummary models
│   │   ├── patch.py                 # Python 3.14 / Pydantic v1 monkeypatch for GX
│   │   └── validator.py             # Great Expectations PandasDataset wrapper
│   ├── services/
│   │   ├── drift_engine.py          # Core statistical calculations & dataset profiler
│   │   └── model_impact.py          # LogisticRegression holdout evaluation engine
│   ├── tests/
│   │   ├── test_api.py              # FastAPI TestClient endpoint integration tests
│   │   ├── test_drift_engine.py     # 35 unit tests for statistical calculations
│   │   └── test_model_impact.py     # 9 unit tests for ML model impact analysis
│   ├── utils/
│   │   └── statistics.py            # Low-level mathematical functions (PSI, JSD, Bins)
│   ├── main.py                      # FastAPI app instance, CORS middleware, lifespan
│   └── requirements.txt             # Backend dependencies (incomplete)
├── src/                             # Frontend Vanilla JS Application Root
│   ├── api/
│   │   └── client.js                # Fetch client & API error handling
│   ├── assets/                      # Static brand assets
│   ├── components/
│   │   └── nav.js                   # Navigation & footer rendering
│   ├── pages/
│   │   ├── analyze.js               # Dual file dropzone, PSI & ML config, client runner
│   │   ├── dashboard.js             # Latest run overview cards & KPI widgets
│   │   ├── home.js                  # Landing page & pipeline diagrams
│   │   └── results.js               # Multi-tab inspection console & distribution drawer
│   ├── state/
│   │   └── store.js                 # In-memory store & sessionStorage serialization
│   └── main.js                      # Hash-based SPA router and script executor
├── index.html                       # HTML entry point, Tailwind CDN & Brutalist theme
├── package.json                     # Vite devDependencies & build scripts
└── README.md                        # Documentation (partially outdated)
```

### Component Analysis

| Component | Framework / Technology | Verified Implementation Details |
|---|---|---|
| **Frontend Framework** | Vanilla JavaScript (ESM) | Single Page Application orchestrated via `window.location.hash` routing in `src/main.js`. No React, Vue, or Angular libraries. |
| **Frontend Styling** | Tailwind CSS CDN + Brutalist Tokens | Loaded via `<script src="https://cdn.tailwindcss.com?plugins=forms">` in `index.html`. Custom tokens for Neo-Brutalist borders (`border-[3px] border-on-surface`), solid shadows (`shadow-[4px_4px_0px_#1c1b1b]`), and fonts (Space Grotesk, JetBrains Mono). |
| **Frontend State** | Module Singleton + `sessionStorage` | In-memory singleton in `src/state/store.js`. On analysis, `persistResult()` strips histogram `distribution` arrays and writes a lean JSON snapshot into `sessionStorage.getItem('dw_latest_result')`. |
| **Backend Framework** | FastAPI `0.115.5` on Uvicorn | Instantiated in `backend/main.py:app` with asynchronous lifespan handler and `/health` route. |
| **Statistical Engine** | NumPy `2.1.3` & SciPy `1.14.1` | Decoupled pure Python service in `backend/services/drift_engine.py:DriftEngine` utilizing helper functions in `backend/utils/statistics.py`. |
| **Data Quality Engine** | Great Expectations `0.18.22` | Wrapped in `backend/quality/validator.py:QualityValidator` using legacy `PandasDataset` expectations. |
| **ML Impact Engine** | Scikit-Learn `>=1.5.0` | Implemented in `backend/services/model_impact.py:ModelImpactAnalyzer` using `Pipeline`, `ColumnTransformer`, `StandardScaler`, `OneHotEncoder`, and `LogisticRegression`. |

---

## 3. Existing Backend and Frontend Integration

### End-to-End Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Frontend (Vite/SPA)
    participant Client as src/api/client.js
    participant API as FastAPI (backend/api/drift.py)
    participant Engine as DriftEngine & ModelImpact
    participant GX as QualityValidator (GX)

    User->>Browser: Selects ref.csv, cur.csv, sets PSI threshold (0.25)
    Note over Browser: Reads first 8KB via FileReader to extract candidate target columns
    User->>Browser: Enables "Evaluate model performance" & selects target column
    User->>Browser: Clicks "ANALYZE DRIFT →"
    Browser->>Client: analyzeDrift(refFile, curFile, threshold, runModelImpact, targetCol)
    Client->>API: POST /api/drift/analyze (multipart/form-data)
    
    API->>API: _read_csv(): Ingests bytes -> String -> pd.DataFrame
    API->>API: Validates common column schema
    API->>Engine: DriftEngine.analyze(ref_df, cur_df)
    Engine-->>API: DriftAnalysisResponse (Metrics, Profiles, Binned Distributions)
    API->>GX: QualityValidator.validate(ref_df, cur_df)
    GX-->>API: QualitySummary (Checks, status, counts)
    API->>Engine: ModelImpactAnalyzer.evaluate(ref_df, cur_df, targetCol)
    Engine-->>API: ModelImpactResult (Holdout vs Current metrics, delta PP, verdict)
    
    API-->>Client: Returns JSON (DriftAnalysisResponse)
    Client-->>Browser: Response received
    Browser->>Browser: persistResult(): Saves lean JSON to sessionStorage (drops distributions)
    Browser->>Browser: Sets window.__dwState & window.location.hash = '#/results'
    Browser->>User: Renders results page, metric cards, GX table, ML comparison, and histogram drawer
```

### Detailed Endpoint Inspection

#### `GET /health` [VERIFIED: `backend/main.py#L72-L76`]
- **Purpose:** Polled by frontend breadcrumb badge in `src/pages/analyze.js#L584-L605` to verify daemon connectivity and latency.
- **Payload:** `{"status": "ok", "service": "DataWatch Drift Engine"}`

#### `POST /api/drift/analyze` [VERIFIED: `backend/api/drift.py#L102-L200`]
- **Payload Type:** `multipart/form-data`
  - `reference_file` (UploadFile, required)
  - `current_file` (UploadFile, required)
  - `psi_threshold` (float Form field, default: `0.25`, bounds: `0.01` to `1.0`)
  - `run_model_impact` (bool Form field, default: `False`)
  - `target_column` (str Form field, optional)
- **Response Model:** `backend/models/drift_models.py:DriftAnalysisResponse` (UUID `analysis_id`, overall status, elapsed time, feature drift metrics, dataset profiles, GX validation summary, ML model impact metrics).

---

## 4. Current Data Storage Mechanism

### Audit Questions & Direct Findings

| Question | Finding | Evidence & File References | Status |
|---|---|---|---|
| **1. Is any database configured?** | **None.** No database connection, ORM models, migration tooling, or persistence layer exists in the project. | Search across backend yielded zero references to `sqlalchemy`, `databases`, `sqlite3`, `psycopg`, or `pymongo`. | `[VERIFIED]` |
| **2. Where are results stored?** | **Browser memory and `sessionStorage`.** The backend is 100% stateless. The frontend stores results in a JavaScript object (`src/state/store.js:state`) and serializes a stripped subset into `sessionStorage`. | `src/state/store.js#L40-L50`: `persistResult(result)` explicitly strips `distribution: null` to conserve browser quota. | `[VERIFIED]` |
| **3. What disappears on refresh/restart?** | **On backend restart:** Nothing breaks on an active results view because state is client-side, but subsequent analyses will fail. **On page refresh:** In-memory file references are destroyed. Re-rendering histogram distribution charts fails because `sessionStorage` dropped the distribution arrays. **On browser close:** 100% of all analysis data is permanently lost. | `src/state/store.js#L26-L29` and `src/pages/analyze.js#L568-L575`. | `[VERIFIED]` |
| **4. Entities needing permanent storage?** | Datasets, Analysis Runs, Feature Drift Metrics, Distribution Bins, Data Quality Expectations, ML Model Evaluation Scores, System Alerts. | Currently generated on the fly and discarded. | `[RECOMMENDATION]` |
| **5. Existing schemas / dependencies?** | Comprehensive Pydantic v2 domain schemas exist (`DriftAnalysisResponse`, `FeatureResult`, `DatasetProfile`, `ModelImpactResult`, `QualitySummary`), but zero ORM/relational schemas exist. | `backend/models/drift_models.py` and `backend/quality/models.py`. | `[VERIFIED]` |
| **6. Support for multiple runs?** | **No.** Every new analysis run overwrites `state.latestResult` and replaces `dw_latest_result` in `sessionStorage`. | `src/state/store.js#L41`: `state.latestResult = result;` replaces the existing instance. | `[VERIFIED]` |
| **7. Retrieval of previous results?** | **Impossible.** There are no history endpoints, no persistent IDs, and no persistence backends. | The `/dashboard` route only renders `state.latestResult`. If null, it displays "NO DATA AVAILABLE". | `[VERIFIED]` |

---

## 5. Feature Completion Verification

| Feature | Assumed Status | Verified Status | Verification Evidence & Code Analysis |
|---|---|---|---|
| **Statistical Drift Detection** | Complete | **`[VERIFIED]` COMPLETE** | `backend/services/drift_engine.py:DriftEngine.analyze()` and `backend/utils/statistics.py`. Calculates PSI, KS statistic, KS p-value, Wasserstein distance, and JS divergence. Bins are correctly anchored to the reference distribution. 35 unit tests pass in `backend/tests/test_drift_engine.py`. |
| **Data Quality Validation (GX)** | Complete | **`[PARTIALLY VERIFIED]` COMPLETE WITH RUNTIME FRICTION** | `backend/quality/validator.py:QualityValidator.validate()` implements 6 expectations: column existence, not-null checks, numeric ranges, type parity, row counts, and duplicate detection. **Caveat:** `great-expectations` is missing from `requirements.txt` and requires an active monkeypatch (`backend/quality/patch.py`) to run on Python 3.14. |
| **Data Profiling** | Extended | **`[VERIFIED]` COMPLETE** | `backend/services/drift_engine.py:_build_dataset_profile()` and `_compute_numeric_stats()`. Generates missing cells %, duplicate rows %, in-memory size, mean, median, standard deviation, variance, min, max, Q25, Q75, and IQR. Mode and mode counts are computed for categorical columns. Displays in `src/pages/results.js#L198-L257`. |
| **ML Model Impact Analysis** | Working | **`[VERIFIED]` COMPLETE** | `backend/services/model_impact.py:ModelImpactAnalyzer.evaluate()`. Trains `LogisticRegression` strictly on 80% reference train split; tests on 20% reference holdout and current labeled batch. Excludes identifiers and target from predictors. Computes macro Accuracy, Precision, Recall, F1, and percentage-point shifts. 9 unit tests pass in `backend/tests/test_model_impact.py`. |
| **Database Persistence** | Not implemented | **`[NOT IMPLEMENTED]`** | Confirmed. No database, ORM, or file-backed storage mechanism exists in the codebase. |
| **Historical Monitoring** | Needs verification | **`[NOT IMPLEMENTED]`** | The Dashboard (`src/pages/dashboard.js`) is purely an alternative view of the single `latestResult`. It contains no historical trend charts, time-series metrics, or run comparisons. |
| **Deployment** | Not implemented | **`[NOT IMPLEMENTED]`** | No container configuration (`Dockerfile`), WSGI/ASGI production configurations, or cloud platform descriptors exist. |

---

## 6. Database Requirements

To support persistent, multi-tenant, reproducible drift monitoring, the database must fulfill the following operational criteria:

1. **Relational Integrity for Lineage:** Strict foreign key relationships between uploaded datasets, analysis runs, feature-level metrics, and model evaluation records.
2. **Semi-Structured Storage for Distributions:** Histogram distribution arrays (variable bin edges, bin labels, raw counts, percentages) and Great Expectations parameter payloads vary dynamically per feature. Storing these in deeply nested relational tables creates unnecessary join overhead; native `JSONB` support is optimal.
3. **Decoupled Binary Storage:** Physical CSV datasets must **not** be stored as raw byte blobs inside relational tables. Relational records must store file metadata, SHA-256 hashes, and storage URI pointers, while files reside on a storage volume or S3-compatible bucket.
4. **Historical Time-Series Querying:** Ability to query metric drift over time for specific features (e.g., `SELECT created_at, psi FROM feature_drift_results WHERE feature_name = 'salary' ORDER BY created_at ASC`).
5. **FastAPI & Async Compatibility:** Non-blocking database drivers compatible with Python's asyncio event loop to prevent worker thread starvation during concurrent analysis runs.

---

## 7. Database Comparison and Final Recommendation

### Comparative Evaluation Matrix

| Criterion | PostgreSQL | MySQL | SQLite | MongoDB |
|---|---|---|---|---|
| **Relational Data Integrity** | **Excellent:** Strict foreign keys, cascading deletes, check constraints. | **Good:** Standard relational capabilities. | **Good:** Basic FK support, lacks concurrent lock control. | **Poor:** Application-level reference management; no true FK constraints. |
| **Structured Results + JSON Flexibility** | **Outstanding:** Best-in-class `JSONB` with GIN indexing for distribution arrays. | **Moderate:** Native JSON type, but weaker indexing and query operators. | **Limited:** Basic JSON functions, stored as plain text. | **Native:** Natural BSON document format. |
| **Historical Comparison Queries** | **Outstanding:** Advanced window functions (`LAG`, `LEAD`), CTEs, time buckets. | **Good:** Supports window functions (MySQL 8+). | **Moderate:** Basic window functions, limited analytical performance. | **Moderate:** Requires complex aggregation pipelines (`$lookup`, `$unwind`). |
| **FastAPI Integration** | **Seamless:** First-class support via `SQLAlchemy 2.0 (async)` and `asyncpg`. | **Good:** Supported via `aiomysql` or `asyncmy`. | **Seamless for local:** Supported via `aiosqlite`. | **Moderate:** Requires `Motor` / `Beanie`; lacks native relational session management. |
| **Deployment Compatibility** | **Universal:** Supported across all containerized, PaaS, and DBaaS environments. | **Good:** Wide availability, but fewer generous free tiers. | **High Risk in Containers:** Ephemeral filesystems on Render/Railway wipe SQLite files on restart. | **Good:** MongoDB Atlas free tier available. |
| **Free-Tier Hosting Options** | **Abundant:** Neon (Serverless Postgres, 0.5 GB free), Supabase (500 MB free), Aiven. | **Very Rare:** PlanetScale discontinued free tier; Aiven has limited trials. | **Free (Local only):** Requires persistent disk ($) on cloud platforms. | **Available:** MongoDB Atlas (512 MB M0 cluster free). |

### Final Architectural Recommendation: **PostgreSQL**

#### Technical Justification:
1. **Hybrid Relational + JSONB Paradigm:** DataWatch's domain model has a clear relational spine (`Dataset -> AnalysisRun -> FeatureDriftResult`), but branches into dynamic distribution histograms (`DistributionData` with 10–20 floats/strings) and variable expectation parameters. PostgreSQL's native `JSONB` provides the optimal balance: strict relational guarantees and fast foreign-key joins for metadata and metrics, combined with zero-overhead JSON storage for distribution histograms and GX diagnostics.
2. **Cloud Ephemerality Protection:** Container platforms (Render, Railway, Fly.io) treat local filesystems as ephemeral. An SQLite file is destroyed whenever the web service restarts or redeploys. A managed cloud PostgreSQL instance (such as **Neon**) guarantees zero data loss across deployments.
3. **Async Performance:** PostgreSQL pairs natively with `asyncpg` and `SQLAlchemy 2.0`, enabling non-blocking database queries within FastAPI async path operations.

### Recommended Integration Stack
- **ORM:** `SQLAlchemy 2.0` (modern `Mapped[...]` type-annotated declarations).
- **Migration Engine:** `Alembic` (essential for production schema evolution without data loss).
- **Database Driver:** `asyncpg` (high-performance asynchronous PostgreSQL driver) alongside `psycopg[binary]` for synchronous Alembic migrations.
- **Data Validation & Transfer:** `Pydantic v2` (already installed; models map directly via `model_validate(obj, from_attributes=True)`).

---

## 8. Proposed Database Schema

```mermaid
erDiagram
    DATASETS ||--o{ ANALYSIS_RUNS : "as reference"
    DATASETS ||--o{ ANALYSIS_RUNS : "as current"
    ANALYSIS_RUNS ||--o{ DATASET_PROFILES : "contains"
    ANALYSIS_RUNS ||--o{ FEATURE_DRIFT_RESULTS : "evaluates"
    ANALYSIS_RUNS ||--o| QUALITY_VALIDATION_RESULTS : "validates"
    ANALYSIS_RUNS ||--o| MODEL_IMPACT_RESULTS : "measures"

    DATASETS {
        uuid id PK
        string name
        string file_hash
        string storage_path
        bigint file_size_bytes
        int row_count
        int column_count
        jsonb schema_metadata
        timestamptz created_at
    }

    ANALYSIS_RUNS {
        uuid id PK
        uuid reference_dataset_id FK
        uuid current_dataset_id FK
        float psi_threshold
        float categorical_js_threshold
        string overall_status
        float max_psi
        int features_analyzed
        int features_drifted
        float elapsed_ms
        boolean run_model_impact
        string target_column
        timestamptz created_at
    }

    DATASET_PROFILES {
        bigserial id PK
        uuid analysis_run_id FK
        string dataset_type
        int total_rows
        int total_columns
        int numeric_columns
        int categorical_columns
        int identifier_columns
        int missing_cells
        float missing_cell_percent
        int duplicate_rows
        float duplicate_row_percent
        bigint memory_usage_bytes
    }

    FEATURE_DRIFT_RESULTS {
        bigserial id PK
        uuid analysis_run_id FK
        string feature_name
        string feature_type
        float psi
        string status
        string severity
        float ks_statistic
        float ks_p_value
        float wasserstein_distance
        float js_divergence
        float reference_mean
        float current_mean
        float mean_change_percent
        float reference_std
        float current_std
        int reference_missing_count
        int current_missing_count
        jsonb distribution_data
        jsonb category_distribution_data
    }

    QUALITY_VALIDATION_RESULTS {
        bigserial id PK
        uuid analysis_run_id FK
        int total_expectations
        int passed
        int failed
        int warnings
        float success_percent
        string overall_status
        jsonb expectations_details
    }

    MODEL_IMPACT_RESULTS {
        bigserial id PK
        uuid analysis_run_id FK
        string status
        string verdict
        string model_name
        string target_column
        jsonb classes
        int reference_train_rows
        int reference_evaluation_rows
        int current_evaluation_rows
        jsonb reference_metrics
        jsonb current_metrics
        jsonb metric_changes_pp
        text interpretation
        text message
    }
```

### Table Definitions & Specifications

#### 1. `datasets`
- **Purpose:** Tracks unique uploaded datasets and their physical file pointers to prevent redundant disk usage.
- **Columns:**
  - `id` (`UUID`, PK, default: `gen_random_uuid()`)
  - `name` (`VARCHAR(255)`, NOT NULL): Original filename (e.g. `churn_reference.csv`).
  - `file_hash` (`VARCHAR(64)`, NOT NULL): SHA-256 checksum of file contents.
  - `storage_path` (`VARCHAR(512)`, NOT NULL): Relative local disk path or S3 key.
  - `file_size_bytes` (`BIGINT`, NOT NULL): Size on disk.
  - `row_count` (`INTEGER`, NOT NULL): Parsed row count.
  - `column_count` (`INTEGER`, NOT NULL): Parsed column count.
  - `schema_metadata` (`JSONB`, NOT NULL): Column names and detected roles (`numeric`, `categorical`, `identifier`).
  - `created_at` (`TIMESTAMPTZ`, NOT NULL, default: `NOW()`).
- **Indexes:** `CREATE INDEX ix_datasets_hash ON datasets(file_hash);`

#### 2. `analysis_runs`
- **Purpose:** Core execution record for each drift comparison run.
- **Columns:**
  - `id` (`UUID`, PK, default: `gen_random_uuid()`): Stable run ID.
  - `reference_dataset_id` (`UUID`, FK -> `datasets.id`, NOT NULL).
  - `current_dataset_id` (`UUID`, FK -> `datasets.id`, NOT NULL).
  - `psi_threshold` (`FLOAT`, NOT NULL): Configured threshold (e.g. 0.25).
  - `categorical_js_threshold` (`FLOAT`, NOT NULL, default: 0.10).
  - `overall_status` (`VARCHAR(32)`, NOT NULL): `DRIFT_DETECTED` or `NO_SIGNIFICANT_DRIFT`.
  - `max_psi` (`FLOAT`, NULLABLE): Highest numerical PSI observed.
  - `features_analyzed` (`INTEGER`, NOT NULL).
  - `features_drifted` (`INTEGER`, NOT NULL).
  - `elapsed_ms` (`FLOAT`, NOT NULL): Total server execution duration.
  - `run_model_impact` (`BOOLEAN`, NOT NULL, default: `FALSE`).
  - `target_column` (`VARCHAR(128)`, NULLABLE).
  - `created_at` (`TIMESTAMPTZ`, NOT NULL, default: `NOW()`).
- **Indexes:**
  - `CREATE INDEX ix_analysis_runs_created_at ON analysis_runs(created_at DESC);`
  - `CREATE INDEX ix_analysis_runs_ref_cur ON analysis_runs(reference_dataset_id, current_dataset_id);`

#### 3. `dataset_profiles`
- **Purpose:** Stores summary structural profiles for reference and current datasets associated with a run.
- **Columns:**
  - `id` (`BIGSERIAL`, PK).
  - `analysis_run_id` (`UUID`, FK -> `analysis_runs.id` ON DELETE CASCADE, NOT NULL).
  - `dataset_type` (`VARCHAR(16)`, NOT NULL): `REFERENCE` or `CURRENT`.
  - `total_rows`, `total_columns`, `numeric_columns`, `categorical_columns`, `identifier_columns` (`INTEGER`, NOT NULL).
  - `missing_cells` (`INTEGER`, NOT NULL), `missing_cell_percent` (`FLOAT`, NOT NULL).
  - `duplicate_rows` (`INTEGER`, NOT NULL), `duplicate_row_percent` (`FLOAT`, NOT NULL).
  - `memory_usage_bytes` (`BIGINT`, NOT NULL).
- **Indexes:** `CREATE INDEX ix_dataset_profiles_run ON dataset_profiles(analysis_run_id);`

#### 4. `feature_drift_results`
- **Purpose:** Granular per-feature drift metrics, statistics, and chart bins.
- **Columns:**
  - `id` (`BIGSERIAL`, PK).
  - `analysis_run_id` (`UUID`, FK -> `analysis_runs.id` ON DELETE CASCADE, NOT NULL).
  - `feature_name` (`VARCHAR(128)`, NOT NULL).
  - `feature_type` (`VARCHAR(32)`, NOT NULL): `numeric`, `categorical`, `identifier`.
  - `psi` (`FLOAT`, NULLABLE), `status` (`VARCHAR(16)`, NOT NULL), `severity` (`VARCHAR(16)`, NOT NULL).
  - `ks_statistic`, `ks_p_value`, `wasserstein_distance`, `js_divergence` (`FLOAT`, NULLABLE).
  - `reference_mean`, `current_mean`, `mean_change_percent` (`FLOAT`, NULLABLE).
  - `reference_std`, `current_std`, `reference_variance`, `current_variance` (`FLOAT`, NULLABLE).
  - `reference_min`, `current_min`, `reference_max`, `current_max` (`FLOAT`, NULLABLE).
  - `reference_q25`, `current_q25`, `reference_q75`, `current_q75`, `reference_iqr`, `current_iqr` (`FLOAT`, NULLABLE).
  - `reference_unique_count`, `current_unique_count` (`INTEGER`, NULLABLE).
  - `reference_mode`, `current_mode` (`VARCHAR(255)`, NULLABLE).
  - `reference_missing_count`, `current_missing_count` (`INTEGER`, NOT NULL).
  - `distribution_data` (`JSONB`, NULLABLE): Stores `bins`, `bin_labels`, `reference_counts`, `current_counts`, `reference_percents`, `current_percents`.
  - `category_distribution_data` (`JSONB`, NULLABLE): Stores `categories`, `reference_percentages`, `current_percentages`.
- **Indexes:**
  - `CREATE INDEX ix_feature_drift_run_id ON feature_drift_results(analysis_run_id);`
  - `CREATE INDEX ix_feature_drift_name ON feature_drift_results(feature_name);`
  - `CREATE INDEX ix_feature_drift_status ON feature_drift_results(status);`

#### 5. `quality_validation_results`
- **Purpose:** Summarizes Great Expectations test execution and stores expectation assertions.
- **Columns:**
  - `id` (`BIGSERIAL`, PK).
  - `analysis_run_id` (`UUID`, FK -> `analysis_runs.id` ON DELETE CASCADE, NOT NULL).
  - `total_expectations`, `passed`, `failed`, `warnings` (`INTEGER`, NOT NULL).
  - `success_percent` (`FLOAT`, NOT NULL).
  - `overall_status` (`VARCHAR(32)`, NOT NULL): `PASS`, `ATTENTION`, `FAIL`.
  - `expectations_details` (`JSONB`, NOT NULL): Full array of `ExpectationResult` objects (`expectation`, `column`, `status`, `severity`, `observed_value`, `expected_value`).
- **Indexes:** `CREATE INDEX ix_quality_results_run ON quality_validation_results(analysis_run_id);`

#### 6. `model_impact_results`
- **Purpose:** Stores supervised classification evaluation metrics and performance shift.
- **Columns:**
  - `id` (`BIGSERIAL`, PK).
  - `analysis_run_id` (`UUID`, FK -> `analysis_runs.id` ON DELETE CASCADE, NOT NULL).
  - `status` (`VARCHAR(32)`, NOT NULL): `COMPLETED`, `NOT_REQUESTED`, `NOT_POSSIBLE`, `FAILED`.
  - `verdict` (`VARCHAR(64)`, NOT NULL): e.g. `PERFORMANCE DECREASE OBSERVED`.
  - `model_name` (`VARCHAR(64)`, NULLABLE): e.g. `LogisticRegression`.
  - `target_column` (`VARCHAR(128)`, NULLABLE).
  - `classes` (`JSONB`, NULLABLE): e.g. `["No", "Yes"]`.
  - `reference_train_rows`, `reference_evaluation_rows`, `current_evaluation_rows` (`INTEGER`, NOT NULL).
  - `features_used` (`JSONB`, NULLABLE), `excluded_identifier_columns` (`JSONB`, NULLABLE).
  - `reference_metrics` (`JSONB`, NULLABLE): `{"accuracy": 0.81, "precision": 0.78, "recall": 0.75, "f1_score": 0.76}`.
  - `current_metrics` (`JSONB`, NULLABLE): `{"accuracy": 0.72, "precision": 0.69, "recall": 0.68, "f1_score": 0.68}`.
  - `metric_changes_pp` (`JSONB`, NULLABLE): `{"accuracy": -9.0, "precision": -9.0, "recall": -7.0, "f1_score": -8.0}`.
  - `interpretation` (`TEXT`, NULLABLE).
  - `message` (`TEXT`, NULLABLE).
- **Indexes:** `CREATE INDEX ix_model_impact_run ON model_impact_results(analysis_run_id);`

---

## 9. Recommended Backend Database Integration

### Integration Pattern with FastAPI

To maintain clean separation of concerns and avoid coupling database logic directly to HTTP endpoints:

1. **Database Session Dependency (`backend/database/session.py`):**
   Use `async_sessionmaker` bound to an `AsyncEngine`:
   ```python
   from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

   DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/datawatch")
   engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
   AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

   async def get_db() -> AsyncGenerator[AsyncSession, None]:
       async with AsyncSessionLocal() as session:
           try:
               yield session
               await session.commit()
           except Exception:
               await session.rollback()
               raise
   ```

2. **Repository Pattern (`backend/repositories/drift_repository.py`):**
   Encapsulate all SQL queries and inserts into a dedicated repository class rather than writing query logic inside `api/drift.py`.

3. **Decoupled File Storage (`backend/services/storage.py`):**
   ```text
   UploadFile (Stream) ──> NamedTemporaryFile on /tmp ──> SHA-256 Hash Computed
                                                            │
                      ┌─────────────────────────────────────┴────────────────────────┐
                      ▼                                                              ▼
   Saved to local storage/uploads/{hash}.csv                Metadata & Hash stored in DB
   ```

4. **Preserving Existing API Contracts:**
   `POST /api/drift/analyze` must continue returning the exact existing `DriftAnalysisResponse` JSON structure. Persistence should occur transparently before returning the response.

5. **New Historical Endpoints (Additive only):**
   - `GET /api/drift/runs`: Returns paginated list of past analysis runs.
   - `GET /api/drift/runs/{analysis_id}`: Returns full historical analysis payload.
   - `GET /api/drift/features/{feature_name}/history`: Returns historical PSI values over time for dashboard trend charting.

---

## 10. Deployment Architecture Recommendation

### Practical Architecture for Academic & Faculty Demonstration

```text
               ┌────────────────────────────────────────────────────────┐
               │                  User Browser Client                   │
               └───────────────────────────┬────────────────────────────┘
                                           │
                    HTTPS Requests         │       HTTPS Static Assets
                 (API Calls & Uploads)     │     (HTML, JS, Tailwind CDN)
                                           ▼                                ▼
┌───────────────────────────────────────────────┐  ┌─────────────────────────────────────┐
│             Render Web Service                │  │       Render / Vercel Static        │
│       (FastAPI + Uvicorn Production)          │  │          (Frontend SPA)             │
│  - Python 3.11 Runtime                        │  │  - Built with `npm run build`       │
│  - Environment: VITE_API_BASE_URL             │  │  - Serves static dist/ bundle       │
│  - Ephemeral /tmp disk for streaming uploads  │  └─────────────────────────────────────┘
└───────────────────────┬───────────────────────┘
                        │
                        │ Managed Postgres Connection (SSL)
                        ▼
┌───────────────────────────────────────────────┐
│              Neon Serverless Postgres         │
│  - Free-tier hosted PostgreSQL 16             │
│  - Connection pooling (pgbouncer)             │
│  - Tables: datasets, runs, features, quality  │
└───────────────────────────────────────────────┘
```

### Hosting Platform Breakdown

| Tier | Provider | Recommended Role | Cost | Limitations & Mitigations |
|---|---|---|---|---|
| **Frontend** | **Vercel** or **Render Static** | Hosting static Vite build (`dist/`) | **100% Free** | Static file hosting only; fast global CDN distribution. |
| **Backend** | **Render** (Web Service) | Hosting FastAPI application | **Free Tier** ($0) | Spins down after 15 min of inactivity (50s cold start). Set `GX_ANONYMOUS_USAGE_STATISTICS="false"` to prevent 30s import hangs. |
| **Database** | **Neon** | Serverless Managed PostgreSQL | **Free Tier** ($0) | 0.5 GB storage limit (sufficient for >10,000 analysis runs without raw CSV byte storage). SSL required (`?ssl=require`). |

### Production Startup & Build Commands
- **Frontend Build Command:**
  ```bash
  npm install && npm run build
  ```
- **Backend Build & Migration Command:**
  ```bash
  pip install -r requirements.txt && alembic upgrade head
  ```
- **Backend Production Startup Command:**
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2 --timeout-keep-alive 60
  ```

---

## 11. Security and Performance Risks

### 1. Missing Dependencies in Production Requirements `[CRITICAL]`
- **Observation:** `backend/requirements.txt` lacks `great-expectations`.
- **Impact:** Any standard deployment using `pip install -r requirements.txt` will crash upon startup at `backend/main.py#L6` (`import quality.patch`) or `backend/quality/validator.py#L7` (`import great_expectations as gx`).
- **Fix:** Pin compatible versions: `great-expectations==0.18.22` (or upgrade/replace with a lighter validation harness).

### 2. Python 3.14 Runtime Incompatibility & Telemetry Hang `[HIGH]`
- **Observation:** The local development environment runs `Python 3.14.1`. Great Expectations 0.18.22 uses Pydantic v1 internally, which fails class creation on Python 3.14 without `backend/quality/patch.py`. Furthermore, GX attempts to send anonymous telemetry to `stats.greatexpectations.io`. In isolated or sandboxed production environments without open outbound internet access, this causes a 20–30 second request freeze.
- **Fix:** Deploy on **Python 3.11** or **3.12**. Add `os.environ["GX_ANONYMOUS_USAGE_STATISTICS"] = "false"` to `backend/main.py`.

### 3. In-Memory File Buffering & OOM Crashes `[HIGH]`
- **Observation:** `backend/api/drift.py#L45-L70` loads uploaded CSVs via `await upload.read()`, followed by `text = raw.decode("utf-8")`, followed by `pd.read_csv(io.StringIO(text))`.
- **Impact:** Simultaneously holds three distinct representations of the data in memory. Two simultaneous 30 MB CSV uploads will consume ~400 MB of RAM, instantly triggering an OOM kill on Render's 512 MB free tier.
- **Fix:** Stream incoming uploads directly to temporary files on disk (`tempfile.NamedTemporaryFile`) and pass the file buffer directly to `pd.read_csv()`.

### 4. Overly Restrictive / Fragile CORS Policy `[MEDIUM]`
- **Observation:** `backend/main.py#L51-L64` initializes CORS from a single environment variable:
  ```python
  _frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
  _allowed_origins = [_frontend_origin]
  ```
- **Impact:** When deployed, preview URLs (e.g. `https://datawatch-xyz.vercel.app`) or local development ports other than 5173/5174 will trigger CORS browser blocks.
- **Fix:** Support comma-separated strings in `FRONTEND_ORIGIN` and parse them into a list: `[o.strip() for o in os.getenv("FRONTEND_ORIGIN", "").split(",") if o.strip()]`.

### 5. `new Function()` Script Evaluation in Frontend `[MEDIUM]`
- **Observation:** `src/main.js#L29` executes page scripts using `const fn = new Function(s.textContent); fn();`.
- **Impact:** Violates standard Content Security Policy (`CSP`) headers (`unsafe-eval`), creating vulnerability to cross-site script injection if user data is interpolated into inline script tags.
- **Fix:** Refactor page-specific initializers into standard exported functions (e.g., `initAnalyze()`, `initResults()`) invoked directly by the router instead of `new Function()`.

### 6. Unprotected Compute Endpoints `[MEDIUM]`
- **Observation:** `POST /api/drift/analyze` performs heavy CPU tasks (Scipy numerical integrals, scikit-learn training, GX rule loops) with zero rate limiting or authentication.
- **Impact:** Vulnerable to resource exhaustion / denial of service.

---

## 12. Missing Work — Prioritized Implementation Roadmap

```mermaid
timeline
    title DataWatch Persistence & Deployment Roadmap
    Phase 1 : Fix backend requirements & Python pinning
            : Disable GX anonymous telemetry
            : Add persistent storage engine (SQLAlchemy + Alembic)
    Phase 2 : Implement Database Models & Repositories
            : Hook transparent persistence into /api/drift/analyze
            : Add GET /api/drift/runs and GET /api/drift/runs/{id}
    Phase 3 : Update Frontend Store to fetch run history
            : Build Dashboard historical trend charts
            : Enable re-hydrating past runs by URL
    Phase 4 : Containerize via Dockerfile
            : Provision Neon PostgreSQL & Render Web Service
            : Set up automated CI/CD deployment
```

### Phase 1: Stabilization & Packaging Primitives (Priority 1)
- Add `great-expectations==0.18.22`, `sqlalchemy[asyncio]>=2.0.36`, `alembic>=1.14.0`, and `asyncpg>=0.30.0` to `backend/requirements.txt`.
- Pin target production container to Python 3.11.
- Disable GX anonymous telemetry in `backend/main.py`.

### Phase 2: Relational Persistence Layer (Priority 2)
- Initialize Alembic: `alembic init -t async backend/alembic`.
- Define SQLAlchemy models matching Section 8 schema.
- Implement `DriftRepository.save_analysis_run()`.
- Connect persistence to `POST /api/drift/analyze` without altering the returned response schema.

### Phase 3: History & Trend Endpoints (Priority 3)
- Create `GET /api/drift/runs` (paginated list of previous runs).
- Create `GET /api/drift/runs/{analysis_id}` (retrieves full historical run).
- Update frontend `src/pages/dashboard.js` to render the list of past analysis runs and trend lines across runs.

### Phase 4: Production Hardening & Cloud Deployment (Priority 4)
- Replace in-memory file buffering with disk streaming (`NamedTemporaryFile`).
- Deploy PostgreSQL database on Neon.
- Configure production environment variables (`DATABASE_URL`, `FRONTEND_ORIGIN`, `VITE_API_BASE_URL`).
- Deploy backend to Render/Railway and frontend to Vercel/Render Static.

---

## 13. Potential Breaking Changes

When implementing database persistence and deployment, the following risks must be guarded against to prevent breaking existing functionality:

1. **Response Schema Mutation Risk:** Modifying `DriftAnalysisResponse` in `backend/models/drift_models.py` to fit ORM conventions could break `src/pages/results.js` and `src/pages/dashboard.js`. **Rule:** Keep Pydantic models as the external contract; map ORM entities to Pydantic using `model_validate()`.
2. **Missing Field Ingestion on Historic Runs:** Early runs stored in the database might lack optional fields like `model_impact` or `profile`. Frontend code must handle `null` safely using optional chaining (`result.model_impact?.status`).
3. **Async / Sync Driver Deadlocks:** Mixing synchronous SQLAlchemy calls with FastAPI async endpoints can block the event loop. All database operations inside FastAPI route handlers must strictly use `AsyncSession` and `await`.
4. **Vite Base URL Hardcoding:** Hardcoding `http://localhost:8000` inside frontend files will cause deployment failure. `src/api/client.js` currently uses `import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8000'`, which is correct and must be preserved.

---

## 14. Files That Would Need Modification During Implementation

### Backend Modifications

| File Path | Function / Class | Nature of Modification |
|---|---|---|
| `backend/requirements.txt` | Dependency List | Add `great-expectations`, `sqlalchemy[asyncio]`, `alembic`, `asyncpg`, `psycopg[binary]`. |
| `backend/main.py` | `lifespan()`, CORS config | Initialize database engine connection pool on startup; sanitize CORS origins; disable GX telemetry. |
| `backend/api/drift.py` | `analyze_drift()`, `_read_csv()` | Inject `db: AsyncSession = Depends(get_db)`; stream file uploads to disk; persist analysis run; add `GET /runs` and `GET /runs/{id}` routes. |
| `backend/database/session.py` | `get_db()`, `engine` | **NEW FILE:** SQLAlchemy async engine, sessionmaker, and dependency provider. |
| `backend/database/models.py` | `ORM Models` | **NEW FILE:** Declarative SQLAlchemy models (`DatasetORM`, `AnalysisRunORM`, `FeatureDriftORM`, etc.). |
| `backend/repositories/drift_repo.py` | `DriftRepository` | **NEW FILE:** Encapsulated database query and insertion logic. |

### Frontend Modifications

| File Path | Function / Class | Nature of Modification |
|---|---|---|
| `src/api/client.js` | `fetchAnalysisRuns()`, `fetchRunById()` | Add functions to query history endpoints (`GET /api/drift/runs` and `GET /api/drift/runs/{id}`). |
| `src/state/store.js` | `state`, `loadRun()` | Add state fields for run history (`history: []`); allow loading any historic run into `latestResult`. |
| `src/pages/dashboard.js` | `renderDashboard()` | Replace static single-run cards with dynamic historical run selector and trend charts. |
| `src/main.js` | `getRoute()`, `navigate()` | Support parameterized routing for specific runs (e.g. `#/results?runId=839199a3`). |

---

## Crucial Question Answered

### What should be the very next implementation step to make DataWatch persistent and deployment-ready without breaking its existing functionality?

> **The very next step is to fix the dependency packaging and implement transparent database persistence behind the existing `POST /api/drift/analyze` endpoint using SQLAlchemy and Alembic, keeping the API response model 100% unchanged.**

Specifically, execute this exact atomic sequence:
1. **Stabilize Dependencies:** Add `great-expectations==0.18.22`, `sqlalchemy[asyncio]>=2.0.36`, `alembic>=1.14.0`, and `asyncpg>=0.30.0` to `backend/requirements.txt`, and disable Great Expectations anonymous network telemetry.
2. **Setup Database Infrastructure:** Initialize Alembic, create the PostgreSQL ORM models matching Section 8, and establish an async database session dependency (`get_db`) in FastAPI.
3. **Transparent Persistence Hook:** Inside `backend/api/drift.py:analyze_drift()`, after `DriftEngine`, `QualityValidator`, and `ModelImpactAnalyzer` complete their computations, asynchronously write the generated `result` into the PostgreSQL tables inside a single database transaction.
4. **Preserve External Contract:** Return the existing `result: DriftAnalysisResponse` unchanged to the frontend.

By executing this step first, the existing frontend and analysis workflow will continue to work without a single breaking change, while every subsequent analysis run immediately becomes durable, queryable, and ready for cloud deployment.

