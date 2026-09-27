/**
 * Lending & Debt Page - track money lent to others and borrowed from others,
 * with partial repayment (inward/outward) tracking per record.
 */

import { db } from '../db';
import { formatCurrency, formatDate, getIcon, dateInputToISO, escapeHtml } from '../utils';
import { showToast } from '../components/toast';
import { showModal, showConfirm } from '../components/modal';
import type { LendingRecord } from '../types';
import { withTierGate } from '../components/upgrade-gate';

export async function renderLending(): Promise<void> {
    return withTierGate('pro', 'Lending & Debt', renderLendingImpl);
}

async function renderLendingImpl(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const lendings = await db.getLendings(true);

        const withRemaining = await Promise.all(
            lendings.map(async (l) => {
                const payments = await db.getLendingPayments(l.id);
                const paid = payments.reduce((sum, p) => sum + p.amount, 0);
                return { ...l, paid, remaining: Math.max(l.amount - paid, 0), paymentCount: payments.length };
            })
        );

        const lent = withRemaining.filter(l => l.direction === 'lent');
        const borrowed = withRemaining.filter(l => l.direction === 'borrowed');

        const totalOwedToYou = lent.filter(l => !l.settled).reduce((sum, l) => sum + l.remaining, 0);
        const totalYouOwe = borrowed.filter(l => !l.settled).reduce((sum, l) => sum + l.remaining, 0);

        const renderList = (records: typeof withRemaining, emptyText: string) => `
      ${records.length === 0 ? `
        <div class="glass-card p-8 text-center text-slate-400">${emptyText}</div>
      ` : `
        <div class="space-y-3">
          ${records.map(l => `
            <div class="glass-card p-4 ${l.settled ? 'opacity-60' : ''}">
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center ${l.direction === 'lent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">
                    ${getIcon(l.direction === 'lent' ? 'arrow-up-right' : 'arrow-down-left', 18)}
                  </div>
                  <div>
                    <h4 class="font-medium">${escapeHtml(l.personName)}</h4>
                    <p class="text-xs text-slate-400">
                      ${formatDate(l.date)}${l.dueDate ? ` · Due ${formatDate(l.dueDate)}` : ''}
                      ${l.settled ? ' · <span class="text-emerald-400">Settled</span>' : ''}
                    </p>
                  </div>
                </div>
                <div class="flex gap-1">
                  <button class="edit-lending p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" data-id="${l.id}" aria-label="Edit">
                    ${getIcon('pencil', 14)}
                  </button>
                  <button class="delete-lending p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" data-id="${l.id}" aria-label="Delete">
                    ${getIcon('trash-2', 14)}
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-lg font-bold ${l.direction === 'lent' ? 'text-emerald-400' : 'text-red-400'}">${formatCurrency(l.remaining)}</span>
                  <span class="text-xs text-slate-500"> of ${formatCurrency(l.amount)} remaining</span>
                  ${l.paymentCount > 0 ? `<span class="text-xs text-slate-500"> · ${l.paymentCount} payment${l.paymentCount > 1 ? 's' : ''}</span>` : ''}
                </div>
                ${!l.settled ? `
                  <button class="record-payment glass-button-secondary text-sm px-3 py-1.5" data-id="${l.id}">
                    Record ${l.direction === 'lent' ? 'Inward' : 'Outward'} Payment
                  </button>
                ` : ''}
              </div>
              ${l.notes ? `<p class="text-xs text-slate-500 mt-2 pt-2 border-t border-white/5">${escapeHtml(l.notes)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `}
    `;

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto pb-20">
        <div class="flex items-center justify-between gap-3 mb-6">
          <h1 class="text-2xl sm:text-3xl font-bold">Lending & Debt</h1>
          <button id="new-lending-btn" class="glass-button flex items-center gap-2 whitespace-nowrap">
            ${getIcon('plus', 16)} New Entry
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="glass-card p-4 text-center">
            <p class="text-xs text-gray-400 uppercase tracking-wider">Owed to You</p>
            <p class="text-xl font-bold text-emerald-400 mt-1">${formatCurrency(totalOwedToYou)}</p>
          </div>
          <div class="glass-card p-4 text-center">
            <p class="text-xs text-gray-400 uppercase tracking-wider">You Owe</p>
            <p class="text-xl font-bold text-red-400 mt-1">${formatCurrency(totalYouOwe)}</p>
          </div>
        </div>

        <div class="space-y-6">
          <div>
            <h2 class="text-lg font-semibold text-emerald-400 flex items-center gap-2 mb-3">${getIcon('arrow-up-right', 18)} Money Lent (they owe you)</h2>
            ${renderList(lent, 'No money lent out yet')}
          </div>
          <div>
            <h2 class="text-lg font-semibold text-red-400 flex items-center gap-2 mb-3">${getIcon('arrow-down-left', 18)} Money Borrowed (you owe)</h2>
            ${renderList(borrowed, 'No debts recorded yet')}
          </div>
        </div>
      </div>
    `;

        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }

        document.getElementById('new-lending-btn')?.addEventListener('click', () => openLendingModal());

        mainContent.querySelectorAll('.edit-lending').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id!;
                const record = lendings.find(l => l.id === id);
                if (record) openLendingModal(record);
            });
        });

        mainContent.querySelectorAll('.delete-lending').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id!;
                showConfirm('Delete Entry', 'This will delete the record and all its payment history. Continue?', async () => {
                    try {
                        await db.deleteLending(id);
                        showToast('Entry deleted', { type: 'success' });
                        renderLending();
                    } catch (error) {
                        console.error(error);
                        showToast('Failed to delete entry', { type: 'error' });
                    }
                });
            });
        });

        mainContent.querySelectorAll('.record-payment').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id!;
                const record = withRemaining.find(l => l.id === id);
                if (record) openPaymentModal(record);
            });
        });

    } catch (error) {
        console.error('[Lending] Error rendering:', error);
        showToast('Failed to load lending & debt records', { type: 'error' });
    }
}

function openLendingModal(record?: LendingRecord): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Person's Name</label>
      <input type="text" name="personName" required value="${escapeHtml(record?.personName)}" class="glass-input w-full" placeholder="e.g., Rahul">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Direction</label>
      <div class="flex gap-2">
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="direction" value="lent" ${!record || record.direction === 'lent' ? 'checked' : ''} class="sr-only peer" ${record ? 'disabled' : ''}>
          <div class="glass-input text-center peer-checked:bg-emerald-500/20 peer-checked:border-emerald-500 transition-colors ${record ? 'opacity-60' : ''}">
            I Lent (they owe me)
          </div>
        </label>
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="direction" value="borrowed" ${record?.direction === 'borrowed' ? 'checked' : ''} class="sr-only peer" ${record ? 'disabled' : ''}>
          <div class="glass-input text-center peer-checked:bg-red-500/20 peer-checked:border-red-500 transition-colors ${record ? 'opacity-60' : ''}">
            I Borrowed (I owe them)
          </div>
        </label>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Amount</label>
        <input type="number" name="amount" required min="0.01" step="0.01" value="${record?.amount || ''}" class="glass-input w-full" placeholder="0.00" ${record ? 'disabled' : ''}>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Date</label>
        <input type="date" name="date" required value="${record?.date ? record.date.split('T')[0] : new Date().toISOString().split('T')[0]}" class="glass-input w-full">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Due Date (optional)</label>
      <input type="date" name="dueDate" value="${record?.dueDate ? record.dueDate.split('T')[0] : ''}" class="glass-input w-full">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full" placeholder="What was this for?">${escapeHtml(record?.notes)}</textarea>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${record ? 'Update' : 'Create'} Entry</button>
  `;

    const close = showModal({ title: record ? 'Edit Entry' : 'New Lending / Debt Entry', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const dueDateRaw = formData.get('dueDate') as string;
        const personName = (formData.get('personName') as string).trim();
        if (!personName) {
            showToast('Name is required', { type: 'error' });
            return;
        }

        try {
            if (record) {
                await db.updateLending(record.id, {
                    personName,
                    date: dateInputToISO(formData.get('date') as string),
                    dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : null as any,
                    notes: (formData.get('notes') as string) || (null as any),
                });
                showToast('Entry updated', { type: 'success' });
            } else {
                await db.createLending({
                    personName,
                    direction: formData.get('direction') as 'lent' | 'borrowed',
                    amount: parseFloat(formData.get('amount') as string),
                    date: dateInputToISO(formData.get('date') as string),
                    dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : undefined,
                    notes: (formData.get('notes') as string) || undefined,
                });
                showToast('Entry created', { type: 'success' });
            }
            close();
            renderLending();
        } catch (error) {
            console.error(error);
            showToast('Failed to save entry', { type: 'error' });
        }
    });
}

function openPaymentModal(record: LendingRecord & { remaining: number }): void {
    const isInward = record.direction === 'lent';
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <p class="text-sm text-slate-400">
      Recording ${isInward ? 'money received from' : 'a payment you made to'} <strong>${escapeHtml(record.personName)}</strong>.
      Remaining: ${formatCurrency(record.remaining)}
    </p>
    <div>
      <label class="block text-sm font-medium mb-1">Amount</label>
      <input type="number" name="amount" required min="0.01" step="0.01" max="${record.remaining}" value="${record.remaining}" class="glass-input w-full">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Date</label>
      <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="glass-input w-full">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <input type="text" name="notes" class="glass-input w-full" placeholder="e.g., Paid via UPI">
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Record ${isInward ? 'Inward' : 'Outward'} Payment</button>
  `;

    const close = showModal({ title: `Record ${isInward ? 'Inward' : 'Outward'} Payment`, content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const amount = parseFloat(formData.get('amount') as string);

        if (amount > record.remaining + 0.001) {
            showToast('Amount exceeds remaining balance', { type: 'error' });
            return;
        }

        try {
            await db.addLendingPayment({
                lendingId: record.id,
                amount,
                date: dateInputToISO(formData.get('date') as string),
                notes: (formData.get('notes') as string) || undefined,
            });
            showToast('Payment recorded', { type: 'success' });
            close();
            renderLending();
        } catch (error) {
            console.error(error);
            showToast('Failed to record payment', { type: 'error' });
        }
    });
}
