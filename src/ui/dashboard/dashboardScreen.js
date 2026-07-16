// ui/dashboard/dashboardScreen.js
// Home screen: at-a-glance client counts (Active/Leads/Completed/Dropped),
// today's follow-ups, programs ending soon, payment stats (Pending,
// Today's Collection, Monthly Revenue), and the unified Reminders panel
// (Followups/Payments/Program+Supplement Ending, with Mark Done/Snooze
// and Android notifications). Read-only aside from the reminders panel's
// own actions — aggregates existing IndexedDB data via
// state/actions/dashboardActions.js; no writes in this file.

import { navigate } from '../../core/router.js';
import { on } from '../../core/eventBus.js';
import { getState } from '../../state/store.js';
import { loadDashboard } from '../../state/actions/dashboardActions.js';
import { renderRemindersPanel } from '../reminders/remindersPanel.js';
import { CLIENT_STATUS } from '../../domain/clients/clientRules.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';

let unsubscribe = null;

export async function renderDashboard(container) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  container.innerHTML = `
    <section class="screen dashboard">
      <header class="screen-header">
        <h1>Dashboard</h1>
      </header>

      <div class="dashboard-section">
        <h2>Reminders</h2>
        <div id="reminders-panel"></div>
      </div>

      <div id="dashboard-content"></div>
    </section>
  `;

  const contentEl = container.querySelector('#dashboard-content');

  unsubscribe = on('state:dashboard', (dashboardState) => {
    renderContent(contentEl, dashboardState);
  });

  renderContent(contentEl, getState('dashboard'));

  await loadDashboard();

  const remindersMount = container.querySelector('#reminders-panel');
  await renderRemindersPanel(remindersMount);
}

function renderContent(contentEl, dashboardState) {
  // clientCounts is only null before the first load ever completes (see
  // state/store.js's initial slice) — once loaded, it's always an object,
  // even an empty one, so a later loading/error state doesn't hide
  // already-visible data behind a spinner.
  if (dashboardState.loading && dashboardState.clientCounts === null) {
    contentEl.innerHTML = renderLoadingState('Loading dashboard…');
    return;
  }

  if (dashboardState.error && dashboardState.clientCounts === null) {
    contentEl.innerHTML = renderErrorState(dashboardState.error);
    wireRetry(contentEl, () => loadDashboard());
    return;
  }

  const counts = dashboardState.clientCounts || {};

  contentEl.innerHTML = `
    <div class="fade-in">
      <div class="dashboard-stats" aria-live="polite">
        ${renderStatCard('Active Clients', counts[CLIENT_STATUS.ACTIVE] ?? 0)}
        ${renderStatCard('Leads', counts[CLIENT_STATUS.LEAD] ?? 0)}
        ${renderStatCard('Completed', counts[CLIENT_STATUS.COMPLETED] ?? 0)}
        ${renderStatCard('Dropped', counts[CLIENT_STATUS.DROPPED] ?? 0)}
      </div>

      <div class="dashboard-stats" aria-live="polite">
        ${renderStatCard(
          'Pending Payments',
          formatCurrency(dashboardState.pendingPayments?.totalPending ?? 0),
          `${dashboardState.pendingPayments?.programCount ?? 0} program(s)`
        )}
        ${renderStatCard("Today's Collection", formatCurrency(dashboardState.todaysCollection ?? 0))}
        ${renderStatCard('Monthly Revenue', formatCurrency(dashboardState.monthlyRevenue ?? 0))}
      </div>

      <div class="dashboard-section">
        <h2>Today's Follow-ups</h2>
        ${renderFollowUps(dashboardState.todaysFollowUps || [])}
      </div>

      <div class="dashboard-section">
        <h2>Programs Ending</h2>
        ${renderProgramsEnding(dashboardState.programsEnding || [])}
      </div>
    </div>
  `;

  contentEl.querySelectorAll('[data-goto-client]').forEach((button) => {
    button.addEventListener('click', () => {
      navigate(`/clients/${button.dataset.gotoClient}`);
    });
  });
}

function renderStatCard(label, value, sublabel) {
  return `
    <div class="dashboard-stat-card">
      <span class="dashboard-stat-card__value">${value}</span>
      <span class="dashboard-stat-card__label">${label}</span>
      ${sublabel ? `<span class="dashboard-stat-card__sublabel">${sublabel}</span>` : ''}
    </div>
  `;
}

function renderFollowUps(items) {
  if (!items.length) {
    return `
      <div class="screen-placeholder">
        <span class="screen-placeholder__icon" aria-hidden="true">&#128197;</span>
        <span>No follow-ups scheduled for today.</span>
      </div>
    `;
  }
  return `
    <ul class="dashboard-list">
      ${items
        .map(
          (item) => `
        <li>
          <button type="button" class="dashboard-list__row" data-goto-client="${item.clientId}">
            <span class="dashboard-list__title">${escapeHtml(item.clientName)}</span>
            <span class="dashboard-list__meta">Follow-up today</span>
          </button>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

function renderProgramsEnding(items) {
  if (!items.length) {
    return `
      <div class="screen-placeholder">
        <span class="screen-placeholder__icon" aria-hidden="true">&#10003;</span>
        <span>No programs ending soon.</span>
      </div>
    `;
  }
  return `
    <ul class="dashboard-list">
      ${items
        .map(
          (item) => `
        <li>
          <button type="button" class="dashboard-list__row" data-goto-client="${item.clientId}">
            <span class="dashboard-list__title">${escapeHtml(item.clientName)} &middot; ${escapeHtml(item.programName)}</span>
            <span class="dashboard-list__meta">${item.effectiveStatus === 'expired' ? 'Expired' : 'Ends'} ${formatDate(item.endDate)}</span>
          </button>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
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
