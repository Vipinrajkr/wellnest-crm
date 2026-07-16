// domain/reminders/reminderRules.js
// Shared constants and pure date-window helpers for computing reminders
// across Followups, Payments, Program Ending, and Supplement Ending.
// No IndexedDB or Capacitor/DOM imports here.

import { toDateKey, daysBetween } from '../../core/dateUtils.js';

export { toDateKey, daysBetween };

export const REMINDER_TYPE = Object.freeze({
  FOLLOWUP: 'followup',
  PAYMENT: 'payment',
  PROGRAM_ENDING: 'program_ending',
  SUPPLEMENT_ENDING: 'supplement_ending',
});

export const REMINDER_TYPE_LABELS = {
  [REMINDER_TYPE.FOLLOWUP]: 'Follow-up',
  [REMINDER_TYPE.PAYMENT]: 'Payment',
  [REMINDER_TYPE.PROGRAM_ENDING]: 'Program Ending',
  [REMINDER_TYPE.SUPPLEMENT_ENDING]: 'Supplement Ending',
};

export const ENDING_SOON_WINDOW_DAYS = 7;

/** True once a reminder's override marks it done, or while a snooze is
 * still in effect (snoozedUntil is on or after today). */
export function isOverrideActive(override, todayKey) {
  if (!override) return false;
  if (override.status === 'done') return true;
  if (override.status === 'snoozed' && override.snoozedUntil) {
    return override.snoozedUntil >= todayKey;
  }
  return false;
}

/** Stable positive 32-bit hash of a string id, for Capacitor's numeric
 * LocalNotifications id — same reminder id always hashes to the same
 * notification id, so re-scheduling updates it rather than duplicating. */
export function hashToNotificationId(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}
