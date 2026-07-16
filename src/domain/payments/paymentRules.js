// domain/payments/paymentRules.js
// Business rules for a single payment entry within a program's ledger.
// No IndexedDB or Capacitor/DOM imports here.

export const PAYMENT_METHODS = Object.freeze({
  CASH: 'cash',
  UPI: 'upi',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  OTHER: 'other',
});

export const PAYMENT_METHOD_ORDER = [
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.UPI,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.BANK_TRANSFER,
  PAYMENT_METHODS.OTHER,
];

export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.CASH]: 'Cash',
  [PAYMENT_METHODS.UPI]: 'UPI',
  [PAYMENT_METHODS.CARD]: 'Card',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'Bank Transfer',
  [PAYMENT_METHODS.OTHER]: 'Other',
};

export function normalizePaymentInput(input) {
  return {
    programId: Number(input.programId),
    clientId: Number(input.clientId),
    amount: input.amount === '' || input.amount === undefined || input.amount === null ? null : Number(input.amount),
    method: PAYMENT_METHOD_ORDER.includes(input.method) ? input.method : PAYMENT_METHODS.CASH,
    date: input.date || '',
    reference: (input.reference || '').trim(),
  };
}

export function validatePayment(payment) {
  const errors = {};

  if (!payment.programId) errors._global = 'A payment must belong to a program.';
  if (payment.amount === null || Number.isNaN(payment.amount) || payment.amount <= 0) {
    errors.amount = 'Enter a payment amount greater than 0.';
  }
  if (!payment.date) errors.date = 'Date is required.';

  return { isValid: Object.keys(errors).length === 0, errors };
}
