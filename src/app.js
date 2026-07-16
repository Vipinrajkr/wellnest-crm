// app.js
// Bootstraps the app shell and registers routes. No business logic here —
// this file only wires the shell, router, and screens together.

import { initRouter, registerRoute } from './core/router.js';
import { renderAppShell } from './ui/shell/appShell.js';
import { renderDashboard } from './ui/dashboard/dashboardScreen.js';
import { renderClientList } from './ui/clients/clientListScreen.js';
import { renderClientForm } from './ui/clients/clientForm.js';
import { renderClientDetail } from './ui/clients/clientDetailScreen.js';
import { renderReports } from './ui/reports/reportsScreen.js';
import { renderSettings } from './ui/settings/settingsScreen.js';
import { checkAutoBackup } from './state/actions/backupActions.js';
import { applyTheme } from './ui/shell/theme.js';
import { getSettings } from './domain/settings/settingsService.js';
import { isTelegramConfigured } from './domain/settings/settingsRules.js';
import { syncBackupStatus } from './platform/backgroundRunnerBridge.js';

function bootstrap() {
  const appRoot = document.getElementById('app');
  const { contentOutlet } = renderAppShell(appRoot);

  registerRoute('/dashboard', renderDashboard);
  registerRoute('/clients', renderClientList);
  registerRoute('/clients/add', renderClientForm);
  registerRoute('/clients/edit/:id', renderClientForm);
  // Registered after the static /clients/add and /clients/edit/:id routes
  // above so those take priority over this catch-all :id pattern.
  registerRoute('/clients/:id', renderClientDetail);
  registerRoute('/reports', renderReports);
  registerRoute('/settings', renderSettings);

  initRouter(contentOutlet, '/dashboard');

  // Fire-and-forget: checks settings/lastBackupAt and sends a Telegram
  // backup if the fixed auto-backup hour has passed today and one hasn't
  // already run today. Never blocks initial render.
  checkAutoBackup();

  // Fire-and-forget: applies the persisted theme (default 'light') before
  // the user ever visits Settings. Settings itself calls applyTheme()
  // again immediately on save for a live preview. Also refreshes the
  // Background Runner's CapacitorKV mirror (see
  // platform/backgroundRunnerBridge.js) on every app open, not just when
  // Settings is saved, so the periodic WorkManager check has current data
  // even if the user never opens Settings.
  getSettings().then((settings) => {
    applyTheme(settings.theme);
    syncBackupStatus({
      autoBackupEnabled: settings.autoBackupEnabled,
      autoBackupHour: settings.autoBackupHour,
      telegramConfigured: isTelegramConfigured(settings),
      lastBackupAt: settings.lastBackupAt,
    });
  });
}

document.addEventListener('DOMContentLoaded', bootstrap);
