/**
 * Recurring Transactions Page - Manage recurring income/expenses and subscriptions
 */

import { db } from '../db';
import { formatCurrency, getIcon } from '../utils';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { withTierGate } from '../components/upgrade-gate';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  'bi-weekly': 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const FREQUENCY_COLORS: Record<string, string> = {
  daily: '#ef4444',
  weekly: '#f59e0b',
  'bi-weekly': '#f97316',
  monthly: '#3b82f6',
  quarterly: '#8b5cf6',
  yearly: '#10b981',
};

export async function renderRecurring(): Promise<void> {
  return withTierGate('pro', 'Recurring bills', renderRecurringImpl);
}

async function renderRecurringImpl(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const recurrings = await db.getRecurrings();
  const categories = await db.getCategories();
  const today = new Date().toISOString().split('T')[0];

  const subscriptions = recurrings.filter((r: any) => r.isSubscription);
  const regular = recurrings.filter((r: any) => !r.isSubscription);
  const dueCount = recurrings.filter((r: any) => r.nextDueDate <= today).length;

  const monthlyTotal = recurrings
    .filter((r: any) => r.type === 'expense')
    .reduce((sum: number, r: any) => {
      switch (r.frequency) {
        case 'daily': return sum + r.amount * 30;
        case 'weekly': return sum + r.amount * 4.33;
        case 'bi-weekly': return sum + r.amount * 2.17;
        case 'monthly': return sum + r.amount;
        case 'quarterly': return sum + r.amount / 3;
        case 'yearly': return sum + r.amount / 12;
        default: return sum + r.amount;
      }
    }, 0);

  mainContent.innerHTML = `
    <div class="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-2">
            ${getIcon('repeat', 28)} Recurring
          </h1>
          <p class="text-gray-400 text-sm mt-1">${recurrings.length} recurring items · ~${formatCurrency(monthlyTotal)}/month expenses</p>
        </div>
        <div class="flex gap-2">
          ${dueCount > 0 ? `
          <button id="process-due-btn" class="glass-button px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium text-amber-400 border-amber-500/30">
            ${getIcon('zap', 16)} Process ${dueCount} Due
          </button>
          ` : ''}
          <button id="add-recurring-btn" class="glass-button px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium">
            ${getIcon('plus', 18)} Add
          </button>
        </div>
      </div>

      <!-- Due Alert -->
      ${dueCount > 0 ? `
      <div class="glass-card p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">${getIcon('alert-triangle', 20)}</div>
          <div>
            <p class="font-medium text-amber-400">${dueCount} transaction(s) are due!</p>
            <p class="text-xs text-gray-400">Click "Process Due" to auto-create these transactions</p>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Subscriptions Section -->
      ${subscriptions.length > 0 ? `
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-purple-400 flex items-center gap-2">${getIcon('credit-card', 20)} Subscriptions (${subscriptions.length})</h2>
        <div class="grid gap-3 md:grid-cols-2">
          ${subscriptions.map((r: any) => renderRecurringCard(r, categories, today)).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Regular Recurring -->
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-blue-400 flex items-center gap-2">${getIcon('refresh-cw', 20)} ${subscriptions.length > 0 ? 'Other Recurring' : 'All Recurring'} (${regular.length})</h2>
        ${regular.length === 0 && subscriptions.length === 0 ? `
        <div class="glass-card p-8 rounded-2xl text-center">
          <div class="text-6xl mb-4">🔄</div>
          <p class="text-gray-400 mb-4">No recurring transactions yet.</p>
          <p class="text-sm text-gray-500">Add recurring items like rent, salary, subscriptions</p>
        </div>
        ` : regular.length === 0 ? '' : `
        <div class="grid gap-3 md:grid-cols-2">
          ${regular.map((r: any) => renderRecurringCard(r, categories, today)).join('')}
        </div>
        `}
      </div>
    </div>
  `;

  // Events
  document.getElementById('add-recurring-btn')?.addEventListener('click', () => openRecurringModal(categories));
  document.getElementById('process-due-btn')?.addEventListener('click', async () => {
    const count = await db.processRecurrings();
    showToast(`${count} transaction(s) created!`, { type: 'success' });
    window.dispatchEvent(new CustomEvent('transaction-changed'));
    renderRecurring();
  });
  mainContent.querySelectorAll('.edit-recurring').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec = recurrings.find((r: any) => r.id === (btn as HTMLElement).dataset.id);
      if (rec) openRecurringModal(categories, rec);
    });
  });
  mainContent.querySelectorAll('.delete-recurring').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this recurring item?')) {
        await db.deleteRecurring((btn as HTMLElement).dataset.id!);
        showToast('Deleted', { type: 'success' });
        renderRecurring();
      }
    });
  });
}

function renderRecurringCard(r: any, categories: any[], today: string): string {
  const cat = categories.find((c: any) => c.id === r.categoryId);
  const isDue = r.nextDueDate <= today;
  const freqColor = FREQUENCY_COLORS[r.frequency] || '#6b7280';

  return `
    <div class="glass-card p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors ${isDue ? 'border border-amber-500/30' : ''}">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center ${r.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">
          ${getIcon(r.isSubscription ? 'credit-card' : (r.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'), 18)}
        </div>
        <div class="min-w-0">
          <p class="font-medium text-white truncate">${r.name}</p>
          <div class="flex items-center gap-2 text-xs">
            <span class="px-2 py-0.5 rounded-full" style="background:${freqColor}20;color:${freqColor}">${FREQUENCY_LABELS[r.frequency]}</span>
            ${cat ? `<span class="text-gray-500">${cat.name}</span>` : ''}
            ${isDue ? `<span class="text-amber-400 font-medium">⚡ Due</span>` : `<span class="text-gray-500">Next: ${r.nextDueDate}</span>`}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 ml-2">
        <span class="text-lg font-bold ${r.type === 'income' ? 'text-emerald-400' : 'text-red-400'}">${r.type === 'income' ? '+' : '-'}${formatCurrency(r.amount)}</span>
        <div class="flex gap-1">
          <button class="edit-recurring p-1.5 rounded-lg hover:bg-white/10 text-gray-400" data-id="${r.id}">${getIcon('pencil', 14)}</button>
          <button class="delete-recurring p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400" data-id="${r.id}">${getIcon('trash-2', 14)}</button>
        </div>
      </div>
    </div>
  `;
}

async function openRecurringModal(categories: any[], existing?: any): Promise<void> {
  const isEdit = !!existing;
  const today = new Date().toISOString().split('T')[0];

  const html = `
    <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <h3 class="text-lg font-semibold text-white">${isEdit ? 'Edit Recurring' : 'Add Recurring'}</h3>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Name *</label>
        <input type="text" id="rec-name" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.name || ''}" placeholder="e.g., Jio Recharge">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Amount (₹) *</label>
          <input type="number" id="rec-amount" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.amount || ''}" min="1">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Type</label>
          <select id="rec-type" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white">
            <option value="expense" ${existing?.type !== 'income' ? 'selected' : ''}>Expense</option>
            <option value="income" ${existing?.type === 'income' ? 'selected' : ''}>Income</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Frequency</label>
          <select id="rec-freq" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white">
            ${Object.entries(FREQUENCY_LABELS).map(([v, l]) => `<option value="${v}" ${existing?.frequency === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Category</label>
          <select id="rec-cat" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white">
            <option value="">None</option>
            ${categories.map((c: any) => `<option value="${c.id}" ${existing?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Start Date</label>
          <input type="date" id="rec-start" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.startDate || today}">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">End Date (optional)</label>
          <input type="date" id="rec-end" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.endDate || ''}">
        </div>
      </div>
      <label class="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" id="rec-sub" class="w-5 h-5 rounded" ${existing?.isSubscription ? 'checked' : ''}>
        <span class="text-sm text-gray-300">This is a subscription (e.g., streaming, SaaS)</span>
      </label>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Notes</label>
        <textarea id="rec-notes" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" rows="2">${existing?.notes || ''}</textarea>
      </div>
      <div class="flex gap-3 pt-2">
        <button id="save-recurring" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold">${isEdit ? 'Update' : 'Add'}</button>
        <button id="cancel-recurring" class="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold">Cancel</button>
      </div>
    </div>
  `;
  const closeModal = showModal({
    title: isEdit ? 'Edit Recurring' : 'Add Recurring',
    content: html
  });

  document.getElementById('save-recurring')?.addEventListener('click', async () => {
    const name = (document.getElementById('rec-name') as HTMLInputElement).value.trim();
    const amount = parseFloat((document.getElementById('rec-amount') as HTMLInputElement).value);
    const type = (document.getElementById('rec-type') as HTMLSelectElement).value;
    const frequency = (document.getElementById('rec-freq') as HTMLSelectElement).value;
    const categoryId = (document.getElementById('rec-cat') as HTMLSelectElement).value || undefined;
    const startDate = (document.getElementById('rec-start') as HTMLInputElement).value;
    const endDate = (document.getElementById('rec-end') as HTMLInputElement).value || undefined;
    const isSubscription = (document.getElementById('rec-sub') as HTMLInputElement).checked;
    const notes = (document.getElementById('rec-notes') as HTMLTextAreaElement).value.trim() || undefined;

    if (!name || !amount) { showToast('Name and amount required', { type: 'error' }); return; }

    if (isEdit) {
      await db.updateRecurring(existing.id, { name, amount, type, categoryId, frequency, startDate, endDate, isSubscription, notes });
      showToast('Updated!', { type: 'success' });
    } else {
      await db.createRecurring({ name, amount, type, categoryId, frequency, startDate, endDate, isSubscription, notes });
      showToast('Recurring item added!', { type: 'success' });
    }
    closeModal();
    renderRecurring();
  });

  document.getElementById('cancel-recurring')?.addEventListener('click', () => closeModal());
}
