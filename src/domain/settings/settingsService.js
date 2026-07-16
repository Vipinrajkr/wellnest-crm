// domain/settings/settingsService.js
// Composes settingsRepo with settingsRules to expose a merged, always
// non-null settings record to the rest of the app.

import { settingsRepo } from '../../data/repositories/settingsRepo.js';
import { DEFAULT_SETTINGS, normalizeSettingsInput } from './settingsRules.js';

export async function getSettings() {
  const stored = await settingsRepo.get();
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function updateSettings(input) {
  const current = await getSettings();
  const normalized = normalizeSettingsInput(input);
  const next = { ...current, ...normalized };
  await settingsRepo.save(next);
  return next;
}

export async function recordLastBackupAt(timestamp) {
  const current = await getSettings();
  const next = { ...current, lastBackupAt: timestamp };
  await settingsRepo.save(next);
  return next;
}
