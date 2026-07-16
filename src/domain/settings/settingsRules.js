// domain/settings/settingsRules.js
// Pure rules for the single app settings record: defaults, normalization,
// and validation. No repo/IO access here.

export const DEFAULT_SETTINGS = {
  clinicName: '',
  currency: 'INR',
  logoDataUrl: null,
  theme: 'light',
  telegramBotToken: '',
  telegramChatId: '',
  autoBackupEnabled: true,
  autoBackupHour: 20,
  lastBackupAt: null,
};

export const THEME_OPTIONS = ['light', 'dark'];

/** Clinic logo is stored inline as a data URL (no Filesystem plugin wired
 * up yet — see platform/notificationsAdapter.js's pattern of not assuming
 * native plugins are present). Capped client-side to keep IndexedDB lean. */
export const MAX_LOGO_BYTES = 300 * 1024;

/** Clamps an hour value into the valid 0-23 range, defaulting to 20 (8 PM). */
export function clampHour(value) {
  const hour = Number(value);
  if (!Number.isFinite(hour)) return 20;
  return Math.min(23, Math.max(0, Math.round(hour)));
}

export function normalizeTheme(value) {
  return THEME_OPTIONS.includes(value) ? value : DEFAULT_SETTINGS.theme;
}

export function normalizeSettingsInput(input = {}) {
  return {
    clinicName: (input.clinicName || '').trim(),
    currency: (input.currency || DEFAULT_SETTINGS.currency).trim() || DEFAULT_SETTINGS.currency,
    logoDataUrl: input.logoDataUrl || null,
    theme: normalizeTheme(input.theme),
    telegramBotToken: (input.telegramBotToken || '').trim(),
    telegramChatId: (input.telegramChatId || '').trim(),
    autoBackupEnabled: Boolean(input.autoBackupEnabled),
    autoBackupHour: clampHour(input.autoBackupHour),
  };
}

export function isTelegramConfigured(settings) {
  return Boolean(settings?.telegramBotToken && settings?.telegramChatId);
}
