// domain/backup/backupService.js
// Orchestrates manual/automatic backup, restore, and the backup audit log.
// Composes data/repositories/backupRepo (cross-store dump/restore),
// backupLogRepo (audit trail), domain/settings (config + lastBackupAt),
// domain/backup/backupRules (payload shape/validation), and
// platform/telegramClient (upload). An independent leaf like
// domain/dashboard/reports/reminders — nothing else depends on it.

import { dumpAllStores, restoreAllStores, clearAllStores } from '../../data/repositories/backupRepo.js';
import { backupLogRepo } from '../../data/repositories/backupLogRepo.js';
import { DB_VERSION } from '../../data/migrations/index.js';
import { getSettings, recordLastBackupAt } from '../settings/settingsService.js';
import { isTelegramConfigured } from '../settings/settingsRules.js';
import {
  buildBackupPayload,
  buildBackupFilename,
  validateBackupPayload,
} from './backupRules.js';
import * as telegramClient from '../../platform/telegramClient.js';
import { toDateKey } from '../../core/dateUtils.js';

/** Builds the current backup payload + a Blob/filename ready to hand off. */
export async function createBackup() {
  const dump = await dumpAllStores();
  const payload = buildBackupPayload(dump, DB_VERSION);
  const filename = buildBackupFilename(new Date(payload.exportedAt));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  return { payload, blob, filename };
}

/**
 * Runs a manual backup to the given destination ('file' | 'telegram'),
 * logging the attempt either way.
 */
export async function runManualBackup(destination) {
  const { blob, filename } = await createBackup();

  if (destination === 'file') {
    await logBackupAttempt({ trigger: 'manual', destination: 'file', status: 'success' });
    await recordLastBackupAt(new Date().toISOString());
    return { success: true, blob, filename };
  }

  if (destination === 'telegram') {
    return sendBackupToTelegram({ trigger: 'manual', blob, filename });
  }

  throw new Error(`Unknown backup destination: ${destination}`);
}

/**
 * Called on app open (see state/actions/backupActions.js -> checkAutoBackup,
 * wired from app.js bootstrap). No-ops unless auto-backup is enabled,
 * Telegram is configured, and the fixed hour has passed today without a
 * backup already having run today.
 */
export async function runAutoBackupIfDue() {
  const settings = await getSettings();
  if (!settings.autoBackupEnabled) return { ran: false, reason: 'disabled' };
  if (!isTelegramConfigured(settings)) return { ran: false, reason: 'telegram-not-configured' };
  if (!isAutoBackupDue(settings, new Date())) return { ran: false, reason: 'not-due' };

  const { blob, filename } = await createBackup();
  const result = await sendBackupToTelegram({ trigger: 'auto', blob, filename });
  return { ran: true, ...result };
}

export function isAutoBackupDue(settings, now) {
  if (now.getHours() < settings.autoBackupHour) return false;
  if (!settings.lastBackupAt) return true;
  return toDateKey(new Date(settings.lastBackupAt)) !== toDateKey(now);
}

export async function sendTestMessage() {
  const settings = await getSettings();
  if (!isTelegramConfigured(settings)) {
    return { success: false, reason: 'Telegram bot token / chat id not set.' };
  }
  return telegramClient.sendMessage({
    botToken: settings.telegramBotToken,
    chatId: settings.telegramChatId,
    text: 'Wellnest CRM: this is a test message. Telegram backup is configured correctly.',
  });
}

/** Validates a parsed backup payload and, if valid, restores it. */
export async function restoreBackup(payload) {
  const validation = validateBackupPayload(payload, DB_VERSION);
  if (!validation.valid) {
    await logBackupAttempt({
      trigger: 'restore',
      destination: 'n/a',
      status: 'failure',
      error: validation.errors.join(' '),
    });
    return { success: false, errors: validation.errors };
  }

  await restoreAllStores(payload.data);
  await logBackupAttempt({ trigger: 'restore', destination: 'n/a', status: 'success' });
  return { success: true };
}

export async function getBackupLog() {
  const log = await backupLogRepo.getAll();
  return log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Factory reset: wipes every store (clients, programs, payments, supplements,
 * consultation notes, reminders, settings — everything) back to empty.
 * Clears first, then writes a single 'reset' entry to the now-empty
 * backupLog so there's still a record of when/that it happened.
 */
export async function resetAllData() {
  await clearAllStores();
  await logBackupAttempt({ trigger: 'reset', destination: 'n/a', status: 'success' });
  return { success: true };
}

async function sendBackupToTelegram({ trigger, blob, filename }) {
  const settings = await getSettings();
  if (!isTelegramConfigured(settings)) {
    await logBackupAttempt({
      trigger,
      destination: 'telegram',
      status: 'failure',
      error: 'Telegram not configured',
    });
    return { success: false, reason: 'Telegram bot token / chat id not set.' };
  }

  const result = await telegramClient.sendDocument({
    botToken: settings.telegramBotToken,
    chatId: settings.telegramChatId,
    blob,
    filename,
    caption: `Wellnest CRM backup — ${filename}`,
  });

  await logBackupAttempt({
    trigger,
    destination: 'telegram',
    status: result.success ? 'success' : 'failure',
    error: result.success ? null : result.reason,
  });

  if (result.success) {
    await recordLastBackupAt(new Date().toISOString());
  }

  return result;
}

async function logBackupAttempt({ trigger, destination, status, error = null }) {
  await backupLogRepo.create({
    timestamp: new Date().toISOString(),
    trigger, // 'manual' | 'auto' | 'restore' | 'reset'
    destination, // 'file' | 'telegram' | 'n/a'
    status, // 'success' | 'failure'
    error,
  });
}
