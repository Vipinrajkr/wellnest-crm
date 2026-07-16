// core/debounce.js
// Generic debounce helper — app-wide plumbing, not feature-specific (see
// ARCHITECTURE.md's definition of core/). Added during the production
// optimization pass to stop the Clients search input from firing an
// IndexedDB query + re-render on every keystroke; the same helper is
// available to any future feature with the same "wait for the user to
// pause typing" need.

/**
 * Returns a wrapped version of `fn` that only runs `wait` ms after the
 * last call — every call within that window resets the timer, so `fn`
 * only actually runs once the caller has stopped calling it.
 * @param {Function} fn
 * @param {number} wait milliseconds
 */
export function debounce(fn, wait = 250) {
  let timeoutId = null;
  return function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, wait);
  };
}
