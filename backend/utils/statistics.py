"""
DataWatch — Low-level statistical utility functions.

All functions are pure (no side effects) and deal only with numpy arrays.
"""
from __future__ import annotations

import math
import numpy as np
from typing import Optional

_EPSILON = 1e-9   # Small constant to avoid log(0) and div-by-zero


# ---------------------------------------------------------------------------
# PSI
# ---------------------------------------------------------------------------

def calculate_psi_from_proportions(
    expected_prop: np.ndarray,
    actual_prop: np.ndarray,
    eps: float = _EPSILON,
) -> float:
    """
    Calculate PSI given pre-computed probability vectors.

    PSI = Σ (actual% - expected%) × ln(actual% / expected%)

    Both arrays must be the same length and sum to (approximately) 1.
    """
    e = np.clip(expected_prop, eps, None)
    a = np.clip(actual_prop, eps, None)
    psi_contributions = (a - e) * np.log(a / e)
    return float(np.sum(psi_contributions))


def build_numeric_bins(
    reference_values: np.ndarray,
    n_bins: int = 10,
) -> np.ndarray:
    """
    Build quantile-based bin edges from the *reference* distribution.

    Using reference quantiles ensures both datasets are evaluated
    against the same boundary set (anchored to the baseline).

    Returns an array of (n_bins + 1) edges, guaranteed unique.
    """
    quantiles = np.linspace(0, 100, n_bins + 1)
    edges = np.nanpercentile(reference_values, quantiles)

    # Deduplicate — may happen with highly discrete data.
    edges = np.unique(edges)
    if len(edges) < 2:
        # Degenerate: constant column — callers must handle this.
        return edges

    # Ensure the outermost edges are open-ended to capture all values.
    edges[0]  = -np.inf
    edges[-1] =  np.inf
    return edges


def proportions_from_bins(
    values: np.ndarray,
    edges: np.ndarray,
    eps: float = _EPSILON,
) -> np.ndarray:
    """
    Compute per-bin proportions for *values* using pre-defined *edges*.

    Returns an array of length (len(edges) - 1) that sums to 1.
    Values outside the edge range are clipped to the outermost bucket.
    """
    n = len(values)
    counts, _ = np.histogram(values, bins=edges)
    proportions = counts / max(n, 1)
    proportions = np.where(proportions == 0, eps, proportions)
    total = proportions.sum()
    return proportions / total  # normalise


# ---------------------------------------------------------------------------
# Jensen-Shannon divergence
# ---------------------------------------------------------------------------

def js_divergence(p: np.ndarray, q: np.ndarray, eps: float = _EPSILON) -> float:
    """
    Compute Jensen-Shannon divergence between two probability distributions.

    JS(P||Q) = 0.5 * KL(P||M) + 0.5 * KL(Q||M)  where M = 0.5*(P+Q)

    Both arrays must be the same length.  They are normalised internally.
    """
    p = np.clip(p, eps, None)
    q = np.clip(q, eps, None)
    p = p / p.sum()
    q = q / q.sum()
    m = 0.5 * (p + q)
    kl_pm = np.sum(p * np.log(p / m))
    kl_qm = np.sum(q * np.log(q / m))
    jsd = 0.5 * (kl_pm + kl_qm)
    # Clip to [0, ln2] due to floating-point rounding
    return float(np.clip(jsd, 0.0, math.log(2)))


# ---------------------------------------------------------------------------
# Categorical frequency helpers
# ---------------------------------------------------------------------------

def categorical_proportions(
    values: np.ndarray,
    categories: list,
    eps: float = _EPSILON,
) -> np.ndarray:
    """
    Compute normalised frequency vector for *values* over the union of *categories*.

    Unseen categories get a small epsilon so JS divergence stays well-defined.
    """
    counts = np.zeros(len(categories), dtype=float)
    cat_index = {c: i for i, c in enumerate(categories)}
    total = len(values)
    for v in values:
        if v in cat_index:
            counts[cat_index[v]] += 1
    # Apply epsilon for unseen categories
    counts = np.where(counts == 0, eps, counts)
    return counts / counts.sum()


# ---------------------------------------------------------------------------
# Severity classification
# ---------------------------------------------------------------------------

def classify_psi_severity(psi: float, threshold: float) -> tuple[str, str]:
    """
    Map a PSI value to a (status, severity) tuple.

    DataWatch PSI interpretation:
        PSI < 0.10              → STABLE / NEGLIGIBLE
        0.10 <= PSI < threshold → WARNING / LOW or MODERATE
        PSI >= threshold        → DRIFT  / HIGH or CRITICAL
    """
    if psi < 0.10:
        return "STABLE", "NEGLIGIBLE"
    if psi < threshold:
        # Within warning zone — below the configured drift threshold
        if psi < 0.15:
            return "WARNING", "LOW"
        return "WARNING", "MODERATE"
    # At or above the configured threshold
    if psi < threshold * 1.5:
        return "DRIFT", "HIGH"
    return "DRIFT", "CRITICAL"


def classify_js_severity(jsd: float, threshold: float) -> tuple[str, str]:
    """
    Map a JS divergence value to a (status, severity) tuple.
    """
    if jsd < 0.05:
        return "STABLE", "NEGLIGIBLE"
    if jsd < threshold:
        if jsd < 0.075:
            return "WARNING", "LOW"
        return "WARNING", "MODERATE"
    if jsd < threshold * 1.5:
        return "DRIFT", "HIGH"
    return "DRIFT", "CRITICAL"
