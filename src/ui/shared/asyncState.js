// ui/shared/asyncState.js
// Shared loading/error state markup so every screen renders a consistent
// spinner/error-banner (styles/base.css's .loading-state/.spinner/
// .error-banner) instead of bespoke per-screen markup — pure view helpers,
// no state/domain imports. Cross-feature primitive, like clientForm.js's
// escapeHtml or the .button/.status-badge classes other screens reuse.

export function renderLoadingState(message = 'Loading…') {
  return `
    <div class="loading-state" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

/**
 * @param {string} message
 * @param {{ retryId?: string }} [options]
 */
export function renderErrorState(message = 'Something went wrong. Please try again.', options = {}) {
  const retryId = options.retryId || 'retry-button';
  return `
    <div class="error-banner" role="alert">
      <span class="error-banner__icon" aria-hidden="true">&#9888;</span>
      <span class="error-banner__message">${escapeHtml(message)}</span>
      <button type="button" class="button button--ghost" id="${retryId}">Retry</button>
    </div>
  `;
}

/** Wires the Retry button rendered by renderErrorState() inside container. */
export function wireRetry(container, onRetry, retryId = 'retry-button') {
  const button = container.querySelector(`#${retryId}`);
  if (button) button.addEventListener('click', onRetry);
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
