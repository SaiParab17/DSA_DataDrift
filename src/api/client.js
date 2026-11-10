/**
 * DataWatch — Centralised API client.
 *
 * All HTTP calls go through this module.
 * The base URL is read from the Vite env variable VITE_API_BASE_URL,
 * falling back to http://localhost:8000 for local development.
 */

const rawApiBase = import.meta.env?.VITE_API_BASE_URL;
const API_BASE = (rawApiBase && rawApiBase.trim() !== '')
  ? rawApiBase.trim().replace(/\/+$/, '')
  : 'http://localhost:8000';

/**
 * Analyze drift between two CSV files.
 *
 * @param {File}   referenceFile
 * @param {File}   currentFile
 * @param {number} psiThreshold
 * @param {boolean} [runModelImpact=false]
 * @param {string|null} [targetColumn=null]
 * @returns {Promise<DriftAnalysisResult>}
 */
export async function analyzeDrift(referenceFile, currentFile, psiThreshold = 0.25, runModelImpact = false, targetColumn = null) {
  const form = new FormData();
  form.append('reference_file', referenceFile);
  form.append('current_file',   currentFile);
  form.append('psi_threshold',  String(psiThreshold));
  form.append('run_model_impact', String(Boolean(runModelImpact)));
  if (targetColumn) {
    form.append('target_column', String(targetColumn));
  }

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
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Fetch paginated historical analysis runs.
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @returns {Promise<Array<object>>}
 */
export async function fetchAnalysisRuns(limit = 20, offset = 0) {
  const response = await fetch(`${API_BASE}/api/drift/runs?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch (_) {}
    throw new DriftApiError(detail, response.status);
  }
  return await response.json();
}

/**
 * Fetch a specific analysis run by its UUID.
 * @param {string} runId
 * @returns {Promise<object>}
 */
export async function fetchAnalysisRunById(runId) {
  const response = await fetch(`${API_BASE}/api/drift/runs/${encodeURIComponent(runId)}`);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch (_) {}
    throw new DriftApiError(detail, response.status);
  }
  return await response.json();
}

/**
 * Compare two analysis runs side-by-side.
 * @param {string} runId1
 * @param {string} runId2
 * @returns {Promise<object>}
 */
export async function compareAnalysisRuns(runId1, runId2) {
  const response = await fetch(`${API_BASE}/api/drift/runs/compare?run_id_1=${encodeURIComponent(runId1)}&run_id_2=${encodeURIComponent(runId2)}`);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch (_) {}
    throw new DriftApiError(detail, response.status);
  }
  return await response.json();
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
