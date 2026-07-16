// state/actions/supplementsActions.js
// Bridges UI events to domain/supplements, then updates state/store.
// UI never calls domain/supplements directly — matches the pattern
// established in clientsActions.js and programsActions.js.

import { setState } from '../store.js';
import * as supplementService from '../../domain/supplements/supplementService.js';

export async function loadSupplementsForClient(clientId) {
  setState('supplements', { clientId, loading: true, error: null });
  try {
    const items = await supplementService.listSupplementsForClient(clientId);
    setState('supplements', { clientId, items, loading: false, error: null });
  } catch (error) {
    setState('supplements', { clientId, loading: false, error: error?.message || 'Failed to load supplements.' });
  }
}

export async function addSupplement(formValues) {
  const result = await supplementService.createSupplement(formValues);
  if (result.success) {
    await loadSupplementsForClient(formValues.clientId);
  }
  return result;
}

export async function completeSupplementAction(id, clientId) {
  await supplementService.completeSupplement(id);
  await loadSupplementsForClient(clientId);
}

export async function discontinueSupplementAction(id, clientId) {
  await supplementService.discontinueSupplement(id);
  await loadSupplementsForClient(clientId);
}
