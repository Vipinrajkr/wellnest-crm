// ui/payments/ledgerPanel.js
// Renders one program's payment ledger: auto-calculated fee/discount/
// paid/pending, payment history, a "Record Payment" form, and Receipt/
// Invoice PDF generation. Mounted inline inside a program card in
// ui/programs/programsPanel.js.

import { loadClientForEdit } from '../../state/actions/clientsActions.js';
import { loadLedger, recordPaymentAction } from '../../state/actions/paymentsActions.js';
import { getState } from '../../state/store.js';
import { on } from '../../core/eventBus.js';
import * as ledgerService from '../../domain/payments/ledgerService.js';
import { PAYMENT_METHOD_ORDER, PAYMENT_METHOD_LABELS } from '../../domain/payments/paymentRules.js';
import { generatePdf } from '../../services/pdfGenerator.js';
import { downloadBlob } from '../../services/fileExport.js';
import { renderErrorState, wireRetry } from '../shared/asyncState.js';

let unsubscribe = null;
let formVisible = false;
// Same "don't hide already-visible data behind a spinner" gate used in
// programsPanel.js/dashboardScreen.js — ledger is a nested, embedded
// component so it uses the smaller .spinner--inline instead of the full
// .loading-state block.
let hasRenderedContent = false;

export async function renderLedgerPanel(container, { program, clientId }) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  formVisible = false;
  hasRenderedContent = false;

  container.innerHTML = `
    <div class="ledger-panel">
      <div class="ledger-panel__summary" id="ledger-summary" aria-live="polite"></div>

      <div class="ledger-panel__toolbar">
        <button type="button" class="button button--ghost" id="record-payment-button">Record Payment</button>
        <button type="button" class="button button--ghost" id="invoice-button">Invoice PDF</button>
      </div>

      <div id="payment-form-mount"></div>

      <div class="ledger-panel__history" id="payment-history"></div>
    </div>
  `;

  const summaryEl = container.querySelector('#ledger-summary');
  const historyEl = container.querySelector('#payment-history');
  const recordButton = container.querySelector('#record-payment-button');
  const invoiceButton = container.querySelector('#invoice-button');
  const formMount = container.querySelector('#payment-form-mount');

  recordButton.addEventListener('click', () => {
    formVisible = !formVisible;
    renderForm(formMount, program, recordButton);
  });

  invoiceButton.addEventListener('click', async () => {
    const client = await loadClientForEdit(clientId);
    const summary = getState('ledger').summary || ledgerService.calculateLedgerSummary(program, []);
    const doc = ledgerService.buildInvoiceDocument(client, program, summary);
    const blob = generatePdf(doc);
    downloadBlob(blob, `invoice-${slugify(program.name)}-${program.id}.pdf`);
  });

  unsubscribe = on('state:ledger', (ledgerState) => {
    renderBody(summaryEl, historyEl, ledgerState, program, clientId);
  });

  renderBody(summaryEl, historyEl, getState('ledger'), program, clientId);

  await loadLedger(program);
}

function renderBody(summaryEl, historyEl, ledgerState, program, clientId) {
  if (!ledgerState || ledgerState.programId !== program.id) {
    return;
  }

  if (ledgerState.loading && !hasRenderedContent) {
    summaryEl.innerHTML = `
      <div class="ledger-panel__loading" role="status" aria-live="polite">
        <div class="spinner spinner--inline" aria-hidden="true"></div>
        <span>Loading ledger…</span>
      </div>
    `;
    historyEl.innerHTML = '';
    return;
  }

  if (ledgerState.error && !hasRenderedContent) {
    summaryEl.innerHTML = renderErrorState(ledgerState.error);
    wireRetry(summaryEl, () => loadLedger(program));
    historyEl.innerHTML = '';
    return;
  }

  hasRenderedContent = true;
  renderSummary(summaryEl, ledgerState.summary);
  renderHistory(historyEl, ledgerState.payments, program, clientId);
}

function renderForm(formMount, program, recordButton) {
  if (!formVisible) {
    formMount.innerHTML = '';
    recordButton.textContent = 'Record Payment';
    return;
  }

  recordButton.textContent = 'Cancel';
  formMount.innerHTML = `
    <form class="payment-form" id="payment-form" novalidate>
      <div class="client-form__error" id="payment-form-error" hidden></div>

      <label class="client-form__field">
        <span>Amount *</span>
        <input type="number" name="amount" min="0" step="0.01" required />
        <span class="client-form__field-error" data-error-for="amount"></span>
      </label>

      <label class="client-form__field">
        <span>Method</span>
        <select name="method">
          ${PAYMENT_METHOD_ORDER.map(
            (method) => `<option value="${method}">${PAYMENT_METHOD_LABELS[method]}</option>`
          ).join('')}
        </select>
      </label>

      <label class="client-form__field">
        <span>Date *</span>
        <input type="date" name="date" required />
        <span class="client-form__field-error" data-error-for="date"></span>
      </label>

      <label class="client-form__field">
        <span>Reference</span>
        <input type="text" name="reference" placeholder="Transaction / cheque no." />
      </label>

      <div class="client-form__actions">
        <button type="submit" class="button button--primary">Save Payment</button>
      </div>
    </form>
  `;

  const form = formMount.querySelector('#payment-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const formData = new FormData(form);
    const values = {
      ...Object.fromEntries(formData.entries()),
      programId: program.id,
      clientId: program.clientId,
    };

    const result = await recordPaymentAction(program, values);
    if (result.success) {
      formVisible = false;
      renderForm(formMount, program, recordButton);
    } else {
      showErrors(form, result.errors);
    }
  });
}

function renderSummary(summaryEl, summary) {
  if (!summary) {
    summaryEl.innerHTML = '';
    return;
  }

  summaryEl.innerHTML = `
    <div class="fade-in">
      <div class="ledger-summary__row">
        <span>Program Fee</span><span>₹${summary.fee.toFixed(2)}</span>
      </div>
      <div class="ledger-summary__row">
        <span>Discount</span><span>&minus;₹${summary.discount.toFixed(2)}</span>
      </div>
      <div class="ledger-summary__row ledger-summary__row--total">
        <span>Net Payable</span><span>₹${summary.netPayable.toFixed(2)}</span>
      </div>
      <div class="ledger-summary__row ledger-summary__row--paid">
        <span>Paid</span><span>₹${summary.paid.toFixed(2)}</span>
      </div>
      <div class="ledger-summary__row ledger-summary__row--pending">
        <span>Pending</span><span>₹${summary.pending.toFixed(2)}</span>
      </div>
    </div>
  `;
}

function renderHistory(historyEl, payments, program, clientId) {
  if (!payments || !payments.length) {
    historyEl.innerHTML = `
      <div class="fade-in">
        <div class="screen-placeholder">
          <span class="screen-placeholder__icon" aria-hidden="true">&#129534;</span>
          <span>No payments recorded yet.</span>
        </div>
      </div>
    `;
    return;
  }

  historyEl.innerHTML = `
    <div class="fade-in">
      <h4 class="ledger-panel__history-title">Payment History</h4>
      <ul class="payment-history">
        ${payments.map((payment) => renderPaymentRow(payment)).join('')}
      </ul>
    </div>
  `;

  historyEl.querySelectorAll('[data-receipt-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const paymentId = Number(button.dataset.receiptId);
      const payment = payments.find((item) => item.id === paymentId);
      if (!payment) return;
      const client = await loadClientForEdit(clientId);
      const doc = ledgerService.buildReceiptDocument(client, program, payment);
      const blob = generatePdf(doc);
      downloadBlob(blob, `receipt-${payment.id}.pdf`);
    });
  });
}

function renderPaymentRow(payment) {
  return `
    <li class="payment-history__row">
      <span class="payment-history__amount">₹${Number(payment.amount).toFixed(2)}</span>
      <span class="payment-history__meta">${PAYMENT_METHOD_LABELS[payment.method] || payment.method} &middot; ${formatDate(payment.date)}</span>
      <span class="payment-history__reference">${escapeHtml(payment.reference || 'No reference')}</span>
      <button type="button" class="button button--ghost" data-receipt-id="${payment.id}">Receipt</button>
    </li>
  `;
}

function clearErrors(form) {
  form.querySelectorAll('.client-form__field-error').forEach((el) => {
    el.textContent = '';
  });
  const globalError = form.querySelector('#payment-form-error');
  if (globalError) {
    globalError.hidden = true;
    globalError.textContent = '';
  }
}

function showErrors(form, errors = {}) {
  Object.entries(errors).forEach(([field, message]) => {
    if (field === '_global') {
      const globalError = form.querySelector('#payment-form-error');
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

function slugify(value) {
  return String(value || 'program')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
