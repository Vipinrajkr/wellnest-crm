// state/actions/clientsActions.js
// Bridges UI events to the domain layer, then updates state/store.
// UI never calls domain/clients directly — it goes through these actions,
// keeping the dependency direction UI -> state -> domain intact.

import { getState, setState } from '../store.js';
import * as clientService from '../../domain/clients/clientService.js';

export async function loadClients() {
  const { searchTerm, statusFilter } = getState('clients');
  setState('clients', { loading: true, error: null });
  try {
    const items = await clientService.listClients({ searchTerm, status: statusFilter });
    setState('clients', { items, loading: false, error: null });
  } catch (error) {
    setState('clients', { loading: false, error: error?.message || 'Failed to load clients.' });
  }
}

export async function setSearchTerm(searchTerm) {
  setState('clients', { searchTerm });
  await loadClients();
}

export async function setStatusFilter(statusFilter) {
  setState('clients', { statusFilter });
  await loadClients();
}

export async function submitNewClient(formValues) {
  try {
    const result = await clientService.createClient(formValues);
    if (result.success) {
      await loadClients();
    }
    return result;
  } catch (error) {
    // Preserve the { success, errors } shape clientForm.js already expects
    // (errors._global renders as the form's top banner) instead of
    // throwing and leaving the submit button stuck with no feedback.
    return { success: false, errors: { _global: error?.message || 'Failed to save client. Please try again.' } };
  }
}

export async function submitClientEdit(id, formValues) {
  try {
    const result = await clientService.updateClient(id, formValues);
    if (result.success) {
      await loadClients();
    }
    return result;
  } catch (error) {
    return { success: false, errors: { _global: error?.message || 'Failed to save client. Please try again.' } };
  }
}

export async function removeClient(id) {
  try {
    await clientService.deleteClient(id);
    await loadClients();
  } catch (error) {
    // Not rethrown: the caller (clientListScreen.js) doesn't await/catch
    // this call, so surface the failure via the clients slice's error
    // field (rendered by the list's existing error banner) instead of an
    // unhandled rejection with no visible feedback.
    setState('clients', { error: error?.message || 'Failed to delete client.' });
  }
}

export async function loadClientForEdit(id) {
  return clientService.getClient(id);
}
