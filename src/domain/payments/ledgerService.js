// domain/payments/ledgerService.js
// Orchestrates a program's payment ledger: recording payments, computing
// Paid/Pending from the program's Fee/Discount ("Auto calculations"), and
// building the plain-text content for Receipt/Invoice PDFs. Persistence
// goes through paymentsRepo; actual PDF byte generation lives in
// services/pdfGenerator.js so this module stays free of DOM/Blob concerns.

import { paymentsRepo } from '../../data/repositories/paymentsRepo.js';
import { normalizePaymentInput, validatePayment, PAYMENT_METHOD_LABELS } from './paymentRules.js';

export async function listPaymentsForProgram(programId) {
  const payments = await paymentsRepo.getByProgramId(Number(programId));
  return payments.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function recordPayment(input) {
  const normalized = normalizePaymentInput(input);
  const { isValid, errors } = validatePayment(normalized);
  if (!isValid) {
    return { success: false, errors };
  }

  const record = { ...normalized, createdAt: new Date().toISOString() };
  const id = await paymentsRepo.create(record);
  return { success: true, id };
}

/**
 * Auto calculations: net payable is the program fee minus its discount;
 * paid is the sum of every recorded payment; pending is whatever's left,
 * never negative. None of these are stored — always derived from the
 * program record plus its payments so they can never drift.
 */
export function calculateLedgerSummary(program, payments) {
  const fee = Number(program.fee) || 0;
  const discount = Number(program.discount) || 0;
  const netPayable = Math.max(0, fee - discount);
  const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const pending = Math.max(0, netPayable - paid);

  return { fee, discount, netPayable, paid, pending };
}

/** Plain-text content for the program's Invoice PDF (fee/discount/net/paid/pending). */
export function buildInvoiceDocument(client, program, summary) {
  const lines = [
    `Client: ${client.fullName}`,
    `Program: ${program.name}`,
    `Period: ${program.startDate} to ${program.endDate}`,
    '',
    `Program Fee: INR ${summary.fee.toFixed(2)}`,
    `Discount: INR ${summary.discount.toFixed(2)}`,
    `Net Payable: INR ${summary.netPayable.toFixed(2)}`,
    `Paid: INR ${summary.paid.toFixed(2)}`,
    `Pending: INR ${summary.pending.toFixed(2)}`,
    '',
    `Generated: ${new Date().toLocaleString()}`,
  ];
  return { title: `Invoice - ${program.name}`, lines };
}

/** Plain-text content for a single payment's Receipt PDF. */
export function buildReceiptDocument(client, program, payment) {
  const lines = [
    `Client: ${client.fullName}`,
    `Program: ${program.name}`,
    '',
    `Amount Paid: INR ${Number(payment.amount).toFixed(2)}`,
    `Method: ${PAYMENT_METHOD_LABELS[payment.method] || payment.method}`,
    `Date: ${payment.date}`,
    `Reference: ${payment.reference || 'N/A'}`,
    '',
    `Generated: ${new Date().toLocaleString()}`,
  ];
  return { title: 'Payment Receipt', lines };
}
