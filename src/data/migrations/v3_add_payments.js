// data/migrations/v3_add_payments.js
// Adds the 'payments' object store: one record per payment received
// against a program (Method, Date, Reference, Amount). Paid/Pending are
// always computed from these records plus the program's fee/discount —
// never stored — so the ledger can't drift out of sync.

export function migrateV3(db) {
  if (!db.objectStoreNames.contains('payments')) {
    const paymentsStore = db.createObjectStore('payments', {
      keyPath: 'id',
      autoIncrement: true,
    });
    paymentsStore.createIndex('programId', 'programId', { unique: false });
    paymentsStore.createIndex('clientId', 'clientId', { unique: false });
    paymentsStore.createIndex('date', 'date', { unique: false });
  }
}
