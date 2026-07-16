// data/repositories/paymentsRepo.js
// Only module allowed to open a transaction against the 'payments' store.
// Payment entries are append-only (no update/remove) to keep the ledger's
// history trustworthy — corrections are handled as new entries, not edits.

import { getStore } from '../db.js';
import { requestToPromise, txDone } from '../idbUtils.js';

const STORE_NAME = 'payments';

export const paymentsRepo = {
  async getAll() {
    const { store } = await getStore(STORE_NAME, 'readonly');
    return requestToPromise(store.getAll());
  },

  async getByProgramId(programId) {
    const { store } = await getStore(STORE_NAME, 'readonly');
    const index = store.index('programId');
    return requestToPromise(index.getAll(programId));
  },

  async getByClientId(clientId) {
    const { store } = await getStore(STORE_NAME, 'readonly');
    const index = store.index('clientId');
    return requestToPromise(index.getAll(clientId));
  },

  async getById(id) {
    const { store } = await getStore(STORE_NAME, 'readonly');
    return requestToPromise(store.get(id));
  },

  async create(record) {
    const { store, tx } = await getStore(STORE_NAME, 'readwrite');
    const id = await requestToPromise(store.add(record));
    await txDone(tx);
    return id;
  },
};
