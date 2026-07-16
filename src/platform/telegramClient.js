// platform/telegramClient.js
// Thin adapter over the Telegram Bot API using raw fetch() calls — no SDK,
// consistent with this project's no-bundler/no-npm-dependency constraint.
// Unlike notificationsAdapter, this doesn't depend on the Capacitor bridge:
// it's plain network access, available in both browser dev preview and the
// native WebView (as long as the device has connectivity).

const TELEGRAM_API_ROOT = 'https://api.telegram.org';

/**
 * Uploads a file (e.g. a backup JSON) as a Telegram document.
 * @param {{ botToken: string, chatId: string, blob: Blob, filename: string, caption?: string }} params
 */
export async function sendDocument({ botToken, chatId, blob, filename, caption }) {
  if (!botToken || !chatId) return { success: false, reason: 'not-configured' };

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', blob, filename);
    if (caption) formData.append('caption', caption);

    const response = await fetch(`${TELEGRAM_API_ROOT}/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
      return { success: false, reason: body?.description || `HTTP ${response.status}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, reason: error?.message || 'network-error' };
  }
}

/**
 * Sends a plain text message — used for the Settings "Send Test Message"
 * button, to let the user confirm bot token + chat id are correct without
 * running a full backup.
 * @param {{ botToken: string, chatId: string, text: string }} params
 */
export async function sendMessage({ botToken, chatId, text }) {
  if (!botToken || !chatId) return { success: false, reason: 'not-configured' };

  try {
    const response = await fetch(`${TELEGRAM_API_ROOT}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.ok) {
      return { success: false, reason: body?.description || `HTTP ${response.status}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, reason: error?.message || 'network-error' };
  }
}
