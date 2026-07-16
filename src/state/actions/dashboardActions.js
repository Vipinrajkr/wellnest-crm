// state/actions/dashboardActions.js
// Bridges the dashboard screen to domain/dashboard, then updates
// state/store. UI never calls domain/dashboard directly — matches the
// pattern established across the other feature actions.

import { setState } from '../store.js';
import { loadDashboardSummary } from '../../domain/dashboard/dashboardService.js';

export async function loadDashboard() {
  setState('dashboard', { loading: true, error: null });
  try {
    const summary = await loadDashboardSummary();
    setState('dashboard', { ...summary, loading: false, error: null });
  } catch (error) {
    setState('dashboard', { loading: false, error: error?.message || 'Failed to load dashboard.' });
  }
}
