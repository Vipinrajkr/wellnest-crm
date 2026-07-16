// domain/reminders/reminderService.js
// Computes the unified reminders list — Followups, Payments, Program
// Ending, Supplement Ending — from existing data, applies persisted
// Mark Done / Snooze overrides, and syncs the result to Android local
// notifications via platform/notificationsAdapter. Reads repositories
// directly (an independent leaf, like domain/dashboard and
// domain/reports) rather than depending on those sibling reporting
// modules.

import { clientsRepo } from '../../data/repositories/clientsRepo.js';
import { programsRepo } from '../../data/repositories/programsRepo.js';
import { paymentsRepo } from '../../data/repositories/paymentsRepo.js';
import { consultationNotesRepo } from '../../data/repositories/consultationNotesRepo.js';
import { supplementsRepo } from '../../data/repositories/supplementsRepo.js';
import { reminderOverridesRepo } from '../../data/repositories/reminderOverridesRepo.js';
import { deriveEffectiveStatus, PROGRAM_STATUS } from '../programs/programRules.js';
import { calculateLedgerSummary } from '../payments/ledgerService.js';
import { SUPPLEMENT_STATUS } from '../supplements/supplementRules.js';
import * as notificationsAdapter from '../../platform/notificationsAdapter.js';
import {
  REMINDER_TYPE,
  REMINDER_TYPE_LABELS,
  ENDING_SOON_WINDOW_DAYS,
  toDateKey,
  daysBetween,
  isOverrideActive,
  hashToNotificationId,
} from './reminderRules.js';
import { groupBy } from '../../core/collectionUtils.js';

export async function loadReminders() {
  const [clients, programs, payments, notes, supplements, overrides] = await Promise.all([
    clientsRepo.getAll(),
    programsRepo.getAll(),
    paymentsRepo.getAll(),
    consultationNotesRepo.getAll(),
    supplementsRepo.getAll(),
    reminderOverridesRepo.getAll(),
  ]);

  const todayKey = toDateKey(new Date());
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const overrideById = new Map(overrides.map((override) => [override.id, override]));
  const paymentsByProgramId = groupBy(payments, (payment) => payment.programId);

  const items = [
    ...buildFollowupReminders(notes, clientById, todayKey),
    ...buildPaymentReminders(programs, paymentsByProgramId, clientById, todayKey),
    ...buildProgramEndingReminders(programs, clientById, todayKey),
    ...buildSupplementEndingReminders(supplements, clientById, todayKey),
  ].filter((item) => !isOverrideActive(overrideById.get(item.id), todayKey));

  items.sort((a, b) => daysBetween(a.dueDate, todayKey) - daysBetween(b.dueDate, todayKey));

  return items;
}

export async function markReminderDone(id) {
  await reminderOverridesRepo.upsert({
    id,
    status: 'done',
    snoozedUntil: null,
    updatedAt: new Date().toISOString(),
  });
  await notificationsAdapter.cancelNotification(hashToNotificationId(id));
}

export async function snoozeReminder(id, snoozedUntilDateKey) {
  await reminderOverridesRepo.upsert({
    id,
    status: 'snoozed',
    snoozedUntil: snoozedUntilDateKey,
    updatedAt: new Date().toISOString(),
  });
  await notificationsAdapter.cancelNotification(hashToNotificationId(id));
}

/**
 * Schedules an Android notification (via platform/notificationsAdapter)
 * for each reminder due today or in the future — already-overdue items
 * still show in the in-app list but aren't scheduled forward, since
 * there's nothing to "remind ahead of" for a date that's already passed.
 * A no-op outside the native Capacitor shell (see notificationsAdapter).
 */
export async function syncReminderNotifications(items) {
  const supported = await notificationsAdapter.isSupported();
  if (!supported) return { scheduled: 0, supported: false };

  await notificationsAdapter.requestPermission();

  const todayKey = toDateKey(new Date());
  let scheduled = 0;

  for (const item of items) {
    if (daysBetween(item.dueDate, todayKey) < 0) continue;

    const [year, month, day] = item.dueDate.split('-').map(Number);
    const at = new Date(year, month - 1, day, 9, 0, 0);

    await notificationsAdapter.scheduleNotification({
      id: hashToNotificationId(item.id),
      title: REMINDER_TYPE_LABELS[item.type] || 'Reminder',
      body: item.title,
      at,
    });
    scheduled += 1;
  }

  return { scheduled, supported: true };
}

function buildFollowupReminders(notes, clientById, todayKey) {
  return notes
    .filter((note) => note.followUpDate && note.followUpDate <= todayKey)
    .map((note) => ({
      id: `followup:${note.id}`,
      type: REMINDER_TYPE.FOLLOWUP,
      clientId: note.clientId,
      title: `${clientById.get(note.clientId)?.fullName || 'Unknown client'} — follow-up`,
      dueDate: note.followUpDate,
    }));
}

function buildPaymentReminders(programs, paymentsByProgramId, clientById, todayKey) {
  return programs
    .map((program) => {
      const programPayments = paymentsByProgramId.get(program.id) || [];
      return { program, ledgerSummary: calculateLedgerSummary(program, programPayments) };
    })
    .filter(({ ledgerSummary }) => ledgerSummary.pending > 0)
    .map(({ program, ledgerSummary }) => ({
      id: `payment:${program.id}`,
      type: REMINDER_TYPE.PAYMENT,
      clientId: program.clientId,
      title: `${clientById.get(program.clientId)?.fullName || 'Unknown client'} — ₹${ledgerSummary.pending.toFixed(2)} pending for ${program.name}`,
      dueDate: todayKey,
    }));
}

function buildProgramEndingReminders(programs, clientById, todayKey) {
  const today = new Date();
  return programs
    .map((program) => ({ program, effectiveStatus: deriveEffectiveStatus(program, today) }))
    .filter(({ program, effectiveStatus }) => {
      if (effectiveStatus === PROGRAM_STATUS.EXPIRED) return true;
      if (effectiveStatus !== PROGRAM_STATUS.ACTIVE || !program.endDate) return false;
      const daysUntilEnd = daysBetween(program.endDate, todayKey);
      return daysUntilEnd >= 0 && daysUntilEnd <= ENDING_SOON_WINDOW_DAYS;
    })
    .map(({ program }) => ({
      id: `program-ending:${program.id}`,
      type: REMINDER_TYPE.PROGRAM_ENDING,
      clientId: program.clientId,
      title: `${clientById.get(program.clientId)?.fullName || 'Unknown client'} — ${program.name} ending`,
      dueDate: program.endDate,
    }));
}

function buildSupplementEndingReminders(supplements, clientById, todayKey) {
  // Supplements have no derived "expired" status the way programs do
  // (SUPPLEMENT_STATUS is only active/completed/discontinued), so an
  // active supplement whose end date has already passed is treated the
  // same way programs' EXPIRED bucket is: it keeps surfacing regardless
  // of how long ago it ended, until the user Completes/Discontinues it
  // — there's deliberately no lower bound on daysUntilEnd here, only an
  // upper one for "ending soon" (still active and within the window).
  return supplements
    .filter((supplement) => {
      if (supplement.status !== SUPPLEMENT_STATUS.ACTIVE || !supplement.endDate) return false;
      return daysBetween(supplement.endDate, todayKey) <= ENDING_SOON_WINDOW_DAYS;
    })
    .map((supplement) => ({
      id: `supplement-ending:${supplement.id}`,
      type: REMINDER_TYPE.SUPPLEMENT_ENDING,
      clientId: supplement.clientId,
      title: `${clientById.get(supplement.clientId)?.fullName || 'Unknown client'} — ${supplement.name} ending`,
      dueDate: supplement.endDate,
    }));
}
