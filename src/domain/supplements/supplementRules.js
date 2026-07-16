// domain/supplements/supplementRules.js
// Business rules for a client's supplements: validation and the derived
// Duration label. No IndexedDB or Capacitor/DOM imports here.

export const SUPPLEMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DISCONTINUED: 'discontinued',
});

export const SUPPLEMENT_STATUS_LABELS = {
  [SUPPLEMENT_STATUS.ACTIVE]: 'Active',
  [SUPPLEMENT_STATUS.COMPLETED]: 'Completed',
  [SUPPLEMENT_STATUS.DISCONTINUED]: 'Discontinued',
};

const STORED_STATUSES = Object.values(SUPPLEMENT_STATUS);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Normalizes raw form input into a clean supplement record shape. */
export function normalizeSupplementInput(input) {
  return {
    clientId: Number(input.clientId),
    name: (input.name || '').trim(),
    brand: (input.brand || '').trim(),
    dosage: (input.dosage || '').trim(),
    frequency: (input.frequency || '').trim(),
    startDate: input.startDate || '',
    endDate: input.endDate || '',
    instructions: (input.instructions || '').trim(),
    status: STORED_STATUSES.includes(input.status) ? input.status : SUPPLEMENT_STATUS.ACTIVE,
  };
}

export function validateSupplement(supplement) {
  const errors = {};

  if (!supplement.clientId) errors._global = 'A supplement must belong to a client.';
  if (!supplement.name) errors.name = 'Name is required.';
  if (!supplement.dosage) errors.dosage = 'Dosage is required.';
  if (!supplement.frequency) errors.frequency = 'Frequency is required.';
  if (!supplement.startDate) errors.startDate = 'Start date is required.';

  if (supplement.startDate && supplement.endDate) {
    if (new Date(supplement.endDate) < new Date(supplement.startDate)) {
      errors.endDate = 'End date must be on or after the start date.';
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Duration is always derived from Start/End rather than stored — a
 * supplement with no End date (an ongoing regimen) reads as "Ongoing"
 * instead of a day count.
 */
export function calculateDurationLabel(startDate, endDate) {
  if (!startDate) return '—';
  if (!endDate) return 'Ongoing';

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
  return `${days} day${days === 1 ? '' : 's'}`;
}
