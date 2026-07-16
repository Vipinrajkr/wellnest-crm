// ui/clients/clientDetailScreen.js
// Client detail: profile summary plus the client's Programs panel
// (current programs, history, renew/complete actions), Supplements panel
// (active regimens, history, complete/discontinue actions), and
// Consultation Notes panel (unlimited chronological vitals + clinical
// notes log). Reuses the existing clientsActions.loadClientForEdit lookup
// rather than adding a new state action for a single read.

import { navigate } from '../../core/router.js';
import { loadClientForEdit } from '../../state/actions/clientsActions.js';
import { renderProgramsPanel } from '../programs/programsPanel.js';
import { renderSupplementsPanel } from '../supplements/supplementsPanel.js';
import { renderConsultationNotesPanel } from '../consultationNotes/consultationNotesPanel.js';
import { CLIENT_STATUS_LABELS } from '../../domain/clients/clientRules.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';

export async function renderClientDetail(container, params = {}) {
  const clientId = Number(params.id);

  // The router clears the outlet before calling this render function, so
  // without a placeholder the screen would be blank while this awaits —
  // show a spinner instead, and an error state (with retry) if the lookup
  // itself throws, matching the loading/error pattern used elsewhere.
  container.innerHTML = renderLoadingState('Loading client…');

  let client;
  try {
    client = await loadClientForEdit(clientId);
  } catch (error) {
    container.innerHTML = renderErrorState(error?.message || 'Failed to load client.');
    wireRetry(container, () => renderClientDetail(container, params));
    return;
  }

  if (!client) {
    container.innerHTML = `
      <section class="screen">
        <header class="screen-header"><h1>Client not found</h1></header>
        <div class="screen-placeholder">
          <span class="screen-placeholder__icon" aria-hidden="true">&#128100;</span>
          <span>This client no longer exists.</span>
        </div>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="screen client-detail fade-in">
      <header class="client-detail__header">
        <button type="button" class="icon-button" id="back-button" aria-label="Back to clients">&larr;</button>
        <div class="client-detail__heading">
          <h1>${escapeHtml(client.fullName)}</h1>
          <span class="status-badge status-badge--${client.status}">${CLIENT_STATUS_LABELS[client.status] || client.status}</span>
        </div>
        <button type="button" class="button button--ghost" id="edit-client-button">Edit</button>
      </header>

      <div class="client-detail__contact">
        ${client.phone ? `<span>${escapeHtml(client.phone)}</span>` : ''}
        ${client.email ? `<span>${escapeHtml(client.email)}</span>` : ''}
        ${!client.phone && !client.email ? `<span class="client-detail__contact-empty">No contact info on file.</span>` : ''}
      </div>

      <section class="client-detail__section">
        <h2>Programs</h2>
        <div id="programs-panel"></div>
      </section>

      <section class="client-detail__section">
        <h2>Supplements</h2>
        <div id="supplements-panel"></div>
      </section>

      <section class="client-detail__section">
        <h2>Consultation Notes</h2>
        <div id="consultation-notes-panel"></div>
      </section>
    </section>
  `;

  container.querySelector('#back-button').addEventListener('click', () => navigate('/clients'));
  container
    .querySelector('#edit-client-button')
    .addEventListener('click', () => navigate(`/clients/edit/${clientId}`));

  const programsMount = container.querySelector('#programs-panel');
  await renderProgramsPanel(programsMount, clientId);

  const supplementsMount = container.querySelector('#supplements-panel');
  await renderSupplementsPanel(supplementsMount, clientId);

  const consultationNotesMount = container.querySelector('#consultation-notes-panel');
  await renderConsultationNotesPanel(consultationNotesMount, clientId);
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
