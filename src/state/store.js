/**
 * DataWatch — Application state store.
 *
 * Simple module-level singleton that holds:
 *   - referenceFile / currentFile: the File objects chosen by the user
 *   - psiThreshold: the configured PSI cutoff
 *   - latestResult: the last successful DriftAnalysisResult from the API
 *   - error: the last error message (if any)
 *
 * Pages read from and write to this store.
 * The router does NOT clear state on navigation so results persist
 * across the analyze → results → dashboard flow.
 */

/** @type {{ referenceFile: File|null, currentFile: File|null, psiThreshold: number, latestResult: object|null, error: string|null }} */
const state = {
  referenceFile: null,
  currentFile:   null,
  psiThreshold:  0.25,
  latestResult:  null,
  error:         null,
};

// Attempt to restore a lightweight result snapshot from sessionStorage
// so the Dashboard shows data after a page refresh during the same session.
try {
  const saved = sessionStorage.getItem('dw_latest_result');
  if (saved) state.latestResult = JSON.parse(saved);
} catch (_) { /* ignore */ }

export default state;

/**
 * Persist a lightweight summary of the result to sessionStorage.
 * We only store top-level fields + feature PSI values (not full distributions)
 * to keep the payload small.
 *
 * @param {object} result
 */
export function persistResult(result) {
  state.latestResult = result;
  try {
    // Omit distribution data to keep sessionStorage payload manageable
    const lean = {
      ...result,
      features: result.features.map(f => ({ ...f, distribution: null })),
    };
    sessionStorage.setItem('dw_latest_result', JSON.stringify(lean));
  } catch (_) { /* ignore quota errors */ }
}
