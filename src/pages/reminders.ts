/**
 * Reminders Page - Bill reminders and recurring payments
 */

import { db } from '../db';
import { formatDate, formatCurrency } from '../utils';
import { showToast } from '../components/toast';

export async function renderReminders(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const reminders = await db.getReminders();

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Reminders</h1>
        
        <div class="glass-card p-6">
          ${reminders.length > 0 ? `
            <div class="space-y-3">
              ${reminders.map(reminder => `
                <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <h4 class="font-medium">${reminder.name}</h4>
                    <p class="text-sm text-slate-400">Due: ${formatDate(reminder.dueDate)}</p>
                  </div>
                  <span class="text-yellow-400">${formatCurrency(reminder.amount)}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="bell" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No reminders set</p>
            </div>
          `}
        </div>
      </div>
    `;

        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }

    } catch (error) {
        console.error('[Reminders] Error rendering:', error);
        showToast('Failed to load reminders', { type: 'error' });
    }
}
