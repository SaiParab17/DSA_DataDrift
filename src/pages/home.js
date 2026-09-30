import { renderNav, renderFooter } from '../components/nav.js';

export function renderHome() {
  return `
${renderNav('home')}
<main class="w-full pt-20 bg-surface min-h-[calc(100vh-140px)]">
  <div class="flex flex-col w-full">

    <!-- Top Ticker Bar -->
    <div class="w-full bg-on-surface text-surface py-space-xs px-gutter border-b-2 border-on-surface overflow-hidden">
      <div class="flex items-center justify-between text-code-sm font-code-sm uppercase tracking-widest">
        <div class="flex items-center gap-space-md">
          <span class="inline-flex items-center gap-1 font-bold text-primary-container">
            <span class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
            SYS_STATUS::STABLE
          </span>
          <span class="hidden md:inline text-surface-dim">|</span>
          <span class="hidden md:inline text-surface-dim">PSI_THRESHOLD: 0.25 (CRITICAL)</span>
          <span class="hidden md:inline text-surface-dim">|</span>
          <span class="hidden md:inline text-surface-dim">KS_CONFIDENCE: 99.8%</span>
        </div>
        <div class="flex items-center gap-space-sm font-code-sm font-bold text-primary-container">
          <span>ENGINE::FASTAPI_PIPELINE</span>
          <span class="text-surface">[ST_OCT_2025]</span>
        </div>
      </div>
    </div>

    <!-- HERO SECTION -->
    <section class="w-full px-gutter-sm sm:px-gutter py-space-xl border-b-[3px] border-on-surface bg-surface relative"
      style="background-image: radial-gradient(#1c1b1b 1px, transparent 1px); background-size: 24px 24px;">
      <div class="max-w-7xl mx-auto flex flex-col lg:flex-row items-stretch gap-space-xl relative z-10">
        <!-- Left Column -->
        <div class="flex-1 flex flex-col justify-between">
          <div>
            <div class="inline-flex items-center gap-2 px-space-sm py-1 bg-surface border-2 border-on-surface shadow-[3px_3px_0px_#1c1b1b] mb-space-lg">
              <span class="w-2.5 h-2.5 bg-tertiary border border-on-surface"></span>
              <span class="font-label-caps text-label-caps uppercase text-on-surface font-bold tracking-wider">DRIFT_INSPECTION_LAYER</span>
            </div>
            <div class="space-y-space-xs">
              <h1 class="font-display text-display text-on-surface uppercase tracking-tighter leading-none">
                KNOW WHEN YOUR DATA CHANGES.
              </h1>
              <h2 class="font-display text-display text-secondary uppercase tracking-tighter leading-none mt-space-xs">
                BEFORE YOUR MODEL FEELS IT.
              </h2>
            </div>
            <p class="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mt-space-lg leading-relaxed border-l-4 border-on-surface pl-space-md bg-surface/80">
              DataWatch compares your reference and current datasets to detect statistical drift, identify affected features, and turn silent baseline erosion into clear, deterministic engineering signals.
            </p>
          </div>
          <div class="pt-space-xl flex flex-wrap items-center gap-space-md">
            <a class="inline-flex items-center justify-center bg-primary-container text-on-surface font-headline-sm text-headline-sm uppercase px-space-lg py-space-md border-[3px] border-on-surface shadow-[6px_6px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-75" href="#/analyze">
              ANALYZE DATA
              <span class="material-symbols-outlined ml-2 font-bold">arrow_forward</span>
            </a>
            <a class="inline-flex items-center justify-center bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm uppercase px-space-lg py-space-md border-[3px] border-on-surface shadow-[4px_4px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-75" href="#/dashboard">
              VIEW DASHBOARD
              <span class="material-symbols-outlined ml-2 text-on-surface-variant">query_stats</span>
            </a>
          </div>
          <!-- Terminal Status Bar -->
          <div class="mt-space-xl p-space-sm bg-surface-container-high border-2 border-on-surface font-code-sm text-code-sm flex items-center justify-between">
            <div class="flex items-center gap-space-xs text-on-surface font-semibold">
              <span class="material-symbols-outlined text-[16px] text-primary">terminal</span>
              <span>CLI READY:</span>
              <code class="text-on-surface-variant font-mono">datawatch verify --ref baseline.csv --cur batch_10.csv</code>
            </div>
            <span class="hidden sm:inline font-label-caps text-label-caps bg-on-surface text-surface px-1.5 py-0.5 font-bold">SHA-256</span>
          </div>
        </div>

        <!-- Right Column: Pipeline Schematic -->
        <div class="w-full lg:w-[460px] flex flex-col justify-center">
          <div class="border-[3px] border-on-surface bg-surface-container-lowest p-space-lg shadow-[8px_8px_0px_#1c1b1b] relative">
            <div class="flex items-center justify-between pb-space-sm mb-space-md border-b-2 border-on-surface">
              <span class="font-label-caps text-label-caps font-bold tracking-wider uppercase text-on-surface flex items-center gap-1.5">
                <span class="w-3 h-3 bg-secondary"></span>
                DATA_FLOW_PIPELINE
              </span>
              <span class="font-code-sm text-code-sm text-on-surface-variant font-bold">STAGE 01-03</span>
            </div>
            <div class="flex flex-col items-stretch space-y-3">
              <!-- Block 1: Reference Dataset -->
              <div class="border-[3px] border-on-surface bg-primary-container p-space-md shadow-[4px_4px_0px_#1c1b1b]">
                <div class="flex items-center justify-between">
                  <span class="font-headline-sm text-headline-sm uppercase text-on-surface font-bold">REFERENCE DATASET</span>
                  <span class="font-code-sm text-code-sm px-1.5 py-0.5 bg-surface border border-on-surface font-bold">N=50,000</span>
                </div>
                <p class="font-code-sm text-code-sm text-on-surface mt-1 font-medium">Baseline distribution snapshot (Golden Batch)</p>
                <div class="mt-space-sm pt-space-xs border-t border-on-surface flex items-end justify-between h-8 gap-1">
                  <div class="w-full bg-on-surface h-3"></div>
                  <div class="w-full bg-on-surface h-5"></div>
                  <div class="w-full bg-on-surface h-7"></div>
                  <div class="w-full bg-on-surface h-8"></div>
                  <div class="w-full bg-on-surface h-6"></div>
                  <div class="w-full bg-on-surface h-4"></div>
                  <div class="w-full bg-on-surface h-2"></div>
                </div>
              </div>
              <!-- Flow Indicator 1 -->
              <div class="flex items-center justify-center gap-2 py-1">
                <div class="h-0.5 w-12 bg-on-surface"></div>
                <div class="bg-surface px-2 py-0.5 border-2 border-on-surface font-code-sm text-code-sm font-bold shadow-[2px_2px_0px_#1c1b1b] flex items-center gap-1">
                  <span>↓ COMPARE</span>
                </div>
                <div class="h-0.5 w-12 bg-on-surface"></div>
              </div>
              <!-- Block 2: Current Dataset -->
              <div class="border-[3px] border-on-surface bg-surface p-space-md shadow-[4px_4px_0px_#1c1b1b]">
                <div class="flex items-center justify-between">
                  <span class="font-headline-sm text-headline-sm uppercase text-secondary font-bold">CURRENT DATASET</span>
                  <span class="font-label-caps text-label-caps px-1.5 py-0.5 bg-secondary text-on-secondary border border-on-surface font-bold">BATCH_248</span>
                </div>
                <p class="font-code-sm text-code-sm text-on-surface-variant mt-1 font-medium">Live production inference stream (T-0 to T-24h)</p>
                <div class="mt-space-sm pt-space-xs border-t border-on-surface flex items-end justify-between h-8 gap-1">
                  <div class="w-full bg-secondary h-1"></div>
                  <div class="w-full bg-secondary h-2"></div>
                  <div class="w-full bg-secondary h-4"></div>
                  <div class="w-full bg-secondary h-5"></div>
                  <div class="w-full bg-secondary h-7"></div>
                  <div class="w-full bg-secondary h-8"></div>
                  <div class="w-full bg-secondary h-6"></div>
                </div>
              </div>
              <!-- Flow Indicator 2 -->
              <div class="flex items-center justify-center gap-2 py-1">
                <div class="h-0.5 w-8 bg-on-surface"></div>
                <div class="bg-surface-container-high px-2 py-0.5 border-2 border-on-surface font-code-sm text-code-sm font-bold shadow-[2px_2px_0px_#1c1b1b] flex items-center gap-1">
                  <span>↓ STATISTICAL TESTS (PSI &amp; KS)</span>
                </div>
                <div class="h-0.5 w-8 bg-on-surface"></div>
              </div>
              <!-- Block 3: Drift Detected -->
              <div class="border-[3px] border-on-surface bg-tertiary-container p-space-md shadow-[4px_4px_0px_#1c1b1b]">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-tertiary font-bold">warning</span>
                    <span class="font-headline-sm text-headline-sm uppercase text-on-surface font-bold">DRIFT DETECTED</span>
                  </div>
                  <span class="font-label-caps text-label-caps px-2 py-0.5 bg-tertiary text-on-tertiary border border-on-surface font-bold tracking-wider">CRITICAL SIGNAL</span>
                </div>
                <div class="mt-2 flex items-center justify-between font-code-sm text-code-sm font-bold text-on-surface pt-1 border-t border-on-surface">
                  <span>PSI: 0.384 (&gt;0.25)</span>
                  <span class="text-tertiary">ACTION REQUIRED</span>
                </div>
              </div>
            </div>
            <div class="mt-space-md pt-space-xs border-t-2 border-on-surface flex items-center justify-between text-code-sm font-code-sm text-on-surface-variant font-mono">
              <span>DIVERGENCE: 7_FEATURES</span>
              <span>LATENCY: 42ms</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="w-full px-gutter-sm sm:px-gutter py-space-xl border-b-[3px] border-on-surface bg-surface-container-low">
      <div class="max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-space-xl pb-space-md border-b-[3px] border-on-surface gap-space-sm">
          <div>
            <span class="font-label-caps text-label-caps font-bold tracking-widest uppercase text-secondary bg-secondary-fixed px-2 py-0.5 border border-on-surface inline-block mb-2">OPERATIONAL WORKFLOW</span>
            <h2 class="font-headline-lg text-headline-lg uppercase text-on-surface tracking-tight">HOW IT WORKS</h2>
          </div>
          <div class="font-code-md text-code-md text-on-surface-variant font-bold max-w-sm">
            Simple input → clear analysis → understandable result. Zero black box mystery.
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          <!-- Card 01 -->
          <div class="bg-surface border-[3px] border-on-surface p-space-lg shadow-[6px_6px_0px_#1c1b1b] flex flex-col justify-between hover:-translate-y-1 transition-transform">
            <div>
              <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-sm mb-space-md">
                <span class="font-display text-display text-on-surface font-bold leading-none">01</span>
                <span class="font-label-caps text-label-caps bg-surface-container border border-on-surface px-2 py-1 font-bold">STAGE_INGEST</span>
              </div>
              <h3 class="font-headline-md text-headline-md uppercase text-on-surface font-bold tracking-tight">UPLOAD</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mt-space-sm leading-relaxed">
                Add a reference dataset and a current dataset in standard CSV format. Instant schema ingestion without proprietary transformations.
              </p>
            </div>
            <div class="mt-space-lg pt-space-md border-t-2 border-on-surface">
              <div class="bg-surface-container p-space-sm border border-on-surface font-code-sm text-code-sm space-y-1">
                <div class="flex items-center gap-1.5 text-on-surface">
                  <span class="material-symbols-outlined text-[16px]">file_upload</span>
                  <span>ref_golden_v1.csv</span>
                </div>
                <div class="flex items-center gap-1.5 text-secondary font-bold">
                  <span class="material-symbols-outlined text-[16px]">file_upload</span>
                  <span>cur_stream_latest.csv</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Card 02 -->
          <div class="bg-primary-container border-[3px] border-on-surface p-space-lg shadow-[6px_6px_0px_#1c1b1b] flex flex-col justify-between hover:-translate-y-1 transition-transform">
            <div>
              <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-sm mb-space-md">
                <span class="font-display text-display text-on-surface font-bold leading-none">02</span>
                <span class="font-label-caps text-label-caps bg-surface text-on-surface border border-on-surface px-2 py-1 font-bold">STAGE_EVAL</span>
              </div>
              <h3 class="font-headline-md text-headline-md uppercase text-on-surface font-bold tracking-tight">ANALYZE</h3>
              <p class="font-body-md text-body-md text-on-surface mt-space-sm font-medium leading-relaxed">
                DataWatch compares their feature distributions using population stability index (PSI) and nonparametric Kolmogorov-Smirnov evaluations.
              </p>
            </div>
            <div class="mt-space-lg pt-space-md border-t-2 border-on-surface">
              <div class="bg-surface p-space-sm border border-on-surface font-code-sm text-code-sm space-y-1">
                <div class="flex justify-between text-on-surface font-bold">
                  <span>METRIC_PSI</span>
                  <span class="text-tertiary">0.312 [SHIFT]</span>
                </div>
                <div class="flex justify-between text-on-surface-variant font-mono">
                  <span>KS_TEST_PVAL</span>
                  <span>0.0001 (α=0.01)</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Card 03 -->
          <div class="bg-surface border-[3px] border-on-surface p-space-lg shadow-[6px_6px_0px_#1c1b1b] flex flex-col justify-between hover:-translate-y-1 transition-transform">
            <div>
              <div class="flex items-center justify-between border-b-2 border-on-surface pb-space-sm mb-space-md">
                <span class="font-display text-display text-on-surface font-bold leading-none">03</span>
                <span class="font-label-caps text-label-caps bg-surface-container border border-on-surface px-2 py-1 font-bold">STAGE_TRIAGE</span>
              </div>
              <h3 class="font-headline-md text-headline-md uppercase text-on-surface font-bold tracking-tight">UNDERSTAND</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mt-space-sm leading-relaxed">
                See which features changed and how much. Pinpoint numerical drift and categorical divergence before downstream models degrade.
              </p>
            </div>
            <div class="mt-space-lg pt-space-md border-t-2 border-on-surface">
              <div class="bg-surface-container p-space-sm border border-on-surface font-code-sm text-code-sm space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-on-surface">DRIFT_SCORE</span>
                  <span class="font-bold text-tertiary uppercase">HIGH RISK</span>
                </div>
                <div class="w-full bg-surface h-2 border border-on-surface overflow-hidden">
                  <div class="bg-tertiary h-full w-[78%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CORE CAPABILITIES -->
    <section class="w-full px-gutter-sm sm:px-gutter py-space-xl border-b-[3px] border-on-surface bg-surface">
      <div class="max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-space-xl pb-space-md border-b-[3px] border-on-surface gap-space-sm">
          <div>
            <span class="font-label-caps text-label-caps font-bold tracking-widest uppercase text-tertiary bg-tertiary-container px-2 py-0.5 border border-on-surface inline-block mb-2">SYSTEM AUDITING</span>
            <h2 class="font-headline-lg text-headline-lg uppercase text-on-surface tracking-tight">CORE CAPABILITIES</h2>
          </div>
          <div class="font-code-md text-code-md text-on-surface-variant font-bold">
            High-precision statistical telemetry across pipeline layers.
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          <!-- Drift Detection (ACTIVE) -->
          <div class="bg-surface border-[3px] border-on-surface p-space-lg shadow-[6px_6px_0px_#1c1b1b] relative">
            <div class="flex items-center justify-between gap-space-sm mb-space-md">
              <h3 class="font-headline-md text-headline-md uppercase text-on-surface font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary">ssid_chart</span>
                DRIFT DETECTION
              </h3>
              <span class="font-label-caps text-label-caps font-bold px-2 py-0.5 bg-[#00D26A] text-on-surface border-2 border-on-surface shadow-[2px_2px_0px_#1c1b1b] uppercase whitespace-nowrap">ACTIVE ENGINE</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Continuous distribution comparison between baseline and production batches using PSI and Kolmogorov-Smirnov metrics. Full feature breakdown with bin-level stability evaluation.
            </p>
            <div class="mt-space-lg border-t-2 border-on-surface pt-space-md flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm">
              <span class="px-2 py-0.5 bg-surface-container border border-on-surface font-bold text-on-surface">PSI_CALC</span>
              <span class="px-2 py-0.5 bg-surface-container border border-on-surface font-bold text-on-surface">KS_2SAMPLE</span>
              <span class="px-2 py-0.5 bg-surface-container border border-on-surface font-bold text-on-surface">QUANTILE_BINNING</span>
              <span class="px-2 py-0.5 bg-surface-container border border-on-surface font-bold text-on-surface">REAL_TIME</span>
            </div>
          </div>
          <!-- Data Quality (ROADMAP) -->
          <div class="bg-surface-container-low border-[3px] border-on-surface p-space-lg shadow-[4px_4px_0px_#1c1b1b] opacity-90">
            <div class="flex items-center justify-between gap-space-sm mb-space-md">
              <h3 class="font-headline-md text-headline-md uppercase text-on-surface font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">fact_check</span>
                DATA QUALITY
              </h3>
              <span class="font-label-caps text-label-caps font-bold px-2 py-0.5 bg-surface border-2 border-on-surface shadow-[2px_2px_0px_#1c1b1b] text-on-surface-variant uppercase whitespace-nowrap">COMING IN NEXT PHASE</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Basic dataset validity, missing value detection, null counts, and data boundary verifications. Automated boundary assertion flags when feature ranges violate physical reality.
            </p>
            <div class="mt-space-lg border-t-2 border-on-surface pt-space-md flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm text-on-surface-variant">
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">NULL_RATE_AUDIT</span>
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">OUTLIER_BOUNDS</span>
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">TYPE_SANITY</span>
            </div>
          </div>
          <!-- Schema Validation (ROADMAP) -->
          <div class="bg-surface-container-low border-[3px] border-on-surface p-space-lg shadow-[4px_4px_0px_#1c1b1b] opacity-90">
            <div class="flex items-center justify-between gap-space-sm mb-space-md">
              <h3 class="font-headline-md text-headline-md uppercase text-on-surface font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">account_tree</span>
                SCHEMA VALIDATION
              </h3>
              <span class="font-label-caps text-label-caps font-bold px-2 py-0.5 bg-surface border-2 border-on-surface shadow-[2px_2px_0px_#1c1b1b] text-on-surface-variant uppercase whitespace-nowrap">COMING IN NEXT PHASE</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Column type shifts, added/dropped fields, and structural schema modifications. Prevents pipeline failure caused by upstream engineering mutations before model ingestion.
            </p>
            <div class="mt-space-lg border-t-2 border-on-surface pt-space-md flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm text-on-surface-variant">
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">FIELD_DROP_GUARD</span>
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">TYPE_MUTATION</span>
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">SCHEMA_DIFF</span>
            </div>
          </div>
          <!-- Model Impact (ROADMAP) -->
          <div class="bg-surface-container-low border-[3px] border-on-surface p-space-lg shadow-[4px_4px_0px_#1c1b1b] opacity-90">
            <div class="flex items-center justify-between gap-space-sm mb-space-md">
              <h3 class="font-headline-md text-headline-md uppercase text-on-surface font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-on-surface-variant">biotech</span>
                MODEL IMPACT
              </h3>
              <span class="font-label-caps text-label-caps font-bold px-2 py-0.5 bg-surface border-2 border-on-surface shadow-[2px_2px_0px_#1c1b1b] text-on-surface-variant uppercase whitespace-nowrap">COMING IN NEXT PHASE</span>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Downstream performance degradation estimation and feature attribution shifts. Understand exactly how individual drifted variables erode production model confidence.
            </p>
            <div class="mt-space-lg border-t-2 border-on-surface pt-space-md flex flex-wrap items-center gap-space-xs font-code-sm text-code-sm text-on-surface-variant">
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">PERF_DEGRADATION</span>
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">SHAP_ATTRIBUTION</span>
              <span class="px-2 py-0.5 bg-surface border border-outline-variant font-mono">LOSS_PROJECTION</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="w-full px-gutter-sm sm:px-gutter py-space-xl bg-surface-container-high border-b-[3px] border-on-surface relative">
      <div class="max-w-5xl mx-auto bg-surface border-[4px] border-on-surface p-space-lg sm:p-space-xl shadow-[10px_10px_0px_#1c1b1b] relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-primary-container border-b-[3px] border-l-[3px] border-on-surface -rotate-45 translate-x-16 -translate-y-16"></div>
        <div class="relative z-10">
          <div class="inline-flex items-center gap-2 border-2 border-on-surface px-space-sm py-1 bg-primary-container mb-space-md shadow-[3px_3px_0px_#1c1b1b]">
            <span class="material-symbols-outlined text-[16px] text-on-surface">bolt</span>
            <span class="font-label-caps text-label-caps font-bold uppercase text-on-surface tracking-wider">ZERO CONFIGURATION REQUIRED</span>
          </div>
          <h2 class="font-display text-display uppercase text-on-surface tracking-tighter leading-none mb-space-sm">
            READY TO CHECK YOUR DATA?
          </h2>
          <p class="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed mb-space-xl">
            Upload two CSV files and receive real-time drift metrics within seconds. Pinpoint corrupt distributions, isolate shifted columns, and safeguard machine learning integrity.
          </p>
          <div class="flex flex-col sm:flex-row sm:items-center gap-space-md">
            <a class="inline-flex items-center justify-center bg-tertiary text-on-tertiary font-headline-md text-headline-md uppercase px-space-xl py-space-md border-[4px] border-on-surface shadow-[8px_8px_0px_#1c1b1b] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-75" href="#/analyze">
              START ANALYSIS →
            </a>
            <div class="font-code-sm text-code-sm text-on-surface-variant flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-[#00D26A]">verified</span>
              <span>CSV, PARQUET, AND JSON COMPATIBLE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</main>
${renderFooter()}`;
}
