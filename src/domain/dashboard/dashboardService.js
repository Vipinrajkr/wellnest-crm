// domain/dashboard/dashboardService.js
// Aggregates existing data into the home-screen summary: client counts by
// status, today's follow-ups, programs ending soon, pending payments,
// today's collection, and monthly revenue. Purely a read-side reporting
// layer — no new storage, no writes. Reads repositories directly (rather
// than through each feature's per-client domain service) because these
// are cross-client aggregates, not single-client lookups.

import { clientsRepo } from '../../data/repositories/clientsRepo.js';
import { programsRepo } from '../../data/repositories/programsRepo.js';
import { paymentsRepo } from '../../data/repositories/paymentsRepo.js';
import { consultationNotesRepo } from '../../data/repositories/consultationNotesRepo.js';
import { CLIENT_STATUS } from '../clients/clientRules.js';
import { deriveEffectiveStatus, PROGRAM_STATUS } from '../programs/programRules.js';
import { calculateLedgerSummary } from '../payments/ledgerService.js';
import { toDateKey, dateKeyToUtcTimestamp } from '../../core/dateUtils.js';
import { groupBy } from '../../core/collectionUtils.js';

const PROGRAM_ENDING_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function loadDashboardSummary() {
  const [clients, programs, payments, notes] = await Promise.all([
    clientsRepo.getAll(),
    programsRepo.getAll(),
    paymentsRepo.getAll(),
    consultationNotesRepo.getAll(),
  ]);

  const today = new Date();
  const todayKey = toDateKey(today);

  const clientById = new Map(clients.map((client) => [client.id, client]));
  const paymentsByProgramId = groupBy(payments, (payment) => payment.programId);

  const decoratedPrograms = programs.map((program) => {
    const effectiveStatus = deriveEffectiveStatus(program, today);
    const programPayments = paymentsByProgramId.get(program.id) || [];
    const ledgerSummary = calculateLedgerSummary(program, programPayments);
    return { ...program, effectiveStatus, ledgerSummary };
  });

  return {
    clientCounts: countClientsByStatus(clients),
    todaysFollowUps: buildFollowUpsToday(notes, clientById, todayKey),
    programsEnding: buildProgramsEnding(decoratedPrograms, clientById, todayKey),
    pendingPayments: buildPendingPayments(decoratedPrograms),
    todaysCollection: sumPaymentsForDate(payments, todayKey),
    monthlyRevenue: sumPaymentsForMonth(payments, todayKey),
  };
}

function countClientsByStatus(clients) {
  const counts = {
    [CLIENT_STATUS.ACTIVE]: 0,
    [CLIENT_STATUS.LEAD]: 0,
    [CLIENT_STATUS.COMPLETED]: 0,
    [CLIENT_STATUS.DROPPED]: 0,
  };
  clients.forEach((client) => {
    if (counts[client.status] !== undefined) counts[client.status] += 1;
  });
  return counts;
}

function buildFollowUpsToday(notes, clientById, todayKey) {
  return notes
    .filter((note) => note.followUpDate === todayKey)
    .map((note) => ({
      noteId: note.id,
      clientId: note.clientId,
      clientName: clientById.get(note.clientId)?.fullName || 'Unknown client',
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));
}

/** Anything needing attention today: already past its end date (expired),
 * or active and ending within the next PROGRAM_ENDING_WINDOW_DAYS days.
 * Compares calendar days only (via dateKeyToUtcTimestamp) rather than
 * exact instants, so a program's end date and "today" are diffed as
 * whole days regardless of the current time-of-day or timezone. */
function buildProgramsEnding(decoratedPrograms, clientById, todayKey) {
  const todayTimestamp = dateKeyToUtcTimestamp(todayKey);
  return decoratedPrograms
    .filter((program) => {
      if (program.effectiveStatus === PROGRAM_STATUS.EXPIRED) return true;
      if (program.effectiveStatus !== PROGRAM_STATUS.ACTIVE) return false;
      if (!program.endDate) return false;
      const daysUntilEnd = Math.round((dateKeyToUtcTimestamp(program.endDate) - todayTimestamp) / MS_PER_DAY);
      return daysUntilEnd >= 0 && daysUntilEnd <= PROGRAM_ENDING_WINDOW_DAYS;
    })
    .map((program) => ({
      programId: program.id,
      clientId: program.clientId,
      clientName: clientById.get(program.clientId)?.fullName || 'Unknown client',
      programName: program.name,
      endDate: program.endDate,
      effectiveStatus: program.effectiveStatus,
    }))
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
}

function buildPendingPayments(decoratedPrograms) {
  const withPending = decoratedPrograms.filter((program) => program.ledgerSummary.pending > 0);
  const totalPending = withPending.reduce((sum, program) => sum + program.ledgerSummary.pending, 0);
  return { totalPending, programCount: withPending.length };
}

function sumPaymentsForDate(payments, dateKey) {
  return payments
    .filter((payment) => payment.date === dateKey)
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

function sumPaymentsForMonth(payments, todayKey) {
  const monthPrefix = todayKey.slice(0, 7); // "YYYY-MM" — string match avoids re-parsing
  // date-only strings through Date(), which would reinterpret them in UTC
  // and can roll across a month boundary depending on timezone.
  return payments
    .filter((payment) => typeof payment.date === 'string' && payment.date.startsWith(monthPrefix))
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

