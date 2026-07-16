// data/migrations/v5_add_consultation_notes.js
// Adds the 'consultationNotes' object store: an unlimited, per-client log
// combining vitals (Weight, BMI, Body Fat, Waist, BP) with clinical notes
// (Medical Notes, Diet Changes, Follow-up). Consolidates what the spec
// originally sketched as separate 'measurements' and 'consultations'
// stores (neither of which had been implemented yet) into one entity.

export function migrateV5(db) {
  if (!db.objectStoreNames.contains('consultationNotes')) {
    const store = db.createObjectStore('consultationNotes', {
      keyPath: 'id',
      autoIncrement: true,
    });
    store.createIndex('clientId', 'clientId', { unique: false });
    store.createIndex('date', 'date', { unique: false });
  }
}
