// domain/reports/reportsService.js
// Aggregates existing data into report-ready shapes: Revenue/Collections/
// Pending totals, a monthly collections trend, Client and Program status
// breakdowns, and the decorated records CSV export needs. Purely a
// read-side reporting layer — no new storage, no writes. Reads
// repositories directly and composes the same lower-level pure functions
// domain/dashboard uses, rather than depending on domain/dashboard itself,
// so the two reporting surfaces (today-at-a-glance vs. historical/export)
// stay independent leaves.

import { clientsRepo } from '../../data/repositories/clientsRepo.js';
import { programsRepo } from '../../data/repositories/programsRepo.js';
import { paymentsRepo } from '../../data/repositories/paymentsRepo.js';
import { CLIENT_STATUS_ORDER } from '../clients/clientRules.js';
import { deriveEffectiveStatus, PROGRAM_STATUS } from '../programs/programRules.js';
import { calculateLedgerSummary } from '../payments/ledgerService.js';
import { groupBy } from '../../core/collectionUtils.js';

const TREND_MONTHS = 6;

export async function loadReportsSummary() {
  const [clients, programs, payments] = await Promise.all([
    clientsRepo.getAll(),
    programsRepo.getAll(),
    paymentsRepo.getAll(),
  ]);

  const today = new Date();
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const programById = new Map(programs.map((program) => [program.id, program]));
  const paymentsByProgramId = groupBy(payments, (payment) => payment.programId);

  const decoratedPrograms = programs.map((program) => {
    const effectiveStatus = deriveEffectiveStatus(program, today);
    const programPayments = paymentsByProgramId.get(program.id) || [];
    const ledgerSummary = calculateLedgerSummary(program, programPayments);
    return {
      ...program,
      effectiveStatus,
      ledgerSummary,
      clientName: clientById.get(program.clientId)?.fullName || 'Unknown client',
    };
  });

  const totals = decoratedPrograms.reduce(
    (acc, program) => {
      acc.revenue += program.ledgerSummary.netPayable;
      acc.collections += program.ledgerSummary.paid;
      acc.pending += program.ledgerSummary.pending;
      return acc;
    },
    { revenue: 0, collections: 0, pending: 0 }
  );

  return {
    totals,
    monthlyCollections: buildMonthlyCollectionsSeries(payments, today, TREND_MONTHS),
    clientCounts: countClientsByStatus(clients),
    clientTotal: clients.length,
    programCounts: countProgramsByStatus(decoratedPrograms),
    programTotal: decoratedPrograms.length,
    programs: [...decoratedPrograms].sort((a, b) => b.ledgerSummary.pending - a.ledgerSummary.pending),
    clients,
    payments: decoratePaymentsForExport(payments, clientById, programById),
  };
}

function countClientsByStatus(clients) {
  const counts = {};
  CLIENT_STATUS_ORDER.forEach((status) => {
    counts[status] = 0;
  });
  clients.forEach((client) => {
    if (counts[client.status] !== undefined) counts[client.status] += 1;
  });
  return counts;
}

function countProgramsByStatus(decoratedPrograms) {
  const counts = {
    [PROGRAM_STATUS.ACTIVE]: 0,
    [PROGRAM_STATUS.COMPLETED]: 0,
    [PROGRAM_STATUS.RENEWED]: 0,
    [PROGRAM_STATUS.EXPIRED]: 0,
  };
  decoratedPrograms.forEach((program) => {
    if (counts[program.effectiveStatus] !== undefined) counts[program.effectiveStatus] += 1;
  });
  return counts;
}

/**
 * Total payments collected per calendar month for the trailing
 * `monthCount` months (oldest first). Grouped by string-prefix match on
 * the "YYYY-MM-DD" payment date rather than re-parsing through Date(),
 * so results aren't skewed by timezone reinterpretation of date-only
 * strings (see domain/dashboard/dashboardService.js for the same fix).
 */
function buildMonthlyCollectionsSeries(payments, today, monthCount) {
  const months = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      key: toMonthKey(date),
      label: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    });
  }

  const totalsByMonth = new Map(months.map((month) => [month.key, 0]));
  payments.forEach((payment) => {
    if (typeof payment.date !== 'string') return;
    const monthKey = payment.date.slice(0, 7);
    if (totalsByMonth.has(monthKey)) {
      totalsByMonth.set(monthKey, totalsByMonth.get(monthKey) + (Number(payment.amount) || 0));
    }
  });

  return months.map((month) => ({ label: month.label, total: totalsByMonth.get(month.key) || 0 }));
}

function decoratePaymentsForExport(payments, clientById, programById) {
  return payments
    .map((payment) => ({
      ...payment,
      clientName: clientById.get(payment.clientId)?.fullName || 'Unknown client',
      programName: programById.get(payment.programId)?.name || 'Unknown program',
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
