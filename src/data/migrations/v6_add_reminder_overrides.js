// data/migrations/v6_add_reminder_overrides.js
// Adds the 'reminderOverrides' store: tracks Mark Done / Snooze state for
// computed reminders (Followups, Payments, Program Ending, Supplement
// Ending). Keyed by the reminder's own natural string id (e.g.
// "followup:12") rather than autoIncrement, since these aren't
// independently-created records — they mirror whatever
// domain/reminders/reminderService.js computes on each load.

export function migrateV6(db) {
  if (!db.objectStoreNames.contains('reminderOverrides')) {
    db.createObjectStore('reminderOverrides', { keyPath: 'id' });
  }
}
