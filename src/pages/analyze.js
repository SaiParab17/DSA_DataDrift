import { renderNav, renderFooter } from '../components/nav.js';
import { analyzeDrift } from '../api/client.js';
import state, { persistResult } from '../state/store.js';

export function renderAnalyze() {
  return `
${renderNav('analyze')}
<main class="w-full pt-20 bg-surface min-h-[calc(100vh-140px)]">
  <div class="flex flex-col w-full">

    <!-- Top Breadcrumb Strip -->
    <div class="w-full bg-surface-container-high border-b-[3px] border-on-surface px-margin-sm md:px-margin py-space-xs flex flex-wrap items-center justify-between gap-space-sm">
      <div class="flex items-center gap-space-sm font-label-caps text-label-caps">
        <span class="bg-on-surface text-surface-container-lowest px-1.5 py-0.5 font-bold uppercase">MODE</span>
        <span class="text-on-surface font-bold uppercase tracking-wider">DRIFT_INSPECTION_WORKSPACE</span>
        <span class="text-outline">/</span>
        <span class="text-on-surface-variant">BATCH_CSV_INGEST</span>
      </div>
      <div class="flex items-center gap-space-md font-code-sm text-code-sm">
        <div class="inline-flex items-center gap-1.5" id="daemon-status-badge">
          <span class="w-2.5 h-2.5 bg-surface-container-highest border-2 border-on-surface" id="daemon-dot"></span>
          <span class="font-bold text-on-surface uppercase" id="daemon-label">FASTAPI_DAEMON: CHECKING…</span>
        </div>
        <span class="hidden sm:inline text-outline-variant">|</span>
        <span class="hidden sm:inline font-mono text-on-surface-variant" id="latency-label">LATENCY: —</span>
      </div>
    </div>

    <div class="w-full px-margin-sm md:px-margin py-space-xl max-w-7xl mx-auto flex flex-col gap-space-xl">

      <!-- Hero Header -->
      <header class="flex flex-col gap-space-sm border-l-8 border-primary-container pl-space-md md:pl-space-lg">
        <div class="inline-flex items-center gap-space-xs">
          <span class="bg-on-surface text-primary-container font-label-caps text-label-caps px-2 py-0.5 uppercase tracking-widest font-bold">STAGE 01 :: INGEST &amp; CONFIG</span>
          <span class="font-code-sm text-code-sm text-on-surface-variant font-medium">STABILITY_CHECK_SUITE</span>
        </div>
        <h1 class="font-display text-display text-on-surface uppercase tracking-tight leading-none">
          COMPARE YOUR DATA
        </h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant max-w-3xl font-medium">
          Upload a reference dataset and a current dataset. DataWatch will compare their distributions and identify meaningful statistical drift across continuous and categorical vectors.
        </p>
      </header>

      <!-- Format Callout Banner -->
      <section class="w-full bg-[#FFFDF8] border-[3px] border-on-surface p-space-md shadow-[4px_4px_0px_#1c1b1b] flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
        <div class="flex items-start md:items-center gap-space-md">
          <div class="w-10 h-10 bg-secondary-container text-on-secondary flex items-center justify-center border-2 border-on-surface shrink-0 shadow-[2px_2px_0px_#1c1b1b]">
            <span class="material-symbols-outlined text-[24px]">description</span>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-space-xs flex-wrap">
              <span class="font-label-caps text-label-caps font-bold bg-primary-container text-on-surface border border-on-surface px-1.5 py-0.5 uppercase">SPECIFICATION</span>
              <span class="font-headline-sm text-headline-sm text-on-surface uppercase">SUPPORTED FORMAT: CSV (Comma Separated Values)</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Column names and data types must match across both files. Parquet and SQL connectors are slated for the next deployment phase.
            </p>
          </div>
        </div>
        <div class="shrink-0 flex items-center gap-space-xs bg-surface-container border-2 border-on-surface px-space-sm py-1">
          <span class="material-symbols-outlined text-[18px] text-on-surface">lock</span>
          <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface">ZERO CLOUD PERSISTENCE</span>
        </div>
      </section>

      <!-- Error Banner (hidden by default) -->
      <div class="hidden border-[3px] border-on-surface bg-tertiary-container p-space-md shadow-[4px_4px_0px_#1c1b1b] flex-col gap-space-xs" id="error-banner">
        <div class="flex items-center gap-space-sm">
          <span class="material-symbols-outlined text-tertiary text-[22px]">error</span>
          <span class="font-headline-sm text-headline-sm uppercase font-bold text-on-surface">ANALYSIS ERROR</span>
        </div>
        <p class="font-body-md text-body-md text-on-surface font-medium" id="error-message">Unknown error.</p>
        <button class="self-start mt-1 bg-surface border-2 border-on-surface px-space-sm py-1 font-label-caps text-label-caps font-bold uppercase hover:bg-surface-container transition-all shadow-[2px_2px_0px_#1c1b1b]" id="dismiss-error-btn">DISMISS</button>
      </div>

      <!-- Dual Dataset Upload Grid -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        <!-- CARD 1: REFERENCE DATASET -->
        <article class="bg-[#FFFDF8] border-[3.5px] border-on-surface shadow-[6px_6px_0px_#1c1b1b] flex flex-col justify-between">
          <div class="border-b-[3px] border-on-surface bg-surface-container-high p-space-md flex items-center justify-between">
            <div class="flex flex-col">
              <span class="font-label-caps text-label-caps text-primary font-bold uppercase tracking-widest">BASELINE GROUND TRUTH</span>
              <h2 class="font-headline-md text-headline-md text-on-surface uppercase font-bold">01 — REFERENCE DATASET</h2>
            </div>
            <span class="bg-on-surface text-surface-container-lowest font-code-sm text-code-sm font-bold px-2 py-1 uppercase">SPLIT: BASE</span>
          </div>
          <div class="p-space-md md:p-space-lg flex flex-col gap-space-md grow">
            <p class="font-body-md text-body-md text-on-surface-variant font-medium">
              The baseline distribution (e.g. training set or validated historical period). All statistical divergence tests are computed relative to this anchor.
            </p>
            <!-- Dropzone -->
            <div class="relative group cursor-pointer border-[3px] border-dashed border-on-surface bg-[#F7F4EA] p-space-lg flex flex-col items-center justify-center text-center transition-all hover:bg-[#EFE9D8]" id="ref-dropzone">
              <input accept=".csv" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" id="ref-file-input" type="file" />
              <div class="w-14 h-14 bg-primary-container border-[2.5px] border-on-surface flex items-center justify-center shadow-[3px_3px_0px_#1c1b1b] mb-space-sm group-hover:-translate-y-1 transition-transform" id="ref-drop-icon">
                <span class="material-symbols-outlined text-on-surface text-[32px]">upload_file</span>
              </div>
              <span class="font-headline-sm text-headline-sm text-on-surface uppercase font-bold">DROP REFERENCE CSV HERE</span>
              <span class="font-code-sm text-code-sm text-on-surface-variant mt-1">OR CLICK TO BROWSE LOCAL STORAGE</span>
              <div class="mt-space-sm inline-flex border-2 border-on-surface bg-surface-container-lowest px-space-md py-1 shadow-[2px_2px_0px_#1c1b1b] font-label-caps text-label-caps uppercase font-bold text-on-surface">
                [ CHOOSE FILE ]
              </div>
            </div>
            <!-- File Status Block -->
            <div class="border-[2.5px] border-on-surface bg-surface-container-lowest p-space-md shadow-[3px_3px_0px_#1c1b1b] flex flex-col gap-space-xs" id="ref-status">
              <div class="flex items-center justify-between">
                <div class="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface border-2 border-on-surface px-2 py-0.5 shadow-[1.5px_1.5px_0px_#1c1b1b]" id="ref-status-badge">
                  <span class="font-label-caps text-label-caps font-bold">AWAITING FILE</span>
                </div>
                <button class="text-tertiary hover:underline font-code-sm text-code-sm font-bold uppercase transition-transform hover:-translate-x-0.5 hidden" type="button" id="ref-remove-btn">[ REMOVE ]</button>
              </div>
              <div class="font-code-lg text-code-lg font-bold text-on-surface break-all flex items-center gap-1.5 mt-1 text-on-surface-variant" id="ref-filename-display">
                <span class="material-symbols-outlined text-[18px]">draft</span>
                <span>No file selected</span>
              </div>
              <div class="font-code-sm text-code-sm text-on-surface-variant font-medium pt-1 border-t border-outline-variant" id="ref-file-meta">
                Select a CSV file to continue.
              </div>
            </div>
          </div>
          <div class="bg-surface-container p-space-sm border-t-[2.5px] border-on-surface font-code-sm text-code-sm text-on-surface-variant flex justify-between items-center">
            <span id="ref-parse-status">AWAITING FILE</span>
            <span class="font-bold text-on-surface">ENCODING: UTF-8</span>
          </div>
        </article>

        <!-- CARD 2: CURRENT DATASET -->
        <article class="bg-[#FFFDF8] border-[3.5px] border-on-surface shadow-[6px_6px_0px_#1c1b1b] flex flex-col justify-between">
          <div class="border-b-[3px] border-on-surface bg-surface-container-high p-space-md flex items-center justify-between">
            <div class="flex flex-col">
              <span class="font-label-caps text-label-caps text-secondary font-bold uppercase tracking-widest">OBSERVED PRODUCTION STREAM</span>
              <h2 class="font-headline-md text-headline-md text-on-surface uppercase font-bold">02 — CURRENT DATASET</h2>
            </div>
            <span class="bg-secondary-container text-on-secondary font-code-sm text-code-sm font-bold px-2 py-1 uppercase border border-on-surface shadow-[1.5px_1.5px_0px_#1c1b1b]">SPLIT: TEST</span>
          </div>
          <div class="p-space-md md:p-space-lg flex flex-col gap-space-md grow">
            <p class="font-body-md text-body-md text-on-surface-variant font-medium">
              The latest production batch to compare against baseline. Drift statistics evaluate whether inference conditions maintain fidelity.
            </p>
            <!-- Dropzone -->
            <div class="relative group cursor-pointer border-[3px] border-dashed border-on-surface bg-[#F7F4EA] p-space-lg flex flex-col items-center justify-center text-center transition-all hover:bg-[#EFE9D8]" id="cur-dropzone">
              <input accept=".csv" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" id="cur-file-input" type="file" />
              <div class="w-14 h-14 bg-secondary-fixed border-[2.5px] border-on-surface flex items-center justify-center shadow-[3px_3px_0px_#1c1b1b] mb-space-sm group-hover:-translate-y-1 transition-transform" id="cur-drop-icon">
                <span class="material-symbols-outlined text-on-surface text-[32px]">sync_alt</span>
              </div>
              <span class="font-headline-sm text-headline-sm text-on-surface uppercase font-bold">DROP CURRENT CSV HERE</span>
              <span class="font-code-sm text-code-sm text-on-surface-variant mt-1">OR CLICK TO BROWSE LOCAL STORAGE</span>
              <div class="mt-space-sm inline-flex border-2 border-on-surface bg-surface-container-lowest px-space-md py-1 shadow-[2px_2px_0px_#1c1b1b] font-label-caps text-label-caps uppercase font-bold text-on-surface">
                [ CHOOSE FILE ]
              </div>
            </div>
            <!-- File Status Block -->
            <div class="border-[2.5px] border-on-surface bg-surface-container-lowest p-space-md shadow-[3px_3px_0px_#1c1b1b] flex flex-col gap-space-xs" id="cur-status">
              <div class="flex items-center justify-between">
                <div class="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface border-2 border-on-surface px-2 py-0.5 shadow-[1.5px_1.5px_0px_#1c1b1b]" id="cur-status-badge">
                  <span class="font-label-caps text-label-caps font-bold">AWAITING FILE</span>
                </div>
                <button class="text-tertiary hover:underline font-code-sm text-code-sm font-bold uppercase transition-transform hover:-translate-x-0.5 hidden" type="button" id="cur-remove-btn">[ REMOVE ]</button>
              </div>
              <div class="font-code-lg text-code-lg font-bold text-on-surface break-all flex items-center gap-1.5 mt-1 text-on-surface-variant" id="cur-filename-display">
                <span class="material-symbols-outlined text-[18px]">draft</span>
                <span>No file selected</span>
              </div>
              <div class="font-code-sm text-code-sm text-on-surface-variant font-medium pt-1 border-t border-outline-variant" id="cur-file-meta">
                Select a CSV file to continue.
              </div>
            </div>
          </div>
          <div class="bg-surface-container p-space-sm border-t-[2.5px] border-on-surface font-code-sm text-code-sm text-on-surface-variant flex justify-between items-center">
            <span id="cur-parse-status">AWAITING FILE</span>
            <span class="font-bold text-on-surface">ENCODING: UTF-8</span>
          </div>
        </article>
      </section>

      <!-- PSI Threshold Configuration -->
      <section class="bg-[#FFFDF8] border-[3.5px] border-on-surface p-space-md md:p-space-lg shadow-[6px_6px_0px_#1c1b1b]">
        <div class="border-b-[2.5px] border-on-surface pb-space-sm mb-space-md flex flex-wrap items-center justify-between gap-space-xs">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-[20px] text-on-surface">tune</span>
            <h3 class="font-headline-sm text-headline-sm uppercase text-on-surface font-bold">ANALYSIS PARAMETERS &amp; THRESHOLDS</h3>
          </div>
          <span class="font-label-caps text-label-caps bg-surface-container-high border border-on-surface px-2 py-0.5 uppercase font-bold text-on-surface">ENGINE: NUMPY_QUANTILE_v2</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-space-lg items-start">
          <div class="md:col-span-4 flex flex-col gap-space-xs">
            <label class="font-headline-sm text-headline-sm uppercase text-on-surface font-bold" for="psi-input">PSI Threshold Configuration</label>
            <span class="font-code-sm text-code-sm text-on-surface-variant">Population Stability Index cutoff point</span>
            <div class="relative mt-2">
              <input class="w-full bg-[#FFFFFF] border-[3px] border-on-surface p-space-sm font-code-lg text-code-lg font-bold text-on-surface shadow-[3px_3px_0px_#1c1b1b] focus:outline-none focus:bg-primary-fixed focus:shadow-[5px_5px_0px_#1c1b1b] transition-all"
                id="psi-input" max="1.00" min="0.01" step="0.01" type="number" value="0.25" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 font-label-caps text-label-caps font-bold text-on-surface-variant">INDEX</span>
            </div>
            <div class="flex gap-2 mt-2">
              <button class="px-2 py-1 bg-surface-container border border-on-surface font-code-sm text-code-sm hover:bg-primary-container uppercase font-bold transition-all" id="psi-strict" type="button">0.10 (STRICT)</button>
              <button class="px-2 py-1 bg-primary-container border border-on-surface font-code-sm text-code-sm font-bold uppercase shadow-[1.5px_1.5px_0px_#1c1b1b]" id="psi-standard" type="button">0.25 (STANDARD)</button>
              <button class="px-2 py-1 bg-surface-container border border-on-surface font-code-sm text-code-sm hover:bg-primary-container uppercase font-bold transition-all" id="psi-lenient" type="button">0.30 (LENIENT)</button>
            </div>
          </div>
          <div class="md:col-span-8 bg-[#F7F4EA] border-[2.5px] border-on-surface p-space-md flex flex-col justify-between gap-space-sm shadow-[3px_3px_0px_#1c1b1b]">
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-[18px] text-on-surface">info</span>
              <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface">INTERPRETATION MATRIX</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant font-medium">
              Features with <strong class="text-on-surface font-bold">PSI ≥ configured threshold</strong> are flagged as significant distribution drift. DataWatch default boundaries:
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-space-xs font-code-sm text-code-sm pt-2">
              <div class="border-2 border-on-surface bg-surface-container-lowest p-2 flex flex-col">
                <span class="font-bold text-[#008744]">&lt; 0.10 PSI</span>
                <span class="text-on-surface font-medium">NO SIGNIFICANT CHANGE</span>
                <span class="text-on-surface-variant font-code-sm mt-1">Normal drift rate.</span>
              </div>
              <div class="border-2 border-on-surface bg-surface-container-lowest p-2 flex flex-col">
                <span class="font-bold text-[#b58b00]">0.10 – threshold PSI</span>
                <span class="text-on-surface font-medium">MODERATE DRIFT</span>
                <span class="text-on-surface-variant font-code-sm mt-1">Warning threshold.</span>
              </div>
              <div class="border-2 border-on-surface bg-tertiary-container p-2 flex flex-col">
                <span class="font-bold text-tertiary">≥ threshold PSI</span>
                <span class="text-on-surface font-bold">SIGNIFICANT DRIFT</span>
                <span class="text-on-surface-variant font-code-sm mt-1">Immediate action needed.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA: Analyze Button -->
      <section class="flex flex-col items-center justify-center gap-space-sm py-space-sm">
        <button
          class="w-full max-w-2xl text-center bg-primary-container text-on-surface border-[4px] border-on-surface font-display text-headline-lg uppercase py-space-md px-space-xl shadow-[8px_8px_0px_#1c1b1b] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#1c1b1b] active:translate-x-2 active:translate-y-2 active:shadow-none transition-all duration-75 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[8px_8px_0px_#1c1b1b]"
          id="trigger-analysis-btn" type="button">
          ANALYZE DRIFT →
        </button>
        <div class="flex items-center gap-space-xs text-on-surface-variant font-code-sm text-code-sm">
          <span class="material-symbols-outlined text-[16px] text-[#00D26A]">bolt</span>
          <span>Sends datasets to FastAPI drift engine for real-time distribution computation (10 bins).</span>
        </div>
      </section>

      <!-- Analysis Loading State (hidden by default) -->
      <section class="hidden border-[3.5px] border-on-surface bg-[#FFFDF8] shadow-[6px_6px_0px_#1c1b1b] overflow-hidden" id="loading-section">
        <div class="bg-on-surface text-surface-container-lowest p-space-md flex flex-wrap items-center justify-between gap-space-sm">
          <div class="flex items-center gap-space-sm">
            <div class="w-3 h-3 bg-[#FFE600] animate-pulse"></div>
            <h3 class="font-headline-sm text-headline-sm uppercase tracking-wide font-bold">ANALYZING DATA…</h3>
          </div>
          <div class="font-code-sm text-code-sm text-primary-container font-bold">ENGINE PROCESSING</div>
        </div>
        <div class="p-space-md flex flex-col gap-space-md">
          <div class="flex items-center gap-space-md">
            <div class="w-8 h-8 border-4 border-on-surface border-t-primary-container rounded-full animate-spin"></div>
            <div class="flex flex-col">
              <span class="font-headline-sm text-headline-sm uppercase font-bold text-on-surface">RUNNING STATISTICAL COMPUTATIONS</span>
              <span class="font-code-sm text-code-sm text-on-surface-variant">PSI · KS · Wasserstein · Jensen-Shannon — please wait…</span>
            </div>
          </div>
          <div class="w-full bg-surface-container-highest h-2 border border-on-surface overflow-hidden">
            <div class="h-full bg-primary-container animate-pulse w-full"></div>
          </div>
        </div>
      </section>

      <!-- Engine Diagnostics Panel -->
      <section class="border-[3px] border-on-surface bg-[#FFFDF8] p-space-md md:p-space-lg shadow-[4px_4px_0px_#1c1b1b]">
        <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-sm mb-space-md">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-tertiary text-[20px]">health_and_safety</span>
            <h4 class="font-headline-sm text-headline-sm uppercase font-bold text-on-surface">ENGINE DIAGNOSTICS &amp; ERROR PROTOCOLS</h4>
          </div>
          <span class="font-code-sm text-code-sm text-on-surface-variant">FAIL-SAFE VALIDATION READY</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div class="border-2 border-on-surface p-space-sm bg-surface-container-low flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface">INPUT REQUIREMENT</span>
              <span class="font-code-sm text-code-sm font-bold text-on-surface-variant" id="diag-input">—</span>
            </div>
            <span class="font-headline-sm text-headline-sm text-on-surface uppercase">DATASET INTEGRITY</span>
            <p class="font-body-md text-body-md text-on-surface-variant mt-1">
              Both files must be uploaded before computation can initialize.
            </p>
          </div>
          <div class="border-2 border-on-surface p-space-sm bg-surface-container-low flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface">SCHEMA VERIFICATION</span>
              <span class="font-code-sm text-code-sm font-bold text-on-surface-variant" id="diag-schema">—</span>
            </div>
            <span class="font-headline-sm text-headline-sm text-on-surface uppercase">SCHEMA PARITY</span>
            <p class="font-body-md text-body-md text-on-surface-variant mt-1">
              Incompatible schemas trigger <code>ERR_SCHEMA_MISMATCH</code>.
            </p>
          </div>
          <div class="border-2 border-on-surface p-space-sm bg-surface-container-low flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="font-label-caps text-label-caps uppercase font-bold text-on-surface">DAEMON STATUS</span>
              <span class="font-code-sm text-code-sm font-bold text-on-surface-variant" id="diag-daemon">CHECKING…</span>
            </div>
            <span class="font-headline-sm text-headline-sm text-on-surface uppercase">FASTAPI CONNECTION</span>
            <p class="font-body-md text-body-md text-on-surface-variant mt-1">
              Engine endpoint at <code>http://127.0.0.1:8000/api/drift</code>.
            </p>
          </div>
        </div>
      </section>

    </div>
  </div>
</main>
${renderFooter()}

<script data-page="analyze">
(function initAnalyze() {
  // ---- PSI Presets ----
  const psiInput = document.getElementById('psi-input');
  document.getElementById('psi-strict')  ?.addEventListener('click', () => { psiInput.value = '0.10'; });
  document.getElementById('psi-standard')?.addEventListener('click', () => { psiInput.value = '0.25'; });
  document.getElementById('psi-lenient') ?.addEventListener('click', () => { psiInput.value = '0.30'; });
  psiInput?.addEventListener('blur', () => {
    const v = parseFloat(psiInput.value);
    if (isNaN(v) || v <= 0) psiInput.value = '0.25';
  });

  // ---- File state ----
  let refFile = null;
  let curFile = null;

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function updateFileUI(prefix, file) {
    const badge    = document.getElementById(prefix + '-status-badge');
    const display  = document.getElementById(prefix + '-filename-display');
    const meta     = document.getElementById(prefix + '-file-meta');
    const remove   = document.getElementById(prefix + '-remove-btn');
    const parse    = document.getElementById(prefix + '-parse-status');

    if (file) {
      badge.innerHTML = '<span class="font-label-caps text-label-caps font-bold">✓ READY</span>';
      badge.className = badge.className.replace('bg-surface-container-high','bg-[#00D26A]');
      display.innerHTML = '<span class="material-symbols-outlined text-[18px]">draft</span><span class="text-on-surface">' + file.name + '</span>';
      meta.textContent = formatBytes(file.size) + ' • CSV • UTF-8';
      remove.classList.remove('hidden');
      if (parse) parse.textContent = 'PARSING INTEGRITY: READY';
    } else {
      badge.innerHTML = '<span class="font-label-caps text-label-caps font-bold">AWAITING FILE</span>';
      badge.className = badge.className.replace('bg-[#00D26A]','bg-surface-container-high');
      display.innerHTML = '<span class="material-symbols-outlined text-[18px]">draft</span><span>No file selected</span>';
      meta.textContent = 'Select a CSV file to continue.';
      remove.classList.add('hidden');
      if (parse) parse.textContent = 'AWAITING FILE';
    }
    updateDiagInput();
  }

  function updateDiagInput() {
    const diag = document.getElementById('diag-input');
    if (diag) {
      if (refFile && curFile) {
        diag.textContent = 'PASSED';
        diag.className = diag.className.replace('text-on-surface-variant','text-[#008744]');
      } else {
        diag.textContent = refFile || curFile ? 'PARTIAL' : '—';
      }
    }
  }

  // ---- File input handlers ----
  ['ref', 'cur'].forEach(prefix => {
    const input = document.getElementById(prefix + '-file-input');
    if (!input) return;
    input.addEventListener('change', e => {
      const file = e.target.files?.[0] || null;
      if (prefix === 'ref') refFile = file;
      else curFile = file;
      updateFileUI(prefix, file);
    });
    document.getElementById(prefix + '-remove-btn')?.addEventListener('click', () => {
      input.value = '';
      if (prefix === 'ref') refFile = null;
      else curFile = null;
      updateFileUI(prefix, null);
    });
  });

  // Restore files from state if navigating back
  if (window.__dwState?.referenceFile) {
    refFile = window.__dwState.referenceFile;
    updateFileUI('ref', refFile);
  }
  if (window.__dwState?.currentFile) {
    curFile = window.__dwState.currentFile;
    updateFileUI('cur', curFile);
  }

  // ---- Error banner ----
  function showError(msg) {
    const banner = document.getElementById('error-banner');
    const msgEl  = document.getElementById('error-message');
    if (banner && msgEl) {
      msgEl.textContent = msg;
      banner.classList.remove('hidden');
      banner.classList.add('flex');
    }
  }
  function hideError() {
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.classList.add('hidden');
      banner.classList.remove('flex');
    }
  }
  document.getElementById('dismiss-error-btn')?.addEventListener('click', hideError);

  // ---- Loading state ----
  function setLoading(on) {
    const btn     = document.getElementById('trigger-analysis-btn');
    const loading = document.getElementById('loading-section');
    if (btn) {
      btn.disabled = on;
      btn.textContent = on ? 'ANALYZING DATA…' : 'ANALYZE DRIFT →';
    }
    if (loading) {
      if (on) loading.classList.remove('hidden');
      else    loading.classList.add('hidden');
    }
  }

  // ---- ANALYZE DRIFT button ----
  document.getElementById('trigger-analysis-btn')?.addEventListener('click', async () => {
    hideError();
    if (!refFile) { showError('Please select a Reference CSV file before running analysis.'); return; }
    if (!curFile) { showError('Please select a Current CSV file before running analysis.'); return; }
    const threshold = parseFloat(psiInput?.value || '0.25');
    if (isNaN(threshold) || threshold <= 0 || threshold > 1) {
      showError('PSI threshold must be between 0.01 and 1.00.');
      return;
    }

    setLoading(true);
    try {
      // Dynamic import so the API module is loaded lazily
      const { analyzeDrift } = await import('/src/api/client.js');
      const { persistResult, default: store } = await import('/src/state/store.js');
      const t0 = performance.now();
      const result = await analyzeDrift(refFile, curFile, threshold);
      const elapsed = performance.now() - t0;
      persistResult(result);
      // Store files on the window so they survive navigation for re-analysis
      window.__dwState = { referenceFile: refFile, currentFile: curFile, psiThreshold: threshold };
      window.location.hash = '#/results';
    } catch (err) {
      setLoading(false);
      const msg = err?.message || 'Unable to connect to the DataWatch analysis service. Make sure the FastAPI backend is running on port 8000.';
      showError(msg);
    }
  });

  // ---- Backend health check ----
  (async () => {
    const daemonDot   = document.getElementById('daemon-dot');
    const daemonLabel = document.getElementById('daemon-label');
    const diagDaemon  = document.getElementById('diag-daemon');
    try {
      const { checkBackendHealth } = await import('/src/api/client.js');
      const t0 = performance.now();
      const ok = await checkBackendHealth();
      const latency = Math.round(performance.now() - t0);
      const latencyEl = document.getElementById('latency-label');
      if (ok) {
        if (daemonDot)   { daemonDot.className = 'w-2.5 h-2.5 bg-[#00D26A] border-2 border-on-surface'; }
        if (daemonLabel) daemonLabel.textContent = 'FASTAPI_DAEMON: CONNECTED';
        if (diagDaemon)  { diagDaemon.textContent = 'HEALTHY (200 OK)'; diagDaemon.className = diagDaemon.className.replace('text-on-surface-variant','text-[#008744]'); }
        if (latencyEl)   latencyEl.textContent = 'LATENCY: ' + latency + 'ms';
      } else {
        if (daemonDot)   { daemonDot.className = 'w-2.5 h-2.5 bg-[#FF5277] border-2 border-on-surface'; }
        if (daemonLabel) daemonLabel.textContent = 'FASTAPI_DAEMON: OFFLINE';
        if (diagDaemon)  { diagDaemon.textContent = 'UNREACHABLE'; diagDaemon.className = diagDaemon.className.replace('text-on-surface-variant','text-tertiary'); }
      }
    } catch(_) {}
  })();

  // ---- Restore PSI from state ----
  if (window.__dwState?.psiThreshold && psiInput) {
    psiInput.value = String(window.__dwState.psiThreshold);
  }
})();
</script>`;
}
