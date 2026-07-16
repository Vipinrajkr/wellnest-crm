// core/eventBus.js
// Minimal pub/sub used by the state layer to notify UI of changes,
// without giving UI a direct reference to state internals.

const listeners = new Map();

export function on(eventName, handler) {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName).add(handler);
  return () => off(eventName, handler);
}

export function off(eventName, handler) {
  listeners.get(eventName)?.delete(handler);
}

export function emit(eventName, payload) {
  listeners.get(eventName)?.forEach((handler) => handler(payload));
}
