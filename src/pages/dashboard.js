import { renderNav, renderFooter } from '../components/nav.js';
import state from '../state/store.js';

export function renderDashboard() {
  const result = state.latestResult;

  if (!result) {
    return `
${renderNav('dashboard')}
<main class="w-full pt-20 flex-1 flex flex-col justify-between min-h-screen">
  <div class="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-8 md:py-10 flex flex-col gap-8 items-center justify-center grow">
    <div class="border-[4px] border-on-surface bg-surface-card p-12 shadow-[8px_8px_0px_#111111] flex flex-col items-center gap-6 text-center max-w-2xl">
      <span class="material-symbols-outlined text-[64px] text-on-surface/50">monitoring</span>
      <h1 class="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-on-surface">
        NO DATA AVAILABLE
      </h1>
      <p class="font-body text-lg font-semibold text-on-surface/70">
        Run your first drift analysis to populate the dashboard monitoring console.
      </p>
      <a class="bg-brand-yellow text-on-surface border-[3px] border-on-surface font-display font-black text-sm uppercase px-8 py-3.5 shadow-[4px_4px_0px_#111111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#111111] transition-all mt-4" href="#/analyze">
        [ START ANALYSIS → ]
      </a>
    </div>
  </div>
  ${renderFooter()}
</main>`;
  }

  const hasDrift = result.overall_status === 'DRIFT_DETECTED';
  const features = result.features || [];
  const firstFeature = features[0] || null;

  return `
${renderNav('dashboard')}
<main class="w-full pt-20 flex-1 flex flex-col justify-between min-h-screen">
  <div class="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-8 md:py-10 flex flex-col gap-8">

    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-[3px] border-on-surface bg-surface-card p-6 shadow-[5px_5px_0px_#111111]">
      <div class="flex flex-col gap-1">
        <div class="font-mono text-xs font-bold text-on-surface/60 uppercase tracking-widest">MONITORING CONSOLE</div>
        <h1 class="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-on-surface">
          LATEST ANALYSIS
        </h1>
      </div>
      <!-- Dataset Metadata Tags -->
      <div class="flex flex-wrap items-center gap-2.5 font-mono text-xs font-bold">
        <div class="inline-flex items-center gap-2 bg-[#FAF7EE] border-2 border-on-surface px-3 py-1.5 shadow-[2px_2px_0px_#111111]">
          <span class="text-on-surface/60">REF:</span>
          <span class="text-on-surface">${result.reference_file}</span>
          <span class="bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold text-on-surface">(${result.reference_rows.toLocaleString()} rows)</span>
        </div>
        <span class="text-on-surface font-black hidden sm:inline">|</span>
        <div class="inline-flex items-center gap-2 bg-[#FAF7EE] border-2 border-on-surface px-3 py-1.5 shadow-[2px_2px_0px_#111111]">
          <span class="text-on-surface/60">CUR:</span>
          <span class="text-on-surface">${result.current_file}</span>
          <span class="bg-brand-yellow px-1.5 py-0.5 border border-on-surface text-[10px] font-semibold text-on-surface">(${result.current_rows.toLocaleString()} rows)</span>
        </div>
      </div>
    </div>

    <!-- Verdict Card -->
    <div class="border-[3.5px] border-on-surface ${hasDrift ? 'bg-brand-coral' : 'bg-brand-green'} p-6 sm:p-8 shadow-[6px_6px_0px_#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      <div class="flex flex-col gap-3">
        <div class="inline-flex items-center gap-2 bg-on-surface text-white px-3 py-1 font-mono text-xs font-bold tracking-widest uppercase self-start">
          <span class="material-symbols-outlined text-[16px] ${hasDrift ? 'text-brand-yellow' : 'text-brand-green'}">${hasDrift ? 'warning' : 'check_circle'}</span>
          STATUS OVERVIEW
        </div>
        <h2 class="font-display text-2xl sm:text-3xl font-extrabold text-on-surface uppercase tracking-tight">
          ${hasDrift ? 'DRIFT DETECTED' : 'SYSTEM STABLE'}
        </h2>
        <p class="font-body text-base sm:text-lg font-semibold text-on-surface leading-snug max-w-3xl">
          ${hasDrift 
            ? `${result.features_drifted} of ${result.features_analyzed} features exceed the ${result.psi_threshold} PSI threshold. Primary drift contributor:
               <strong class="underline decoration-on-surface decoration-2 underline-offset-4 font-mono font-bold">${firstFeature ? firstFeature.name + ' (PSI: ' + firstFeature.psi.toFixed(3) + ')' : '—'}</strong>.`
            : `All ${result.features_analyzed} features are operating within normal variation thresholds (${result.psi_threshold} PSI).`}
        </p>
      </div>
      <div class="shrink-0 bg-white border-[3px] border-on-surface px-5 py-4 shadow-[4px_4px_0px_#111111] flex flex-col items-center justify-center text-center">
        <span class="font-mono text-xs uppercase font-extrabold text-on-surface/70">${hasDrift ? 'ACTION REQUIRED' : 'NO ACTION NEEDED'}</span>
        <span class="font-mono text-2xl font-black ${hasDrift ? 'text-brand-coral' : 'text-brand-green'}">${hasDrift ? 'REVIEW MODEL' : 'ALL CLEAR'}</span>
      </div>
    </div>

    <!-- 4 Metric Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <!-- Features Analyzed -->
      <div class="bg-surface-card border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface/70 pb-3 border-b-2 border-on-surface">FEATURES ANALYZED</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-on-surface leading-none">${result.features_analyzed}</div>
          <div class="font-mono text-xs font-bold text-on-surface/80 mt-2">100% evaluated</div>
        </div>
      </div>
      <!-- Features Drifted -->
      <div class="bg-brand-yellow border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface pb-3 border-b-2 border-on-surface">FEATURES DRIFTED</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-on-surface leading-none">${result.features_drifted}</div>
          <div class="font-mono text-xs font-bold text-on-surface mt-2">PSI &gt; ${result.psi_threshold}</div>
        </div>
      </div>
      <!-- Max PSI -->
      <div class="bg-[#FFE5EC] border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface pb-3 border-b-2 border-on-surface">MAX PSI</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-brand-coral leading-none">${result.max_psi !== null ? result.max_psi.toFixed(3) : 'N/A'}</div>
          <div class="font-mono text-xs font-bold text-on-surface/80 mt-2 truncate">${result.max_psi !== null && firstFeature ? firstFeature.name : 'No numeric features'}</div>
        </div>
      </div>
      <!-- PSI Threshold -->
      <div class="bg-[#E6F9F0] border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface pb-3 border-b-2 border-on-surface">PSI THRESHOLD</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-brand-green leading-none">${result.psi_threshold}</div>
          <div class="font-mono text-xs font-bold text-on-surface/80 mt-2">Configured guardrail</div>
        </div>
      </div>
    </div>

    <!-- Model Impact Dashboard Card (Only when COMPLETED) -->
    ${result.model_impact && result.model_impact.status === 'COMPLETED' ? `
    <div class="border-[3.5px] border-on-surface bg-surface-card p-6 shadow-[5px_5px_0px_#111111] flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-on-surface pb-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[22px] text-on-surface">model_training</span>
          <h3 class="font-display text-xl font-extrabold uppercase tracking-tight text-on-surface">
            ML MODEL IMPACT SUMMARY (${result.model_impact.model_name})
          </h3>
        </div>
        <div class="flex items-center gap-2 font-mono text-xs font-bold">
          <span class="bg-primary-container px-2 py-0.5 border border-on-surface uppercase">TARGET: ${result.model_impact.target_column}</span>
          <span class="${result.model_impact.verdict === 'PERFORMANCE DECREASE OBSERVED' ? 'bg-[#FF5277]' : 'bg-[#00D26A]'} px-2 py-0.5 border border-on-surface uppercase">${result.model_impact.verdict}</span>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-center">
        <div class="border-2 border-on-surface bg-white p-3">
          <div class="text-xs uppercase text-on-surface/70 font-bold">HOLDOUT F1</div>
          <div class="text-2xl font-black text-on-surface mt-1">${result.model_impact.reference_metrics ? (result.model_impact.reference_metrics.f1_score * 100).toFixed(1) : 0}%</div>
          <div class="text-[10px] text-on-surface/60">Macro-averaged</div>
        </div>
        <div class="border-2 border-on-surface bg-white p-3">
          <div class="text-xs uppercase text-on-surface/70 font-bold">CURRENT F1</div>
          <div class="text-2xl font-black text-on-surface mt-1">${result.model_impact.current_metrics ? (result.model_impact.current_metrics.f1_score * 100).toFixed(1) : 0}%</div>
          <div class="text-[10px] text-on-surface/60">Production batch</div>
        </div>
        <div class="border-2 border-on-surface bg-white p-3">
          <div class="text-xs uppercase text-on-surface/70 font-bold">F1 CHANGE</div>
          <div class="text-2xl font-black ${(result.model_impact.metric_changes_percentage_points?.f1_score ?? 0) < -5 ? 'text-[#ba1a1a]' : ((result.model_impact.metric_changes_percentage_points?.f1_score ?? 0) < 0 ? 'text-[#b58b00]' : 'text-[#008744]')} mt-1">
            ${result.model_impact.metric_changes_percentage_points?.f1_score !== undefined ? (result.model_impact.metric_changes_percentage_points.f1_score >= 0 ? '+' : '') + result.model_impact.metric_changes_percentage_points.f1_score.toFixed(2) + ' pp' : 'N/A'}
          </div>
          <div class="text-[10px] text-on-surface/60">Percentage points</div>
        </div>
        <div class="border-2 border-on-surface bg-white p-3">
          <div class="text-xs uppercase text-on-surface/70 font-bold">ACCURACY CHANGE</div>
          <div class="text-2xl font-black ${(result.model_impact.metric_changes_percentage_points?.accuracy ?? 0) < -5 ? 'text-[#ba1a1a]' : ((result.model_impact.metric_changes_percentage_points?.accuracy ?? 0) < 0 ? 'text-[#b58b00]' : 'text-[#008744]')} mt-1">
            ${result.model_impact.metric_changes_percentage_points?.accuracy !== undefined ? (result.model_impact.metric_changes_percentage_points.accuracy >= 0 ? '+' : '') + result.model_impact.metric_changes_percentage_points.accuracy.toFixed(2) + ' pp' : 'N/A'}
          </div>
          <div class="text-[10px] text-on-surface/60">Ref: ${result.model_impact.reference_metrics ? (result.model_impact.reference_metrics.accuracy * 100).toFixed(1) + '%' : 'N/A'} → Cur: ${result.model_impact.current_metrics ? (result.model_impact.current_metrics.accuracy * 100).toFixed(1) + '%' : 'N/A'}</div>
        </div>
      </div>
      <p class="font-body text-sm font-semibold text-on-surface/80 m-0">
        ${result.model_impact.interpretation || ''}
      </p>
    </div>
    ` : `
    <div class="border-[2.5px] border-dashed border-on-surface/50 bg-[#FAF7EE] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-on-surface/60">model_training</span>
        <span class="font-mono text-xs font-bold uppercase text-on-surface/70">ML MODEL IMPACT: NOT EVALUATED IN LATEST ANALYSIS</span>
      </div>
      <a href="#/analyze" class="font-mono text-xs font-extrabold uppercase bg-white border border-on-surface px-3 py-1 shadow-[2px_2px_0px_#111111] hover:bg-brand-yellow transition-all">
        CONFIGURE IN ANALYZE →
      </a>
    </div>
    `}


    <!-- Feature Drift Table -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="font-display text-xl font-extrabold uppercase tracking-tight text-on-surface">
          FEATURE DRIFT EVALUATION
        </h3>
        <span class="font-mono text-xs font-bold uppercase bg-brand-gray border-2 border-on-surface px-2.5 py-1">
          SORTED BY PSI (DESCENDING)
        </span>
      </div>
      <div class="w-full bg-surface-card border-[3.5px] border-on-surface shadow-[6px_6px_0px_#111111] overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[620px]">
          <thead>
            <tr class="bg-brand-gray border-b-[3px] border-on-surface font-mono text-xs font-black uppercase text-on-surface">
              <th class="py-3 px-5 border-r-[2.5px] border-on-surface tracking-wider">FEATURE</th>
              <th class="py-3 px-5 border-r-[2.5px] border-on-surface tracking-wider text-right">PSI</th>
              <th class="py-3 px-5 border-r-[2.5px] border-on-surface tracking-wider">STATUS</th>
              <th class="py-3 px-5 tracking-wider">SEVERITY</th>
            </tr>
          </thead>
          <tbody class="font-mono text-sm divide-y-[2.5px] divide-on-surface">
            ${features.slice(0, 5).map(f => _renderDashboardRow(f)).join('')}
          </tbody>
        </table>
        ${features.length > 5 ? `<div class="p-3 text-center border-t-[2.5px] border-on-surface font-mono text-xs font-bold bg-[#FAF7EE]"><a href="#/results" class="hover:underline">VIEW ALL ${features.length} FEATURES →</a></div>` : ''}
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-wrap items-center gap-4 pt-2 pb-6">
      <a class="w-full sm:w-auto text-center bg-brand-yellow text-on-surface border-[3px] border-on-surface font-display font-black text-sm uppercase px-8 py-3.5 shadow-[4px_4px_0px_#111111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#111111] transition-all" href="#/analyze">
        [ ANALYZE NEW DATA → ]
      </a>
      <a class="w-full sm:w-auto text-center bg-white text-on-surface border-[3px] border-on-surface font-display font-black text-sm uppercase px-8 py-3.5 shadow-[4px_4px_0px_#111111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#111111] transition-all" href="#/results">
        [ VIEW DETAILED RESULTS → ]
      </a>
    </div>
  </div>

  ${renderFooter()}
</main>`;
}

function _renderDashboardRow(f) {
  const primaryMetric = f.type === 'numeric' ? f.psi : f.js_divergence;
  let rowBg = 'bg-surface-card hover:bg-black/5';
  let psiColor = 'text-on-surface';
  let statusBadge = '';
  let severityBadge = '';

  if (f.status === 'DRIFT') {
    if (f.severity === 'CRITICAL') {
      rowBg = 'bg-[#FFF0F3] hover:bg-[#FFE0E6]';
      psiColor = 'text-brand-coral';
      statusBadge = '<span class="inline-block bg-on-surface text-brand-coral px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">DRIFT</span>';
      severityBadge = '<span class="inline-block bg-brand-coral text-on-surface border-2 border-on-surface px-2.5 py-0.5 text-xs font-black uppercase shadow-[1.5px_1.5px_0px_#111111]">CRITICAL</span>';
    } else {
      rowBg = 'bg-[#FFF9DE] hover:bg-[#FFF4C2]';
      statusBadge = '<span class="inline-block bg-on-surface text-brand-yellow px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">DRIFT</span>';
      severityBadge = '<span class="inline-block bg-brand-yellow text-on-surface border-2 border-on-surface px-2.5 py-0.5 text-xs font-black uppercase shadow-[1.5px_1.5px_0px_#111111]">HIGH</span>';
    }
  } else if (f.status === 'WARNING') {
    statusBadge = '<span class="inline-block bg-brand-gray text-on-surface border border-on-surface px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">WARNING</span>';
    severityBadge = '<span class="inline-block bg-brand-gray text-on-surface border-2 border-on-surface px-2.5 py-0.5 text-xs font-black uppercase shadow-[1.5px_1.5px_0px_#111111]">MODERATE</span>';
  } else {
    statusBadge = '<span class="inline-block bg-brand-green/20 text-brand-green border border-on-surface px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">STABLE</span>';
    severityBadge = '<span class="inline-block bg-brand-green text-on-surface border-2 border-on-surface px-2.5 py-0.5 text-xs font-black uppercase shadow-[1.5px_1.5px_0px_#111111]">' + f.severity + '</span>';
  }

  return `
    <tr class="${rowBg} transition-colors">
      <td class="py-3.5 px-5 border-r-[2.5px] border-on-surface font-bold text-on-surface">${f.name}</td>
      <td class="py-3.5 px-5 border-r-[2.5px] border-on-surface font-black text-right ${psiColor} text-base">${(f.type === 'numeric' ? 'PSI ' : 'JS ') + primaryMetric.toFixed(3)}</td>
      <td class="py-3.5 px-5 border-r-[2.5px] border-on-surface">${statusBadge}</td>
      <td class="py-3.5 px-5">${severityBadge}</td>
    </tr>`;
}
