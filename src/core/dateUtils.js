// core/dateUtils.js
// Shared, timezone-safe date-key helpers. Consolidated here after an audit
// found near-identical copies scattered across domain/reminders,
// domain/dashboard, domain/reports, and domain/backup — this is now the
// single source of truth all of them import from.
//
// "Today" and any date-only comparison must use LOCAL calendar components
// (getFullYear/getMonth/getDate), never toISOString() (which is UTC-based
// and misreports the calendar day for part of every day in timezones
// ahead of UTC, e.g. IST/UTC+5:30) — this was a real bug found and fixed
// earlier in this project, and is the reason these helpers exist in one
// place instead of being re-derived per feature.

/** Local calendar-day key ("YYYY-MM-DD") for a Date. */
export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Converts a "YYYY-MM-DD" key to a UTC timestamp for whole-day diffing,
 * so two date-only strings can be compared without either being
 * reinterpreted through a timezone-sensitive Date parse. */
export function dateKeyToUtcTimestamp(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole-day difference (target − reference), positive if target is later. */
export function daysBetween(targetDateKey, referenceDateKey) {
  return Math.round((dateKeyToUtcTimestamp(targetDateKey) - dateKeyToUtcTimestamp(referenceDateKey)) / MS_PER_DAY);
}
