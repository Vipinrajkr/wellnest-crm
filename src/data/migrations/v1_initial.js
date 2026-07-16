// data/migrations/v1_initial.js
// Creates the initial object stores. Only the 'clients' store is defined
// for now — later modules add their own stores in their own migration
// file, registered in migrations/index.js.

export function migrateV1(db) {
  if (!db.objectStoreNames.contains('clients')) {
    const clientsStore = db.createObjectStore('clients', {
      keyPath: 'id',
      autoIncrement: true,
    });
    clientsStore.createIndex('fullName', 'fullName', { unique: false });
    clientsStore.createIndex('status', 'status', { unique: false });
    clientsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
  }
}
