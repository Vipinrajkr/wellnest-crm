// platform/notificationsAdapter.js
// Thin adapter over Capacitor's Local Notifications plugin. Accessed via
// the global `window.Capacitor.Plugins.LocalNotifications` bridge rather
// than a package import, since this project has no bundler — Capacitor
// exposes registered plugins on `window.Capacitor.Plugins` inside the
// native WebView. Running in a plain browser (e.g. during development)
// has no such bridge, so every function here degrades to a safe no-op
// instead of throwing — domain/reminders never needs to know which case
// it's in.

function getPlugin() {
  return (typeof window !== 'undefined' && window.Capacitor?.Plugins?.LocalNotifications) || null;
}

export async function isSupported() {
  return !!getPlugin();
}

export async function requestPermission() {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.requestPermissions();
    return result?.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * @param {{ id: number, title: string, body: string, at: Date }} notification
 */
export async function scheduleNotification({ id, title, body, at }) {
  const plugin = getPlugin();
  if (!plugin) return { success: false, reason: 'unsupported' };

  try {
    await plugin.schedule({
      notifications: [{ id, title, body, schedule: { at } }],
    });
    return { success: true };
  } catch (error) {
    return { success: false, reason: error?.message || 'schedule-failed' };
  }
}

export async function cancelNotification(id) {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.cancel({ notifications: [{ id }] });
  } catch {
    // Nothing pending with this id — safe to ignore.
  }
}
