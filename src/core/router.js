// core/router.js
// Minimal hash-based router with basic dynamic segment support
// (e.g. '/clients/edit/:id'). No business logic — just maps a path
// pattern to a render function and swaps the content outlet's contents.

const routes = [];
let outletEl = null;

/**
 * Register a screen's render function against a path pattern.
 * Supports static paths ('/dashboard') and dynamic segments
 * ('/clients/edit/:id').
 * @param {string} pattern
 * @param {(container: HTMLElement, params: Record<string,string>) => void} renderFn
 */
export function registerRoute(pattern, renderFn) {
  routes.push({ pattern, regex: compilePattern(pattern), renderFn });
}

/**
 * Start the router. Renders whatever the current hash points to,
 * falling back to defaultPath if no hash is set.
 * @param {HTMLElement} outlet
 * @param {string} defaultPath
 */
export function initRouter(outlet, defaultPath = '/dashboard') {
  outletEl = outlet;

  window.addEventListener('hashchange', handleHashChange);

  if (!window.location.hash) {
    window.location.hash = defaultPath;
  } else {
    handleHashChange();
  }
}

/**
 * Navigate to a path. If already on that path, re-renders it
 * (useful for the FAB always landing on a fresh "Add Client" screen).
 * @param {string} path
 */
export function navigate(path) {
  const activePath = window.location.hash.replace('#', '');
  if (activePath === path) {
    renderRoute(path);
  } else {
    window.location.hash = path;
  }
}

function handleHashChange() {
  const path = window.location.hash.replace('#', '') || '/dashboard';
  renderRoute(path);
}

function renderRoute(path) {
  if (!outletEl) return;
  outletEl.innerHTML = '';

  const match = matchRoute(path);
  if (match) {
    match.route.renderFn(outletEl, match.params);
  } else {
    outletEl.innerHTML = '<div class="screen-placeholder">Screen not found.</div>';
  }

  document.dispatchEvent(
    new CustomEvent('route:changed', { detail: { path } })
  );
}

function matchRoute(path) {
  for (const route of routes) {
    const result = route.regex.exec(path);
    if (result) {
      return { route, params: result.groups || {} };
    }
  }
  return null;
}

function compilePattern(pattern) {
  const escaped = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        return `(?<${segment.slice(1)}>[^/]+)`;
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${escaped}$`);
}
