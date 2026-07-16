// ui/programs/programsPanel.js
// Renders a client's programs: an "Add Program" form, active program
// cards with auto progress + Renew/Complete actions, and a History
// section for completed/renewed/expired programs. Mounted inside
// ui/clients/clientDetailScreen.js.

import { on } from '../../core/eventBus.js';
import { getState } from '../../state/store.js';
import {
  loadProgramsForClient,
  addProgram,
  completeProgramAction,
  renewProgramAction,
} from '../../state/actions/programsActions.js';
import { PROGRAM_STATUS, PROGRAM_STATUS_LABELS } from '../../domain/programs/programRules.js';
import { renderLedgerPanel } from '../payments/ledgerPanel.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';

let unsubscribe = null;
let formVisible = false;
// Tracks whether real content (not a loading/error placeholder) has been
// shown yet for the current mount — once true, a later loading/error tick
// (e.g. from Complete/Renew re-fetching the list) never hides already-
// visible cards behind a spinner, matching dashboardScreen.js's approach.
let hasRenderedContent = false;
const expandedLedgerIds = new Set();

export async function renderProgramsPanel(container, clientId) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  formVisible = false;
  hasRenderedContent = false;

  container.innerHTML = `
    <div class="programs-panel">
      <div class="programs-panel__toolbar">
        <button type="button" class="button button--primary" id="add-program-button">Add Program</button>
      </div>
      <div id="program-form-mount"></div>
      <div class="programs-panel__list" id="programs-list"></div>
    </div>
  `;

  const addButton = container.querySelector('#add-program-button');
  const formMount = container.querySelector('#program-form-mount');
  const listMount = container.querySelector('#programs-list');

  addButton.addEventListener('click', () => {
    formVisible = !formVisible;
    renderForm(formMount, clientId, addButton);
  });

  unsubscribe = on('state:programs', (programsState) => {
    if (programsState.clientId === clientId) {
      renderList(listMount, programsState, clientId);
    }
  });

  renderList(listMount, getState('programs'), clientId);

  await loadProgramsForClient(clientId);
}

function renderForm(formMount, clientId, addButton) {
  if (!formVisible) {
    formMount.innerHTML = '';
    addButton.textContent = 'Add Program';
    return;
  }

  addButton.textContent = 'Cancel';
  formMount.innerHTML = `
    <form class="program-form" id="program-form" novalidate>
      <div class="client-form__error" id="program-form-error" hidden></div>

      <label class="client-form__field">
        <span>Program *</span>
        <input type="text" name="name" required />
        <span class="client-form__field-error" data-error-for="name"></span>
      </label>

      <div class="program-form__dates">
        <label class="client-form__field">
          <span>Start *</span>
          <input type="date" name="startDate" required />
          <span class="client-form__field-error" data-error-for="startDate"></span>
        </label>

        <label class="client-form__field">
          <span>End *</span>
          <input type="date" name="endDate" required />
          <span class="client-form__field-error" data-error-for="endDate"></span>
        </label>
      </div>

      <label class="client-form__field">
        <span>Goal *</span>
        <textarea name="goal" rows="2"></textarea>
        <span class="client-form__field-error" data-error-for="goal"></span>
      </label>

      <div class="program-form__fees">
        <label class="client-form__field">
          <span>Program Fee</span>
          <input type="number" name="fee" min="0" step="0.01" value="0" />
          <span class="client-form__field-error" data-error-for="fee"></span>
        </label>

        <label class="client-form__field">
          <span>Discount</span>
          <input type="number" name="discount" min="0" step="0.01" value="0" />
          <span class="client-form__field-error" data-error-for="discount"></span>
        </label>
      </div>

      <div class="client-form__actions">
        <button type="submit" class="button button--primary">Save Program</button>
      </div>
    </form>
  `;

  const form = formMount.querySelector('#program-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const formData = new FormData(form);
    const values = { ...Object.fromEntries(formData.entries()), clientId };

    const result = await addProgram(values);
    if (result.success) {
      formVisible = false;
      renderForm(formMount, clientId, addButton);
    } else {
      showErrors(form, result.errors);
    }
  });
}

function renderList(listMount, programsState, clientId) {
  if (!programsState || programsState.clientId !== clientId) {
    return;
  }

  if (programsState.loading && !hasRenderedContent) {
    listMount.innerHTML = renderLoadingState('Loading programs…');
    return;
  }

  if (programsState.error && !hasRenderedContent) {
    listMount.innerHTML = renderErrorState(programsState.error);
    wireRetry(listMount, () => loadProgramsForClient(clientId));
    return;
  }

  hasRenderedContent = true;
  const items = programsState.items || [];

  if (!items.length) {
    listMount.innerHTML = `
      <div class="fade-in">
        <div class="screen-placeholder">
          <span class="screen-placeholder__icon" aria-hidden="true">&#128203;</span>
          <span>No programs yet for this client.</span>
        </div>
      </div>
    `;
    return;
  }

  const active = items.filter(
    (program) => program.effectiveStatus === PROGRAM_STATUS.ACTIVE || program.effectiveStatus === PROGRAM_STATUS.EXPIRED
  );
  const history = items.filter(
    (program) => program.effectiveStatus === PROGRAM_STATUS.COMPLETED || program.effectiveStatus === PROGRAM_STATUS.RENEWED
  );

  listMount.innerHTML = `
    <div class="fade-in">
      ${
        active.length
          ? `<div class="program-cards">${active.map((program) => renderProgramCard(program)).join('')}</div>`
          : `
            <div class="screen-placeholder">
              <span class="screen-placeholder__icon" aria-hidden="true">&#10003;</span>
              <span>No active programs.</span>
            </div>
          `
      }
      ${
        history.length
          ? `
            <h3 class="programs-panel__history-title">History</h3>
            <ul class="program-history">
              ${history.map((program) => renderHistoryRow(program)).join('')}
            </ul>
          `
          : ''
      }
    </div>
  `;

  listMount.querySelectorAll('[data-complete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      completeProgramAction(Number(button.dataset.completeId), clientId);
    });
  });

  listMount.querySelectorAll('[data-renew-id]').forEach((button) => {
    button.addEventListener('click', () => {
      renewProgramAction(Number(button.dataset.renewId), clientId);
    });
  });

  active.forEach((program) => {
    const toggleButton = listMount.querySelector(`[data-ledger-toggle="${program.id}"]`);
    const ledgerMount = listMount.querySelector(`[data-ledger-mount="${program.id}"]`);
    if (!toggleButton || !ledgerMount) return;

    toggleButton.addEventListener('click', () => {
      if (expandedLedgerIds.has(program.id)) {
        expandedLedgerIds.delete(program.id);
        ledgerMount.innerHTML = '';
        toggleButton.textContent = 'Ledger';
      } else {
        expandedLedgerIds.add(program.id);
        toggleButton.textContent = 'Hide Ledger';
        renderLedgerPanel(ledgerMount, { program, clientId });
      }
    });

    if (expandedLedgerIds.has(program.id)) {
      toggleButton.textContent = 'Hide Ledger';
      renderLedgerPanel(ledgerMount, { program, clientId });
    }
  });
}

function renderProgramCard(program) {
  return `
    <div class="program-card">
      <div class="program-card__header">
        <span class="program-card__name">${escapeHtml(program.name)}</span>
        <span class="status-badge status-badge--${program.effectiveStatus}">${PROGRAM_STATUS_LABELS[program.effectiveStatus] || program.effectiveStatus}</span>
      </div>
      <div class="program-card__dates">
        ${formatDate(program.startDate)} &ndash; ${formatDate(program.endDate)}
        (${program.durationDays ?? '—'} days)
      </div>
      <div class="program-card__goal">${escapeHtml(program.goal)}</div>
      <div class="program-progress" role="progressbar" aria-valuenow="${program.progressPercent}" aria-valuemin="0" aria-valuemax="100">
        <div class="program-progress__bar" style="width: ${program.progressPercent}%"></div>
      </div>
      <div class="program-progress__label">${program.progressPercent}% elapsed</div>
      <div class="program-card__fees" aria-live="polite">
        <span>Fee ₹${program.ledgerSummary.fee.toFixed(2)}</span>
        <span>Paid ₹${program.ledgerSummary.paid.toFixed(2)}</span>
        <span class="program-card__fees-pending">Pending ₹${program.ledgerSummary.pending.toFixed(2)}</span>
      </div>
      <div class="program-card__actions">
        <button type="button" class="button button--ghost" data-ledger-toggle="${program.id}">Ledger</button>
        <button type="button" class="button button--ghost" data-complete-id="${program.id}">Complete</button>
        <button type="button" class="button button--primary" data-renew-id="${program.id}">Renew</button>
      </div>
      <div class="program-card__ledger-mount" data-ledger-mount="${program.id}"></div>
    </div>
  `;
}

function renderHistoryRow(program) {
  return `
    <li class="program-history__row">
      <span class="program-history__name">${escapeHtml(program.name)}</span>
      <span class="program-history__dates">${formatDate(program.startDate)} &ndash; ${formatDate(program.endDate)}</span>
      <span class="program-history__pending">${program.ledgerSummary.pending > 0 ? `Pending ₹${program.ledgerSummary.pending.toFixed(2)}` : 'Paid in full'}</span>
      <span class="status-badge status-badge--${program.effectiveStatus}">${PROGRAM_STATUS_LABELS[program.effectiveStatus] || program.effectiveStatus}</span>
    </li>
  `;
}

function clearErrors(form) {
  form.querySelectorAll('.client-form__field-error').forEach((el) => {
    el.textContent = '';
  });
  const globalError = form.querySelector('#program-form-error');
  if (globalError) {
    globalError.hidden = true;
    globalError.textContent = '';
  }
}

function showErrors(form, errors = {}) {
  Object.entries(errors).forEach(([field, message]) => {
    if (field === '_global') {
      const globalError = form.querySelector('#program-form-error');
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
