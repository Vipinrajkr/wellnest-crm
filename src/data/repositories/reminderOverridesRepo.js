// data/repositories/reminderOverridesRepo.js
// Only module allowed to open a transaction against the
// 'reminderOverrides' store. Tracks Mark Done / Snooze state for computed
// reminders (which aren't stored records themselves — see
// domain/reminders/reminderService.js).

import { getStore } from '../db.js';
import { requestToPromise, txDone } from '../idbUtils.js';

const STORE_NAME = 'reminderOverrides';

export const reminderOverridesRepo = {
  async getAll() {
    const { store } = await getStore(STORE_NAME, 'readonly');
    return requestToPromise(store.getAll());
  },

  async getById(id) {
    const { store } = await getStore(STORE_NAME, 'readonly');
    return requestToPromise(store.get(id));
  },

  async upsert(record) {
    const { store, tx } = await getStore(STORE_NAME, 'readwrite');
    await requestToPromise(store.put(record));
    await txDone(tx);
  },

  async remove(id) {
    const { store, tx } = await getStore(STORE_NAME, 'readwrite');
    await requestToPromise(store.delete(id));
    await txDone(tx);
  },
};
