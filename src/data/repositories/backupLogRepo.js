// data/repositories/backupLogRepo.js
// Only module allowed to open a transaction against the 'backupLog' store.
// Append-only audit trail of backup attempts (manual + automatic).

import { getStore } from '../db.js';
import { requestToPromise, txDone } from '../idbUtils.js';

const STORE_NAME = 'backupLog';

export const backupLogRepo = {
  async getAll() {
    const { store } = await getStore(STORE_NAME, 'readonly');
    return requestToPromise(store.getAll());
  },

  async create(record) {
    const { store, tx } = await getStore(STORE_NAME, 'readwrite');
    await requestToPromise(store.add(record));
    await txDone(tx);
  },
};
