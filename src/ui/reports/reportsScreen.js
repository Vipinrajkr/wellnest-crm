// ui/reports/reportsScreen.js
// Reports: Revenue/Collections/Pending totals, a monthly collections
// chart, Client and Program status breakdowns with a programs table, and
// CSV/PDF exports. Read-only — aggregates existing IndexedDB data via
// state/actions/reportsActions.js; no writes here.

import { on } from '../../core/eventBus.js';
import { getState } from '../../state/store.js';
import { loadReports } from '../../state/actions/reportsActions.js';
import { CLIENT_STATUS_ORDER, CLIENT_STATUS_LABELS } from '../../domain/clients/clientRules.js';
import { PROGRAM_STATUS, PROGRAM_STATUS_LABELS } from '../../domain/programs/programRules.js';
import { PAYMENT_METHOD_LABELS } from '../../domain/payments/paymentRules.js';
import { downloadCsv } from '../../services/csvExport.js';
import { generatePdf } from '../../services/pdfGenerator.js';
import { downloadBlob } from '../../services/fileExport.js';
import { renderBarChart } from './barChart.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';

const PROGRAM_STATUS_DISPLAY_ORDER = [
  PROGRAM_STATUS.ACTIVE,
  PROGRAM_STATUS.COMPLETED,
  PROGRAM_STATUS.RENEWED,
  PROGRAM_STATUS.EXPIRED,
];

let unsubscribe = null;

export async function renderReports(container) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  container.innerHTML = `
    <section class="screen reports">
      <header class="screen-header">
        <h1>Reports</h1>
      </header>

      <div class="reports-toolbar">
        <button type="button" class="button button--ghost" id="export-payments-csv">Export Payments CSV</button>
        <button type="button" class="button button--ghost" id="export-clients-csv">Export Clients CSV</button>
        <button type="button" class="button button--ghost" id="export-programs-csv">Export Programs CSV</button>
        <button type="button" class="button button--primary" id="export-summary-pdf">Download Summary PDF</button>
      </div>

      <div id="reports-content"></div>
    </section>
  `;

  const contentEl = container.querySelector('#reports-content');

  container.querySelector('#export-payments-csv').addEventListener('click', exportPaymentsCsv);
  container.querySelector('#export-clients-csv').addEventListener('click', exportClientsCsv);
  container.querySelector('#export-programs-csv').addEventListener('click', exportProgramsCsv);
  container.querySelector('#export-summary-pdf').addEventListener('click', exportSummaryPdf);

  unsubscribe = on('state:reports', (reportsState) => {
    renderContent(contentEl, reportsState);
  });

  renderContent(contentEl, getState('reports'));

  await loadReports();
}

function renderContent(contentEl, reportsState) {
  // totals is only null before the first load ever completes (see
  // state/store.js's initial reports slice) — once loaded, it's always an
  // object, so a later loading/error state (e.g. re-running loadReports)
  // never hides already-visible results behind a spinner.
  if (reportsState.loading && reportsState.totals === null) {
    contentEl.innerHTML = renderLoadingState('Loading reports…');
    return;
  }

  if (reportsState.error && reportsState.totals === null) {
    contentEl.innerHTML = renderErrorState(reportsState.error);
    wireRetry(contentEl, () => loadReports());
    return;
  }

  const totals = reportsState.totals || { revenue: 0, collections: 0, pending: 0 };
  const clientCounts = reportsState.clientCounts || {};
  const programCounts = reportsState.programCounts || {};

  contentEl.innerHTML = `
    <div class="fade-in">
      <div class="dashboard-stats" aria-live="polite">
        ${renderStatCard('Revenue', formatCurrency(totals.revenue))}
        ${renderStatCard('Collections', formatCurrency(totals.collections))}
        ${renderStatCard('Pending', formatCurrency(totals.pending))}
      </div>

      <div class="reports-section">
        <h2>Collections &mdash; Last 6 Months</h2>
        <figure class="reports-chart-figure">
          <canvas
            id="collections-chart"
            class="reports-chart"
            role="img"
            aria-label="Bar chart of total collections for each of the last 6 months"
          ></canvas>
        </figure>
      </div>

      <div class="reports-section">
        <h2>Clients (${reportsState.clientTotal ?? 0})</h2>
        <div class="dashboard-stats" aria-live="polite">
          ${CLIENT_STATUS_ORDER.map((status) => renderStatCard(CLIENT_STATUS_LABELS[status], clientCounts[status] ?? 0)).join('')}
        </div>
      </div>

      <div class="reports-section">
        <h2>Programs (${reportsState.programTotal ?? 0})</h2>
        <div class="dashboard-stats" aria-live="polite">
          ${PROGRAM_STATUS_DISPLAY_ORDER.map((status) => renderStatCard(PROGRAM_STATUS_LABELS[status], programCounts[status] ?? 0)).join('')}
        </div>
        ${renderProgramsTable(reportsState.programs || [])}
      </div>
    </div>
  `;

  const canvas = contentEl.querySelector('#collections-chart');
  if (canvas) {
    renderBarChart(canvas, reportsState.monthlyCollections || []);
  }
}

function renderStatCard(label, value) {
  return `
    <div class="dashboard-stat-card">
      <span class="dashboard-stat-card__value">${value}</span>
      <span class="dashboard-stat-card__label">${label}</span>
    </div>
  `;
}

function renderProgramsTable(programs) {
  if (!programs.length) {
    return `
      <div class="screen-placeholder">
        <span class="screen-placeholder__icon" aria-hidden="true">&#128202;</span>
        <span>No programs recorded yet.</span>
      </div>
    `;
  }

  return `
    <div class="reports-table-wrapper">
      <table class="reports-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Program</th>
            <th>Fee</th>
            <th>Paid</th>
            <th>Pending</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${programs
            .map(
              (program) => `
            <tr>
              <td>${escapeHtml(program.clientName)}</td>
              <td>${escapeHtml(program.name)}</td>
              <td>${formatCurrency(program.ledgerSummary.fee)}</td>
              <td>${formatCurrency(program.ledgerSummary.paid)}</td>
              <td>${formatCurrency(program.ledgerSummary.pending)}</td>
              <td><span class="status-badge status-badge--${program.effectiveStatus}">${PROGRAM_STATUS_LABELS[program.effectiveStatus] || program.effectiveStatus}</span></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function exportPaymentsCsv() {
  const { payments } = getState('reports');
  downloadCsv(
    `payments-${dateStamp()}.csv`,
    [
      { key: 'date', label: 'Date' },
      { key: 'clientName', label: 'Client' },
      { key: 'programName', label: 'Program' },
      { key: 'amount', label: 'Amount' },
      { key: 'methodLabel', label: 'Method' },
      { key: 'reference', label: 'Reference' },
    ],
    (payments || []).map((payment) => ({
      ...payment,
      methodLabel: PAYMENT_METHOD_LABELS[payment.method] || payment.method,
    }))
  );
}

function exportClientsCsv() {
  const { clients } = getState('reports');
  downloadCsv(
    `clients-${dateStamp()}.csv`,
    [
      { key: 'fullName', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'statusLabel', label: 'Status' },
    ],
    (clients || []).map((client) => ({
      ...client,
      statusLabel: CLIENT_STATUS_LABELS[client.status] || client.status,
    }))
  );
}

function exportProgramsCsv() {
  const { programs } = getState('reports');
  downloadCsv(
    `programs-${dateStamp()}.csv`,
    [
      { key: 'clientName', label: 'Client' },
      { key: 'name', label: 'Program' },
      { key: 'startDate', label: 'Start' },
      { key: 'endDate', label: 'End' },
      { key: 'fee', label: 'Fee' },
      { key: 'paid', label: 'Paid' },
      { key: 'pending', label: 'Pending' },
      { key: 'statusLabel', label: 'Status' },
    ],
    (programs || []).map((program) => ({
      clientName: program.clientName,
      name: program.name,
      startDate: program.startDate,
      endDate: program.endDate,
      fee: program.ledgerSummary.fee,
      paid: program.ledgerSummary.paid,
      pending: program.ledgerSummary.pending,
      statusLabel: PROGRAM_STATUS_LABELS[program.effectiveStatus] || program.effectiveStatus,
    }))
  );
}

function exportSummaryPdf() {
  const reportsState = getState('reports');
  const totals = reportsState.totals || { revenue: 0, collections: 0, pending: 0 };
  const clientCounts = reportsState.clientCounts || {};
  const programCounts = reportsState.programCounts || {};

  const lines = [
    `Revenue: INR ${totals.revenue.toFixed(2)}`,
    `Collections: INR ${totals.collections.toFixed(2)}`,
    `Pending: INR ${totals.pending.toFixed(2)}`,
    '',
    'Clients',
    ...CLIENT_STATUS_ORDER.map((status) => `  ${CLIENT_STATUS_LABELS[status]}: ${clientCounts[status] ?? 0}`),
    `  Total: ${reportsState.clientTotal ?? 0}`,
    '',
    'Programs',
    ...PROGRAM_STATUS_DISPLAY_ORDER.map((status) => `  ${PROGRAM_STATUS_LABELS[status]}: ${programCounts[status] ?? 0}`),
    `  Total: ${reportsState.programTotal ?? 0}`,
    '',
    `Generated: ${new Date().toLocaleString()}`,
  ];

  const blob = generatePdf({ title: 'Wellnest Summary Report', lines });
  downloadBlob(blob, `wellnest-report-${dateStamp()}.pdf`);
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function dateStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
