/**
 * DataWatch — Centralised API client.
 *
 * All HTTP calls go through this module.
 * The base URL is read from the Vite env variable VITE_API_BASE_URL,
 * falling back to http://localhost:8000 for local development.
 */

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

/**
 * Analyze drift between two CSV files.
 *
 * @param {File}   referenceFile
 * @param {File}   currentFile
 * @param {number} psiThreshold
 * @returns {Promise<DriftAnalysisResult>}
 */
export async function analyzeDrift(referenceFile, currentFile, psiThreshold = 0.25) {
  const form = new FormData();
  form.append('reference_file', referenceFile);
  form.append('current_file',   currentFile);
  form.append('psi_threshold',  String(psiThreshold));

  const response = await fetch(`${API_BASE}/api/drift/analyze`, {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type manually — browser sets it with the boundary.
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch (_) { /* ignore JSON parse errors */ }
    throw new DriftApiError(detail, response.status);
  }

  return /** @type {DriftAnalysisResult} */ (await response.json());
}

/**
 * Check if the backend is reachable.
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Custom error type
// ---------------------------------------------------------------------------
export class DriftApiError extends Error {
  /** @param {string} message @param {number} statusCode */
  constructor(message, statusCode) {
    super(message);
    this.name = 'DriftApiError';
    this.statusCode = statusCode;
  }
}
