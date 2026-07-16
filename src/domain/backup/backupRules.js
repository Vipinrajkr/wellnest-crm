// domain/backup/backupRules.js
// Pure rules for backup payload shape and validation. No repo/IO access.

// Not exported — nothing outside this file needs the raw constant, only
// the payload it's embedded in via buildBackupPayload().
const BACKUP_FORMAT_VERSION = 1;

export function buildBackupPayload(dump, schemaVersion) {
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion,
    exportedAt: new Date().toISOString(),
    data: dump,
  };
}

export function buildBackupFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `wellnest_backup_${stamp}.json`;
}

/**
 * Validates a parsed backup payload before restore. Rejects payloads from a
 * newer schema than this app supports (an older app build must not silently
 * half-restore data it doesn't understand); older schemaVersions are
 * accepted since applyMigrations() brings the live DB forward to match.
 */
export function validateBackupPayload(payload, currentSchemaVersion) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Backup file is not valid JSON.');
    return { valid: false, errors };
  }

  if (!Number.isFinite(payload.backupFormatVersion)) {
    errors.push('Backup file is missing a valid backupFormatVersion.');
  }

  if (!Number.isFinite(payload.schemaVersion)) {
    errors.push('Backup file is missing a valid schemaVersion.');
  } else if (payload.schemaVersion > currentSchemaVersion) {
    errors.push(
      `Backup was created by a newer app version (schema ${payload.schemaVersion}) than this app supports (schema ${currentSchemaVersion}).`
    );
  }

  if (!payload.data || typeof payload.data !== 'object') {
    errors.push('Backup file has no data section.');
  }

  if (!payload.exportedAt || Number.isNaN(Date.parse(payload.exportedAt))) {
    errors.push('Backup file is missing a valid exportedAt timestamp.');
  }

  return { valid: errors.length === 0, errors };
}
