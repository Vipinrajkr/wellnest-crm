// ui/shell/theme.js
// Applies the persisted theme (light/dark) to the document root via a
// data attribute. styles/tokens.css defines dark-mode variable overrides
// scoped to [data-theme="dark"], so every screen re-themes automatically
// since all colors already flow through CSS variables — no per-component
// dark-mode styles needed. Called once on app bootstrap (from the
// settings record) and again immediately whenever Settings saves a new
// theme, for a live preview without a full reload.

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}
