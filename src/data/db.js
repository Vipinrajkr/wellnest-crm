// data/db.js
// Owns opening the IndexedDB database and running versioned migrations.
// No feature/business logic here — only schema setup and store handles.
// Repositories are the only other layer allowed to import this module.

import { applyMigrations, DB_VERSION } from './migrations/index.js';

const DB_NAME = 'wellnest_db';

let dbInstance = null;
let openPromise = null;

// Not exported — only getStore()/getAllStoreNames()/getMultiStore() below
// need it; every other module already goes through one of those.
function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      applyMigrations(request.result, event.oldVersion, event.newVersion);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      openPromise = null;
      reject(request.error);
    };
  });

  return openPromise;
}

/**
 * @param {string} storeName
 * @param {'readonly'|'readwrite'} mode
 */
export async function getStore(storeName, mode = 'readonly') {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  return { tx, store: tx.objectStore(storeName) };
}

/** Every object store name currently in the database — used by
 * data/repositories/backupRepo.js so full backup/restore doesn't need a
 * hardcoded list of stores kept in sync by hand. */
export async function getAllStoreNames() {
  const db = await openDatabase();
  return Array.from(db.objectStoreNames);
}

/**
 * Opens one transaction spanning multiple stores at once — needed for an
 * atomic full-database restore (all stores clear + repopulate together,
 * or none do). Regular feature repositories still use getStore() above
 * for their single-store CRUD; this is only for backup/restore's
 * cross-store need.
 * @param {string[]} storeNames
 * @param {'readonly'|'readwrite'} mode
 */
export async function getMultiStore(storeNames, mode = 'readonly') {
  const db = await openDatabase();
  const tx = db.transaction(storeNames, mode);
  return { tx, getStore: (name) => tx.objectStore(name) };
}
