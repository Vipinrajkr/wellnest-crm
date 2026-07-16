// state/actions/settingsActions.js
// Bridges the Settings screen to domain/settings, then updates
// state/store. UI never calls domain/settings directly.

import { setState } from '../store.js';
import * as settingsService from '../../domain/settings/settingsService.js';
import { isTelegramConfigured } from '../../domain/settings/settingsRules.js';
import { syncBackupStatus } from '../../platform/backgroundRunnerBridge.js';

export async function loadSettings() {
  setState('settings', { loading: true, error: null });
  try {
    const data = await settingsService.getSettings();
    setState('settings', { data, loading: false, error: null });
  } catch (error) {
    setState('settings', { loading: false, error: error?.message || 'Failed to load settings.' });
  }
}

export async function saveSettings(formValues) {
  const data = await settingsService.updateSettings(formValues);
  setState('settings', { data, loading: false });
  // Fire-and-forget: mirrors the auto-backup fields into the Background
  // Runner's CapacitorKV store (see platform/backgroundRunnerBridge.js) so
  // the periodic WorkManager check has current data. No-ops outside the
  // native Capacitor shell.
  syncBackupStatus({
    autoBackupEnabled: data.autoBackupEnabled,
    autoBackupHour: data.autoBackupHour,
    telegramConfigured: isTelegramConfigured(data),
    lastBackupAt: data.lastBackupAt,
  });
  return data;
}
