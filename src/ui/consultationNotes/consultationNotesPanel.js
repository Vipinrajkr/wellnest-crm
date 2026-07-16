// ui/consultationNotes/consultationNotesPanel.js
// Renders a client's consultation notes: an unlimited, chronological log
// of vitals (Weight, auto-calculated BMI, Body Fat, Waist, BP) plus
// clinical notes (Medical Notes, Diet Changes, Follow-up). Supports
// add/edit/delete. Mounted inside ui/clients/clientDetailScreen.js.

import { on } from '../../core/eventBus.js';
import { getState } from '../../state/store.js';
import {
  loadNotesForClient,
  addNote,
  editNote,
  removeNote,
  loadNoteForEdit,
} from '../../state/actions/consultationNotesActions.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';
import { DEFAULT_PAGE_SIZE, paginate, renderLoadMoreButton, wireLoadMore } from '../shared/pagination.js';

let unsubscribe = null;
let formVisible = false;
let editingId = null;
// Same "don't hide already-visible data behind a spinner" gate used in
// programsPanel.js/dashboardScreen.js.
let hasRenderedContent = false;
// Windowed rendering (see ui/shared/pagination.js) — a client with years
// of consultation history could have hundreds of notes; see
// PROJECT_SPEC.md §8.2. Reset on every mount (new client).
let visibleCount = DEFAULT_PAGE_SIZE;

export async function renderConsultationNotesPanel(container, clientId) {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  formVisible = false;
  editingId = null;
  hasRenderedContent = false;
  visibleCount = DEFAULT_PAGE_SIZE;

  container.innerHTML = `
    <div class="consultation-notes-panel">
      <div class="consultation-notes-panel__toolbar">
        <button type="button" class="button button--primary" id="add-note-button">Add Note</button>
      </div>
      <div id="note-form-mount"></div>
      <div class="consultation-notes-panel__list" id="notes-list"></div>
    </div>
  `;

  const addButton = container.querySelector('#add-note-button');
  const formMount = container.querySelector('#note-form-mount');
  const listMount = container.querySelector('#notes-list');

  addButton.addEventListener('click', () => {
    editingId = null;
    formVisible = !formVisible;
    renderForm(formMount, clientId, addButton, null);
  });

  unsubscribe = on('state:consultationNotes', (notesState) => {
    if (notesState.clientId === clientId) {
      renderList(listMount, notesState, clientId, formMount, addButton);
    }
  });

  renderList(listMount, getState('consultationNotes'), clientId, formMount, addButton);

  await loadNotesForClient(clientId);
}

function renderForm(formMount, clientId, addButton, existing) {
  if (!formVisible) {
    formMount.innerHTML = '';
    addButton.textContent = 'Add Note';
    return;
  }

  addButton.textContent = 'Cancel';
  formMount.innerHTML = `
    <form class="note-form" id="note-form" novalidate>
      <div class="client-form__error" id="note-form-error" hidden></div>

      <label class="client-form__field">
        <span>Date *</span>
        <input type="date" name="date" value="${escapeAttr(existing?.date)}" required />
        <span class="client-form__field-error" data-error-for="date"></span>
      </label>

      <div class="note-form__row">
        <label class="client-form__field">
          <span>Weight (kg)</span>
          <input type="number" name="weight" min="0" step="0.1" value="${escapeAttr(existing?.weight)}" />
          <span class="client-form__field-error" data-error-for="weight"></span>
        </label>

        <label class="client-form__field">
          <span>Body Fat (%)</span>
          <input type="number" name="bodyFatPercent" min="0" max="100" step="0.1" value="${escapeAttr(existing?.bodyFatPercent)}" />
          <span class="client-form__field-error" data-error-for="bodyFatPercent"></span>
        </label>
      </div>

      <div class="note-form__row">
        <label class="client-form__field">
          <span>Waist (cm)</span>
          <input type="number" name="waist" min="0" step="0.1" value="${escapeAttr(existing?.waist)}" />
          <span class="client-form__field-error" data-error-for="waist"></span>
        </label>

        <label class="client-form__field">
          <span>Blood Pressure</span>
          <input type="text" name="bloodPressure" placeholder="e.g. 120/80" value="${escapeAttr(existing?.bloodPressure)}" />
        </label>
      </div>

      <label class="client-form__field">
        <span>Medical Notes</span>
        <textarea name="medicalNotes" rows="2">${escapeHtml(existing?.medicalNotes)}</textarea>
      </label>

      <label class="client-form__field">
        <span>Diet Changes</span>
        <textarea name="dietChanges" rows="2">${escapeHtml(existing?.dietChanges)}</textarea>
      </label>

      <label class="client-form__field">
        <span>Follow-up</span>
        <input type="date" name="followUpDate" value="${escapeAttr(existing?.followUpDate)}" />
        <span class="client-form__field-error" data-error-for="followUpDate"></span>
      </label>

      <div class="client-form__actions">
        <button type="submit" class="button button--primary">${existing ? 'Save Changes' : 'Save Note'}</button>
      </div>
    </form>
  `;

  const form = formMount.querySelector('#note-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const formData = new FormData(form);
    const values = { ...Object.fromEntries(formData.entries()), clientId };

    const result = editingId ? await editNote(editingId, values) : await addNote(values);

    if (result.success) {
      formVisible = false;
      editingId = null;
      renderForm(formMount, clientId, addButton, null);
    } else {
      showErrors(form, result.errors);
    }
  });
}

function renderList(listMount, notesState, clientId, formMount, addButton) {
  if (!notesState || notesState.clientId !== clientId) {
    return;
  }

  if (notesState.loading && !hasRenderedContent) {
    listMount.innerHTML = renderLoadingState('Loading consultation notes…');
    return;
  }

  if (notesState.error && !hasRenderedContent) {
    listMount.innerHTML = renderErrorState(notesState.error);
    wireRetry(listMount, () => loadNotesForClient(clientId));
    return;
  }

  hasRenderedContent = true;
  const items = notesState.items || [];

  if (!items.length) {
    listMount.innerHTML = `
      <div class="fade-in">
        <div class="screen-placeholder">
          <span class="screen-placeholder__icon" aria-hidden="true">&#128221;</span>
          <span>No consultation notes yet.</span>
        </div>
      </div>
    `;
    return;
  }

  // Windowed rendering: only the first `visibleCount` notes (already
  // sorted newest-first by consultationNoteService) become DOM nodes on
  // this pass — see ui/shared/pagination.js.
  const visibleItems = paginate(items, visibleCount);

  listMount.innerHTML = `
    <div class="fade-in">
      <ul class="note-cards">
        ${visibleItems.map((note) => renderNoteCard(note)).join('')}
      </ul>
      ${renderLoadMoreButton(items.length, visibleCount)}
    </div>
  `;

  wireLoadMore(listMount, () => {
    visibleCount += DEFAULT_PAGE_SIZE;
    renderList(listMount, getState('consultationNotes'), clientId, formMount, addButton);
  });

  listMount.querySelectorAll('[data-edit-note-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const noteId = Number(button.dataset.editNoteId);
      const note = await loadNoteForEdit(noteId);
      if (!note) return;
      editingId = noteId;
      formVisible = true;
      renderForm(formMount, clientId, addButton, note);
    });
  });

  listMount.querySelectorAll('[data-delete-note-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const confirmed = window.confirm('Delete this consultation note? This cannot be undone.');
      if (confirmed) {
        removeNote(Number(button.dataset.deleteNoteId), clientId);
      }
    });
  });
}

function renderNoteCard(note) {
  return `
    <li class="note-card">
      <div class="note-card__header">
        <span class="note-card__date">${formatDate(note.date)}</span>
        <div class="note-card__actions">
          <button type="button" class="icon-button" data-edit-note-id="${note.id}" aria-label="Edit note">&#9998;</button>
          <button type="button" class="icon-button icon-button--danger" data-delete-note-id="${note.id}" aria-label="Delete note">&#128465;</button>
        </div>
      </div>

      <div class="note-card__vitals">
        ${renderVital('Weight', note.weight, ' kg')}
        ${renderVital('BMI', note.bmi, '')}
        ${renderVital('Body Fat', note.bodyFatPercent, '%')}
        ${renderVital('Waist', note.waist, ' cm')}
        ${note.bloodPressure ? renderVital('BP', note.bloodPressure, '') : ''}
      </div>

      ${note.medicalNotes ? `<div class="note-card__section"><strong>Medical Notes:</strong> ${escapeHtml(note.medicalNotes)}</div>` : ''}
      ${note.dietChanges ? `<div class="note-card__section"><strong>Diet Changes:</strong> ${escapeHtml(note.dietChanges)}</div>` : ''}
      ${note.followUpDate ? `<div class="note-card__followup">Follow-up: ${formatDate(note.followUpDate)}</div>` : ''}
    </li>
  `;
}

function renderVital(label, value, unit) {
  if (value === null || value === undefined || value === '') return '';
  return `<span class="note-vital"><span class="note-vital__label">${label}</span><span class="note-vital__value">${escapeHtml(value)}${unit}</span></span>`;
}

function clearErrors(form) {
  form.querySelectorAll('.client-form__field-error').forEach((el) => {
    el.textContent = '';
  });
  const globalError = form.querySelector('#note-form-error');
  if (globalError) {
    globalError.hidden = true;
    globalError.textContent = '';
  }
}

function showErrors(form, errors = {}) {
  Object.entries(errors).forEach(([field, message]) => {
    if (field === '_global') {
      const globalError = form.querySelector('#note-form-error');
      if (globalError) {
        globalError.hidden = false;
        globalError.textContent = message;
      }
      return;
    }
    const target = form.querySelector(`[data-error-for="${field}"]`);
    if (target) target.textContent = message;
  });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/"/g, '&quot;');
}
