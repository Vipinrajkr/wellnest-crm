// platform/backgroundTask.js
// Runs inside Capacitor Background Runner's isolated JS environment — a
// separate, headless JS context with NO DOM, NO IndexedDB, and no access
// to anything else in this app's main WebView. Registered as a periodic
// WorkManager job on Android via capacitor.config.json's BackgroundRunner
// plugin block (event: "checkBackupDue", interval: 15 minutes).
//
// Because this context can't reach IndexedDB, it cannot itself build a
// backup payload or call platform/telegramClient.js — that still only
// happens in the foreground (domain/backup/backupService.js, triggered by
// state/actions/backupActions.js's checkAutoBackup() on app open). What
// this job DOES provide: a genuine OS-level guarantee (via WorkManager)
// that even if the app is never manually reopened, the device will
// periodically wake this script up — surviving process death and device
// reboot — to check whether a backup is overdue and nudge the user with a
// notification prompting them to open the app.
//
// The small set of fields needed for that check (autoBackupEnabled,
// autoBackupHour, whether Telegram is configured, lastBackupAt) is
// mirrored into CapacitorKV by the foreground app via
// platform/backgroundRunnerBridge.js's syncBackupStatus(), which
// dispatches the 'syncStatus' event below — CapacitorKV is the only
// storage available in this context and is NOT shared with IndexedDB.

addEventListener('syncStatus', (resolve, reject, args) => {
  try {
    const details = args?.details || {};
    CapacitorKV.set('autoBackupEnabled', String(details.autoBackupEnabled ?? 'false'));
    CapacitorKV.set('autoBackupHour', String(details.autoBackupHour ?? '20'));
    CapacitorKV.set('telegramConfigured', String(details.telegramConfigured ?? 'false'));
    CapacitorKV.set('lastBackupAt', String(details.lastBackupAt ?? ''));
    resolve();
  } catch (err) {
    reject(err);
  }
});

addEventListener('checkBackupDue', (resolve, reject) => {
  try {
    const autoBackupEnabled = CapacitorKV.get('autoBackupEnabled').value === 'true';
    const telegramConfigured = CapacitorKV.get('telegramConfigured').value === 'true';
    const autoBackupHour = Number(CapacitorKV.get('autoBackupHour').value || '20');
    const lastBackupAtRaw = CapacitorKV.get('lastBackupAt').value || '';

    if (!autoBackupEnabled || !telegramConfigured) {
      resolve();
      return;
    }

    const now = new Date();
    const isPastBackupHour = now.getHours() >= autoBackupHour;
    const lastBackupDateKey = lastBackupAtRaw ? toDateKey(new Date(lastBackupAtRaw)) : null;
    const alreadyBackedUpToday = lastBackupDateKey === toDateKey(now);

    if (isPastBackupHour && !alreadyBackedUpToday) {
      CapacitorNotifications.schedule([
        {
          id: 999001,
          title: 'Wellnest backup due',
          body: "Today's automatic backup hasn't run yet — open Wellnest to send it to Telegram.",
        },
      ]);
    }

    resolve();
  } catch (err) {
    reject(err);
  }
});

// Local calendar-day key (not toISOString(), which is UTC-based and would
// misreport "today" near midnight in timezones ahead of UTC — the same
// class of bug fixed in domain/reminders/reminderRules.js's toDateKey).
function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
