// ui/shell/appShell.js
// Renders the persistent app frame: content outlet, bottom navigation
// (side rail on wider screens), and the global "Add Client" FAB.
// Purely structural — no data, no validation, no storage access.

import { navigate } from '../../core/router.js';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: iconDashboard() },
  { path: '/clients', label: 'Clients', icon: iconClients() },
  { path: '/reports', label: 'Reports', icon: iconReports() },
  { path: '/settings', label: 'Settings', icon: iconSettings() },
];

/**
 * @param {HTMLElement} root - element to mount the shell into
 * @returns {{ contentOutlet: HTMLElement }}
 */
export function renderAppShell(root) {
  root.innerHTML = `
    <div class="app-shell">
      <main class="app-shell__content" id="content-outlet"></main>

      <button class="fab" id="fab-add-client" type="button" aria-label="Add Client">
        <span class="fab__icon" aria-hidden="true">+</span>
      </button>

      <nav class="bottom-nav" id="bottom-nav" aria-label="Primary"></nav>
    </div>
  `;

  const contentOutlet = root.querySelector('#content-outlet');
  const bottomNav = root.querySelector('#bottom-nav');
  const fab = root.querySelector('#fab-add-client');

  renderNavItems(bottomNav);

  bottomNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-path]');
    if (!button) return;
    navigate(button.dataset.path);
  });

  fab.addEventListener('click', () => {
    navigate('/clients/add');
  });

  document.addEventListener('route:changed', (event) => {
    setActiveNavItem(bottomNav, event.detail.path);
  });

  setActiveNavItem(bottomNav, window.location.hash.replace('#', '') || '/dashboard');

  return { contentOutlet };
}

function renderNavItems(navEl) {
  navEl.innerHTML = NAV_ITEMS.map(
    (item) => `
      <button class="bottom-nav__item" data-path="${item.path}" type="button">
        <span class="bottom-nav__icon" aria-hidden="true">${item.icon}</span>
        <span class="bottom-nav__label">${item.label}</span>
      </button>
    `
  ).join('');
}

function setActiveNavItem(navEl, path) {
  // Nested routes (e.g. /clients/add) still highlight the /clients tab.
  const topLevelPath = '/' + path.split('/')[1];
  navEl.querySelectorAll('[data-path]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.path === topLevelPath);
  });
}

function svgIcon(path) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="${path}"/></svg>`;
}

function iconDashboard() {
  return svgIcon('M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z');
}

function iconClients() {
  return svgIcon(
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05C16.16 13.87 17 15 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'
  );
}

function iconReports() {
  return svgIcon('M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z');
}

function iconSettings() {
  return svgIcon(
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 00-.61.22L1.64 8.86a.5.5 0 00.12.64l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.14.24.4.32.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.48 0 .61-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.01-1.58zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z'
  );
}
