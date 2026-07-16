// state/actions/consultationNotesActions.js
// Bridges UI events to domain/consultationNotes, then updates
// state/store. UI never calls domain/consultationNotes directly —
// matches the pattern established in clientsActions.js and
// programsActions.js.

import { setState } from '../store.js';
import * as consultationNoteService from '../../domain/consultationNotes/consultationNoteService.js';

export async function loadNotesForClient(clientId) {
  setState('consultationNotes', { clientId, loading: true, error: null });
  try {
    const items = await consultationNoteService.listNotesForClient(clientId);
    setState('consultationNotes', { clientId, items, loading: false, error: null });
  } catch (error) {
    setState('consultationNotes', { clientId, loading: false, error: error?.message || 'Failed to load consultation notes.' });
  }
}

export async function addNote(formValues) {
  const result = await consultationNoteService.createNote(formValues);
  if (result.success) {
    await loadNotesForClient(formValues.clientId);
  }
  return result;
}

export async function editNote(id, formValues) {
  const result = await consultationNoteService.updateNote(id, formValues);
  if (result.success) {
    await loadNotesForClient(formValues.clientId);
  }
  return result;
}

export async function removeNote(id, clientId) {
  await consultationNoteService.deleteNote(id);
  await loadNotesForClient(clientId);
}

export async function loadNoteForEdit(id) {
  return consultationNoteService.getNote(id);
}
