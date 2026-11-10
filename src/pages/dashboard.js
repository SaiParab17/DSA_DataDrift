import { renderNav, renderFooter } from '../components/nav.js';
import state from '../state/store.js';

export function renderDashboard() {
  const result = state.latestResult;
  const hasDrift = result?.overall_status === 'DRIFT_DETECTED';
  const features = result?.features || [];
  const firstFeature = features[0] || null;

  return `
${renderNav('dashboard')}
<main class="w-full pt-20 flex-1 flex flex-col justify-between min-h-screen bg-surface">
  <div class="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-8 md:py-10 flex flex-col gap-8">

    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-[3px] border-on-surface bg-surface-card p-6 shadow-[5px_5px_0px_#111111]">
      <div class="flex flex-col gap-1">
        <div class="font-mono text-xs font-bold text-on-surface/60 uppercase tracking-widest">MONITORING CONSOLE</div>
        <h1 class="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-on-surface">
          DATA DRIFT MONITORING
        </h1>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <a class="bg-brand-yellow text-on-surface border-[3px] border-on-surface font-display font-black text-xs uppercase px-5 py-2.5 shadow-[3px_3px_0px_#111111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#111111] transition-all" href="#/analyze">
          + NEW ANALYSIS
        </a>
      </div>
    </div>

    ${result ? `
    <!-- Verdict Card (Latest Session Run) -->
    <div class="border-[3.5px] border-on-surface ${hasDrift ? 'bg-brand-coral' : 'bg-brand-green'} p-6 sm:p-8 shadow-[6px_6px_0px_#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      <div class="flex flex-col gap-3">
        <div class="inline-flex items-center gap-2 bg-on-surface text-white px-3 py-1 font-mono text-xs font-bold tracking-widest uppercase self-start">
          <span class="material-symbols-outlined text-[16px] ${hasDrift ? 'text-brand-yellow' : 'text-brand-green'}">${hasDrift ? 'warning' : 'check_circle'}</span>
          LATEST SESSION STATUS
        </div>
        <h2 class="font-display text-2xl sm:text-3xl font-extrabold text-on-surface uppercase tracking-tight">
          ${hasDrift ? 'DRIFT DETECTED' : 'SYSTEM STABLE'}
        </h2>
        <p class="font-body text-base sm:text-lg font-semibold text-on-surface leading-snug max-w-3xl">
          ${hasDrift 
            ? `${result.features_drifted} of ${result.features_analyzed} features exceed the ${result.psi_threshold} PSI threshold. Primary drift contributor:
               <strong class="underline decoration-on-surface decoration-2 underline-offset-4 font-mono font-bold">${firstFeature ? firstFeature.name + ' (PSI: ' + (firstFeature.psi !== null ? firstFeature.psi.toFixed(3) : 'N/A') + ')' : '—'}</strong>.`
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
      <div class="bg-surface-card border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface/70 pb-3 border-b-2 border-on-surface">FEATURES ANALYZED</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-on-surface leading-none">${result.features_analyzed}</div>
          <div class="font-mono text-xs font-bold text-on-surface/80 mt-2">100% evaluated</div>
        </div>
      </div>
      <div class="bg-brand-yellow border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface pb-3 border-b-2 border-on-surface">FEATURES DRIFTED</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-on-surface leading-none">${result.features_drifted}</div>
          <div class="font-mono text-xs font-bold text-on-surface mt-2">PSI &gt; ${result.psi_threshold}</div>
        </div>
      </div>
      <div class="bg-[#FFE5EC] border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface pb-3 border-b-2 border-on-surface">MAX PSI</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-brand-coral leading-none">${result.max_psi !== null && result.max_psi !== undefined ? Number(result.max_psi).toFixed(3) : 'N/A'}</div>
          <div class="font-mono text-xs font-bold text-on-surface/80 mt-2 truncate">${result.max_psi !== null && firstFeature ? firstFeature.name : 'No numeric features'}</div>
        </div>
      </div>
      <div class="bg-[#E6F9F0] border-[3px] border-on-surface p-5 shadow-[4px_4px_0px_#111111] flex flex-col justify-between">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-on-surface pb-3 border-b-2 border-on-surface">PSI THRESHOLD</div>
        <div class="my-4">
          <div class="font-mono text-5xl font-black text-brand-green leading-none">${result.psi_threshold}</div>
          <div class="font-mono text-xs font-bold text-on-surface/80 mt-2">Configured guardrail</div>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Historical Runs Section -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[24px] text-on-surface">history</span>
          <h2 class="font-display text-2xl font-extrabold uppercase tracking-tight text-on-surface">
            HISTORICAL ANALYSIS RUNS
          </h2>
        </div>
        <div class="flex items-center gap-2 font-mono text-xs font-bold text-on-surface/70">
          <span id="history-runs-count" class="bg-brand-gray border-2 border-on-surface px-2.5 py-1 uppercase">
            LOADING RUNS…
          </span>
        </div>
      </div>

      <!-- Table Container -->
      <div class="w-full bg-surface-card border-[3.5px] border-on-surface shadow-[6px_6px_0px_#111111] overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr class="bg-brand-gray border-b-[3px] border-on-surface font-mono text-xs font-black uppercase text-on-surface">
              <th class="py-3 px-4 border-r-[2.5px] border-on-surface tracking-wider">DATE / TIME</th>
              <th class="py-3 px-4 border-r-[2.5px] border-on-surface tracking-wider">REFERENCE (BASELINE)</th>
              <th class="py-3 px-4 border-r-[2.5px] border-on-surface tracking-wider">CURRENT (PROD)</th>
              <th class="py-3 px-4 border-r-[2.5px] border-on-surface tracking-wider text-center">STATUS</th>
              <th class="py-3 px-4 border-r-[2.5px] border-on-surface tracking-wider text-right">MAX PSI</th>
              <th class="py-3 px-4 border-r-[2.5px] border-on-surface tracking-wider text-right">QUALITY %</th>
              <th class="py-3 px-4 tracking-wider text-center">ACTION</th>
            </tr>
          </thead>
          <tbody id="history-runs-tbody" class="font-mono text-sm divide-y-[2.5px] divide-on-surface">
            <tr>
              <td colspan="7" class="py-12 text-center text-on-surface/60 font-mono text-sm font-bold">
                <span class="inline-block animate-pulse">CONNECTING TO DATABASE…</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
  ${renderFooter()}
</main>

<script data-page="dashboard">
(async function initDashboardHistory() {
  const tbody = document.getElementById('history-runs-tbody');
  const countBadge = document.getElementById('history-runs-count');

  try {
    const { fetchAnalysisRuns } = await import('/src/api/client.js');
    const runs = await fetchAnalysisRuns(20, 0);

    if (!runs || runs.length === 0) {
      if (countBadge) countBadge.textContent = '0 RUNS RECORDED';
      if (tbody) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="7" class="py-12 text-center text-on-surface font-mono">
              <div class="flex flex-col items-center gap-3">
                <span class="material-symbols-outlined text-[40px] text-on-surface/40">inventory_2</span>
                <span class="font-bold text-base uppercase">NO HISTORICAL RUNS FOUND</span>
                <span class="text-xs text-on-surface/70">Execute an analysis run to record persistent monitoring metrics.</span>
                <a href="#/analyze" class="mt-2 bg-brand-yellow text-on-surface border-2 border-on-surface font-mono font-bold text-xs uppercase px-4 py-2 shadow-[2px_2px_0px_#111111]">
                  [ START YOUR FIRST ANALYSIS → ]
                </a>
              </div>
            </td>
          </tr>\`;
      }
      return;
    }

    if (countBadge) countBadge.textContent = runs.length + ' RUNS RECORDED';

    if (tbody) {
      tbody.innerHTML = runs.map(run => {
        const isDrift = run.overall_status === 'DRIFT_DETECTED';
        const statusBadge = isDrift
          ? '<span class="inline-block bg-[#FF5277] text-on-surface border border-on-surface px-2 py-0.5 text-xs font-black uppercase shadow-[1.5px_1.5px_0px_#111111]">DRIFT</span>'
          : '<span class="inline-block bg-[#00D26A] text-on-surface border border-on-surface px-2 py-0.5 text-xs font-black uppercase shadow-[1.5px_1.5px_0px_#111111]">STABLE</span>';

        const rowBg = isDrift ? 'bg-[#FFF0F3] hover:bg-[#FFE0E6]' : 'bg-surface-card hover:bg-black/5';
        const dateStr = run.created_at ? new Date(run.created_at).toLocaleString() : 'N/A';
        const maxPsiStr = run.max_psi !== null && run.max_psi !== undefined ? Number(run.max_psi).toFixed(3) : 'N/A';
        const qualityStr = run.quality_success_percent !== null && run.quality_success_percent !== undefined 
          ? Number(run.quality_success_percent).toFixed(1) + '%' 
          : '—';

        return \`
          <tr class="\${rowBg} transition-colors">
            <td class="py-3 px-4 border-r-[2.5px] border-on-surface font-semibold text-xs whitespace-nowrap text-on-surface">\${dateStr}</td>
            <td class="py-3 px-4 border-r-[2.5px] border-on-surface font-bold text-on-surface truncate max-w-[200px]" title="\${run.reference_file}">\${run.reference_file}</td>
            <td class="py-3 px-4 border-r-[2.5px] border-on-surface font-bold text-on-surface truncate max-w-[200px]" title="\${run.current_file}">\${run.current_file}</td>
            <td class="py-3 px-4 border-r-[2.5px] border-on-surface text-center">\${statusBadge}</td>
            <td class="py-3 px-4 border-r-[2.5px] border-on-surface text-right font-black \${isDrift ? 'text-brand-coral' : 'text-on-surface'}">\${maxPsiStr}</td>
            <td class="py-3 px-4 border-r-[2.5px] border-on-surface text-right font-bold text-on-surface">\${qualityStr}</td>
            <td class="py-3 px-4 text-center">
              <a href="#/results?id=\${encodeURIComponent(run.id)}" class="inline-flex items-center gap-1 bg-brand-yellow text-on-surface border-2 border-on-surface font-mono font-bold text-xs uppercase px-3 py-1.5 shadow-[2px_2px_0px_#111111] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#111111] transition-all">
                VIEW →
              </a>
            </td>
          </tr>\`;
      }).join('');
    }
  } catch (err) {
    if (countBadge) countBadge.textContent = 'OFFLINE';
    if (tbody) {
      tbody.innerHTML = \`
        <tr>
          <td colspan="7" class="py-8 text-center text-[#ba1a1a] font-mono text-sm font-bold bg-[#FFE5EC]">
            ERROR LOADING RUNS: \${err.message || 'FastAPI backend unreachable'}. Ensure server is running on port 8000.
          </td>
        </tr>\`;
    }
  }
})();
</script>`;
}
