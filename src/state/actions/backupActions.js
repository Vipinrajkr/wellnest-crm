// state/actions/backupActions.js
// Bridges the Settings screen's backup/restore UI to domain/backup, then
// updates state/store. UI never calls domain/backup directly.

import { setState, getState } from '../store.js';
import * as backupService from '../../domain/backup/backupService.js';
import { downloadBlob } from '../../services/fileExport.js';
import { loadSettings } from './settingsActions.js';
import { isTelegramConfigured } from '../../domain/settings/settingsRules.js';
import { syncBackupStatus } from '../../platform/backgroundRunnerBridge.js';

export async function loadBackupLog() {
  setState('backup', { loading: true, error: null });
  try {
    const log = await backupService.getBackupLog();
    setState('backup', { log, loading: false, error: null });
  } catch (error) {
    setState('backup', { loading: false, error: error?.message || 'Failed to load backup log.' });
  }
}

/**
 * Re-mirrors the current settings (specifically lastBackupAt, which
 * changes after every successful backup) into the Background Runner's
 * CapacitorKV store — see platform/backgroundRunnerBridge.js. Called
 * after any operation that updates lastBackupAt, so the periodic
 * WorkManager check (platform/backgroundTask.js) never reads stale data.
 */
async function refreshBackgroundRunnerMirror() {
  const settings = getState('settings').data;
  if (!settings) return;
  syncBackupStatus({
    autoBackupEnabled: settings.autoBackupEnabled,
    autoBackupHour: settings.autoBackupHour,
    telegramConfigured: isTelegramConfigured(settings),
    lastBackupAt: settings.lastBackupAt,
  });
}

export async function runManualBackupToFile() {
  setState('backup', { running: true, lastResult: null });
  try {
    const result = await backupService.runManualBackup('file');
    downloadBlob(result.blob, result.filename);
    setState('backup', { running: false, lastResult: { success: true, destination: 'file' } });
  } catch (error) {
    setState('backup', {
      running: false,
      lastResult: { success: false, reason: error?.message || 'Backup failed.' },
    });
  }
  await loadBackupLog();
  await loadSettings();
  await refreshBackgroundRunnerMirror();
}

export async function runManualBackupToTelegram() {
  setState('backup', { running: true, lastResult: null });
  const result = await backupService.runManualBackup('telegram');
  setState('backup', {
    running: false,
    lastResult: { success: result.success, reason: result.reason, destination: 'telegram' },
  });
  await loadBackupLog();
  await loadSettings();
  await refreshBackgroundRunnerMirror();
  return result;
}

export async function sendTestMessageAction() {
  return backupService.sendTestMessage();
}

export async function restoreBackupFromPayload(payload) {
  setState('backup', { running: true, lastResult: null });
  const result = await backupService.restoreBackup(payload);
  setState('backup', {
    running: false,
    lastResult: { success: result.success, reason: (result.errors || []).join(' ') },
  });
  await loadBackupLog();
  return result;
}

/**
 * Factory reset — wipes every store, including settings. The Settings
 * screen reloads the page after this resolves so every in-memory state
 * slice (not just 'settings'/'backup') gets re-initialized from empty
 * stores rather than trying to selectively reset each feature's state.
 */
export async function resetAllDataAction() {
  return backupService.resetAllData();
}

/**
 * Called once on app bootstrap (see app.js). Fire-and-forget — doesn't
 * block initial render. No-ops unless auto-backup is due (see
 * domain/backup/backupService.isAutoBackupDue).
 */
export async function checkAutoBackup() {
  const result = await backupService.runAutoBackupIfDue();
  if (result.ran) {
    const current = getState('backup');
    if (current) await loadBackupLog();
    await loadSettings();
    await refreshBackgroundRunnerMirror();
  }
  return result;
}
