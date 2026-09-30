export function renderNav(activePage) {
  const navLinks = [
    { label: 'Home',      path: 'home',      href: '#/' },
    { label: 'Dashboard', path: 'dashboard', href: '#/dashboard' },
    { label: 'Analyze',   path: 'analyze',   href: '#/analyze' },
    { label: 'Results',   path: 'results',   href: '#/results' },
  ];

  const navHTML = navLinks.map(link => {
    const isActive = link.path === activePage;
    const activeClasses = isActive
      ? 'bg-primary-container text-on-surface border-[2px] border-on-surface shadow-[2px_2px_0px_#1c1b1b] font-bold'
      : 'font-code-md text-code-md text-on-surface-variant hover:-translate-x-0.5 hover:-translate-y-0.5';
    return `<a href="${link.href}" data-nav-link="${link.path}" aria-current="${isActive ? 'page' : 'false'}"
      class="px-space-md py-space-xs uppercase transition-transform ${activeClasses}">${link.label}</a>`;
  }).join('');

  return `
  <header class="fixed top-0 left-0 w-full z-50 bg-[#FAF7EE] border-b-[3px] border-on-surface" id="main-header">
    <div class="h-20 w-full px-gutter flex items-center justify-between">
      <!-- Brand -->
      <div class="flex items-center gap-space-lg">
        <div class="flex items-center gap-space-sm">
          <svg class="h-8 w-auto" viewBox="0 0 240 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="56" height="56" fill="#FFE600" stroke="#1c1b1b" stroke-width="3"/>
            <rect x="14" y="14" width="32" height="32" fill="none" stroke="#1c1b1b" stroke-width="3"/>
            <line x1="18" y1="18" x2="42" y2="42" stroke="#1c1b1b" stroke-width="3"/>
            <line x1="42" y1="18" x2="18" y2="42" stroke="#1c1b1b" stroke-width="3"/>
          </svg>
          <span class="font-headline-md text-headline-md tracking-tight text-on-surface uppercase">DataWatch</span>
        </div>
        <div class="hidden sm:inline-block border-2 border-on-surface bg-primary-container px-space-xs py-0.5 shadow-[2px_2px_0px_#1c1b1b]">
          <span class="font-label-caps text-label-caps uppercase text-on-surface font-bold">DRIFT_ENGINE::v2.4</span>
        </div>
      </div>

      <!-- Nav -->
      <nav class="hidden md:flex items-center gap-space-sm">
        ${navHTML}
      </nav>

      <!-- Right Actions -->
      <div class="flex items-center gap-space-md">
        <a href="#/analyze"
           class="inline-flex items-center justify-center bg-primary-container text-on-surface border-[3px] border-on-surface font-headline-sm text-headline-sm uppercase px-space-md py-space-xs shadow-[4px_4px_0px_#1c1b1b] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1c1b1b] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-75">
          ANALYZE DATA →
        </a>
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-on-surface">
          <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
        </div>
      </div>
    </div>
  </header>`;
}

export function renderFooter() {
  return `
  <footer class="w-full bg-[#FAF7EE] border-t-[3px] border-on-surface py-space-lg">
    <div class="w-full px-gutter flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md font-code-sm text-code-sm">
      <div class="flex flex-col gap-space-xs">
        <div class="font-bold tracking-wider text-on-surface uppercase">DATAWATCH — STATISTICAL DRIFT &amp; DATASET MONITORING PLATFORM</div>
        <div class="text-on-surface-variant">© 2025 DATAWATCH INDUSTRIAL SYSTEMS. ALL RIGHTS RESERVED.</div>
      </div>
      <div class="flex flex-wrap items-center gap-space-md">
        <div class="inline-flex items-center gap-space-xs border-2 border-on-surface px-space-sm py-1 bg-surface shadow-[2px_2px_0px_#1c1b1b]">
          <span class="w-2 h-2 rounded-full bg-[#00D26A] border border-on-surface"></span>
          <span class="font-label-caps text-label-caps font-bold uppercase text-on-surface">SYSTEM ACTIVE</span>
        </div>
        <div class="inline-flex items-center gap-space-xs border-2 border-on-surface px-space-sm py-1 bg-surface shadow-[2px_2px_0px_#1c1b1b]">
          <span class="font-label-caps text-label-caps uppercase text-on-surface">FASTAPI ENGINE CONNECTED</span>
        </div>
      </div>
    </div>
  </footer>`;
}
