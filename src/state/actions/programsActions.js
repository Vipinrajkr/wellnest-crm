// state/actions/programsActions.js
// Bridges UI events to domain/programs, then updates state/store.
// UI never calls domain/programs directly — it goes through these
// actions, matching the pattern established in clientsActions.js.

import { setState } from '../store.js';
import * as programService from '../../domain/programs/programService.js';

export async function loadProgramsForClient(clientId) {
  setState('programs', { clientId, loading: true, error: null });
  try {
    const items = await programService.listProgramsForClient(clientId);
    setState('programs', { clientId, items, loading: false, error: null });
  } catch (error) {
    setState('programs', { clientId, loading: false, error: error?.message || 'Failed to load programs.' });
  }
}

export async function addProgram(formValues) {
  const result = await programService.createProgram(formValues);
  if (result.success) {
    await loadProgramsForClient(formValues.clientId);
  }
  return result;
}

export async function completeProgramAction(id, clientId) {
  await programService.completeProgram(id);
  await loadProgramsForClient(clientId);
}

export async function renewProgramAction(id, clientId) {
  await programService.renewProgram(id);
  await loadProgramsForClient(clientId);
}
