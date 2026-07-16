// platform/backgroundRunnerBridge.js
// Thin adapter over Capacitor's Background Runner plugin, accessed via
// the global `window.Capacitor.Plugins.BackgroundRunner` bridge (same
// no-bundler pattern as platform/notificationsAdapter.js). Degrades to a
// safe no-op outside the native Capacitor shell.
//
// Background Runner executes src/platform/backgroundTask.js in an
// isolated JS context with NO access to this app's IndexedDB or DOM —
// see that file's header comment for the full explanation. This bridge's
// only job is mirroring the small set of fields the background task
// needs (via CapacitorKV, written from inside the runner) so the OS-
// triggered periodic check has something to read. It cannot mirror or
// trigger the actual backup upload itself.

const RUNNER_LABEL = 'com.wellnest.crm.backuprunner';

function getPlugin() {
  return (typeof window !== 'undefined' && window.Capacitor?.Plugins?.BackgroundRunner) || null;
}

/**
 * Pushes the fields backgroundTask.js's `checkBackupDue` handler needs
 * into the runner's CapacitorKV store, by dispatching a `syncStatus`
 * event the runner script also listens for. Call this whenever settings
 * are saved or a backup completes (see state/actions/settingsActions.js
 * and state/actions/backupActions.js) — best-effort, never blocks or
 * throws into the caller.
 * @param {{ autoBackupEnabled: boolean, autoBackupHour: number, telegramConfigured: boolean, lastBackupAt: string|null }} status
 */
export async function syncBackupStatus(status) {
  const plugin = getPlugin();
  if (!plugin) return;

  try {
    await plugin.dispatchEvent({
      label: RUNNER_LABEL,
      event: 'syncStatus',
      details: {
        autoBackupEnabled: String(Boolean(status.autoBackupEnabled)),
        autoBackupHour: String(status.autoBackupHour ?? 20),
        telegramConfigured: String(Boolean(status.telegramConfigured)),
        lastBackupAt: status.lastBackupAt || '',
      },
    });
  } catch {
    // Mirror is best-effort — the foreground checkAutoBackup() path (see
    // domain/backup/backupService.js) remains the source of truth.
  }
}
