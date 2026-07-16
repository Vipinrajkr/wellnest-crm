// data/migrations/v4_add_supplements.js
// Adds the 'supplements' object store: one record per supplement
// prescribed to a client (Name, Brand, Dosage, Frequency, Start, End,
// Instructions, Status). Duration is derived from Start/End, never stored.

export function migrateV4(db) {
  if (!db.objectStoreNames.contains('supplements')) {
    const supplementsStore = db.createObjectStore('supplements', {
      keyPath: 'id',
      autoIncrement: true,
    });
    supplementsStore.createIndex('clientId', 'clientId', { unique: false });
    supplementsStore.createIndex('status', 'status', { unique: false });
    supplementsStore.createIndex('endDate', 'endDate', { unique: false });
  }
}
