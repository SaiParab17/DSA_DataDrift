import { renderHome }      from './pages/home.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderAnalyze }   from './pages/analyze.js';
import { renderResults }   from './pages/results.js';
import {
  analyzeDrift,
  checkBackendHealth,
  fetchAnalysisRuns,
  fetchAnalysisRunById,
} from './api/client.js';
import state, { persistResult } from './state/store.js';

const pageContext = Object.freeze({
  api: Object.freeze({
    analyzeDrift,
    checkBackendHealth,
    fetchAnalysisRuns,
    fetchAnalysisRunById,
  }),
  store: Object.freeze({
    state,
    persistResult,
  }),
});

const root = document.getElementById('app-root');

function getRoute() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/dashboard')) return 'dashboard';
  if (hash.startsWith('#/analyze'))   return 'analyze';
  if (hash.startsWith('#/results'))   return 'results';
  return 'home';
}

function navigate() {
  root.classList.add('fade-out');
  setTimeout(() => {
    const route = getRoute();
    switch (route) {
      case 'dashboard': root.innerHTML = renderDashboard(); break;
      case 'analyze':   root.innerHTML = renderAnalyze();   break;
      case 'results':   root.innerHTML = renderResults();   break;
      default:          root.innerHTML = renderHome();       break;
    }
    // Re-run page-specific scripts with bundled runtime modules injected
    const scripts = root.querySelectorAll('script[data-page]');
    scripts.forEach(s => {
      const fn = new Function('__dw', s.textContent); // eslint-disable-line no-new-func
      fn(pageContext);
    });
    root.classList.remove('fade-out');
    window.scrollTo(0, 0);
    updateNavActive(route);
  }, 80);
}

function updateNavActive(route) {
  document.querySelectorAll('[data-nav-link]').forEach(link => {
    const linkRoute = link.getAttribute('data-nav-link');
    const isActive  = linkRoute === route;
    if (isActive) {
      link.classList.add('bg-primary-container','text-on-surface','border-[2px]','border-on-surface','shadow-[2px_2px_0px_#1c1b1b]','font-bold');
      link.classList.remove('text-on-surface-variant','font-code-md','text-code-md');
    } else {
      link.classList.remove('bg-primary-container','text-on-surface','border-[2px]','border-on-surface','shadow-[2px_2px_0px_#1c1b1b]','font-bold');
      link.classList.add('text-on-surface-variant','font-code-md','text-code-md');
    }
  });
}

window.__dwNavigate = navigate;
window.addEventListener('hashchange', navigate);
navigate();
