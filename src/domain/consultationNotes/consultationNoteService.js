// domain/consultationNotes/consultationNoteService.js
// Orchestrates consultation note CRUD. Delegates persistence to the
// consultationNotes repository; validation and the derived BMI come from
// consultationNoteRules. Looks up the client's height via domain/clients
// (not clientsRepo directly) to keep this a domain-to-domain call rather
// than reaching past another feature's data layer.

import { consultationNotesRepo } from '../../data/repositories/consultationNotesRepo.js';
import { getClient } from '../clients/clientService.js';
import { normalizeConsultationNoteInput, validateConsultationNote, calculateBmi } from './consultationNoteRules.js';

export async function listNotesForClient(clientId) {
  const notes = await consultationNotesRepo.getByClientId(Number(clientId));
  return notes.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function getNote(id) {
  return consultationNotesRepo.getById(id);
}

export async function createNote(input) {
  const normalized = normalizeConsultationNoteInput(input);
  const { isValid, errors } = validateConsultationNote(normalized);
  if (!isValid) {
    return { success: false, errors };
  }

  const client = await getClient(normalized.clientId);
  const bmi = calculateBmi(normalized.weight, client?.height_cm);

  const now = new Date().toISOString();
  const record = { ...normalized, bmi, createdAt: now, updatedAt: now };
  const id = await consultationNotesRepo.create(record);
  return { success: true, id };
}

export async function updateNote(id, input) {
  const normalized = normalizeConsultationNoteInput(input);
  const { isValid, errors } = validateConsultationNote(normalized);
  if (!isValid) {
    return { success: false, errors };
  }

  const existing = await consultationNotesRepo.getById(id);
  if (!existing) {
    return { success: false, errors: { _global: 'Consultation note not found.' } };
  }

  const client = await getClient(normalized.clientId);
  const bmi = calculateBmi(normalized.weight, client?.height_cm);

  const updated = { ...existing, ...normalized, bmi, updatedAt: new Date().toISOString() };
  await consultationNotesRepo.update(id, updated);
  return { success: true };
}

export async function deleteNote(id) {
  await consultationNotesRepo.remove(id);
  return { success: true };
}
