// state/actions/remindersActions.js
// Bridges the reminders panel to domain/reminders, then updates
// state/store. UI never calls domain/reminders directly — matches the
// pattern established across the other feature actions.

import { setState } from '../store.js';
import * as reminderService from '../../domain/reminders/reminderService.js';
import { toDateKey } from '../../core/dateUtils.js';

export async function loadReminders() {
  setState('reminders', { loading: true, error: null });
  try {
    const items = await reminderService.loadReminders();
    const { supported } = await reminderService.syncReminderNotifications(items);
    setState('reminders', { items, notificationsSupported: supported, loading: false, error: null });
  } catch (error) {
    setState('reminders', { loading: false, error: error?.message || 'Failed to load reminders.' });
  }
}

export async function markReminderDoneAction(id) {
  await reminderService.markReminderDone(id);
  await loadReminders();
}

export async function snoozeReminderAction(id, days = 1) {
  const snoozeUntil = new Date();
  snoozeUntil.setDate(snoozeUntil.getDate() + days);
  await reminderService.snoozeReminder(id, toDateKey(snoozeUntil));
  await loadReminders();
}
