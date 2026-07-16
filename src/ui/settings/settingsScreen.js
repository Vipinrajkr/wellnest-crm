// ui/settings/settingsScreen.js
// Clinic + Telegram configuration, manual backup (file/Telegram), restore
// from a backup file, and the backup attempt log. Delegates all IO to
// state/actions/settingsActions.js and state/actions/backupActions.js —
// this module only handles form wiring and rendering.

import { on } from '../../core/eventBus.js';
import { getState } from '../../state/store.js';
import { loadSettings, saveSettings } from '../../state/actions/settingsActions.js';
import {
  loadBackupLog,
  runManualBackupToFile,
  runManualBackupToTelegram,
  sendTestMessageAction,
  restoreBackupFromPayload,
  resetAllDataAction,
} from '../../state/actions/backupActions.js';
import { MAX_LOGO_BYTES } from '../../domain/settings/settingsRules.js';
import { applyTheme } from '../shell/theme.js';
import { renderLoadingState, renderErrorState, wireRetry } from '../shared/asyncState.js';

let unsubscribeSettings = null;
let unsubscribeBackup = null;

export async function renderSettings(container) {
  if (unsubscribeSettings) unsubscribeSettings();
  if (unsubscribeBackup) unsubscribeBackup();

  container.innerHTML = `
    <section class="screen settings">
      <header class="screen-header">
        <h1>Settings</h1>
      </header>
      <div id="settings-content"></div>
    </section>
  `;

  const contentEl = container.querySelector('#settings-content');

  unsubscribeSettings = on('state:settings', () => renderContent(contentEl));
  unsubscribeBackup = on('state:backup', () => renderContent(contentEl));

  renderContent(contentEl);

  await Promise.all([loadSettings(), loadBackupLog()]);
}

function renderContent(contentEl) {
  const settingsState = getState('settings');
  const backupState = getState('backup');
  const settings = settingsState.data;

  // settings.data is only null before the first load ever completes (see
  // state/store.js's initial settings slice) — once loaded, it's always an
  // object, so a later loading/error state never hides the already-visible
  // form behind a spinner.
  if (settingsState.loading && !settings) {
    contentEl.innerHTML = renderLoadingState('Loading settings…');
    return;
  }

  if (settingsState.error && !settings) {
    contentEl.innerHTML = renderErrorState(settingsState.error);
    wireRetry(contentEl, () => loadSettings());
    return;
  }

  if (!settings) {
    // Guards against a render before the initial load kicks off at all.
    contentEl.innerHTML = renderLoadingState('Loading settings…');
    return;
  }

  contentEl.innerHTML = `
    <div class="fade-in">
    <div class="settings-section">
      <h2>Clinic</h2>
      <form class="client-form" id="clinic-form" novalidate>
        <label class="client-form__field">
          <span>Clinic name</span>
          <input type="text" name="clinicName" value="${escapeAttr(settings.clinicName)}" />
        </label>
        <label class="client-form__field">
          <span>Currency</span>
          <input type="text" name="currency" value="${escapeAttr(settings.currency)}" />
        </label>
        <label class="client-form__field">
          <span>Theme</span>
          <select name="theme">
            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </label>
        <div class="client-form__field">
          <span>Clinic logo</span>
          <div class="settings-logo">
            <img
              id="logo-preview"
              class="settings-logo__preview"
              src="${settings.logoDataUrl ? escapeAttr(settings.logoDataUrl) : ''}"
              alt="Clinic logo preview"
              ${settings.logoDataUrl ? '' : 'hidden'}
            />
            <div class="settings-logo__actions">
              <input
                type="file"
                accept="image/*"
                id="logo-input"
                class="settings-file-input"
                aria-label="Choose clinic logo image"
              />
              <button type="button" class="button button--ghost" id="remove-logo">Remove Logo</button>
            </div>
          </div>
          <span class="settings-help">Shown on generated PDFs. Max ${Math.round(MAX_LOGO_BYTES / 1024)} KB.</span>
        </div>
        <div class="settings-actions">
          <button type="submit" class="button button--primary">Save Clinic Info</button>
        </div>
      </form>
    </div>

    <div class="settings-section">
      <h2>Telegram Backup</h2>
      <p class="settings-help">Used for automatic 8 PM backups and manual "Send to Telegram" backups.</p>
      <form class="client-form" id="telegram-form" novalidate>
        <label class="client-form__field">
          <span>Bot token</span>
          <input type="password" name="telegramBotToken" value="${escapeAttr(settings.telegramBotToken)}" autocomplete="off" />
        </label>
        <label class="client-form__field">
          <span>Chat ID</span>
          <input type="text" name="telegramChatId" value="${escapeAttr(settings.telegramChatId)}" />
        </label>
        <label class="client-form__field client-form__field--checkbox">
          <input type="checkbox" name="autoBackupEnabled" ${settings.autoBackupEnabled ? 'checked' : ''} />
          <span>Enable automatic daily backup</span>
        </label>
        <label class="client-form__field">
          <span>Backup Time</span>
          <select name="autoBackupHour">
            ${hourOptions(settings.autoBackupHour)}
          </select>
        </label>
        <div class="settings-actions">
          <button type="submit" class="button button--primary">Save Telegram Settings</button>
          <button type="button" class="button button--ghost" id="send-test-message">Send Test Message</button>
        </div>
        <div class="settings-feedback" id="telegram-feedback" role="status" aria-live="polite" hidden></div>
      </form>
      <div class="settings-last-backup">
        Last successful backup: ${settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : 'Never'}
      </div>
    </div>

    <div class="settings-section">
      <h2>Export</h2>
      <div class="settings-actions">
        <button type="button" class="button button--primary" id="backup-to-file" ${backupState.running ? 'disabled' : ''}>
          Export Backup File
        </button>
        <button type="button" class="button button--ghost" id="backup-to-telegram" ${backupState.running ? 'disabled' : ''}>
          Send Backup to Telegram
        </button>
      </div>
      <div aria-live="polite">
        ${renderBackupResult(backupState.lastResult)}
        ${renderTelegramStatus(backupState.log || [], settings.lastBackupAt, backupState.running)}
      </div>
    </div>

    <div class="settings-section">
      <h2>Import</h2>
      <p class="settings-help">Importing replaces all current data with the contents of the backup file. This cannot be undone.</p>
      <input
        type="file"
        accept="application/json"
        class="settings-file-input"
        id="restore-file-input"
        aria-label="Choose backup file to restore"
      />
      <div class="settings-actions">
        <button type="button" class="button button--danger" id="restore-confirm" disabled>Import Backup File</button>
      </div>
    </div>

    <div class="settings-section">
      <h2>Reset</h2>
      <p class="settings-help">Permanently erases all clients, programs, payments, supplements, notes, and settings on this device. Export a backup first if you want to keep a copy — this cannot be undone.</p>
      <div class="settings-actions">
        <button type="button" class="button button--danger" id="reset-all-data">Reset All Data</button>
      </div>
    </div>

    <div class="settings-section">
      <h2>Backup Log</h2>
      ${renderBackupLog(backupState.log || [])}
    </div>
    </div>
  `;

  wireClinicForm(contentEl);
  wireTelegramForm(contentEl);
  wireManualBackup(contentEl);
  wireRestore(contentEl);
  wireReset(contentEl);
}

function wireClinicForm(contentEl) {
  const form = contentEl.querySelector('#clinic-form');
  const logoInput = contentEl.querySelector('#logo-input');
  const logoPreview = contentEl.querySelector('#logo-preview');
  const removeLogoButton = contentEl.querySelector('#remove-logo');

  // Holds the logo across this render's lifetime — file inputs can't be
  // pre-filled with a value, so the data URL is tracked here and only
  // written to settings when the form is actually submitted.
  let pendingLogoDataUrl = getState('settings').data?.logoDataUrl || null;

  logoInput.addEventListener('change', async () => {
    const file = logoInput.files?.[0];
    if (!file) return;

    // Base64 encoding inflates the raw file size by ~4/3 — check against
    // that estimated encoded size, not the raw file size, since
    // MAX_LOGO_BYTES caps what's actually stored in IndexedDB (the data
    // URL string), not the original file on disk.
    const estimatedEncodedBytes = Math.ceil(file.size / 3) * 4;
    if (estimatedEncodedBytes > MAX_LOGO_BYTES) {
      window.alert(`Logo image is too large (max ${Math.round(MAX_LOGO_BYTES / 1024)} KB). Choose a smaller image.`);
      logoInput.value = '';
      return;
    }

    pendingLogoDataUrl = await readFileAsDataUrl(file);
    logoPreview.src = pendingLogoDataUrl;
    logoPreview.hidden = false;
  });

  removeLogoButton.addEventListener('click', () => {
    pendingLogoDataUrl = null;
    logoInput.value = '';
    logoPreview.hidden = true;
    logoPreview.src = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const current = getState('settings').data;
    await saveSettings({ ...current, ...values, logoDataUrl: pendingLogoDataUrl });
    // Live preview: re-applies immediately rather than waiting for the
    // next app open, matching the same "no reload needed" pattern used
    // when a theme is saved directly (see ui/shell/theme.js).
    applyTheme(values.theme);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function wireTelegramForm(contentEl) {
  const form = contentEl.querySelector('#telegram-form');
  const feedback = contentEl.querySelector('#telegram-feedback');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const current = getState('settings').data;
    await saveSettings({
      ...current,
      telegramBotToken: formData.get('telegramBotToken'),
      telegramChatId: formData.get('telegramChatId'),
      autoBackupEnabled: formData.get('autoBackupEnabled') === 'on',
      autoBackupHour: formData.get('autoBackupHour'),
    });
  });

  contentEl.querySelector('#send-test-message').addEventListener('click', async () => {
    feedback.hidden = false;
    feedback.textContent = 'Sending…';
    const result = await sendTestMessageAction();
    feedback.textContent = result.success
      ? 'Test message sent successfully.'
      : `Failed: ${result.reason || 'Unknown error'}`;
  });
}

function wireManualBackup(contentEl) {
  contentEl.querySelector('#backup-to-file').addEventListener('click', () => {
    runManualBackupToFile();
  });
  contentEl.querySelector('#backup-to-telegram').addEventListener('click', () => {
    runManualBackupToTelegram();
  });

  // Only present when the latest Telegram attempt failed (see
  // renderTelegramStatus) — retries by re-running the same Telegram
  // upload; a new backupLog entry (success or failure) replaces this
  // status on the next 'state:backup' re-render.
  const retryButton = contentEl.querySelector('#retry-telegram-backup');
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      runManualBackupToTelegram();
    });
  }
}

function wireRestore(contentEl) {
  const fileInput = contentEl.querySelector('#restore-file-input');
  const confirmButton = contentEl.querySelector('#restore-confirm');
  let selectedFile = null;

  fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files?.[0] || null;
    confirmButton.disabled = !selectedFile;
  });

  confirmButton.addEventListener('click', async () => {
    if (!selectedFile) return;
    const confirmed = window.confirm(
      'This will replace all current data with the contents of this backup file. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    try {
      const text = await selectedFile.text();
      const payload = JSON.parse(text);
      const result = await restoreBackupFromPayload(payload);
      if (result.success) {
        window.alert('Restore complete. The app will now reload.');
        window.location.reload();
      } else {
        window.alert(`Restore failed:\n${(result.errors || []).join('\n')}`);
      }
    } catch (error) {
      window.alert(`Restore failed: ${error?.message || 'Invalid backup file.'}`);
    }
  });
}

function wireReset(contentEl) {
  contentEl.querySelector('#reset-all-data').addEventListener('click', async () => {
    const confirmed = window.confirm(
      'This will permanently erase ALL data on this device — clients, programs, payments, supplements, notes, and settings. Export a backup first if you want to keep a copy. Continue?'
    );
    if (!confirmed) return;

    // Second confirmation — this is the one destructive action in the app
    // with no undo path at all (unlike Import, which at least requires a
    // valid backup file to replace data with).
    const doubleConfirmed = window.confirm('Are you absolutely sure? This cannot be undone.');
    if (!doubleConfirmed) return;

    await resetAllDataAction();
    window.alert('All data has been reset. The app will now reload.');
    window.location.reload();
  });
}

function renderBackupResult(lastResult) {
  if (!lastResult) return '';
  const statusClass = lastResult.success ? 'settings-feedback--success' : 'settings-feedback--failure';
  const message = lastResult.success
    ? `Backup sent successfully (${lastResult.destination}).`
    : `Backup failed: ${lastResult.reason || 'Unknown error'}`;
  return `<div class="settings-feedback ${statusClass}">${escapeHtml(message)}</div>`;
}

/**
 * Persistent Telegram backup status — Success/Failed badge, Retry (only
 * when the latest attempt failed), and Last Backup timestamp. Derived from
 * backupLog + settings.lastBackupAt rather than stored separately, so it
 * reflects automatic 8 PM attempts too, not just this session's manual
 * clicks (unlike renderBackupResult above, which only covers the current
 * session).
 */
function renderTelegramStatus(log, lastBackupAt, running) {
  const latest = getLatestTelegramLogEntry(log);
  const lastBackupLabel = lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'Never';

  if (!latest) {
    return `
      <div class="telegram-status__row">
        <span class="telegram-status__last-backup">Last Backup: ${lastBackupLabel}</span>
      </div>
    `;
  }

  const isSuccess = latest.status === 'success';
  return `
    <div class="telegram-status__row">
      <span class="status-badge status-badge--${isSuccess ? 'success' : 'failure'}">${isSuccess ? 'Success' : 'Failed'}</span>
      <span class="telegram-status__last-backup">Last Backup: ${lastBackupLabel}</span>
      ${
        isSuccess
          ? ''
          : `<button type="button" class="button button--ghost" id="retry-telegram-backup" ${running ? 'disabled' : ''}>Retry</button>`
      }
    </div>
    ${!isSuccess && latest.error ? `<div class="telegram-status__error">${escapeHtml(latest.error)}</div>` : ''}
  `;
}

/** backupState.log is already sorted newest-first by backupService.getBackupLog(). */
function getLatestTelegramLogEntry(log) {
  return log.find((entry) => entry.destination === 'telegram') || null;
}

function renderBackupLog(log) {
  if (!log.length) {
    return `
      <div class="screen-placeholder">
        <span class="screen-placeholder__icon" aria-hidden="true">&#128203;</span>
        <span>No backup attempts recorded yet.</span>
      </div>
    `;
  }

  return `
    <div class="backup-log">
      ${log
        .map(
          (entry) => `
        <div class="backup-log__row">
          <span class="backup-log__time">${new Date(entry.timestamp).toLocaleString()}</span>
          <span class="backup-log__meta">${escapeHtml(entry.trigger)} &rarr; ${escapeHtml(entry.destination)}</span>
          <span class="backup-log__status backup-log__status--${entry.status}">${escapeHtml(entry.status)}</span>
          ${entry.error ? `<span class="backup-log__error">${escapeHtml(entry.error)}</span>` : ''}
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function hourOptions(selectedHour) {
  const options = [];
  for (let hour = 0; hour <= 23; hour += 1) {
    const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
    options.push(`<option value="${hour}" ${hour === selectedHour ? 'selected' : ''}>${label}</option>`);
  }
  return options.join('');
}

function escapeAttr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
