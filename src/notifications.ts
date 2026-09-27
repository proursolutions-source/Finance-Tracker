/**
 * Local notification checks - bill reminders due/overdue and budget overspend alerts.
 * Runs once per app load; de-dupes via localStorage so the same alert doesn't fire twice a day.
 */

import { db } from './db';
import { store } from './stores';
import { showNotification, getBudgetPercentage } from './utils';

const SEEN_KEY = 'moneyflow-notified';

function getSeenSet(): Set<string> {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function markSeen(key: string, seen: Set<string>): void {
    seen.add(key);
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
    } catch {
        // ignore storage failures
    }
}

export async function runNotificationChecks(): Promise<void> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const profile = store.getState().userProfile;
    const prefs = profile?.notificationPreferences;
    const today = new Date().toISOString().split('T')[0];
    const seen = getSeenSet();

    if (prefs?.reminders !== false) {
        try {
            const reminders = await db.getReminders(false);
            const now = new Date();
            for (const reminder of reminders) {
                const dueDate = new Date(reminder.dueDate);
                if (dueDate > now) continue; // not due yet
                const key = `reminder:${reminder.id}:${today}`;
                if (seen.has(key)) continue;
                showNotification('Bill Reminder', {
                    body: `${reminder.name} (₹${reminder.amount}) is due`,
                    tag: key,
                });
                markSeen(key, seen);
            }
        } catch (error) {
            console.error('[Notifications] Failed to check reminders:', error);
        }
    }

    if (prefs?.overspendingAlerts !== false) {
        try {
            const budgets = await db.getBudgetAnalytics();
            for (const b of budgets) {
                const percentage = getBudgetPercentage(b.actualSpent, b.budgeted);
                if (percentage < 90) continue;
                const key = `budget:${b.budgetId}:${today}`;
                if (seen.has(key)) continue;
                showNotification('Budget Alert', {
                    body: `You've used ${percentage}% of your ${b.categoryName} budget`,
                    tag: key,
                });
                markSeen(key, seen);
            }
        } catch (error) {
            console.error('[Notifications] Failed to check budgets:', error);
        }
    }
}
