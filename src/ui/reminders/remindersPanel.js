// ui/reminders/remindersPanel.js
// Renders the unified reminders list (Followups, Payments, Program
// Ending, Supplement Ending) with Mark Done / Snooze actions. Mounted
// inside ui/dashboard/dashboardScreen.js.

import { navigate } from '../../core/router.js';
import { on } from '../../core/eventBus.js';
import { getState } from '../../state/store.js';
import { loadReminders, markReminderDoneAction, snoozeReminderAction } from '../../state/actions/remindersActions.js';
import { REMINDER_TYPE_LABELS } from '../../domain/reminders/reminderRules.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';

let unsubscribe = null;

export async function renderRemindersPanel(container) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  container.innerHTML = `
    <div class="reminders-panel">
      <div id="reminders-notice"></div>
      <div id="reminders-list"></div>
    </div>
  `;

  const noticeEl = container.querySelector('#reminders-notice');
  const listEl = container.querySelector('#reminders-list');

  unsubscribe = on('state:reminders', (remindersState) => {
    renderNotice(noticeEl, remindersState);
    renderList(listEl, remindersState);
  });

  renderNotice(noticeEl, getState('reminders'));
  renderList(listEl, getState('reminders'));

  await loadReminders();
}

function renderNotice(noticeEl, remindersState) {
  if (remindersState.notificationsSupported) {
    noticeEl.innerHTML = '';
    return;
  }
  noticeEl.innerHTML = `<div class="reminders-panel__notice">Android notifications aren't available in this preview — reminders still show here in-app, and will fire as device notifications once running inside the Capacitor Android app.</div>`;
}

function renderList(listEl, remindersState) {
  const { items, loading, error } = remindersState;

  // items is only null before the first load ever completes (see
  // state/store.js's initial reminders slice) — once loaded, it's always
  // an array, even an empty one, so a later loading/error state (e.g. a
  // background refresh after Mark Done) never hides an already-visible
  // list behind a spinner.
  if (loading && items === null) {
    listEl.innerHTML = renderLoadingState('Loading reminders…');
    return;
  }

  if (error && items === null) {
    listEl.innerHTML = renderErrorState(error);
    wireRetry(listEl, () => loadReminders());
    return;
  }

  const list = items || [];

  if (!list.length) {
    listEl.innerHTML = `
      <div class="fade-in">
        <div class="screen-placeholder">
          <span class="screen-placeholder__icon" aria-hidden="true">&#10003;</span>
          <span>Nothing needs attention right now.</span>
        </div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div class="fade-in">
      <ul class="dashboard-list" aria-live="polite">
        ${list.map((item) => renderReminderRow(item)).join('')}
      </ul>
    </div>
  `;

  listEl.querySelectorAll('[data-goto-client]').forEach((button) => {
    button.addEventListener('click', () => navigate(`/clients/${button.dataset.gotoClient}`));
  });

  listEl.querySelectorAll('[data-mark-done]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      markReminderDoneAction(button.dataset.markDone);
    });
  });

  listEl.querySelectorAll('[data-snooze]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      snoozeReminderAction(button.dataset.snooze, 1);
    });
  });
}

function renderReminderRow(item) {
  const title = escapeHtml(item.title);
  const titleAttr = escapeAttr(item.title);
  return `
    <li class="reminder-row">
      <button type="button" class="dashboard-list__row reminder-row__main" data-goto-client="${item.clientId}">
        <span class="dashboard-list__title">${title}</span>
        <span class="dashboard-list__meta">${REMINDER_TYPE_LABELS[item.type] || 'Reminder'}</span>
      </button>
      <div class="reminder-row__actions">
        <button type="button" class="button button--ghost" data-snooze="${item.id}" aria-label="Snooze &quot;${titleAttr}&quot; for 1 day">Snooze</button>
        <button type="button" class="button button--primary" data-mark-done="${item.id}" aria-label="Mark &quot;${titleAttr}&quot; as done">Done</button>
      </div>
    </li>
  `;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
