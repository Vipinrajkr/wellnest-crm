// domain/programs/programRules.js
// Business rules for client programs: validation, and the derived values
// (duration, auto progress, effective status) that make "Auto progress"
// possible without storing values that could drift out of sync.
// No IndexedDB or Capacitor imports here.

export const PROGRAM_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  RENEWED: 'renewed',
  EXPIRED: 'expired',
});

export const PROGRAM_STATUS_LABELS = {
  [PROGRAM_STATUS.ACTIVE]: 'Active',
  [PROGRAM_STATUS.COMPLETED]: 'Completed',
  [PROGRAM_STATUS.RENEWED]: 'Renewed',
  [PROGRAM_STATUS.EXPIRED]: 'Expired',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STORED_STATUSES = [PROGRAM_STATUS.ACTIVE, PROGRAM_STATUS.COMPLETED, PROGRAM_STATUS.RENEWED];

/**
 * Normalizes raw form input into a clean program record shape.
 * 'expired' is never stored — it is always derived (see deriveEffectiveStatus).
 */
export function normalizeProgramInput(input) {
  return {
    clientId: Number(input.clientId),
    name: (input.name || '').trim(),
    startDate: input.startDate || '',
    endDate: input.endDate || '',
    goal: (input.goal || '').trim(),
    status: STORED_STATUSES.includes(input.status) ? input.status : PROGRAM_STATUS.ACTIVE,
    previousProgramId: input.previousProgramId ? Number(input.previousProgramId) : null,
    fee: input.fee === '' || input.fee === undefined || input.fee === null ? 0 : Number(input.fee),
    discount: input.discount === '' || input.discount === undefined || input.discount === null ? 0 : Number(input.discount),
  };
}

export function validateProgram(program) {
  const errors = {};

  if (!program.clientId) errors._global = 'A program must belong to a client.';
  if (!program.name) errors.name = 'Program name is required.';
  if (!program.startDate) errors.startDate = 'Start date is required.';
  if (!program.endDate) errors.endDate = 'End date is required.';

  if (program.startDate && program.endDate) {
    const start = new Date(program.startDate);
    const end = new Date(program.endDate);
    if (end < start) {
      errors.endDate = 'End date must be on or after the start date.';
    }
  }

  if (!program.goal) errors.goal = 'Goal is required.';

  if (Number.isNaN(program.fee) || program.fee < 0) {
    errors.fee = 'Program fee must be zero or greater.';
  }

  if (Number.isNaN(program.discount) || program.discount < 0) {
    errors.discount = 'Discount must be zero or greater.';
  }

  if (!errors.fee && !errors.discount && program.discount > program.fee) {
    errors.discount = 'Discount cannot exceed the program fee.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/** Duration in whole days between start and end. Always derived, never stored. */
export function calculateDurationDays(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / MS_PER_DAY));
}

/**
 * Auto progress: percentage of the program elapsed as of today,
 * clamped 0-100. Purely derived from dates — never persisted, so it
 * can never go stale.
 */
export function calculateProgressPercent(startDate, endDate, today = new Date()) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = today.getTime();

  if (end <= start) return 100;
  if (now <= start) return 0;
  if (now >= end) return 100;

  return Math.round(((now - start) / (end - start)) * 100);
}

/**
 * Derives the status actually shown in the UI. A program stored as
 * 'active' whose end date has passed reads as 'expired' until the user
 * explicitly completes or renews it — manual statuses are never
 * overridden by this derivation.
 */
export function deriveEffectiveStatus(program, today = new Date()) {
  if (program.status !== PROGRAM_STATUS.ACTIVE) {
    return program.status;
  }
  const end = new Date(program.endDate).getTime();
  if (today.getTime() > end) {
    return PROGRAM_STATUS.EXPIRED;
  }
  return PROGRAM_STATUS.ACTIVE;
}
