// data/migrations/v2_add_programs.js
// Adds the 'programs' object store: each record is one enrollment period
// for a client (a client can have many, including concurrent, programs).

export function migrateV2(db) {
  if (!db.objectStoreNames.contains('programs')) {
    const programsStore = db.createObjectStore('programs', {
      keyPath: 'id',
      autoIncrement: true,
    });
    programsStore.createIndex('clientId', 'clientId', { unique: false });
    programsStore.createIndex('status', 'status', { unique: false });
    programsStore.createIndex('endDate', 'endDate', { unique: false });
  }
}
