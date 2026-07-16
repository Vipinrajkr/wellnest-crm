// domain/clients/clientService.js
// Orchestrates client CRUD: validates/normalizes input via clientRules,
// then delegates persistence to the clients repository. This is the only
// module the state layer calls into for client operations.

import { clientsRepo } from '../../data/repositories/clientsRepo.js';
import { validateClient, normalizeClientInput } from './clientRules.js';

export async function listClients({ searchTerm = '', status = 'all' } = {}) {
  const all = await clientsRepo.getAll();
  return all
    .filter((client) => matchesStatus(client, status))
    .filter((client) => matchesSearch(client, searchTerm))
    .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
}

export async function getClient(id) {
  return clientsRepo.getById(id);
}

export async function createClient(input) {
  const normalized = normalizeClientInput(input);
  const { isValid, errors } = validateClient(normalized);
  if (!isValid) {
    return { success: false, errors };
  }

  const now = new Date().toISOString();
  const record = { ...normalized, createdAt: now, updatedAt: now };
  const id = await clientsRepo.create(record);
  return { success: true, id };
}

export async function updateClient(id, input) {
  const normalized = normalizeClientInput(input);
  const { isValid, errors } = validateClient(normalized);
  if (!isValid) {
    return { success: false, errors };
  }

  const existing = await clientsRepo.getById(id);
  if (!existing) {
    return { success: false, errors: { _global: 'Client not found.' } };
  }

  const updated = {
    ...existing,
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  await clientsRepo.update(id, updated);
  return { success: true };
}

export async function deleteClient(id) {
  await clientsRepo.remove(id);
  return { success: true };
}

function matchesStatus(client, status) {
  if (!status || status === 'all') return true;
  return client.status === status;
}

function matchesSearch(client, searchTerm) {
  const term = (searchTerm || '').trim().toLowerCase();
  if (!term) return true;
  return (
    (client.fullName || '').toLowerCase().includes(term) ||
    (client.phone || '').toLowerCase().includes(term) ||
    (client.email || '').toLowerCase().includes(term)
  );
}
