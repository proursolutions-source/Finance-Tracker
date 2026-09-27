/**
 * Reminders Page - Bill reminders and recurring payments
 */

import { db } from '../db';
import { store } from '../stores';
import { formatDate, formatCurrency } from '../utils';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import type { Reminder } from '../types';

export async function renderReminders(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const reminders = await db.getReminders(true);
        const categories = store.getState().categories;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto pb-20">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold">Reminders</h1>
          <button id="create-reminder-btn" class="glass-button flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i>
            New Reminder
          </button>
        </div>

        <div class="glass-card p-6">
          ${reminders.length > 0 ? `
            <div class="space-y-3">
              ${reminders.map(reminder => {
            const cat = categories.find(c => c.id === reminder.categoryId);
            const dueDate = new Date(reminder.dueDate);
            // Compare calendar days, not exact instants: a due date carries no meaningful
            // time-of-day, so a reminder due "today" must never show as already overdue.
            const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            const isOverdue = !reminder.completed && startOfDueDate < startOfToday;
            return `
                <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0 ${reminder.completed ? 'opacity-50' : ''}">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                      <i data-lucide="${cat?.icon || 'bell'}" class="w-5 h-5"></i>
                    </div>
                    <div>
                      <h4 class="font-medium">${reminder.name}</h4>
                      <p class="text-sm ${isOverdue ? 'text-red-400' : 'text-slate-400'} capitalize">
                        ${reminder.completed ? 'Paid' : isOverdue ? 'Overdue' : 'Due'}: ${formatDate(reminder.dueDate)} · ${reminder.frequency}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-yellow-400 font-semibold">${formatCurrency(reminder.amount)}</span>
                    ${!reminder.completed ? `
                      <button class="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-emerald-400"
                          onclick="window.markReminderPaid('${reminder.id}')" aria-label="Mark as paid">
                        <i data-lucide="check" class="w-4 h-4"></i>
                      </button>
                    ` : ''}
                    <button class="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                        onclick="window.editReminder('${reminder.id}')" aria-label="Edit reminder">
                      <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button class="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-red-400"
                        onclick="window.deleteReminder('${reminder.id}')" aria-label="Delete reminder">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>
              `;
        }).join('')}
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

        document.getElementById('create-reminder-btn')?.addEventListener('click', () => openReminderModal());

        (window as any).editReminder = (id: string) => {
            const reminder = reminders.find(r => r.id === id);
            if (reminder) openReminderModal(reminder);
        };

        (window as any).markReminderPaid = async (id: string) => {
            try {
                await db.updateReminder(id, { completed: true });
                showToast('Reminder marked as paid', { type: 'success' });
                renderReminders();
            } catch (error) {
                console.error(error);
                showToast('Failed to update reminder', { type: 'error' });
            }
        };

        (window as any).deleteReminder = async (id: string) => {
            if (confirm('Are you sure you want to delete this reminder?')) {
                try {
                    await db.deleteReminder(id);
                    showToast('Reminder deleted', { type: 'success' });
                    renderReminders();
                } catch (error) {
                    console.error(error);
                    showToast('Failed to delete reminder', { type: 'error' });
                }
            }
        };

    } catch (error) {
        console.error('[Reminders] Error rendering:', error);
        showToast('Failed to load reminders', { type: 'error' });
    }
}

/**
 * Open create/edit reminder modal
 */
function openReminderModal(reminder?: Reminder): void {
    const categories = store.getState().categories.filter(c => c.type === 'expense');

    const form = document.createElement('form');
    form.className = 'space-y-4';

    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Name</label>
      <input type="text" name="name" required
             value="${reminder?.name || ''}" class="glass-input w-full" placeholder="e.g., Electricity Bill">
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Amount</label>
        <input type="number" name="amount" required min="0" step="0.01"
               value="${reminder?.amount || ''}" class="glass-input w-full" placeholder="0.00">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Due Date</label>
        <input type="date" name="dueDate" required
               value="${reminder?.dueDate ? reminder.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]}"
               class="glass-input w-full">
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Category (optional)</label>
        <select name="categoryId" class="glass-input w-full">
          <option value="">None</option>
          ${categories.map(c => `
            <option value="${c.id}" ${reminder?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>
          `).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Frequency</label>
        <select name="frequency" required class="glass-input w-full">
          <option value="weekly" ${reminder?.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
          <option value="monthly" ${!reminder || reminder.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
          <option value="yearly" ${reminder?.frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
        </select>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full" placeholder="Add details...">${reminder?.notes || ''}</textarea>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${reminder ? 'Update' : 'Create'} Reminder</button>
  `;

    const close = showModal({
        title: reminder ? 'Edit Reminder' : 'New Reminder',
        content: form,
        footer,
    });

    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data: any = {
            name: formData.get('name') as string,
            amount: parseFloat(formData.get('amount') as string),
            dueDate: new Date(formData.get('dueDate') as string).toISOString(),
            categoryId: (formData.get('categoryId') as string) || undefined,
            frequency: formData.get('frequency') as 'weekly' | 'monthly' | 'yearly',
            notes: (formData.get('notes') as string) || undefined,
        };

        try {
            if (reminder) {
                await db.updateReminder(reminder.id, data);
                showToast('Reminder updated successfully', { type: 'success' });
            } else {
                await db.createReminder({ ...data, completed: false });
                showToast('Reminder created successfully', { type: 'success' });
            }
            close();
            renderReminders();
        } catch (error) {
            console.error(error);
            showToast('Failed to save reminder', { type: 'error' });
        }
    });
}
