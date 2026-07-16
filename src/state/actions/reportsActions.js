// state/actions/reportsActions.js
// Bridges the reports screen to domain/reports, then updates
// state/store. UI never calls domain/reports directly — matches the
// pattern established across the other feature actions.

import { setState } from '../store.js';
import { loadReportsSummary } from '../../domain/reports/reportsService.js';

export async function loadReports() {
  setState('reports', { loading: true, error: null });
  try {
    const summary = await loadReportsSummary();
    setState('reports', { ...summary, loading: false, error: null });
  } catch (error) {
    setState('reports', { loading: false, error: error?.message || 'Failed to load reports.' });
  }
}
