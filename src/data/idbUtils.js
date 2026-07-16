// data/idbUtils.js
// Shared IndexedDB request/transaction promisification. Consolidated here
// after an audit found byte-for-byte identical copies of both helpers in
// every repository file. Only data/ modules should import this — it's an
// implementation detail of the repository pattern, not a public API.

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
