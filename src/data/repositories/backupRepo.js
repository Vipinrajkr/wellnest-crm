// data/repositories/backupRepo.js
// Only module allowed to open a cross-store transaction for full-database
// backup/restore. Uses getAllStoreNames()/getMultiStore() from data/db.js
// so the store list never needs to be hand-maintained as new features add
// object stores.

import { getAllStoreNames, getMultiStore } from '../db.js';
import { requestToPromise, txDone } from '../idbUtils.js';

/** Reads every record from every store into a plain object keyed by store name. */
export async function dumpAllStores() {
  const storeNames = await getAllStoreNames();
  const { tx, getStore } = await getMultiStore(storeNames, 'readonly');

  // Requests are issued synchronously (before any await) so the
  // transaction doesn't auto-commit before all reads are queued.
  const reads = storeNames.map((name) => requestToPromise(getStore(name).getAll()));
  const [results] = await Promise.all([Promise.all(reads), txDone(tx)]);

  const dump = {};
  storeNames.forEach((name, index) => {
    dump[name] = results[index];
  });
  return dump;
}

/**
 * Clears and repopulates every store from a backup dump in a single
 * transaction — either the whole restore succeeds, or none of it applies.
 * Stores present in the live database but absent from an older dump are
 * simply cleared and left empty (dump[name] defaults to []).
 */
export async function restoreAllStores(dump) {
  const storeNames = await getAllStoreNames();
  const { tx, getStore } = await getMultiStore(storeNames, 'readwrite');

  storeNames.forEach((name) => {
    const store = getStore(name);
    store.clear();
    const records = dump[name] || [];
    records.forEach((record) => store.put(record));
  });

  await txDone(tx);
}

/**
 * Factory reset: clears every store (including 'settings', so Telegram
 * config/theme/logo revert to defaults too) in one atomic transaction.
 * Used by Settings' "Reset" action — distinct from restoreAllStores in
 * intent (wiping, not repopulating from a backup) even though the
 * clear-everything mechanics are the same.
 */
export async function clearAllStores() {
  const storeNames = await getAllStoreNames();
  const { tx, getStore } = await getMultiStore(storeNames, 'readwrite');

  storeNames.forEach((name) => getStore(name).clear());

  await txDone(tx);
}
