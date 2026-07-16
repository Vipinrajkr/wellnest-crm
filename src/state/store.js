// state/store.js
// In-memory view-state container. Not a cache of business rules — just
// what's currently on screen (list results, active filters, loading flags).
// UI subscribes via core/eventBus rather than reading this object directly
// on a timer, so screens re-render only when something actually changed.

import { emit } from '../core/eventBus.js';

// Every slice below carries a matching `error: null` field (populated by
// its feature's load action on failure — see state/actions/*.js — and
// rendered via ui/shared/asyncState.js's renderErrorState), on top of the
// existing `loading` flag.

const state = {
  clients: {
    items: [],
    searchTerm: '',
    statusFilter: 'all',
    loading: false,
    error: null,
  },
  programs: {
    clientId: null,
    items: [],
    loading: false,
    error: null,
  },
  ledger: {
    programId: null,
    payments: [],
    summary: null,
    loading: false,
    error: null,
  },
  supplements: {
    clientId: null,
    items: [],
    loading: false,
    error: null,
  },
  consultationNotes: {
    clientId: null,
    items: [],
    loading: false,
    error: null,
  },
  dashboard: {
    clientCounts: null,
    todaysFollowUps: [],
    programsEnding: [],
    pendingPayments: null,
    todaysCollection: 0,
    monthlyRevenue: 0,
    loading: false,
    error: null,
  },
  reports: {
    totals: null,
    monthlyCollections: [],
    clientCounts: null,
    clientTotal: 0,
    programCounts: null,
    programTotal: 0,
    programs: [],
    clients: [],
    payments: [],
    loading: false,
    error: null,
  },
  reminders: {
    // null until the first load ever completes (see state/dashboard's
    // clientCounts for the same convention) — distinguishes "not loaded
    // yet" from "loaded, zero reminders" so a later loading/error state
    // never hides an already-visible list (see remindersPanel.js).
    items: null,
    notificationsSupported: false,
    loading: false,
    error: null,
  },
  settings: {
    data: null,
    loading: false,
    error: null,
  },
  backup: {
    log: [],
    loading: false,
    running: false,
    lastResult: null,
    error: null,
  },
};

export function getState(key) {
  return state[key];
}

export function setState(key, partial) {
  state[key] = { ...state[key], ...partial };
  emit(`state:${key}`, state[key]);
}
