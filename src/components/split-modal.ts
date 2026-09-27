/**
 * Split Bill - divide an expense among several people.
 * Your own share is always recorded as a real expense transaction.
 * Other people's shares become Lending & Debt entries (an IOU), so they show
 * up on the Lending & Debt page for follow-up, instead of duplicating cash flow.
 */

import { db } from '../db';
import { store } from '../stores';
import { showToast } from './toast';
import { showModal } from './modal';
import { dateInputToISO } from '../utils';

interface ParticipantRow {
    name: string;
    amount: number;
}

export function openSplitModal(onSuccess?: () => void): void {
    const categories = store.getState().categories.filter(c => c.type === 'expense' || c.type === 'both');

    const form = document.createElement('form');
    form.className = 'space-y-4';

    let participants: ParticipantRow[] = [{ name: '', amount: 0 }];

    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">What was it for?</label>
      <input type="text" name="description" required class="glass-input w-full" placeholder="e.g., Dinner at Cafe">
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Total Amount</label>
        <input type="number" name="total" required min="0.01" step="0.01" class="glass-input w-full" placeholder="0.00">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Date</label>
        <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="glass-input w-full">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Category</label>
      <select name="categoryId" required class="glass-input w-full">
        <option value="">Select category...</option>
        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Who paid?</label>
      <div class="flex gap-2">
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="paidBy" value="me" checked class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-primary-500/20 peer-checked:border-primary-500 transition-colors">Me</div>
        </label>
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="paidBy" value="other" class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-primary-500/20 peer-checked:border-primary-500 transition-colors">Someone else</div>
        </label>
      </div>
      <input type="text" name="payerName" class="glass-input w-full mt-2 hidden" placeholder="Who paid?">
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium">Your Share</label>
      </div>
      <input type="number" name="yourShare" required min="0" step="0.01" class="glass-input w-full" placeholder="0.00">
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium">Split With (their shares become an IOU on the Lending & Debt page)</label>
        <button type="button" id="add-participant-btn" class="text-primary-400 text-sm hover:underline">+ Add person</button>
      </div>
      <div id="participants-list" class="space-y-2"></div>
      <button type="button" id="split-equally-btn" class="text-sm text-slate-400 hover:text-white hover:underline mt-2">Split remaining equally</button>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full"></textarea>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Save Split</button>
  `;

    const close = showModal({ title: 'Split a Bill', content: form, footer, size: 'lg' });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    const participantsList = form.querySelector('#participants-list') as HTMLElement;

    function renderParticipants(): void {
        participantsList.innerHTML = participants.map((p, i) => `
      <div class="flex gap-2">
        <input type="text" data-idx="${i}" class="participant-name glass-input flex-1 min-w-0" placeholder="Name" value="${p.name}">
        <input type="number" data-idx="${i}" min="0" step="0.01" class="participant-amount glass-input w-20 sm:w-28 flex-shrink-0" placeholder="0.00" value="${p.amount || ''}">
        <button type="button" data-idx="${i}" class="remove-participant p-2 text-slate-400 hover:text-red-400 flex-shrink-0" aria-label="Remove">✕</button>
      </div>
    `).join('');

        participantsList.querySelectorAll('.participant-name').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = Number((e.target as HTMLElement).dataset.idx);
                participants[idx].name = (e.target as HTMLInputElement).value;
            });
        });
        participantsList.querySelectorAll('.participant-amount').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = Number((e.target as HTMLElement).dataset.idx);
                participants[idx].amount = parseFloat((e.target as HTMLInputElement).value) || 0;
            });
        });
        participantsList.querySelectorAll('.remove-participant').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = Number((e.target as HTMLElement).dataset.idx);
                participants.splice(idx, 1);
                if (participants.length === 0) participants.push({ name: '', amount: 0 });
                renderParticipants();
            });
        });
    }
    renderParticipants();

    form.querySelector('#add-participant-btn')?.addEventListener('click', () => {
        participants.push({ name: '', amount: 0 });
        renderParticipants();
    });

    form.querySelector('#split-equally-btn')?.addEventListener('click', () => {
        const total = parseFloat((form.querySelector('input[name="total"]') as HTMLInputElement).value) || 0;
        const count = participants.length + 1; // +1 for "me"
        if (total <= 0 || count === 0) return;
        const share = Math.round((total / count) * 100) / 100;
        (form.querySelector('input[name="yourShare"]') as HTMLInputElement).value = String(share);
        participants.forEach(p => p.amount = share);
        renderParticipants();
    });

    // Toggle payer name field
    const payerNameInput = form.querySelector('input[name="payerName"]') as HTMLInputElement;
    form.querySelectorAll('input[name="paidBy"]').forEach(el => {
        el.addEventListener('change', (e) => {
            const isOther = (e.target as HTMLInputElement).value === 'other';
            payerNameInput.classList.toggle('hidden', !isOther);
            payerNameInput.required = isOther;
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const description = formData.get('description') as string;
        const categoryId = formData.get('categoryId') as string;
        const date = dateInputToISO(formData.get('date') as string);
        const paidBy = formData.get('paidBy') as string;
        const payerName = (formData.get('payerName') as string || '').trim();
        const yourShare = parseFloat(formData.get('yourShare') as string) || 0;
        const notes = (formData.get('notes') as string) || undefined;

        if (paidBy === 'other' && !payerName) {
            showToast('Enter who paid the bill', { type: 'error' });
            return;
        }

        const validParticipants = participants.filter(p => p.name.trim() && p.amount > 0);

        try {
            if (yourShare > 0) {
                await db.createTransaction({
                    amount: yourShare,
                    type: 'expense',
                    categoryId,
                    date,
                    payee: description,
                    notes: notes ? `Split: ${notes}` : `Split bill: ${description}`,
                });
            }

            if (paidBy === 'me') {
                for (const p of validParticipants) {
                    await db.createLending({
                        personName: p.name.trim(),
                        direction: 'lent',
                        amount: p.amount,
                        date,
                        notes: `Split: ${description}`,
                    });
                }
            } else if (yourShare > 0) {
                await db.createLending({
                    personName: payerName,
                    direction: 'borrowed',
                    amount: yourShare,
                    date,
                    notes: `Split: ${description}`,
                });
            }

            showToast('Split saved', { type: 'success' });
            close();
            window.dispatchEvent(new CustomEvent('transaction-changed'));
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            showToast('Failed to save split', { type: 'error' });
        }
    });
}
