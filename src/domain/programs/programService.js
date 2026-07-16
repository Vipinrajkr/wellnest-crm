// domain/programs/programService.js
// Orchestrates program CRUD plus the Renew/Complete lifecycle actions.
// Delegates persistence to the programs repository; validation and
// derived values (duration, progress, effective status) come from
// programRules. This is the only module the state layer calls into for
// program operations.

import { programsRepo } from '../../data/repositories/programsRepo.js';
import { paymentsRepo } from '../../data/repositories/paymentsRepo.js';
import {
  normalizeProgramInput,
  validateProgram,
  calculateDurationDays,
  calculateProgressPercent,
  deriveEffectiveStatus,
  PROGRAM_STATUS,
} from './programRules.js';
import { calculateLedgerSummary } from '../payments/ledgerService.js';
import { toDateKey } from '../../core/dateUtils.js';
import { groupBy } from '../../core/collectionUtils.js';

/**
 * Fetches this client's payments once (indexed by clientId) and groups
 * them by programId in memory, instead of issuing one
 * paymentsRepo.getByProgramId() query per program — avoids an N+1 query
 * pattern for clients with several programs, matching the same
 * fetch-once-and-group approach used by domain/dashboard and
 * domain/reports for their cross-client aggregates.
 */
export async function listProgramsForClient(clientId) {
  const numericClientId = Number(clientId);
  const [programs, payments] = await Promise.all([
    programsRepo.getByClientId(numericClientId),
    paymentsRepo.getByClientId(numericClientId),
  ]);

  const paymentsByProgramId = groupBy(payments, (payment) => payment.programId);
  const today = new Date();
  const decorated = programs.map((program) =>
    decorateProgram(program, paymentsByProgramId.get(program.id) || [], today)
  );
  return decorated.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
}

export async function createProgram(input) {
  const normalized = normalizeProgramInput(input);
  const { isValid, errors } = validateProgram(normalized);
  if (!isValid) {
    return { success: false, errors };
  }

  const now = new Date().toISOString();
  const record = { ...normalized, createdAt: now, updatedAt: now };
  const id = await programsRepo.create(record);
  return { success: true, id };
}

/** Marks a program as completed, regardless of whether its end date has passed. */
export async function completeProgram(id) {
  const existing = await programsRepo.getById(id);
  if (!existing) {
    return { success: false, errors: { _global: 'Program not found.' } };
  }

  await programsRepo.update(id, {
    ...existing,
    status: PROGRAM_STATUS.COMPLETED,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
}

/**
 * Renews a program: marks the current record 'renewed' and creates a new
 * program starting today for the same duration and goal, linked back via
 * previousProgramId so the renewal chain stays traceable in history.
 */
export async function renewProgram(id) {
  const existing = await programsRepo.getById(id);
  if (!existing) {
    return { success: false, errors: { _global: 'Program not found.' } };
  }

  const durationDays = calculateDurationDays(existing.startDate, existing.endDate) ?? 30;
  const newStart = new Date();
  const newEnd = new Date(newStart.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const now = new Date().toISOString();

  await programsRepo.update(id, {
    ...existing,
    status: PROGRAM_STATUS.RENEWED,
    updatedAt: now,
  });

  const newRecord = {
    clientId: existing.clientId,
    name: existing.name,
    startDate: toDateKey(newStart),
    endDate: toDateKey(newEnd),
    goal: existing.goal,
    status: PROGRAM_STATUS.ACTIVE,
    previousProgramId: existing.id,
    fee: existing.fee ?? 0,
    discount: existing.discount ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  const newId = await programsRepo.create(newRecord);
  return { success: true, id: newId };
}

function decorateProgram(program, payments, today) {
  return {
    ...program,
    durationDays: calculateDurationDays(program.startDate, program.endDate),
    progressPercent: calculateProgressPercent(program.startDate, program.endDate, today),
    effectiveStatus: deriveEffectiveStatus(program, today),
    ledgerSummary: calculateLedgerSummary(program, payments),
  };
}
