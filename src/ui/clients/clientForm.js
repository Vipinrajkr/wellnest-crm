// ui/clients/clientForm.js
// Renders the Add/Edit client form. Delegates validation to the domain
// layer via state actions — this module only handles form wiring and
// displaying whatever errors come back.

import { navigate } from '../../core/router.js';
import {
  submitNewClient,
  submitClientEdit,
  loadClientForEdit,
} from '../../state/actions/clientsActions.js';
import { CLIENT_STATUS_ORDER, CLIENT_STATUS_LABELS } from '../../domain/clients/clientRules.js';

export async function renderClientForm(container, params = {}) {
  const clientId = params.id ? Number(params.id) : null;
  const existing = clientId ? await loadClientForEdit(clientId) : null;

  if (clientId && !existing) {
    container.innerHTML = `
      <section class="screen">
        <header class="screen-header"><h1>Client not found</h1></header>
        <div class="screen-placeholder">This client no longer exists.</div>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="screen">
      <header class="screen-header">
        <h1>${clientId ? 'Edit Client' : 'Add Client'}</h1>
      </header>

      <form class="client-form" id="client-form" novalidate>
        <div class="client-form__error" id="form-error" hidden></div>

        <label class="client-form__field">
          <span>Full name *</span>
          <input type="text" name="fullName" value="${escapeAttr(existing?.fullName)}" required />
          <span class="client-form__field-error" data-error-for="fullName"></span>
        </label>

        <label class="client-form__field">
          <span>Phone</span>
          <input type="tel" name="phone" value="${escapeAttr(existing?.phone)}" />
          <span class="client-form__field-error" data-error-for="phone"></span>
        </label>

        <label class="client-form__field">
          <span>Email</span>
          <input type="email" name="email" value="${escapeAttr(existing?.email)}" />
          <span class="client-form__field-error" data-error-for="email"></span>
        </label>

        <label class="client-form__field">
          <span>Gender</span>
          <select name="gender">
            <option value="" ${!existing?.gender ? 'selected' : ''}>Not specified</option>
            <option value="female" ${existing?.gender === 'female' ? 'selected' : ''}>Female</option>
            <option value="male" ${existing?.gender === 'male' ? 'selected' : ''}>Male</option>
            <option value="other" ${existing?.gender === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </label>

        <label class="client-form__field">
          <span>Date of birth</span>
          <input type="date" name="dob" value="${escapeAttr(existing?.dob)}" />
        </label>

        <label class="client-form__field">
          <span>Height (cm)</span>
          <input type="number" name="height_cm" min="0" step="0.1" value="${existing?.height_cm ?? ''}" />
          <span class="client-form__field-error" data-error-for="height_cm"></span>
        </label>

        <label class="client-form__field">
          <span>Status</span>
          <select name="status">
            ${CLIENT_STATUS_ORDER.map(
              (status) =>
                `<option value="${status}" ${existing?.status === status ? 'selected' : ''}>${CLIENT_STATUS_LABELS[status]}</option>`
            ).join('')}
          </select>
        </label>

        <label class="client-form__field">
          <span>Goals</span>
          <textarea name="goals" rows="2">${escapeHtml(existing?.goals)}</textarea>
        </label>

        <label class="client-form__field">
          <span>Medical notes</span>
          <textarea name="medicalNotes" rows="2">${escapeHtml(existing?.medicalNotes)}</textarea>
        </label>

        <div class="client-form__actions">
          <button type="button" class="button button--ghost" id="cancel-button">Cancel</button>
          <button type="submit" class="button button--primary">${clientId ? 'Save Changes' : 'Add Client'}</button>
        </div>
      </form>
    </section>
  `;

  const form = container.querySelector('#client-form');
  const cancelButton = container.querySelector('#cancel-button');

  cancelButton.addEventListener('click', () => navigate('/clients'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);

    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());

    const result = clientId
      ? await submitClientEdit(clientId, values)
      : await submitNewClient(values);

    if (result.success) {
      navigate('/clients');
    } else {
      showErrors(form, result.errors);
    }
  });
}

function escapeAttr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clearErrors(form) {
  form.querySelectorAll('.client-form__field-error').forEach((el) => {
    el.textContent = '';
  });
  const globalError = form.querySelector('#form-error');
  if (globalError) {
    globalError.hidden = true;
    globalError.textContent = '';
  }
}

function showErrors(form, errors = {}) {
  Object.entries(errors).forEach(([field, message]) => {
    if (field === '_global') {
      const globalError = form.querySelector('#form-error');
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
