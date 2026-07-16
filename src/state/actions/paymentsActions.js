// state/actions/paymentsActions.js
// Bridges UI events to domain/payments, then updates state/store.
// UI never calls domain/payments directly — matches the pattern
// established in clientsActions.js and programsActions.js.

import { setState } from '../store.js';
import * as ledgerService from '../../domain/payments/ledgerService.js';

export async function loadLedger(program) {
  setState('ledger', { programId: program.id, loading: true, error: null });
  try {
    const payments = await ledgerService.listPaymentsForProgram(program.id);
    const summary = ledgerService.calculateLedgerSummary(program, payments);
    setState('ledger', { programId: program.id, payments, summary, loading: false, error: null });
  } catch (error) {
    setState('ledger', { programId: program.id, loading: false, error: error?.message || 'Failed to load ledger.' });
  }
}

export async function recordPaymentAction(program, formValues) {
  const result = await ledgerService.recordPayment(formValues);
  if (result.success) {
    await loadLedger(program);
  }
  return result;
}
