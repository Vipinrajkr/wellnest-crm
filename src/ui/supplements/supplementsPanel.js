// ui/supplements/supplementsPanel.js
// Renders a client's supplements: an "Add Supplement" form, active
// supplement cards, and a History section for completed/discontinued
// entries. Mounted inside ui/clients/clientDetailScreen.js.

import { on } from '../../core/eventBus.js';
import { getState } from '../../state/store.js';
import {
  loadSupplementsForClient,
  addSupplement,
  completeSupplementAction,
  discontinueSupplementAction,
} from '../../state/actions/supplementsActions.js';
import { SUPPLEMENT_STATUS, SUPPLEMENT_STATUS_LABELS } from '../../domain/supplements/supplementRules.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';

let unsubscribe = null;
let formVisible = false;
// Same "don't hide already-visible data behind a spinner" gate used in
// programsPanel.js/dashboardScreen.js.
let hasRenderedContent = false;

export async function renderSupplementsPanel(container, clientId) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  formVisible = false;
  hasRenderedContent = false;

  container.innerHTML = `
    <div class="supplements-panel">
      <div class="supplements-panel__toolbar">
        <button type="button" class="button button--primary" id="add-supplement-button">Add Supplement</button>
      </div>
      <div id="supplement-form-mount"></div>
      <div class="supplements-panel__list" id="supplements-list"></div>
    </div>
  `;

  const addButton = container.querySelector('#add-supplement-button');
  const formMount = container.querySelector('#supplement-form-mount');
  const listMount = container.querySelector('#supplements-list');

  addButton.addEventListener('click', () => {
    formVisible = !formVisible;
    renderForm(formMount, clientId, addButton);
  });

  unsubscribe = on('state:supplements', (supplementsState) => {
    if (supplementsState.clientId === clientId) {
      renderList(listMount, supplementsState, clientId);
    }
  });

  renderList(listMount, getState('supplements'), clientId);

  await loadSupplementsForClient(clientId);
}

function renderForm(formMount, clientId, addButton) {
  if (!formVisible) {
    formMount.innerHTML = '';
    addButton.textContent = 'Add Supplement';
    return;
  }

  addButton.textContent = 'Cancel';
  formMount.innerHTML = `
    <form class="supplement-form" id="supplement-form" novalidate>
      <div class="client-form__error" id="supplement-form-error" hidden></div>

      <label class="client-form__field">
        <span>Name *</span>
        <input type="text" name="name" required />
        <span class="client-form__field-error" data-error-for="name"></span>
      </label>

      <label class="client-form__field">
        <span>Brand</span>
        <input type="text" name="brand" />
      </label>

      <div class="supplement-form__row">
        <label class="client-form__field">
          <span>Dosage *</span>
          <input type="text" name="dosage" placeholder="e.g. 500mg" required />
          <span class="client-form__field-error" data-error-for="dosage"></span>
        </label>

        <label class="client-form__field">
          <span>Frequency *</span>
          <input type="text" name="frequency" placeholder="e.g. Twice daily" required />
          <span class="client-form__field-error" data-error-for="frequency"></span>
        </label>
      </div>

      <div class="supplement-form__row">
        <label class="client-form__field">
          <span>Start *</span>
          <input type="date" name="startDate" required />
          <span class="client-form__field-error" data-error-for="startDate"></span>
        </label>

        <label class="client-form__field">
          <span>End</span>
          <input type="date" name="endDate" />
          <span class="client-form__field-error" data-error-for="endDate"></span>
        </label>
      </div>

      <label class="client-form__field">
        <span>Instructions</span>
        <textarea name="instructions" rows="2" placeholder="e.g. Take with food"></textarea>
      </label>

      <div class="client-form__actions">
        <button type="submit" class="button button--primary">Save Supplement</button>
      </div>
    </form>
  `;

  const form = formMount.querySelector('#supplement-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const formData = new FormData(form);
    const values = { ...Object.fromEntries(formData.entries()), clientId };

    const result = await addSupplement(values);
    if (result.success) {
      formVisible = false;
      renderForm(formMount, clientId, addButton);
    } else {
      showErrors(form, result.errors);
    }
  });
}

function renderList(listMount, supplementsState, clientId) {
  if (!supplementsState || supplementsState.clientId !== clientId) {
    return;
  }

  if (supplementsState.loading && !hasRenderedContent) {
    listMount.innerHTML = renderLoadingState('Loading supplements…');
    return;
  }

  if (supplementsState.error && !hasRenderedContent) {
    listMount.innerHTML = renderErrorState(supplementsState.error);
    wireRetry(listMount, () => loadSupplementsForClient(clientId));
    return;
  }

  hasRenderedContent = true;
  const items = supplementsState.items || [];

  if (!items.length) {
    listMount.innerHTML = `
      <div class="fade-in">
        <div class="screen-placeholder">
          <span class="screen-placeholder__icon" aria-hidden="true">&#128138;</span>
          <span>No supplements recorded for this client.</span>
        </div>
      </div>
    `;
    return;
  }

  const active = items.filter((supplement) => supplement.status === SUPPLEMENT_STATUS.ACTIVE);
  const history = items.filter((supplement) => supplement.status !== SUPPLEMENT_STATUS.ACTIVE);

  listMount.innerHTML = `
    <div class="fade-in">
      ${
        active.length
          ? `<div class="supplement-cards">${active.map((supplement) => renderSupplementCard(supplement)).join('')}</div>`
          : `
            <div class="screen-placeholder">
              <span class="screen-placeholder__icon" aria-hidden="true">&#10003;</span>
              <span>No active supplements.</span>
            </div>
          `
      }
      ${
        history.length
          ? `
            <h3 class="supplements-panel__history-title">History</h3>
            <ul class="supplement-history">
              ${history.map((supplement) => renderHistoryRow(supplement)).join('')}
            </ul>
          `
          : ''
      }
    </div>
  `;

  listMount.querySelectorAll('[data-complete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      completeSupplementAction(Number(button.dataset.completeId), clientId);
    });
  });

  listMount.querySelectorAll('[data-discontinue-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const confirmed = window.confirm('Discontinue this supplement?');
      if (confirmed) {
        discontinueSupplementAction(Number(button.dataset.discontinueId), clientId);
      }
    });
  });
}

function renderSupplementCard(supplement) {
  return `
    <div class="supplement-card">
      <div class="supplement-card__header">
        <span class="supplement-card__name">
          ${escapeHtml(supplement.name)}
          ${supplement.brand ? `<span class="supplement-card__brand">(${escapeHtml(supplement.brand)})</span>` : ''}
        </span>
        <span class="status-badge status-badge--${supplement.status}">${SUPPLEMENT_STATUS_LABELS[supplement.status] || supplement.status}</span>
      </div>
      <div class="supplement-card__meta">${escapeHtml(supplement.dosage)} &middot; ${escapeHtml(supplement.frequency)}</div>
      <div class="supplement-card__dates">
        ${formatDate(supplement.startDate)} &ndash; ${supplement.endDate ? formatDate(supplement.endDate) : 'Ongoing'}
        (${supplement.durationLabel})
      </div>
      ${supplement.instructions ? `<div class="supplement-card__instructions">${escapeHtml(supplement.instructions)}</div>` : ''}
      <div class="supplement-card__actions">
        <button type="button" class="button button--ghost" data-discontinue-id="${supplement.id}">Discontinue</button>
        <button type="button" class="button button--primary" data-complete-id="${supplement.id}">Complete</button>
      </div>
    </div>
  `;
}

function renderHistoryRow(supplement) {
  return `
    <li class="supplement-history__row">
      <span class="supplement-history__name">${escapeHtml(supplement.name)}</span>
      <span class="supplement-history__dates">${formatDate(supplement.startDate)} &ndash; ${supplement.endDate ? formatDate(supplement.endDate) : 'Ongoing'}</span>
      <span class="status-badge status-badge--${supplement.status}">${SUPPLEMENT_STATUS_LABELS[supplement.status] || supplement.status}</span>
    </li>
  `;
}

function clearErrors(form) {
  form.querySelectorAll('.client-form__field-error').forEach((el) => {
    el.textContent = '';
  });
  const globalError = form.querySelector('#supplement-form-error');
  if (globalError) {
    globalError.hidden = true;
    globalError.textContent = '';
  }
}

function showErrors(form, errors = {}) {
  Object.entries(errors).forEach(([field, message]) => {
    if (field === '_global') {
      const globalError = form.querySelector('#supplement-form-error');
      if (globalError) {
        globalError.hidden = false;
        globalError.textContent = message;
      }
      return;
    }
    const target = form.querySelector(`[data-error-for="${field}"]`);
    if (target) target.textContent = message;
  });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
