import { renderNav, renderFooter } from '../components/nav.js';
import state from '../state/store.js';

function _formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function _fmt(val, digits = 4) {
  return (val !== null && val !== undefined) ? Number(val).toFixed(digits) : 'N/A';
}

function _getRunIdFromHash() {
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return null;
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  return params.get('id');
}

export function renderResults() {
  const runId = _getRunIdFromHash();
  const result = state.latestResult;

  // ---- Case 1: Specific historical runId requested that is not yet loaded into state ----
  if (runId && (!result || result.analysis_id !== runId)) {
    return `
${renderNav('results')}
<main class="w-full pt-20 bg-surface min-h-[calc(100vh-140px)] flex flex-col items-center justify-center">
  <div id="results-loading-box" class="max-w-xl w-full mx-auto px-gutter flex flex-col items-center gap-space-xl py-space-xl">
    <div class="border-[4px] border-on-surface bg-surface-container-high p-space-xl shadow-[8px_8px_0px_#1c1b1b] flex flex-col items-center gap-space-md text-center w-full">
      <span class="material-symbols-outlined text-[64px] text-on-surface animate-spin">sync</span>
      <div class="font-label-caps text-label-caps bg-primary-container px-2 py-0.5 border border-on-surface uppercase font-bold">DATABASE QUERY</div>
      <h1 class="font-headline-lg text-headline-lg uppercase text-on-surface font-bold tracking-tight">RETRIEVING HISTORICAL RUN</h1>
      <p class="font-code-sm text-code-sm text-on-surface-variant break-all">RUN_ID: ${runId}</p>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-sm">
        Querying database for statistical metrics, Great Expectations validation, and ML model evaluation...
      </p>
    </div>
  </div>
</main>
${renderFooter()}

<script data-page="results">
(async function loadHistoricalRun() {
  const loadingBox = document.getElementById('results-loading-box');
  try {
    const { fetchAnalysisRunById } = __dw.api;
    const { persistResult } = __dw.store;
    const data = await fetchAnalysisRunById('${runId}');
    persistResult(data);
    if (window.__dwNavigate) {
      window.__dwNavigate();
    } else {
      window.dispatchEvent(new Event('hashchange'));
    }
  } catch (err) {
    if (loadingBox) {
      loadingBox.innerHTML = \`
        <div class="border-[4px] border-on-surface bg-[#FFE5EC] p-space-xl shadow-[8px_8px_0px_#1c1b1b] flex flex-col items-center gap-space-md text-center w-full">
          <span class="material-symbols-outlined text-[64px] text-[#ba1a1a]">error</span>
          <div class="font-label-caps text-label-caps bg-[#ba1a1a] text-white px-2 py-0.5 uppercase font-bold">NOT FOUND / ERROR</div>
          <h1 class="font-headline-lg text-headline-lg uppercase text-[#ba1a1a] font-bold tracking-tight">CANNOT LOAD ANALYSIS</h1>
          <p class="font-body-md text-body-md text-on-surface max-w-sm font-semibold">
            \${err.message || 'Analysis run not found or database error'}.
          </p>
          <div class="flex gap-3 mt-4">
            <a href="#/dashboard" class="bg-surface text-on-surface border-[2px] border-on-surface font-headline-sm uppercase px-4 py-2 font-bold shadow-[3px_3px_0px_#1c1b1b]">
              ← BACK TO DASHBOARD
            </a>
            <a href="#/analyze" class="bg-primary-container text-on-surface border-[2px] border-on-surface font-headline-sm uppercase px-4 py-2 font-bold shadow-[3px_3px_0px_#1c1b1b]">
              RUN NEW ANALYSIS →
            </a>
          </div>
        </div>\`;
    }
  }
})();
</script>`;
  }

  // ---- Case 2: No result yet and no runId in URL ----
  if (!result) {
    return `
${renderNav('results')}
<main class="w-full pt-20 bg-surface min-h-[calc(100vh-140px)] flex flex-col items-center justify-center">
  <div class="max-w-xl w-full mx-auto px-gutter flex flex-col items-center gap-space-xl py-space-xl">
    <div class="border-[4px] border-on-surface bg-surface-container-high p-space-xl shadow-[8px_8px_0px_#1c1b1b] flex flex-col items-center gap-space-md text-center">
      <span class="material-symbols-outlined text-[64px] text-on-surface-variant">analytics</span>
      <h1 class="font-headline-lg text-headline-lg uppercase text-on-surface font-bold tracking-tight">NO ANALYSIS YET</h1>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-sm">
        No drift analysis has been run in this session. Upload two CSV files on the Analyze page and click ANALYZE DRIFT to see results here.
      </p>
      <a class="bg-primary-container text-on-surface border-[3px] border-on-surface font-headline-sm text-headline-sm uppercase px-space-xl py-space-md shadow-[4px_4px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1c1b1b] transition-all" href="#/analyze">
        GO TO ANALYZE →
      </a>
    </div>
  </div>
</main>
${renderFooter()}`;
  }

  // ---- Has result ----
  const hasDrift = result.overall_status === 'DRIFT_DETECTED';
  const features = result.features || [];
  const firstFeature = features[0] || null;

  const driftPct = result.features_analyzed > 0
    ? ((result.features_drifted / result.features_analyzed) * 100).toFixed(1)
    : '0.0';

  const overThreshold = result.max_psi - result.psi_threshold;

  return `
${renderNav('results')}
<main class="w-full pt-20 bg-surface min-h-[calc(100vh-140px)]">
  <div class="flex flex-col w-full">
    <div class="w-full px-gutter py-space-md flex flex-col gap-space-lg">

      <!-- HEADER BAR / METADATA -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border-b-[3px] border-on-surface pb-space-md">
        <div class="flex flex-col gap-space-xs">
          <div class="flex items-center gap-space-sm flex-wrap">
            <span class="inline-block bg-on-surface text-surface px-space-xs py-0.5 font-label-caps text-label-caps uppercase tracking-wider">JOB_STATUS::COMPLETE</span>
            <span class="font-code-sm text-code-sm text-on-surface-variant uppercase font-semibold">RUN_ID: ${result.analysis_id}</span>
            <span class="font-code-sm text-code-sm text-on-surface-variant">• ELAPSED: ${result.elapsed_ms}ms</span>
          </div>
          <h1 class="font-headline-lg text-headline-lg uppercase tracking-tight text-on-surface m-0">DRIFT ANALYSIS RESULTS</h1>
        </div>
        <div class="flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm">
          <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
            <span class="text-on-surface-variant uppercase">REF:</span>
            <span class="font-bold text-on-surface ml-1">${result.reference_file} (${result.reference_rows.toLocaleString()} rows)</span>
          </div>
          <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
            <span class="text-on-surface-variant uppercase">CUR:</span>
            <span class="font-bold text-on-surface ml-1">${result.current_file} (${result.current_rows.toLocaleString()} rows)</span>
          </div>
          <div class="border-2 border-on-surface bg-primary-container px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
            <span class="font-bold text-on-surface uppercase">${result.features_analyzed} FEATURES EVALUATED</span>
          </div>
        </div>
      </div>

      <!-- OVERALL RESULT BANNER -->
      <div class="w-full border-[4px] border-on-surface ${hasDrift ? 'bg-[#FF5277]' : 'bg-[#00D26A]'} p-space-md lg:p-space-lg shadow-[6px_6px_0px_#1c1b1b] flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
        <div class="flex items-start md:items-center gap-space-md">
          <div class="w-12 h-12 bg-on-surface text-surface flex items-center justify-center shrink-0 border-2 border-on-surface">
            <span class="material-symbols-outlined text-[32px] ${hasDrift ? 'text-[#FF5277]' : 'text-[#00D26A]'}">${hasDrift ? 'warning' : 'check_circle'}</span>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-space-sm">
              <span class="font-label-caps text-label-caps bg-on-surface text-surface px-1.5 py-0.5 uppercase tracking-widest">${hasDrift ? 'CRITICAL DISCREPANCY' : 'DISTRIBUTION STABLE'}</span>
              <span class="font-headline-md text-headline-md font-bold uppercase text-on-surface tracking-tight">${hasDrift ? 'DRIFT DETECTED' : 'NO SIGNIFICANT DRIFT'}</span>
            </div>
            <p class="font-body-lg text-body-lg text-on-surface font-semibold mt-0.5">
              ${hasDrift
                ? `${result.features_drifted} of ${result.features_analyzed} features detected as drifted. Numerical features use PSI; categorical features use JS divergence. Top contributor: <span class="bg-surface-container-lowest px-1 py-0.5 border border-on-surface font-code-sm">${firstFeature ? firstFeature.name + (firstFeature.type === 'numeric' ? ' (PSI: ' + firstFeature.psi.toFixed(3) + ')' : ' (JS: ' + firstFeature.js_divergence.toFixed(3) + ')') : '—'}</span>.`
                : `No features detected as drifted. Numerical features use PSI; categorical features use JS divergence.`
              }
            </p>
          </div>
        </div>
        <div class="shrink-0 flex items-center gap-space-xs self-stretch md:self-auto justify-end">
          <a class="bg-surface-container-lowest text-on-surface border-[2px] border-on-surface px-space-md py-space-xs font-headline-sm text-headline-sm uppercase font-bold shadow-[3px_3px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all" href="#/analyze">
            RE-RUN ANALYSIS
          </a>
        </div>
      </div>

      <!-- FOUR KEY METRICS CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div class="bg-surface-container-lowest border-[3px] border-on-surface p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col justify-between">
          <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-xs">
            <span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">FEATURES ANALYZED</span>
            <span class="material-symbols-outlined text-on-surface text-[18px]">table_chart</span>
          </div>
          <div class="mt-space-sm flex items-baseline justify-between">
            <span class="font-code-lg text-display font-bold text-on-surface tracking-tight">${result.features_analyzed}</span>
            <span class="font-code-sm text-code-sm text-on-surface-variant font-medium">100% COVERAGE</span>
          </div>
          <div class="mt-space-xs font-code-sm text-code-sm text-on-surface-variant">
            ${result.schema.numeric_columns.length} Numeric • ${result.schema.categorical_columns.length} Categorical
            ${result.schema.identifier_columns && result.schema.identifier_columns.length ? ' • ' + result.schema.identifier_columns.length + ' Identifier' : ''}
          </div>
        </div>
        <div class="bg-[#FFE600] border-[3px] border-on-surface p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col justify-between">
          <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-xs">
            <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">FEATURES DRIFTED</span>
            <span class="material-symbols-outlined text-on-surface text-[18px]">crisis_alert</span>
          </div>
          <div class="mt-space-sm flex items-baseline justify-between">
            <span class="font-code-lg text-display font-bold text-on-surface tracking-tight">${result.features_drifted}</span>
            <span class="bg-on-surface text-[#FFE600] px-1 py-0.5 font-label-caps text-label-caps uppercase">${driftPct}% OF TOTAL</span>
          </div>
          <div class="mt-space-xs font-code-sm text-code-sm text-on-surface font-semibold">PSI &gt; ${result.psi_threshold} THRESHOLD</div>
        </div>
        <div class="bg-[#FF5277] border-[3px] border-on-surface p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col justify-between text-on-surface">
          <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-xs">
            <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface">MAXIMUM PSI</span>
            <span class="material-symbols-outlined text-on-surface text-[18px]">priority_high</span>
          </div>
          <div class="mt-space-sm flex items-baseline justify-between">
            <span class="font-code-lg text-display font-bold text-on-surface tracking-tight">${result.max_psi.toFixed(3)}</span>
            <span class="font-code-sm text-code-sm font-bold uppercase underline">${firstFeature ? firstFeature.name : '—'}</span>
          </div>
          <div class="mt-space-xs font-code-sm text-code-sm text-on-surface font-semibold">
            ${overThreshold > 0 ? '+' + overThreshold.toFixed(3) + ' OVER GUARDRAIL' : 'WITHIN GUARDRAIL'}
          </div>
        </div>
        <div class="bg-[#00D26A] border-[3px] border-on-surface p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col justify-between text-on-surface">
          <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-xs">
            <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface">PSI THRESHOLD</span>
            <span class="material-symbols-outlined text-on-surface text-[18px]">tune</span>
          </div>
          <div class="mt-space-sm flex items-baseline justify-between">
            <span class="font-code-lg text-display font-bold text-on-surface tracking-tight">${result.psi_threshold}</span>
            <span class="font-code-sm text-code-sm bg-on-surface text-[#00D26A] px-1.5 py-0.5 font-bold uppercase">CONFIGURED</span>
          </div>
          <div class="mt-space-xs font-code-sm text-code-sm text-on-surface font-semibold">DATAWATCH GUARDRAIL</div>
        </div>
      </div>

      <!-- DATASET PROFILING SUMMARY SECTION -->
      ${result.profile ? `
      <div class="mt-space-sm flex flex-col gap-space-md">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border-b-[3px] border-on-surface pb-space-sm">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[24px] text-on-surface">data_exploration</span>
            <h2 class="font-headline-md text-headline-md uppercase tracking-tight text-on-surface m-0">DATASET PROFILING</h2>
          </div>
          <div class="flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm">
            <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
              <span class="text-on-surface-variant uppercase">ROW DELTA:</span>
              <span class="font-bold text-on-surface ml-1">${(result.profile.current.rows - result.profile.reference.rows) >= 0 ? '+' : ''}${(result.profile.current.rows - result.profile.reference.rows).toLocaleString()} rows</span>
            </div>
            <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
              <span class="text-on-surface-variant uppercase">MISSING CELLS:</span>
              <span class="font-bold text-on-surface ml-1">Ref ${result.profile.reference.missing_cell_percent.toFixed(2)}% vs Cur ${result.profile.current.missing_cell_percent.toFixed(2)}%</span>
            </div>
            <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
              <span class="text-on-surface-variant uppercase">DUPLICATE ROWS:</span>
              <span class="font-bold text-on-surface ml-1">Ref ${result.profile.reference.duplicate_rows} vs Cur ${result.profile.current.duplicate_rows}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <!-- REFERENCE DATASET PROFILE -->
          <div class="border-[3px] border-on-surface bg-surface-container-lowest p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col justify-between">
            <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-xs mb-space-sm bg-[#FAF7EE] p-1">
              <span class="font-label-caps text-label-caps font-bold uppercase text-on-surface flex items-center gap-1">
                <span class="w-3 h-3 bg-[#FFE600] border border-on-surface inline-block"></span> BASELINE REFERENCE PROFILE
              </span>
              <span class="font-code-sm text-code-sm font-bold text-on-surface">${result.reference_file}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-space-xs font-code-sm text-code-sm">
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">TOTAL ROWS</div>
                <div class="text-lg font-bold text-on-surface">${result.profile.reference.rows.toLocaleString()}</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">COLUMNS</div>
                <div class="text-lg font-bold text-on-surface">${result.profile.reference.columns}</div>
                <div class="text-[10px] text-on-surface-variant">${result.profile.reference.numeric_columns} num • ${result.profile.reference.categorical_columns} cat • ${result.profile.reference.identifier_columns} id</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">MISSING CELLS</div>
                <div class="text-lg font-bold text-on-surface">${result.profile.reference.missing_cells.toLocaleString()}</div>
                <div class="text-[10px] text-on-surface-variant font-bold">${result.profile.reference.missing_cell_percent.toFixed(2)}% of cells</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">DUPLICATE ROWS</div>
                <div class="text-lg font-bold text-on-surface">${result.profile.reference.duplicate_rows.toLocaleString()}</div>
                <div class="text-[10px] text-on-surface-variant font-bold">${result.profile.reference.duplicate_row_percent.toFixed(2)}% of rows</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2 sm:col-span-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">IN-MEMORY SIZE</div>
                <div class="text-lg font-bold text-on-surface">${_formatBytes(result.profile.reference.memory_usage_bytes)}</div>
                <div class="text-[10px] text-on-surface-variant font-mono">(${result.profile.reference.memory_usage_bytes.toLocaleString()} bytes)</div>
              </div>
            </div>
          </div>

          <!-- CURRENT DATASET PROFILE -->
          <div class="border-[3px] border-on-surface bg-surface-container-lowest p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col justify-between">
            <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-xs mb-space-sm bg-[#FAF7EE] p-1">
              <span class="font-label-caps text-label-caps font-bold uppercase text-on-surface flex items-center gap-1">
                <span class="w-3 h-3 bg-[#FF5277] border border-on-surface inline-block"></span> CURRENT PRODUCTION PROFILE
              </span>
              <span class="font-code-sm text-code-sm font-bold text-on-surface">${result.current_file}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-space-xs font-code-sm text-code-sm">
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">TOTAL ROWS</div>
                <div class="text-lg font-bold text-on-surface">${result.profile.current.rows.toLocaleString()}</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">COLUMNS</div>
                <div class="text-lg font-bold text-on-surface">${result.profile.current.columns}</div>
                <div class="text-[10px] text-on-surface-variant">${result.profile.current.numeric_columns} num • ${result.profile.current.categorical_columns} cat • ${result.profile.current.identifier_columns} id</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">MISSING CELLS</div>
                <div class="text-lg font-bold ${result.profile.current.missing_cells > 0 ? 'text-[#ba1a1a]' : 'text-on-surface'}">${result.profile.current.missing_cells.toLocaleString()}</div>
                <div class="text-[10px] text-on-surface-variant font-bold">${result.profile.current.missing_cell_percent.toFixed(2)}% of cells</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">DUPLICATE ROWS</div>
                <div class="text-lg font-bold ${result.profile.current.duplicate_rows > 0 ? 'text-[#b58b00]' : 'text-on-surface'}">${result.profile.current.duplicate_rows.toLocaleString()}</div>
                <div class="text-[10px] text-on-surface-variant font-bold">${result.profile.current.duplicate_row_percent.toFixed(2)}% of rows</div>
              </div>
              <div class="border border-on-surface bg-surface-container-low p-2 sm:col-span-2">
                <div class="font-label-caps text-on-surface-variant text-[10px] uppercase font-bold">IN-MEMORY SIZE</div>
                <div class="text-lg font-bold text-on-surface">${_formatBytes(result.profile.current.memory_usage_bytes)}</div>
                <div class="text-[10px] text-on-surface-variant font-mono">(${result.profile.current.memory_usage_bytes.toLocaleString()} bytes)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- DATA QUALITY SECTION -->
      ${result.quality ? `
      <div class="mt-space-lg mb-space-md flex flex-col gap-space-md">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border-b-[3px] border-on-surface pb-space-sm">
          <h2 class="font-headline-md text-headline-md uppercase tracking-tight text-on-surface m-0">DATA QUALITY</h2>
          <div class="flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm">
             <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface-variant uppercase">CHECKS:</span>
               <span class="font-bold text-on-surface ml-1">${result.quality.total_expectations}</span>
             </div>
             <div class="border-2 border-on-surface bg-[#00D26A] px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface uppercase">PASSED:</span>
               <span class="font-bold text-on-surface ml-1">${result.quality.passed}</span>
             </div>
             <div class="border-2 border-on-surface ${result.quality.failed > 0 ? 'bg-[#FF5277]' : 'bg-surface-container-lowest'} px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface uppercase">FAILED:</span>
               <span class="font-bold text-on-surface ml-1">${result.quality.failed}</span>
             </div>
             <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface-variant uppercase">SCORE:</span>
               <span class="font-bold text-on-surface ml-1">${result.quality.success_percent.toFixed(1)}%</span>
             </div>
             <div class="border-2 border-on-surface ${result.quality.overall_status === 'FAIL' ? 'bg-[#FF5277]' : result.quality.overall_status === 'ATTENTION' ? 'bg-[#FFE600]' : 'bg-[#00D26A]'} px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface uppercase font-bold">STATUS: ${result.quality.overall_status}</span>
             </div>
          </div>
        </div>

        <div class="border-[3.5px] border-on-surface bg-surface-container-lowest shadow-[6px_6px_0px_#1c1b1b] overflow-x-auto">
          <table class="w-full text-left border-collapse font-code-sm text-code-sm">
            <thead>
              <tr class="bg-surface-container-high border-b-[3px] border-on-surface text-on-surface">
                <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface">CHECK</th>
                <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface">COLUMN</th>
                <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface text-center">STATUS</th>
                <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface">EXPECTED</th>
                <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider">OBSERVED</th>
              </tr>
            </thead>
            <tbody class="divide-y-2 divide-on-surface">
              ${result.quality.expectations.map((q, idx) => {
                const statusBg = q.status === 'PASS' ? 'bg-surface-container' : q.status === 'WARNING' ? 'bg-[#FFE600]' : 'bg-[#FF5277]';
                const statusText = 'text-on-surface';
                return `
                <tr class="hover:bg-primary-container/20 cursor-pointer transition-colors" onclick="window.selectQuality(${idx})">
                  <td class="p-space-sm border-r-2 border-on-surface font-bold text-on-surface">${q.expectation}</td>
                  <td class="p-space-sm border-r-2 border-on-surface uppercase font-semibold">${q.column || 'N/A'}</td>
                  <td class="p-space-sm border-r-2 border-on-surface text-center font-bold">
                    <span class="px-2 py-0.5 border border-on-surface shadow-[1px_1px_0px_#1c1b1b] ${statusBg} ${statusText}">${q.status}</span>
                  </td>
                  <td class="p-space-sm border-r-2 border-on-surface">${q.expected_value}</td>
                  <td class="p-space-sm text-on-surface ${q.status !== 'PASS' ? 'font-bold' : ''}">${q.observed_value}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      <!-- ML MODEL IMPACT SECTION -->
      <div class="mt-space-lg mb-space-md flex flex-col gap-space-md">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border-b-[3px] border-on-surface pb-space-sm">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-[24px] text-on-surface">model_training</span>
            <h2 class="font-headline-md text-headline-md uppercase tracking-tight text-on-surface m-0">ML MODEL IMPACT</h2>
          </div>
          ${result.model_impact && result.model_impact.status === 'COMPLETED' ? `
          <div class="flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm">
             <div class="border-2 border-on-surface bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface-variant uppercase">MODEL:</span>
               <span class="font-bold text-on-surface ml-1">${result.model_impact.model_name}</span>
             </div>
             <div class="border-2 border-on-surface bg-primary-container px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface uppercase font-bold">TARGET:</span>
               <span class="font-bold text-on-surface ml-1">${result.model_impact.target_column}</span>
             </div>
             <div class="border-2 border-on-surface ${result.model_impact.verdict === 'PERFORMANCE DECREASE OBSERVED' ? 'bg-[#FF5277]' : 'bg-[#00D26A]'} px-space-sm py-1 shadow-[2px_2px_0px_#1c1b1b]">
               <span class="text-on-surface uppercase font-bold">${result.model_impact.verdict}</span>
             </div>
          </div>
          ` : ''}
        </div>

        ${(!result.model_impact || result.model_impact.status === 'NOT_REQUESTED') ? `
        <div class="border-[3px] border-on-surface bg-surface-container-lowest p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
          <div class="flex flex-col gap-1">
            <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface-variant">SUPERVISED CLASSIFICATION EVALUATION</span>
            <div class="font-headline-sm text-headline-sm uppercase font-bold text-on-surface">NOT EVALUATED FOR THIS ANALYSIS</div>
            <p class="font-body-md text-body-md text-on-surface-variant m-0">
              Model performance evaluation was not requested for this run. Provide a target column (e.g., churn) to measure holdout accuracy, precision, recall, and macro F1-score across reference and current datasets.
            </p>
          </div>
          <a class="shrink-0 bg-primary-container text-on-surface border-[2.5px] border-on-surface font-label-caps text-label-caps font-bold uppercase px-space-md py-2 shadow-[2px_2px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#1c1b1b] transition-all" href="#/analyze">
            [ ENABLE IN NEXT ANALYSIS → ]
          </a>
        </div>
        ` : (result.model_impact.status === 'NOT_POSSIBLE' || result.model_impact.status === 'FAILED') ? `
        <div class="border-[3px] border-on-surface bg-tertiary-container/30 p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col gap-space-xs">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-tertiary text-[20px]">warning</span>
            <span class="font-headline-sm text-headline-sm uppercase font-bold text-on-surface">MODEL IMPACT: ${result.model_impact.status}</span>
          </div>
          <p class="font-body-md text-body-md text-on-surface m-0 font-medium">
            ${result.model_impact.message || 'Model impact evaluation could not be completed for the provided data.'}
          </p>
        </div>
        ` : `
        <div class="flex flex-col gap-space-md">
          <!-- Sample Metadata & Objective Metrics -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-space-sm font-code-sm text-code-sm">
            <div class="border-2 border-on-surface bg-surface-container-lowest p-space-xs shadow-[2px_2px_0px_#1c1b1b]">
              <span class="font-label-caps text-label-caps text-on-surface-variant block uppercase font-bold">REF TRAIN SAMPLES</span>
              <span class="text-lg font-bold text-on-surface">${result.model_impact.reference_train_rows.toLocaleString()}</span>
              <span class="text-[10px] text-on-surface-variant block">80% baseline split</span>
            </div>
            <div class="border-2 border-on-surface bg-surface-container-lowest p-space-xs shadow-[2px_2px_0px_#1c1b1b]">
              <span class="font-label-caps text-label-caps text-on-surface-variant block uppercase font-bold">REF HOLDOUT EVAL SAMPLES</span>
              <span class="text-lg font-bold text-on-surface">${result.model_impact.reference_evaluation_rows.toLocaleString()}</span>
              <span class="text-[10px] text-on-surface-variant block">20% holdout split</span>
            </div>
            <div class="border-2 border-on-surface bg-surface-container-lowest p-space-xs shadow-[2px_2px_0px_#1c1b1b]">
              <span class="font-label-caps text-label-caps text-on-surface-variant block uppercase font-bold">CURRENT EVAL SAMPLES</span>
              <span class="text-lg font-bold text-on-surface">${result.model_impact.current_evaluation_rows.toLocaleString()}</span>
              <span class="text-[10px] text-on-surface-variant block">Labelled production batch</span>
            </div>
          </div>

          <!-- Performance Comparison Table -->
          <div class="border-[3.5px] border-on-surface bg-surface-container-lowest shadow-[6px_6px_0px_#1c1b1b] overflow-x-auto">
            <table class="w-full text-left border-collapse font-code-sm text-code-sm">
              <thead>
                <tr class="bg-surface-container-high border-b-[3px] border-on-surface text-on-surface">
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface">METRIC (MACRO)</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface text-right">REFERENCE HOLDOUT</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface text-right">CURRENT LABELLED</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider text-right">CHANGE (PP)</th>
                </tr>
              </thead>
              <tbody class="divide-y-2 divide-on-surface">
                ${['accuracy', 'precision', 'recall', 'f1_score'].map(m => {
                  const mLabel = m === 'f1_score' ? 'F1-SCORE (MACRO)' : m.toUpperCase() + ' (MACRO)';
                  const refScore = result.model_impact.reference_metrics ? (result.model_impact.reference_metrics[m] * 100).toFixed(2) + '%' : 'N/A';
                  const curScore = result.model_impact.current_metrics ? (result.model_impact.current_metrics[m] * 100).toFixed(2) + '%' : 'N/A';
                  const deltaPP = result.model_impact.metric_changes_percentage_points ? result.model_impact.metric_changes_percentage_points[m] : 0;
                  const deltaStr = (deltaPP >= 0 ? '+' : '') + deltaPP.toFixed(2) + ' pp';
                  const deltaColor = deltaPP < -5.0 ? 'text-[#ba1a1a] font-bold' : (deltaPP < 0 ? 'text-[#b58b00] font-bold' : 'text-[#008744] font-bold');
                  return `
                  <tr class="hover:bg-primary-container/10">
                    <td class="p-space-sm border-r-2 border-on-surface font-bold uppercase text-on-surface">${mLabel}</td>
                    <td class="p-space-sm border-r-2 border-on-surface text-right font-mono">${refScore}</td>
                    <td class="p-space-sm border-r-2 border-on-surface text-right font-mono font-bold">${curScore}</td>
                    <td class="p-space-sm text-right font-mono ${deltaColor}">${deltaStr}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Interpretation Banner -->
          <div class="border-[2.5px] border-on-surface bg-surface p-space-sm shadow-[2px_2px_0px_#1c1b1b] flex items-start gap-space-sm">
            <span class="material-symbols-outlined text-[20px] text-on-surface shrink-0 mt-0.5">psychology_alt</span>
            <div class="flex flex-col gap-0.5">
              <span class="font-label-caps text-label-caps font-bold uppercase text-on-surface">MODEL IMPACT INTERPRETATION</span>
              <p class="font-body-md text-body-md text-on-surface m-0 leading-relaxed">
                ${result.model_impact.interpretation}
              </p>
            </div>
          </div>
        </div>
        `}
      </div>

      <!-- MAIN 2-COLUMN LAYOUT -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">

        <!-- LEFT: Feature Drift Table -->
        <div class="xl:col-span-7 flex flex-col gap-space-md">
          <!-- Filter Strip -->
          <div class="border-[3px] border-on-surface bg-surface-container-lowest p-space-sm shadow-[4px_4px_0px_#1c1b1b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
            <div class="flex items-center gap-space-xs font-code-sm text-code-sm font-semibold">
              <span class="material-symbols-outlined text-[18px]">filter_list</span>
              <span>FILTER:</span>
              <div class="flex flex-wrap items-center gap-1" id="filter-btns">
                <button class="bg-primary-container text-on-surface border border-on-surface px-2 py-0.5 font-label-caps text-label-caps uppercase font-bold shadow-[1px_1px_0px_#1c1b1b]" data-filter="all">All (${features.length})</button>
                <button class="bg-surface-container text-on-surface border border-on-surface px-2 py-0.5 font-label-caps text-label-caps uppercase font-semibold hover:bg-surface-container-high" data-filter="drift">Drift Only (${result.features_drifted})</button>
                <button class="bg-surface-container text-on-surface border border-on-surface px-2 py-0.5 font-label-caps text-label-caps uppercase font-semibold hover:bg-surface-container-high" data-filter="numeric">Numeric (${result.schema.numeric_columns.length})</button>
                <button class="bg-surface-container text-on-surface border border-on-surface px-2 py-0.5 font-label-caps text-label-caps uppercase font-semibold hover:bg-surface-container-high" data-filter="categorical">Categorical (${result.schema.categorical_columns.length})</button>
              </div>
            </div>
            <span class="font-code-sm text-code-sm text-on-surface-variant font-bold" id="showing-count">Showing ${features.length} features</span>
          </div>
          <!-- Table -->
          <div class="border-[3.5px] border-on-surface bg-surface-container-lowest shadow-[6px_6px_0px_#1c1b1b] overflow-x-auto">
            <table class="w-full text-left border-collapse font-code-sm text-code-sm">
              <thead>
                <tr class="bg-surface-container-high border-b-[3px] border-on-surface text-on-surface">
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface">FEATURE</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface">TYPE</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface text-right">PSI</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface text-right">KS P-VAL</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider border-r-2 border-on-surface text-center">STATUS</th>
                  <th class="p-space-sm font-label-caps text-label-caps uppercase tracking-wider text-center">SEVERITY</th>
                </tr>
              </thead>
              <tbody class="divide-y-2 divide-on-surface" id="feature-table-body">
                ${features.map((f, idx) => _renderFeatureRow(f, idx, result.psi_threshold)).join('')}
              </tbody>
            </table>
          </div>
          <!-- Terminal Log -->
          <div class="border-[2px] border-on-surface bg-on-surface text-surface p-space-sm shadow-[3px_3px_0px_#1c1b1b] font-code-sm text-code-sm">
            <div class="flex items-center justify-between border-b border-surface-container-highest/20 pb-1 mb-2 text-[#FFE600]">
              <span class="font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">terminal</span>
                FASTAPI_EXECUTION_STDOUT
              </span>
              <span class="text-surface-dim">ELAPSED: ${result.elapsed_ms}ms</span>
            </div>
            <p class="text-surface-dim m-0 leading-tight" id="terminal-log">
              [INFO] RUN_ID: ${result.analysis_id} — Analysis complete<br/>
              [INFO] REF: ${result.reference_file} (${result.reference_rows} rows) | CUR: ${result.current_file} (${result.current_rows} rows)<br/>
              [INFO] Features analyzed: ${result.features_analyzed} | Drifted: ${result.features_drifted} | Max PSI: ${result.max_psi !== null ? result.max_psi.toFixed(4) : 'N/A'}<br/>
              ${hasDrift
                ? `[ALERT] Drift detected. Overall: ${result.overall_status}`
                : `[INFO] Drift status: NEGATIVE. Overall: ${result.overall_status}`
              }
            </p>
          </div>
        </div>

        <!-- RIGHT: Feature Detail Drawer -->
        <div class="xl:col-span-5 flex flex-col gap-space-md">
          <div class="border-[3.5px] border-on-surface bg-surface-container-lowest shadow-[6px_6px_0px_#1c1b1b] flex flex-col">
            <div class="bg-surface-container-highest border-b-[3px] border-on-surface p-space-sm flex items-center justify-between">
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-on-surface text-[20px]">troubleshoot</span>
                <span class="font-headline-sm text-headline-sm uppercase font-bold text-on-surface" id="detail-feature-title">
                  ${firstFeature ? 'FEATURE: ' + firstFeature.name : 'SELECT A FEATURE'}
                </span>
              </div>
              <span class="border-2 border-on-surface font-label-caps text-label-caps font-bold px-2 py-0.5 shadow-[2px_2px_0px_#1c1b1b] ${firstFeature ? _severityBadgeClass(firstFeature.severity) : 'bg-surface-container text-on-surface'}" id="detail-feature-badge">
                ${firstFeature ? firstFeature.severity + ' / ' + firstFeature.status : '—'}
              </span>
            </div>
            <div class="p-space-md flex flex-col gap-space-md" id="drawer-content">
              ${firstFeature ? _renderDrawerContent(firstFeature, result.psi_threshold) : '<p class="font-body-md text-body-md text-on-surface-variant text-center py-space-xl">Click a feature row to inspect its statistics.</p>'}
            </div>
          </div>
        </div>
      </div>

      <!-- Export Toast -->
      <div class="hidden border-[3px] border-on-surface bg-[#00D26A] p-space-sm shadow-[4px_4px_0px_#1c1b1b] items-center justify-between" id="export-toast">
        <div class="flex items-center gap-2 font-code-sm text-code-sm font-bold text-on-surface">
          <span class="material-symbols-outlined">check_circle</span>
          <span>REPORT GENERATED: dw-${result.analysis_id}_results.json downloaded</span>
        </div>
        <button class="font-bold border border-on-surface bg-surface px-1.5 py-0.5 text-xs" id="dismiss-toast">DISMISS</button>
      </div>

    </div>
  </div>
</main>
${renderFooter()}

<script data-page="results">
(function initResults() {
  // All features from the API result stored in JS
  var features = ${JSON.stringify(features)};
  var psiThreshold = ${result.psi_threshold};
  var catJsThreshold = ${result.categorical_js_threshold};
  var currentFilter = 'all';
  var selectedFeatureIdx = ${firstFeature ? 0 : -1};

  // ---- Filter buttons ----
  document.getElementById('filter-btns')?.querySelectorAll('button[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.getAttribute('data-filter');
      // Update button styles
      document.querySelectorAll('#filter-btns button').forEach(b => {
        b.className = b.className.replace('bg-primary-container', 'bg-surface-container');
      });
      btn.className = btn.className.replace('bg-surface-container', 'bg-primary-container');
      renderTable();
    });
  });

  function renderTable() {
    var filtered = features.filter(f => {
      if (currentFilter === 'drift') return f.status === 'DRIFT';
      if (currentFilter === 'numeric') return f.type === 'numeric';
      if (currentFilter === 'categorical') return f.type === 'categorical';
      return true;
    });
    document.getElementById('showing-count').textContent = 'Showing ' + filtered.length + ' features';
    var tbody = document.getElementById('feature-table-body');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(function(f, idx) {
      return buildRow(f, features.indexOf(f));
    }).join('');
    // Re-attach click handlers
    tbody.querySelectorAll('tr[data-feature-idx]').forEach(function(row) {
      row.addEventListener('click', function() {
        var idx = parseInt(row.getAttribute('data-feature-idx'), 10);
        selectFeature(idx);
      });
    });
  }

  function buildRow(f, globalIdx) {
    var primaryMetric = f.type === 'numeric' ? f.psi : f.js_divergence;
    var psiColor = f.status === 'DRIFT' ? 'text-[#ba1a1a]' : (f.status === 'WARNING' ? 'text-[#b58b00]' : 'text-on-surface');
    var badgeBg  = _severityBg(f.severity);
    var statusBg = f.status === 'DRIFT' ? (f.severity === 'CRITICAL' ? 'bg-[#FF5277]' : 'bg-[#FFE600]') : 'bg-[#00D26A]';
    var rowBg    = f.status === 'DRIFT' ? 'bg-primary-container/10' : 'bg-surface-container-lowest';
    var borderL  = f.status === 'DRIFT' ? 'border-l-[6px] border-l-[#FF5277]' : '';
    
    var ksPval = 'N/A';
    if (f.type === 'numeric' && f.ks_p_value !== null && f.ks_p_value !== undefined) {
      ksPval = f.ks_p_value < 0.0001 ? '<0.0001' : f.ks_p_value.toFixed(4);
    }

    var isSelected = globalIdx === selectedFeatureIdx;
    return '<tr class="' + rowBg + ' ' + borderL + ' hover:bg-primary-container/20 cursor-pointer transition-colors' + (isSelected ? ' outline outline-2 outline-secondary' : '') + '" data-feature-idx="' + globalIdx + '">' +
      '<td class="p-space-sm border-r-2 border-on-surface font-bold text-on-surface">' + f.name + (f.status === 'DRIFT' ? '<span class="material-symbols-outlined text-[14px] text-[#FF5277] align-middle ml-1">arrow_forward</span>' : '') + '</td>' +
      '<td class="p-space-sm border-r-2 border-on-surface uppercase">' + f.type + '</td>' +
      '<td class="p-space-sm border-r-2 border-on-surface text-right font-bold ' + psiColor + '">' + (f.type === 'numeric' ? 'PSI ' : 'JS ') + primaryMetric.toFixed(3) + '</td>' +
      '<td class="p-space-sm border-r-2 border-on-surface text-right">' + ksPval + '</td>' +
      '<td class="p-space-sm border-r-2 border-on-surface text-center"><span class="inline-block ' + statusBg + ' text-on-surface border border-on-surface font-label-caps text-label-caps font-bold px-1.5 py-0.5 shadow-[1px_1px_0px_#1c1b1b]">' + f.status + '</span></td>' +
      '<td class="p-space-sm text-center"><span class="inline-block ' + badgeBg + ' text-on-surface border border-on-surface font-label-caps text-label-caps font-bold px-1.5 py-0.5">' + f.severity + '</span></td>' +
      '</tr>';
  }

  function _severityBg(sev) {
    if (sev === 'CRITICAL') return 'bg-[#FF5277]';
    if (sev === 'HIGH')     return 'bg-[#FFE600]';
    if (sev === 'MODERATE') return 'bg-surface-container-highest';
    return 'bg-[#00D26A]';
  }

  window.selectQuality = function(idx) {
    var q = result.quality.expectations[idx];
    if (!q) return;

    // Remove selection highlight from drift table since we selected quality
    selectedFeatureIdx = -1;
    renderTable();

    // Update drawer header
    document.getElementById('detail-feature-title').textContent = 'QUALITY CHECK: ' + q.expectation;
    var badge = document.getElementById('detail-feature-badge');
    badge.textContent = q.status;
    var sevBg = q.status === 'PASS' ? 'bg-[#00D26A]' : q.status === 'WARNING' ? 'bg-[#FFE600]' : 'bg-[#FF5277]';
    badge.className = 'border-2 border-on-surface font-label-caps text-label-caps font-bold px-2 py-0.5 shadow-[2px_2px_0px_#1c1b1b] ' + sevBg + ' text-on-surface';

    // Clear chart
    var canvas = document.getElementById('dist-chart');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    var overThreshold = q.status !== 'PASS';
    var explanation = '<strong class="font-bold">' + q.expectation + '</strong> ' + (q.column ? 'on column <strong class="font-bold">' + q.column + '</strong>' : 'on dataset') + ' returned <strong class="font-bold">' + q.status + '</strong>. ';
    explanation += 'Expected <strong class="font-bold">' + q.expected_value + '</strong>, but observed <strong class="font-bold">' + q.observed_value + '</strong>.';

    var content = '<div>' +
      '<span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold tracking-wider block mb-space-xs">QUALITY METRICS</span>' +
      '<div class="grid grid-cols-2 gap-space-xs border-2 border-on-surface bg-surface-container-low p-space-xs">' +
        _statCell('EXPECTED', q.expected_value, '') +
        _statCell('OBSERVED', q.observed_value, overThreshold ? 'text-[#ba1a1a]' : '') +
        _statCell('COLUMN', q.column || 'N/A', '') +
        _statCell('STATUS', q.status, overThreshold ? 'bg-[#FF5277] font-bold text-on-surface' : 'bg-[#00D26A] font-bold text-on-surface') +
      '</div>' +
    '</div>' +
    _renderCommonDrawerBottom({ name: q.expectation, type: 'quality' }, explanation);
    
    document.getElementById('drawer-content').innerHTML = content;
  };

  function selectFeature(idx) {
    selectedFeatureIdx = idx;
    var f = features[idx];
    if (!f) return;

    // Update drawer header
    document.getElementById('detail-feature-title').textContent = 'FEATURE: ' + f.name;
    var badge = document.getElementById('detail-feature-badge');
    badge.textContent = f.severity + ' / ' + f.status;
    badge.className = 'border-2 border-on-surface font-label-caps text-label-caps font-bold px-2 py-0.5 shadow-[2px_2px_0px_#1c1b1b] ' + _severityBg(f.severity) + ' text-on-surface';

    // Render drawer content
    document.getElementById('drawer-content').innerHTML = buildDrawerContent(f);
    renderChart(f);
    renderTable(); // re-render to update selected highlight
  }

  function buildDrawerContent(f) {
    var overThreshold = f.status === 'DRIFT';

    function _f(val, digits) {
      if (digits === undefined) digits = 4;
      return (val !== null && val !== undefined) ? Number(val).toFixed(digits) : 'N/A';
    }

    if (f.type === 'identifier') {
      var explanation = '<strong class="font-bold">' + f.name + '</strong> is an identifier feature. Identifiers are not evaluated for statistical distribution drift (PSI/JS), but are monitored for structural data quality issues such as duplicates and missing values.';
      return '<div>' +
        '<span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold tracking-wider block mb-space-xs">IDENTIFIER PROFILE &amp; STRUCTURAL METRICS</span>' +
        '<div class="grid grid-cols-2 gap-space-xs border-2 border-on-surface bg-surface-container-low p-space-xs">' +
          _statCell('STATUS', f.status, '') +
          _statCell('SEVERITY', f.severity, '') +
          _statCell('REF UNIQUE IDS', (f.reference_unique_count !== null && f.reference_unique_count !== undefined ? f.reference_unique_count.toLocaleString() : 'N/A'), '') +
          _statCell('CUR UNIQUE IDS', (f.current_unique_count !== null && f.current_unique_count !== undefined ? f.current_unique_count.toLocaleString() : 'N/A'), '') +
          _statCell('REF MISSING', f.reference_missing_count + ' (' + f.reference_missing_percent.toFixed(2) + '%)', '') +
          _statCell('CUR MISSING', f.current_missing_count + ' (' + f.current_missing_percent.toFixed(2) + '%)', f.current_missing_count > 0 ? 'text-[#ba1a1a]' : '') +
        '</div>' +
      '</div>' +
      _renderCommonDrawerBottom(f, explanation);
    } else if (f.type === 'categorical') {
      var thresholdDesc = 'Categorical JS threshold: ' + catJsThreshold;
      var explanation = '<strong class="font-bold">' + f.name + '</strong> is a categorical feature with JS divergence of <strong class="font-bold">' + f.js_divergence.toFixed(4) + '</strong>. ' +
        (overThreshold
          ? 'Distribution drift exceeds the configured guardrails (' + thresholdDesc + '). Downstream ML systems using this feature should be evaluated for potential performance impact.'
          : 'Distribution drift is within tolerable production variation boundaries (' + thresholdDesc + ').');
          
      var catRows = '';
      if (f.category_distribution && f.category_distribution.categories) {
        for (var i = 0; i < f.category_distribution.categories.length; i++) {
          catRows += '<tr class="border-b border-on-surface/20 hover:bg-black/5">' +
            '<td class="py-1 px-2 border-r border-on-surface/20 font-bold">' + f.category_distribution.categories[i] + '</td>' +
            '<td class="py-1 px-2 border-r border-on-surface/20 text-right">' + f.category_distribution.reference_percentages[i].toFixed(1) + '%</td>' +
            '<td class="py-1 px-2 text-right font-bold">' + f.category_distribution.current_percentages[i].toFixed(1) + '%</td>' +
            '</tr>';
        }
      }

      var refUnique = f.reference_unique_count !== null && f.reference_unique_count !== undefined ? f.reference_unique_count : 'N/A';
      var curUnique = f.current_unique_count !== null && f.current_unique_count !== undefined ? f.current_unique_count : 'N/A';
      var refMode = f.reference_mode || 'N/A';
      var curMode = f.current_mode || 'N/A';
      var refModeCount = f.reference_mode_count !== null && f.reference_mode_count !== undefined ? f.reference_mode_count.toLocaleString() : 'N/A';
      var curModeCount = f.current_mode_count !== null && f.current_mode_count !== undefined ? f.current_mode_count.toLocaleString() : 'N/A';
      var refModePct = f.reference_mode_percent !== null && f.reference_mode_percent !== undefined ? f.reference_mode_percent.toFixed(1) + '%' : 'N/A';
      var curModePct = f.current_mode_percent !== null && f.current_mode_percent !== undefined ? f.current_mode_percent.toFixed(1) + '%' : 'N/A';

      return '<div>' +
        '<span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold tracking-wider block mb-space-xs">CATEGORICAL METRICS</span>' +
        '<div class="grid grid-cols-3 gap-space-xs border-2 border-on-surface bg-surface-container-low p-space-xs">' +
          _statCell('JS DIVERGENCE', f.js_divergence.toFixed(4), overThreshold ? 'text-[#ba1a1a]' : '', 'LIMIT: ' + catJsThreshold) +
          _statCell('STATUS', f.status, overThreshold ? 'bg-[#FF5277] font-bold text-on-surface' : '') +
          _statCell('SEVERITY', f.severity, overThreshold ? 'bg-[#FF5277] font-bold text-on-surface' : '') +
        '</div>' +
      '</div>' +
      '<div class="border-[2px] border-on-surface bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b] mt-space-sm mb-space-sm">' +
        '<div class="bg-surface-container-highest border-b-2 border-on-surface p-space-xs font-label-caps font-bold uppercase text-on-surface flex items-center justify-between">' +
          '<span>CATEGORICAL PROFILE COMPARISON</span>' +
          '<span class="text-[10px] text-on-surface-variant">REF vs CUR</span>' +
        '</div>' +
        '<table class="w-full text-left border-collapse font-code-sm text-code-sm">' +
          '<thead class="border-b-2 border-on-surface bg-surface-container-low">' +
            '<tr>' +
              '<th class="py-1 px-2 border-r-2 border-on-surface">STATISTIC</th>' +
              '<th class="py-1 px-2 border-r-2 border-on-surface text-right">REFERENCE</th>' +
              '<th class="py-1 px-2 text-right">CURRENT</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody class="divide-y divide-on-surface/20">' +
            '<tr><td class="py-1 px-2 border-r font-bold">Distinct Categories</td><td class="py-1 px-2 border-r text-right">' + refUnique + '</td><td class="py-1 px-2 text-right">' + curUnique + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Most Frequent (Mode)</td><td class="py-1 px-2 border-r text-right font-bold">' + refMode + '</td><td class="py-1 px-2 text-right font-bold">' + curMode + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Mode Frequency</td><td class="py-1 px-2 border-r text-right">' + refModeCount + '</td><td class="py-1 px-2 text-right">' + curModeCount + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Mode Percentage</td><td class="py-1 px-2 border-r text-right">' + refModePct + '</td><td class="py-1 px-2 text-right">' + curModePct + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Missing Values</td><td class="py-1 px-2 border-r text-right">' + f.reference_missing_count + ' (' + f.reference_missing_percent.toFixed(2) + '%)</td><td class="py-1 px-2 text-right">' + f.current_missing_count + ' (' + f.current_missing_percent.toFixed(2) + '%)</td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="border-[2px] border-on-surface bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b] mt-space-sm mb-space-sm">' +
        '<div class="bg-surface-container-highest border-b-2 border-on-surface p-space-xs font-label-caps font-bold uppercase text-on-surface">' +
          'DISTRIBUTION COMPARISON' +
        '</div>' +
        '<table class="w-full text-left border-collapse font-code-sm text-code-sm">' +
          '<thead class="border-b-2 border-on-surface bg-surface-container-low">' +
            '<tr>' +
              '<th class="py-1 px-2 border-r-2 border-on-surface">CATEGORY</th>' +
              '<th class="py-1 px-2 border-r-2 border-on-surface text-right">REFERENCE</th>' +
              '<th class="py-1 px-2 text-right">CURRENT</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody class="divide-y divide-on-surface/20">' + catRows + '</tbody>' +
        '</table>' +
      '</div>' +
      _renderCommonDrawerBottom(f, explanation);
    } else {
      var refMean = _f(f.reference_mean);
      var curMean = _f(f.current_mean);
      var delta   = f.mean_change_percent !== null && f.mean_change_percent !== undefined
        ? (f.mean_change_percent >= 0 ? '+' : '') + f.mean_change_percent.toFixed(1) + '%'
        : 'N/A';
      var ks    = _f(f.ks_statistic);
      var ksPval = f.ks_p_value !== null && f.ks_p_value !== undefined ? (f.ks_p_value < 0.0001 ? '<0.0001' : f.ks_p_value.toFixed(4)) : 'N/A';
      var wass  = _f(f.wasserstein_distance);

      var refMedian = _f(f.reference_median);
      var curMedian = _f(f.current_median);
      var refStd = _f(f.reference_std);
      var curStd = _f(f.current_std);
      var refVar = _f(f.reference_variance);
      var curVar = _f(f.current_variance);
      var refMin = _f(f.reference_min);
      var curMin = _f(f.current_min);
      var refMax = _f(f.reference_max);
      var curMax = _f(f.current_max);
      var refQ25 = _f(f.reference_q25);
      var curQ25 = _f(f.current_q25);
      var refQ75 = _f(f.reference_q75);
      var curQ75 = _f(f.current_q75);
      var refIQR = _f(f.reference_iqr);
      var curIQR = _f(f.current_iqr);
      
      var thresholdDesc = 'PSI threshold: ' + psiThreshold;
      var metricDisplay = 'registered a PSI of <strong class="font-bold">' + f.psi.toFixed(4) + '</strong>';

      var explanation = '<strong class="font-bold">' + f.name + '</strong> ' + metricDisplay + ' and JS divergence of <strong class="font-bold">' + f.js_divergence.toFixed(4) + '</strong>. ' +
        (overThreshold
          ? 'Distribution drift exceeds the configured guardrails (' + thresholdDesc + '). Downstream ML systems using this feature should be evaluated for potential performance impact.'
          : 'Distribution drift is within tolerable production variation boundaries (' + thresholdDesc + ').');
      explanation += ' Reference mean: ' + refMean + ' → Current mean: ' + curMean + ' (' + delta + ').';

      return '<div>' +
        '<span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold tracking-wider block mb-space-xs">DRIFT METRICS MATRIX</span>' +
        '<div class="grid grid-cols-3 gap-space-xs border-2 border-on-surface bg-surface-container-low p-space-xs">' +
          _statCell('PSI VALUE',  f.psi.toFixed(4), overThreshold ? 'text-[#ba1a1a]' : '', 'LIMIT: ' + psiThreshold) +
          _statCell('STATUS',     f.status, overThreshold ? 'bg-[#FF5277] font-bold text-on-surface' : '') +
          _statCell('SEVERITY',   f.severity, overThreshold ? 'bg-[#FF5277] font-bold text-on-surface' : '') +
          _statCell('KS STAT',    ks, '', 'P: ' + ksPval) +
          _statCell('WASSERSTEIN',wass, '', 'L1 DISTANCE') +
          _statCell('MEAN DELTA', delta, overThreshold ? 'bg-[#FF5277]' : '') +
        '</div>' +
      '</div>' +
      '<div class="border-[2px] border-on-surface bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b] mt-space-sm mb-space-sm">' +
        '<div class="bg-surface-container-highest border-b-2 border-on-surface p-space-xs font-label-caps font-bold uppercase text-on-surface flex items-center justify-between">' +
          '<span>NUMERICAL STATISTICAL PROFILE</span>' +
          '<span class="text-[10px] text-on-surface-variant">REF vs CUR</span>' +
        '</div>' +
        '<table class="w-full text-left border-collapse font-code-sm text-code-sm">' +
          '<thead class="border-b-2 border-on-surface bg-surface-container-low">' +
            '<tr>' +
              '<th class="py-1 px-2 border-r-2 border-on-surface">STATISTIC</th>' +
              '<th class="py-1 px-2 border-r-2 border-on-surface text-right">REFERENCE</th>' +
              '<th class="py-1 px-2 text-right">CURRENT</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody class="divide-y divide-on-surface/20">' +
            '<tr><td class="py-1 px-2 border-r font-bold">Mean</td><td class="py-1 px-2 border-r text-right">' + refMean + '</td><td class="py-1 px-2 text-right">' + curMean + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Median</td><td class="py-1 px-2 border-r text-right">' + refMedian + '</td><td class="py-1 px-2 text-right">' + curMedian + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Std Dev (ddof=1)</td><td class="py-1 px-2 border-r text-right">' + refStd + '</td><td class="py-1 px-2 text-right">' + curStd + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Variance (ddof=1)</td><td class="py-1 px-2 border-r text-right">' + refVar + '</td><td class="py-1 px-2 text-right">' + curVar + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Minimum</td><td class="py-1 px-2 border-r text-right">' + refMin + '</td><td class="py-1 px-2 text-right">' + curMin + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Maximum</td><td class="py-1 px-2 border-r text-right">' + refMax + '</td><td class="py-1 px-2 text-right">' + curMax + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">25th Percentile (Q25)</td><td class="py-1 px-2 border-r text-right">' + refQ25 + '</td><td class="py-1 px-2 text-right">' + curQ25 + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">75th Percentile (Q75)</td><td class="py-1 px-2 border-r text-right">' + refQ75 + '</td><td class="py-1 px-2 text-right">' + curQ75 + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">IQR (Q75 - Q25)</td><td class="py-1 px-2 border-r text-right">' + refIQR + '</td><td class="py-1 px-2 text-right">' + curIQR + '</td></tr>' +
            '<tr><td class="py-1 px-2 border-r font-bold">Missing Values</td><td class="py-1 px-2 border-r text-right">' + f.reference_missing_count + ' (' + f.reference_missing_percent.toFixed(2) + '%)</td><td class="py-1 px-2 text-right">' + f.current_missing_count + ' (' + f.current_missing_percent.toFixed(2) + '%)</td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +
      _renderCommonDrawerBottom(f, explanation);
    }
  }

  function _renderCommonDrawerBottom(f, explanation) {
    var chartSection = f.type === 'quality' ? '' : (
      '<div class="border-[2px] border-on-surface p-space-sm bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b] mb-space-sm">' +
        '<div class="flex items-center justify-between border-b-2 border-on-surface pb-1 mb-space-sm">' +
          '<span class="font-label-caps text-label-caps font-bold uppercase text-on-surface">POPULATION DISTRIBUTION DENSITY</span>' +
          '<div class="flex items-center gap-space-sm font-label-caps text-label-caps">' +
            '<span class="flex items-center gap-1 font-bold"><span class="w-3 h-3 bg-[#FFE600] border border-on-surface inline-block"></span> BASELINE</span>' +
            '<span class="flex items-center gap-1 font-bold"><span class="w-3 h-3 bg-[#FF5277] border border-on-surface inline-block"></span> CURRENT</span>' +
          '</div>' +
        '</div>' +
        '<div class="w-full"><canvas id="dist-chart" height="160" style="width:100%;display:block;"></canvas></div>' +
      '</div>'
    );

    return chartSection +
    '<div class="border-[2px] border-on-surface bg-surface p-space-sm shadow-[2px_2px_0px_#1c1b1b]">' +
      '<div class="flex items-center gap-1 border-b border-on-surface pb-1 mb-1 font-label-caps text-label-caps font-bold text-on-surface">' +
        '<span class="material-symbols-outlined text-[15px] text-[#BA1A1A]">psychology_alt</span>' +
        'EXPLANATION &amp; RECOMMENDATION' +
      '</div>' +
      '<p class="font-body-md text-body-md text-on-surface m-0 leading-relaxed">' + explanation + '</p>' +
    '</div>' +
    '<div class="flex flex-col sm:flex-row gap-space-sm pt-space-xs">' +
      '<button class="flex-1 bg-surface-container-lowest text-on-surface border-[3px] border-on-surface py-space-xs px-space-sm font-headline-sm text-headline-sm uppercase font-bold shadow-[4px_4px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-1" id="export-json-btn">' +
        '<span class="material-symbols-outlined text-[18px]">download</span> EXPORT JSON REPORT' +
      '</button>' +
      '<a class="flex-1 bg-[#FFE600] text-on-surface border-[3px] border-on-surface py-space-xs px-space-sm font-headline-sm text-headline-sm uppercase font-bold shadow-[4px_4px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-1" href="#/analyze">' +
        '<span class="material-symbols-outlined text-[18px]">play_arrow</span> ANALYZE NEW DATASET' +
      '</a>' +
    '</div>';
  }

  function _statCell(label, value, extra, sub) {
    return '<div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col ' + (extra || '') + '">' +
      '<span class="font-label-caps text-label-caps text-on-surface-variant uppercase">' + label + '</span>' +
      '<span class="font-code-lg text-code-lg font-bold text-on-surface ' + (extra || '') + '">' + value + '</span>' +
      (sub ? '<span class="font-code-sm text-[9px] text-on-surface-variant">' + sub + '</span>' : '') +
    '</div>';
  }

  function renderChart(f) {
    var canvas = document.getElementById('dist-chart');
    if (!canvas) return;
    
    var labels, refPct, curPct;
    if (f.type === 'numeric' && f.distribution && f.distribution.bin_labels) {
      labels = f.distribution.bin_labels;
      refPct = f.distribution.reference_percents;
      curPct = f.distribution.current_percents;
    } else if (f.type === 'categorical' && f.category_distribution && f.category_distribution.categories) {
      labels = f.category_distribution.categories;
      refPct = f.category_distribution.reference_percentages;
      curPct = f.category_distribution.current_percentages;
    } else {
      return;
    }

    var ctx = canvas.getContext('2d');
    var W = canvas.offsetWidth || 400;
    var H = 160;
    canvas.width  = W;
    canvas.height = H;

    var n    = labels.length;
    var PAD  = { top: 10, right: 8, bottom: 36, left: 36 };
    var barW = Math.max(2, Math.floor((W - PAD.left - PAD.right) / (n * 2 + n + 1)));
    var maxPct = Math.max(1, ...refPct, ...curPct);
    var chartH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    // Grid lines + Y-axis labels
    ctx.strokeStyle = '#CDC7AA';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.fillStyle = '#4b4731';
    [0.25, 0.5, 0.75, 1.0].forEach(function(frac) {
      var y = PAD.top + chartH - Math.round(chartH * frac);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.fillText(Math.round(maxPct * frac) + '%', 0, y + 3);
    });
    ctx.setLineDash([]);

    // Baseline x-axis
    ctx.strokeStyle = '#1c1b1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top + chartH);
    ctx.lineTo(W - PAD.right, PAD.top + chartH);
    ctx.stroke();

    // Bars
    var groupW = barW * 2 + 2;
    var startX = PAD.left + 4;
    for (var i = 0; i < n; i++) {
      var gx = startX + i * (groupW + 4);

      // Reference bar (yellow)
      var refH = Math.round((refPct[i] / maxPct) * chartH);
      ctx.fillStyle = '#FFE600';
      ctx.fillRect(gx, PAD.top + chartH - refH, barW, refH);
      ctx.strokeStyle = '#1c1b1b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx, PAD.top + chartH - refH, barW, refH);

      // Current bar (coral)
      var curH = Math.round((curPct[i] / maxPct) * chartH);
      ctx.fillStyle = '#FF5277';
      ctx.fillRect(gx + barW + 2, PAD.top + chartH - curH, barW, curH);
      ctx.strokeRect(gx + barW + 2, PAD.top + chartH - curH, barW, curH);

      // X label
      ctx.fillStyle = '#1c1b1b';
      ctx.font = 'bold 8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      var lbl = String(labels[i]);
      if (lbl.length > 10) lbl = lbl.substring(0, 9) + '…';
      ctx.fillText(lbl, gx + barW + 1, PAD.top + chartH + 14);
      ctx.textAlign = 'left';
    }
  }

  // ---- Attach row click handlers ----
  document.getElementById('feature-table-body')?.querySelectorAll('tr[data-feature-idx]').forEach(function(row) {
    row.addEventListener('click', function() {
      selectFeature(parseInt(row.getAttribute('data-feature-idx'), 10));
    });
  });

  // Render chart for first feature
  if (selectedFeatureIdx >= 0) {
    setTimeout(function() { renderChart(features[selectedFeatureIdx]); }, 50);
  }

  // ---- Export JSON ----
  document.addEventListener('click', function(e) {
    if (e.target && (e.target.id === 'export-json-btn' || e.target.closest('#export-json-btn'))) {
      var dataStr = JSON.stringify(${JSON.stringify(result)}, null, 2);
      var blob = new Blob([dataStr], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = 'dw-${result.analysis_id}_results.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      var toast = document.getElementById('export-toast');
      if (toast) { toast.classList.remove('hidden'); toast.classList.add('flex'); }
    }
    if (e.target && e.target.id === 'dismiss-toast') {
      var toast = document.getElementById('export-toast');
      if (toast) { toast.classList.add('hidden'); toast.classList.remove('flex'); }
    }
  });
})();
</script>`;
}

// ---- Helper rendering functions (server-side template helpers) ----

function _renderFeatureRow(f, idx, threshold) {
  const isId = f.type === 'identifier';
  const primaryMetric = isId ? null : (f.type === 'numeric' ? f.psi : f.js_divergence);
  const primaryMetricStr = isId ? 'N/A' : (f.type === 'numeric' ? 'PSI ' + primaryMetric.toFixed(3) : 'JS ' + primaryMetric.toFixed(3));
  
  const psiColor = isId ? 'text-surface-dim' : (f.status === 'DRIFT' ? 'text-[#ba1a1a]' : (f.status === 'WARNING' ? 'text-[#b58b00]' : 'text-on-surface'));
  const statusBg = f.status === 'DRIFT' ? (f.severity === 'CRITICAL' ? 'bg-[#FF5277]' : 'bg-[#FFE600]') : 'bg-[#00D26A]';
  const badgeBg  = _severityBgClass(f.severity);
  const rowBg    = f.status === 'DRIFT' ? 'bg-primary-container/10' : 'bg-surface-container-lowest';
  const borderL  = f.status === 'DRIFT' ? 'border-l-[6px] border-l-[#FF5277]' : '';
  
  let ksPval = 'N/A';
  if (f.type === 'numeric' && f.ks_p_value !== null && f.ks_p_value !== undefined) {
    ksPval = f.ks_p_value < 0.0001 ? '<0.0001' : f.ks_p_value.toFixed(4);
  }
  
  const selected = idx === 0 ? 'outline outline-2 outline-secondary' : '';

  return `
  <tr class="${rowBg} ${borderL} ${selected} hover:bg-primary-container/20 cursor-pointer transition-colors" data-feature-idx="${idx}">
    <td class="p-space-sm border-r-2 border-on-surface font-bold text-on-surface">
      ${f.name}${f.status === 'DRIFT' ? '<span class="material-symbols-outlined text-[14px] text-[#FF5277] align-middle ml-1">arrow_forward</span>' : ''}
    </td>
    <td class="p-space-sm border-r-2 border-on-surface uppercase">${f.type}</td>
    <td class="p-space-sm border-r-2 border-on-surface text-right font-bold ${psiColor}">${primaryMetricStr}</td>
    <td class="p-space-sm border-r-2 border-on-surface text-right">${ksPval}</td>
    <td class="p-space-sm border-r-2 border-on-surface text-center">
      <span class="inline-block ${statusBg} text-on-surface border border-on-surface font-label-caps text-label-caps font-bold px-1.5 py-0.5 shadow-[1px_1px_0px_#1c1b1b]">${f.status}</span>
    </td>
    <td class="p-space-sm text-center">
      <span class="inline-block ${badgeBg} text-on-surface border border-on-surface font-label-caps text-label-caps font-bold px-1.5 py-0.5">${f.severity}</span>
    </td>
  </tr>`;
}

function _renderDrawerContent(f, threshold) {
  const over = f.status === 'DRIFT';

  if (f.type === 'identifier') {
    const explanation = `<strong class="font-bold">${f.name}</strong> is an identifier feature. Identifiers are not evaluated for statistical distribution drift (PSI/JS), but are monitored for structural data quality issues such as duplicates and missing values.`;
    const refUnique = f.reference_unique_count !== null && f.reference_unique_count !== undefined ? f.reference_unique_count.toLocaleString() : 'N/A';
    const curUnique = f.current_unique_count !== null && f.current_unique_count !== undefined ? f.current_unique_count.toLocaleString() : 'N/A';
    const refMissing = `${f.reference_missing_count} (${f.reference_missing_percent.toFixed(2)}%)`;
    const curMissing = `${f.current_missing_count} (${f.current_missing_percent.toFixed(2)}%)`;
    return `
    <div>
      <span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold tracking-wider block mb-space-xs">IDENTIFIER PROFILE &amp; STRUCTURAL METRICS</span>
      <div class="grid grid-cols-2 gap-space-xs border-2 border-on-surface bg-surface-container-low p-space-xs">
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">STATUS</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${f.status}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">SEVERITY</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${f.severity}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">REF UNIQUE IDS</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${refUnique}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">CUR UNIQUE IDS</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${curUnique}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">REF MISSING</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${refMissing}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col ${f.current_missing_count > 0 ? 'text-[#ba1a1a]' : ''}">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">CUR MISSING</span>
          <span class="font-code-lg text-code-lg font-bold">${curMissing}</span>
        </div>
      </div>
    </div>
    ` + _renderCommonDrawerBottomTpl(f, threshold, over, explanation);
  } else if (f.type === 'categorical') {
    let catRows = '';
    if (f.category_distribution && f.category_distribution.categories) {
      for (let i = 0; i < f.category_distribution.categories.length; i++) {
        catRows += `
          <tr class="border-b border-on-surface/20 hover:bg-black/5">
            <td class="py-1 px-2 border-r border-on-surface/20 font-bold">${f.category_distribution.categories[i]}</td>
            <td class="py-1 px-2 border-r border-on-surface/20 text-right">${f.category_distribution.reference_percentages[i].toFixed(1)}%</td>
            <td class="py-1 px-2 text-right font-bold">${f.category_distribution.current_percentages[i].toFixed(1)}%</td>
          </tr>`;
      }
    }

    const refUnique = f.reference_unique_count !== null && f.reference_unique_count !== undefined ? f.reference_unique_count : 'N/A';
    const curUnique = f.current_unique_count !== null && f.current_unique_count !== undefined ? f.current_unique_count : 'N/A';
    const refMode = f.reference_mode || 'N/A';
    const curMode = f.current_mode || 'N/A';
    const refModeCount = f.reference_mode_count !== null && f.reference_mode_count !== undefined ? f.reference_mode_count.toLocaleString() : 'N/A';
    const curModeCount = f.current_mode_count !== null && f.current_mode_count !== undefined ? f.current_mode_count.toLocaleString() : 'N/A';
    const refModePct = f.reference_mode_percent !== null && f.reference_mode_percent !== undefined ? f.reference_mode_percent.toFixed(1) + '%' : 'N/A';
    const curModePct = f.current_mode_percent !== null && f.current_mode_percent !== undefined ? f.current_mode_percent.toFixed(1) + '%' : 'N/A';

    return `
    <div>
      <span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold tracking-wider block mb-space-xs">CATEGORICAL METRICS</span>
      <div class="grid grid-cols-3 gap-space-xs border-2 border-on-surface bg-surface-container-low p-space-xs">
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">JS DIVERGENCE</span>
          <span class="font-code-lg text-code-lg font-bold ${over ? 'text-[#ba1a1a]' : 'text-on-surface'}">${f.js_divergence.toFixed(4)}</span>
          <span class="font-code-sm text-[9px] text-on-surface-variant">CATEGORICAL DRIFT</span>
        </div>
        <div class="border border-on-surface ${over ? 'bg-[#FF5277]' : 'bg-surface-container-lowest'} p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">STATUS</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${f.status}</span>
        </div>
        <div class="border border-on-surface ${over ? 'bg-[#FF5277]' : 'bg-surface-container-lowest'} p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">SEVERITY</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${f.severity}</span>
        </div>
      </div>
    </div>
    
    <div class="border-[2px] border-on-surface bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b] mt-space-sm mb-space-sm">
      <div class="bg-surface-container-highest border-b-2 border-on-surface p-space-xs font-label-caps font-bold uppercase text-on-surface flex items-center justify-between">
        <span>CATEGORICAL PROFILE COMPARISON</span>
        <span class="text-[10px] text-on-surface-variant">REF vs CUR</span>
      </div>
      <table class="w-full text-left border-collapse font-code-sm text-code-sm">
        <thead class="border-b-2 border-on-surface bg-surface-container-low">
          <tr>
            <th class="py-1 px-2 border-r-2 border-on-surface">STATISTIC</th>
            <th class="py-1 px-2 border-r-2 border-on-surface text-right">REFERENCE</th>
            <th class="py-1 px-2 text-right">CURRENT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-on-surface/20">
          <tr><td class="py-1 px-2 border-r font-bold">Distinct Categories</td><td class="py-1 px-2 border-r text-right">${refUnique}</td><td class="py-1 px-2 text-right">${curUnique}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Most Frequent (Mode)</td><td class="py-1 px-2 border-r text-right font-bold">${refMode}</td><td class="py-1 px-2 text-right font-bold">${curMode}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Mode Frequency</td><td class="py-1 px-2 border-r text-right">${refModeCount}</td><td class="py-1 px-2 text-right">${curModeCount}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Mode Percentage</td><td class="py-1 px-2 border-r text-right">${refModePct}</td><td class="py-1 px-2 text-right">${curModePct}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Missing Values</td><td class="py-1 px-2 border-r text-right">${f.reference_missing_count} (${f.reference_missing_percent.toFixed(2)}%)</td><td class="py-1 px-2 text-right">${f.current_missing_count} (${f.current_missing_percent.toFixed(2)}%)</td></tr>
        </tbody>
      </table>
    </div>

    <div class="border-[2px] border-on-surface bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b] mt-space-sm mb-space-sm">
      <div class="bg-surface-container-highest border-b-2 border-on-surface p-space-xs font-label-caps font-bold uppercase text-on-surface">
        DISTRIBUTION COMPARISON
      </div>
      <table class="w-full text-left border-collapse font-code-sm text-code-sm">
        <thead class="border-b-2 border-on-surface bg-surface-container-low">
          <tr>
            <th class="py-1 px-2 border-r-2 border-on-surface">CATEGORY</th>
            <th class="py-1 px-2 border-r-2 border-on-surface text-right">REFERENCE</th>
            <th class="py-1 px-2 text-right">CURRENT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-on-surface/20">
          ${catRows}
        </tbody>
      </table>
    </div>
    ` + _renderCommonDrawerBottomTpl(f, threshold, over, '');
  } else {
    const _f = (val, digits = 4) => (val !== null && val !== undefined) ? Number(val).toFixed(digits) : 'N/A';
    const refMean = _f(f.reference_mean);
    const curMean = _f(f.current_mean);
    const delta   = f.mean_change_percent !== null && f.mean_change_percent !== undefined
      ? (f.mean_change_percent >= 0 ? '+' : '') + f.mean_change_percent.toFixed(1) + '%'
      : 'N/A';
    const ks      = _f(f.ks_statistic);
    
    let ksPval = 'N/A';
    if (f.type === 'numeric' && f.ks_p_value !== null && f.ks_p_value !== undefined) {
      ksPval = f.ks_p_value < 0.0001 ? '<0.0001' : f.ks_p_value.toFixed(4);
    }
    
    const wass    = _f(f.wasserstein_distance);
    const refMedian = _f(f.reference_median);
    const curMedian = _f(f.current_median);
    const refStd = _f(f.reference_std);
    const curStd = _f(f.current_std);
    const refVar = _f(f.reference_variance);
    const curVar = _f(f.current_variance);
    const refMin = _f(f.reference_min);
    const curMin = _f(f.current_min);
    const refMax = _f(f.reference_max);
    const curMax = _f(f.current_max);
    const refQ25 = _f(f.reference_q25);
    const curQ25 = _f(f.current_q25);
    const refQ75 = _f(f.reference_q75);
    const curQ75 = _f(f.current_q75);
    const refIQR = _f(f.reference_iqr);
    const curIQR = _f(f.current_iqr);
    
    const meanDisplay = ` Reference mean: ${refMean} → Current mean: ${curMean} (${delta}).`;

    return `
    <div>
      <span class="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold tracking-wider block mb-space-xs">STATISTICAL COMPARISON MATRIX</span>
      <div class="grid grid-cols-3 gap-space-xs border-2 border-on-surface bg-surface-container-low p-space-xs">
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">REF MEAN</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${refMean}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">CURR MEAN</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${curMean}</span>
        </div>
        <div class="border border-on-surface ${over ? 'bg-[#FF5277]' : 'bg-surface-container-lowest'} p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface uppercase font-bold">DELTA</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${delta}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">PSI VALUE</span>
          <span class="font-code-lg text-code-lg font-bold ${over ? 'text-[#ba1a1a]' : 'text-on-surface'}">${f.psi.toFixed(4)}</span>
          <span class="font-code-sm text-[9px] text-on-surface-variant">LIMIT: ${threshold}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">KS STAT</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${ks}</span>
          <span class="font-code-sm text-[9px] text-on-surface-variant">P: ${ksPval}</span>
        </div>
        <div class="border border-on-surface bg-surface-container-lowest p-space-xs flex flex-col">
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase">WASSERSTEIN</span>
          <span class="font-code-lg text-code-lg font-bold text-on-surface">${wass}</span>
          <span class="font-code-sm text-[9px] text-on-surface-variant">L1 DISTANCE</span>
        </div>
      </div>
    </div>

    <div class="border-[2px] border-on-surface bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b] mt-space-sm mb-space-sm">
      <div class="bg-surface-container-highest border-b-2 border-on-surface p-space-xs font-label-caps font-bold uppercase text-on-surface flex items-center justify-between">
        <span>NUMERICAL STATISTICAL PROFILE</span>
        <span class="text-[10px] text-on-surface-variant">REF vs CUR</span>
      </div>
      <table class="w-full text-left border-collapse font-code-sm text-code-sm">
        <thead class="border-b-2 border-on-surface bg-surface-container-low">
          <tr>
            <th class="py-1 px-2 border-r-2 border-on-surface">STATISTIC</th>
            <th class="py-1 px-2 border-r-2 border-on-surface text-right">REFERENCE</th>
            <th class="py-1 px-2 text-right">CURRENT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-on-surface/20">
          <tr><td class="py-1 px-2 border-r font-bold">Mean</td><td class="py-1 px-2 border-r text-right">${refMean}</td><td class="py-1 px-2 text-right">${curMean}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Median</td><td class="py-1 px-2 border-r text-right">${refMedian}</td><td class="py-1 px-2 text-right">${curMedian}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Std Dev (ddof=1)</td><td class="py-1 px-2 border-r text-right">${refStd}</td><td class="py-1 px-2 text-right">${curStd}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Variance (ddof=1)</td><td class="py-1 px-2 border-r text-right">${refVar}</td><td class="py-1 px-2 text-right">${curVar}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Minimum</td><td class="py-1 px-2 border-r text-right">${refMin}</td><td class="py-1 px-2 text-right">${curMin}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Maximum</td><td class="py-1 px-2 border-r text-right">${refMax}</td><td class="py-1 px-2 text-right">${curMax}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">25th Percentile (Q25)</td><td class="py-1 px-2 border-r text-right">${refQ25}</td><td class="py-1 px-2 text-right">${curQ25}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">75th Percentile (Q75)</td><td class="py-1 px-2 border-r text-right">${refQ75}</td><td class="py-1 px-2 text-right">${curQ75}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">IQR (Q75 - Q25)</td><td class="py-1 px-2 border-r text-right">${refIQR}</td><td class="py-1 px-2 text-right">${curIQR}</td></tr>
          <tr><td class="py-1 px-2 border-r font-bold">Missing Values</td><td class="py-1 px-2 border-r text-right">${f.reference_missing_count} (${f.reference_missing_percent.toFixed(2)}%)</td><td class="py-1 px-2 text-right">${f.current_missing_count} (${f.current_missing_percent.toFixed(2)}%)</td></tr>
        </tbody>
      </table>
    </div>
    ` + _renderCommonDrawerBottomTpl(f, threshold, over, meanDisplay);
  }
}

function _renderCommonDrawerBottomTpl(f, threshold, over, meanDisplay) {
  return `
  <div class="border-[2px] border-on-surface p-space-sm bg-surface-container-lowest shadow-[3px_3px_0px_#1c1b1b]">
    <div class="flex items-center justify-between border-b-2 border-on-surface pb-1 mb-space-sm">
      <span class="font-label-caps text-label-caps font-bold uppercase text-on-surface">POPULATION DISTRIBUTION DENSITY</span>
      <div class="flex items-center gap-space-sm font-label-caps text-label-caps">
        <span class="flex items-center gap-1 font-bold"><span class="w-3 h-3 bg-[#FFE600] border border-on-surface inline-block"></span> BASELINE</span>
        <span class="flex items-center gap-1 font-bold"><span class="w-3 h-3 bg-[#FF5277] border border-on-surface inline-block"></span> CURRENT</span>
      </div>
    </div>
    <div class="w-full"><canvas id="dist-chart" height="160" style="width:100%;display:block;"></canvas></div>
  </div>

  <div class="border-[2px] border-on-surface bg-surface p-space-sm shadow-[2px_2px_0px_#1c1b1b]">
    <div class="flex items-center gap-1 border-b border-on-surface pb-1 mb-1 font-label-caps text-label-caps font-bold text-on-surface">
      <span class="material-symbols-outlined text-[15px] text-[#BA1A1A]">psychology_alt</span>
      EXPLANATION &amp; RECOMMENDATION
    </div>
    <p class="font-body-md text-body-md text-on-surface m-0 leading-relaxed">
      <strong class="font-bold">${f.name}</strong> ${f.type === 'numeric' ? `registered a PSI of <strong class="font-bold ${over ? 'text-[#BA1A1A]' : ''}">${f.psi.toFixed(4)}</strong>` : `is a categorical feature with`}
      and JS divergence of <strong class="font-bold">${f.js_divergence.toFixed(4)}</strong>.
      ${over
        ? `Distribution drift exceeds the configured guardrails. Downstream ML systems using this feature should be evaluated for potential performance impact.`
        : `Distribution drift is within tolerable variation boundaries.`
      }
      ${meanDisplay}
    </p>
  </div>

  <div class="flex flex-col sm:flex-row gap-space-sm pt-space-xs">
    <button class="flex-1 bg-surface-container-lowest text-on-surface border-[3px] border-on-surface py-space-xs px-space-sm font-headline-sm text-headline-sm uppercase font-bold shadow-[4px_4px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-1" id="export-json-btn">
      <span class="material-symbols-outlined text-[18px]">download</span> EXPORT JSON REPORT
    </button>
    <a class="flex-1 bg-[#FFE600] text-on-surface border-[3px] border-on-surface py-space-xs px-space-sm font-headline-sm text-headline-sm uppercase font-bold shadow-[4px_4px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-1" href="#/analyze">
      <span class="material-symbols-outlined text-[18px]">play_arrow</span> ANALYZE NEW DATASET
    </a>
  </div>`;
}

function _severityBadgeClass(sev) {
  if (sev === 'CRITICAL') return 'bg-[#FF5277] text-on-surface';
  if (sev === 'HIGH')     return 'bg-[#FFE600] text-on-surface';
  if (sev === 'MODERATE') return 'bg-surface-container-highest text-on-surface';
  return 'bg-[#00D26A] text-on-surface';
}

function _severityBgClass(sev) {
  if (sev === 'CRITICAL') return 'bg-[#FF5277]';
  if (sev === 'HIGH')     return 'bg-[#FFE600]';
  if (sev === 'MODERATE') return 'bg-surface-container-highest';
  return 'bg-[#00D26A]';
}
