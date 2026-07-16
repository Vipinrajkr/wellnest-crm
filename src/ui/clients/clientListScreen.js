// ui/clients/clientListScreen.js
// Client list: search, status filters, and CRUD entry points.
// Renders from state/store + state/actions only — no direct data or
// domain calls from the UI layer.

import { navigate } from '../../core/router.js';
import { on } from '../../core/eventBus.js';
import { debounce } from '../../core/debounce.js';
import { getState } from '../../state/store.js';
import {
  loadClients,
  setSearchTerm,
  setStatusFilter,
  removeClient,
} from '../../state/actions/clientsActions.js';
import { CLIENT_STATUS_ORDER, CLIENT_STATUS_LABELS } from '../../domain/clients/clientRules.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';
import { DEFAULT_PAGE_SIZE, paginate, renderLoadMoreButton, wireLoadMore } from '../shared/pagination.js';

let unsubscribe = null;
// Windowed rendering (see ui/shared/pagination.js) so a several-hundred-
// client list doesn't build hundreds of DOM rows on one render pass — see
// PROJECT_SPEC.md §8.2. Reset whenever the search/filter combination
// changes (renderResults tracks that via lastFilterKey), so switching
// filters always starts back at the first page rather than carrying over
// an unrelated scroll position.
let visibleCount = DEFAULT_PAGE_SIZE;
let lastFilterKey = null;

// Debounced so typing doesn't fire an IndexedDB query + re-render on every
// keystroke — only once the user pauses for 250ms. The input element
// itself isn't state-controlled (see below), so this doesn't affect what
// the user sees as they type, only when the underlying search re-runs.
const debouncedSetSearchTerm = debounce((value) => setSearchTerm(value), 250);

export async function renderClientList(container) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  visibleCount = DEFAULT_PAGE_SIZE;
  lastFilterKey = null;

  container.innerHTML = `
    <section class="screen client-list">
      <header class="screen-header">
        <h1>Clients</h1>
      </header>

      <div class="client-list__toolbar">
        <input
          type="search"
          class="client-list__search"
          id="client-search"
          placeholder="Search by name, phone, or email"
        />
        <div class="client-list__filters" id="client-filters"></div>
      </div>

      <div class="client-list__results" id="client-results"></div>
    </section>
  `;

  const searchInput = container.querySelector('#client-search');
  const filtersEl = container.querySelector('#client-filters');
  const resultsEl = container.querySelector('#client-results');

  const initial = getState('clients');
  searchInput.value = initial.searchTerm;
  renderFilterChips(filtersEl, initial.statusFilter);
  renderResults(resultsEl, initial);

  searchInput.addEventListener('input', (event) => {
    debouncedSetSearchTerm(event.target.value);
  });

  filtersEl.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-status]');
    if (!chip) return;
    setStatusFilter(chip.dataset.status);
  });

  resultsEl.addEventListener('click', (event) => {
    const editTarget = event.target.closest('[data-edit-id]');
    if (editTarget) {
      navigate(`/clients/edit/${editTarget.dataset.editId}`);
      return;
    }

    const deleteTarget = event.target.closest('[data-delete-id]');
    if (deleteTarget) {
      const confirmed = window.confirm('Remove this client? This cannot be undone.');
      if (confirmed) {
        removeClient(Number(deleteTarget.dataset.deleteId));
      }
      return;
    }

    const viewTarget = event.target.closest('[data-view-id]');
    if (viewTarget) {
      navigate(`/clients/${viewTarget.dataset.viewId}`);
    }
  });

  unsubscribe = on('state:clients', (clientsState) => {
    renderFilterChips(filtersEl, clientsState.statusFilter);
    renderResults(resultsEl, clientsState);
  });

  await loadClients();
}

function renderFilterChips(filtersEl, activeStatus) {
  const chips = ['all', ...CLIENT_STATUS_ORDER];
  filtersEl.innerHTML = chips
    .map((status) => {
      const label = status === 'all' ? 'All' : CLIENT_STATUS_LABELS[status];
      const isActive = status === activeStatus;
      return `<button type="button" class="chip ${isActive ? 'chip--active' : ''}" data-status="${status}">${label}</button>`;
    })
    .join('');
}

function renderResults(resultsEl, clientsState) {
  const { items, loading, error, searchTerm, statusFilter } = clientsState;

  // A new search term or status filter is a new result set — start back
  // at the first page rather than carrying over a page position that no
  // longer means anything for the new filter.
  const filterKey = `${searchTerm}::${statusFilter}`;
  if (filterKey !== lastFilterKey) {
    visibleCount = DEFAULT_PAGE_SIZE;
    lastFilterKey = filterKey;
  }

  // Only block the list with a spinner when there's nothing to show yet
  // (first load, or a search/filter with no cached results). Once items
  // is non-empty, a background refresh (typing in search, switching a
  // filter) keeps the previous results visible instead of flashing a
  // spinner over them.
  if (loading && items.length === 0) {
    resultsEl.innerHTML = renderLoadingState('Loading clients…');
    return;
  }

  if (error && items.length === 0) {
    resultsEl.innerHTML = renderErrorState(error);
    wireRetry(resultsEl, () => loadClients());
    return;
  }

  if (!items.length) {
    resultsEl.innerHTML = `
      <div class="screen-placeholder">
        <span class="screen-placeholder__icon" aria-hidden="true">&#128269;</span>
        <span>No clients match your search or filters.</span>
      </div>
    `;
    return;
  }

  // Windowed rendering: only the first `visibleCount` matches become DOM
  // nodes on this pass (see ui/shared/pagination.js) — the full, sorted
  // `items` array from state is still the source of truth, this only
  // limits how much of it gets rendered at once.
  const visibleItems = paginate(items, visibleCount);

  resultsEl.innerHTML = `
    <div class="fade-in">
      <ul class="client-list__items" aria-live="polite">
        ${visibleItems.map((client) => renderClientRow(client)).join('')}
      </ul>
      ${renderLoadMoreButton(items.length, visibleCount)}
    </div>
  `;

  wireLoadMore(resultsEl, () => {
    visibleCount += DEFAULT_PAGE_SIZE;
    renderResults(resultsEl, getState('clients'));
  });
}

function renderClientRow(client) {
  return `
    <li class="client-row">
      <button type="button" class="client-row__info" data-view-id="${client.id}">
        <span class="client-row__name">${escapeHtml(client.fullName)}</span>
        <span class="client-row__meta">${escapeHtml(client.phone || client.email || 'No contact info')}</span>
      </button>
      <span class="status-badge status-badge--${client.status}">${CLIENT_STATUS_LABELS[client.status] || client.status}</span>
      <div class="client-row__actions">
        <button type="button" class="icon-button" data-edit-id="${client.id}" aria-label="Edit client">✎</button>
        <button type="button" class="icon-button icon-button--danger" data-delete-id="${client.id}" aria-label="Delete client">🗑</button>
      </div>
    </li>
  `;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
