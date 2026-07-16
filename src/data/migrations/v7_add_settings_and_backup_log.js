// data/migrations/v7_add_settings_and_backup_log.js
// Adds the 'settings' store (single record, keyed by a fixed id — see
// data/repositories/settingsRepo.js) and the 'backupLog' store (an
// append-only audit trail of backup attempts).

export function migrateV7(db) {
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'id' });
  }

  if (!db.objectStoreNames.contains('backupLog')) {
    const backupLogStore = db.createObjectStore('backupLog', {
      keyPath: 'id',
      autoIncrement: true,
    });
    backupLogStore.createIndex('timestamp', 'timestamp', { unique: false });
  }
}
