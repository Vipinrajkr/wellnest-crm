// data/repositories/supplementsRepo.js
// Only module allowed to open a transaction against the 'supplements'
// store. Exposes a small CRUD API; no validation or business rules here —
// that lives in domain/supplements.

import { getStore } from '../db.js';
import { requestToPromise, txDone } from '../idbUtils.js';

const STORE_NAME = 'supplements';

export const supplementsRepo = {
  async getAll() {
    const { store } = await getStore(STORE_NAME, 'readonly');
    return requestToPromise(store.getAll());
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

  async update(id, record) {
    const { store, tx } = await getStore(STORE_NAME, 'readwrite');
    await requestToPromise(store.put({ ...record, id }));
    await txDone(tx);
  },

  async remove(id) {
    const { store, tx } = await getStore(STORE_NAME, 'readwrite');
    await requestToPromise(store.delete(id));
    await txDone(tx);
  },
};
