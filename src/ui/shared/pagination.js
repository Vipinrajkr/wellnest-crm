// ui/shared/pagination.js
// Shared client-side "Load more" pagination for long lists — added during
// the production optimization pass to satisfy PROJECT_SPEC.md §8.2's
// "Lists (clients, consultations) should paginate or virtualize past a
// few hundred records" requirement, which had never actually been
// implemented. Deliberately simple (windowed array slicing + a manual
// "Load more" button) rather than scroll-based virtualization: it needs
// no extra dependency, no scroll-position bookkeeping across re-renders,
// and every record is still reachable — this only limits how many DOM
// nodes get built on a single render pass, which is what actually costs
// on low-end Android WebViews (see §8.2's target of Android 8+).
//
// Pure view helper — no state/domain imports, same layering as
// asyncState.js.

export const DEFAULT_PAGE_SIZE = 50;

/** Slices `items` down to the currently visible window. */
export function paginate(items, visibleCount) {
  return items.slice(0, visibleCount);
}

/**
 * @param {number} totalCount
 * @param {number} visibleCount
 * @param {{ id?: string, label?: string }} [options]
 */
export function renderLoadMoreButton(totalCount, visibleCount, options = {}) {
  if (visibleCount >= totalCount) return '';
  const id = options.id || 'load-more-button';
  const remaining = totalCount - visibleCount;
  const label = options.label || `Load ${Math.min(remaining, DEFAULT_PAGE_SIZE)} more (${remaining} remaining)`;
  return `
    <div class="load-more">
      <button type="button" class="button button--ghost" id="${id}">${label}</button>
    </div>
  `;
}

/** Wires the Load More button rendered by renderLoadMoreButton() inside container. */
export function wireLoadMore(container, onLoadMore, id = 'load-more-button') {
  const button = container.querySelector(`#${id}`);
  if (button) button.addEventListener('click', onLoadMore);
}
