// data/repositories/settingsRepo.js
// Only module allowed to open a transaction against the 'settings' store.
// Single-row store: always read/written at the fixed key SETTINGS_ID, since
// this app has exactly one user/clinic configuration record.

import { getStore } from '../db.js';
import { requestToPromise, txDone } from '../idbUtils.js';

const STORE_NAME = 'settings';
// Not exported — nothing outside this file needs the fixed key itself,
// only the get()/save() API below.
const SETTINGS_ID = 'app';

export const settingsRepo = {
  async get() {
    const { store } = await getStore(STORE_NAME, 'readonly');
    return requestToPromise(store.get(SETTINGS_ID));
  },

  async save(record) {
    const { store, tx } = await getStore(STORE_NAME, 'readwrite');
    await requestToPromise(store.put({ ...record, id: SETTINGS_ID }));
    await txDone(tx);
  },
};
