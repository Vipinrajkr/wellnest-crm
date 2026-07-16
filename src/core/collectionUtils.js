// core/collectionUtils.js
// Shared array helper. Consolidated here after an audit found identical
// copies in domain/dashboard/dashboardService.js, domain/reports/reportsService.js,
// and domain/reminders/reminderService.js.

/** Groups items into a Map keyed by keyFn(item). */
export function groupBy(items, keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}
