import { db } from '../db';
import { store } from '../stores';
import { showToast } from './toast';
import { showModal } from './modal';
import { fileToArrayBuffer, getFileExtension, uuid, dateInputToISO, escapeHtml, isGenuineReceiptFile, MAX_RECEIPT_FILE_SIZE, formatBytes } from '../utils';
import type { Transaction, Memory } from '../types';
import { hasFeature } from '../cloud/entitlements';

function setFileInputFiles(input: HTMLInputElement, file: File): void {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
}

export async function openTransactionModal(existingTransaction?: Transaction, onSuccess?: () => void): Promise<void> {
    const categories = store.getState().categories;
    const profile = store.getState().userProfile;
    const currency = profile?.primaryCurrency || 'INR';

    const existingMemory = existingTransaction
        ? await db.getMemoryByTransactionId(existingTransaction.id).catch(() => null)
        : null;

    const form = document.createElement('form');
    form.className = 'space-y-4';

    const isIncome = existingTransaction?.type === 'income';
    let accounts: any[] = [];
    let removeReceipt = false;

    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-2">Amount (${currency})</label>
      <input type="number" name="amount" step="0.01" min="0" required
        value="${existingTransaction?.amount || ''}"
        class="glass-input w-full" placeholder="0.00">
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">Type</label>
      <div class="flex gap-2">
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="type" value="expense" ${!isIncome ? 'checked' : ''} class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-red-500/20 peer-checked:border-red-500 transition-colors">
            Expense
          </div>
        </label>
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="type" value="income" ${isIncome ? 'checked' : ''} class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-green-500/20 peer-checked:border-green-500 transition-colors">
            Income
          </div>
        </label>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">Category</label>
      <select name="categoryId" required class="glass-input w-full">
        <option value="">Select category...</option>
        ${categories.map(cat => `
          <option value="${cat.id}" ${existingTransaction?.categoryId === cat.id ? 'selected' : ''}>
            ${cat.icon ? cat.icon + ' ' : ''}${escapeHtml(cat.name)}
          </option>
        `).join('')}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">Account (optional)</label>
      <select name="accountId" class="glass-input w-full">
        <option value="">None</option>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">Date</label>
      <input type="date" name="date" required
        value="${existingTransaction?.date ? existingTransaction.date.split('T')[0] : new Date().toISOString().split('T')[0]}"
        class="glass-input w-full">
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">Payee (optional)</label>
      <input type="text" name="payee"
        value="${escapeHtml(existingTransaction?.payee)}"
        class="glass-input w-full" placeholder="e.g., Grocery Store">
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full" placeholder="Add details...">${escapeHtml(existingTransaction?.notes)}</textarea>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">Receipt (optional)</label>
      <div id="receipt-current" class="mb-2 ${existingTransaction?.receiptPath ? '' : 'hidden'}">
        <div class="flex items-center justify-between glass-input">
          <span class="text-sm text-slate-300 flex items-center gap-2">
            <i data-lucide="paperclip" class="w-4 h-4"></i> Receipt attached
          </span>
          <button type="button" id="remove-receipt-btn" class="text-red-400 text-sm hover:underline">Remove</button>
        </div>
      </div>
      <div class="flex gap-2">
        <input type="file" name="receipt" accept="image/*,application/pdf" class="glass-input w-full flex-1">
        <button type="button" id="scan-bill-btn" class="glass-button-secondary flex items-center gap-2 whitespace-nowrap px-3">
          <i data-lucide="${hasFeature('ocr') ? 'scan-line' : 'lock'}" class="w-4 h-4"></i> Scan
        </button>
      </div>
      <input type="file" id="scan-bill-input" accept="image/*" capture="environment" class="hidden">
      <p id="scan-status" class="text-xs text-slate-500 mt-1 hidden"></p>
    </div>

    <div class="border-t border-white/10 pt-4">
      <button type="button" id="memory-toggle-btn" class="flex items-center gap-2 text-sm font-medium text-primary-400 hover:text-primary-300">
        <i data-lucide="sparkles" class="w-4 h-4"></i>
        ${existingMemory ? 'Edit memory' : 'Add a memory (optional)'}
      </button>
      <div id="memory-fields" class="space-y-3 mt-3 ${existingMemory ? '' : 'hidden'}">
        <p class="text-xs text-slate-500">Memories are optional — a short story behind this expense, for your own "On This Day" and Timeline later.</p>
        <input type="text" name="memoryTitle" value="${escapeHtml(existingMemory?.title)}" class="glass-input w-full" placeholder="e.g., First coffee with my new team">
        <textarea name="memoryBody" rows="2" class="glass-input w-full" placeholder="What made this memorable? (optional)">${escapeHtml(existingMemory?.body)}</textarea>
      </div>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${existingTransaction ? 'Update' : 'Add'} Transaction</button>
  `;

    const close = showModal({
        title: existingTransaction ? 'Edit Transaction' : 'Add Transaction',
        content: form,
        footer,
        size: 'lg',
    });

    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }

    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    // Populate accounts (async, since Net Worth accounts aren't in the global store)
    db.getAccounts().then((result) => {
        accounts = result;
        const select = form.querySelector('select[name="accountId"]') as HTMLSelectElement;
        if (!select) return;
        select.innerHTML = `
      <option value="">None</option>
      ${accounts.map(a => `
        <option value="${a.id}" ${existingTransaction?.accountId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>
      `).join('')}
    `;
    }).catch(() => { /* accounts are optional; ignore failures */ });

    form.querySelector('#memory-toggle-btn')?.addEventListener('click', () => {
        form.querySelector('#memory-fields')?.classList.toggle('hidden');
    });

    form.querySelector('#remove-receipt-btn')?.addEventListener('click', () => {
        removeReceipt = true;
        form.querySelector('#receipt-current')?.classList.add('hidden');
    });

    const scanInput = form.querySelector('#scan-bill-input') as HTMLInputElement;
    const receiptInput = form.querySelector('input[name="receipt"]') as HTMLInputElement;
    const scanStatus = form.querySelector('#scan-status') as HTMLElement;
    const amountInput = form.querySelector('input[name="amount"]') as HTMLInputElement;
    const dateInput = form.querySelector('input[name="date"]') as HTMLInputElement;

    form.querySelector('#scan-bill-btn')?.addEventListener('click', () => {
        if (!hasFeature('ocr')) {
            showToast('Bill scanning is a Pro feature — upgrade from Settings > Subscription', { type: 'error' });
            return;
        }
        scanInput.click();
    });

    scanInput.addEventListener('change', async () => {
        const file = scanInput.files?.[0];
        if (!file) return;

        // Attach the photo as the receipt right away, independent of OCR success
        setFileInputFiles(receiptInput, file);
        removeReceipt = false;
        form.querySelector('#receipt-current')?.classList.add('hidden');

        scanStatus.textContent = 'Scanning bill...';
        scanStatus.classList.remove('hidden');

        try {
            const { scanBillImage } = await import('../ocr');
            const result = await scanBillImage(file);

            const found: string[] = [];
            if (result.amount && !amountInput.value) {
                amountInput.value = String(result.amount);
                found.push(`amount ₹${result.amount}`);
            }
            if (result.date) {
                dateInput.value = result.date;
                found.push('date');
            }

            scanStatus.textContent = found.length > 0
                ? `Detected ${found.join(' and ')} — please verify before saving.`
                : 'Photo attached. Could not confidently read the amount — please enter it manually.';
        } catch (error) {
            console.error('[Scan Bill] OCR failed:', error);
            scanStatus.textContent = 'Photo attached, but scanning failed. Enter details manually.';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const formData = new FormData(form);
            const amount = parseFloat(formData.get('amount') as string);
            // Backstop behind the input's HTML5 min="0" — never trust client
            // constraint validation alone to keep bad data out of storage.
            if (!Number.isFinite(amount) || amount <= 0) {
                showToast('Enter a valid amount greater than 0', { type: 'error' });
                return;
            }
            const payee = (formData.get('payee') as string || '').trim();
            const notes = (formData.get('notes') as string || '').trim();
            const data: any = {
                amount,
                type: formData.get('type') as 'income' | 'expense',
                categoryId: formData.get('categoryId') as string,
                date: dateInputToISO(formData.get('date') as string),
                payee: payee || undefined,
                notes: notes || undefined,
                accountId: (formData.get('accountId') as string) || undefined,
            };

            const receiptFile = formData.get('receipt') as File | null;
            let receiptPath = existingTransaction?.receiptPath;

            if (removeReceipt) {
                receiptPath = undefined;
            }

            if (receiptFile && receiptFile.size > 0) {
                if (receiptFile.size > MAX_RECEIPT_FILE_SIZE) {
                    showToast(`Receipt is too large (max ${formatBytes(MAX_RECEIPT_FILE_SIZE)})`, { type: 'error' });
                    return;
                }
                if (!(await isGenuineReceiptFile(receiptFile))) {
                    showToast('That file doesn\'t look like a real image or PDF — please attach a genuine receipt photo or scan.', { type: 'error' });
                    return;
                }
                receiptPath = `receipts/${uuid()}.${getFileExtension(receiptFile.name) || 'bin'}`;
                const buffer = await fileToArrayBuffer(receiptFile);
                await db.writeBlob(receiptPath, buffer);
            }

            data.receiptPath = receiptPath;

            let transactionId: string;
            if (existingTransaction) {
                // sql.js can't bind `undefined` — normalize to null so "cleared" fields persist correctly
                for (const key of Object.keys(data)) {
                    if (data[key] === undefined) data[key] = null;
                }
                await db.updateTransaction(existingTransaction.id, data);
                transactionId = existingTransaction.id;
                showToast('Transaction updated successfully', { type: 'success' });
            } else {
                transactionId = await db.createTransaction(data);
                showToast('Transaction added successfully', { type: 'success' });
            }

            const memoryTitle = (formData.get('memoryTitle') as string || '').trim();
            const memoryBody = (formData.get('memoryBody') as string || '').trim();
            if (memoryTitle) {
                const memoryPayload: Omit<Memory, 'id' | 'createdAt'> = {
                    transactionId,
                    title: memoryTitle,
                    body: memoryBody || undefined,
                    occurredAt: data.date,
                    visibility: 'private',
                };
                if (existingMemory) {
                    await db.updateMemory(existingMemory.id, memoryPayload);
                } else {
                    await db.createMemory(memoryPayload);
                }
            } else if (existingMemory) {
                // Title cleared out - remove the memory rather than leave an empty one behind
                await db.deleteMemory(existingMemory.id);
            }

            close();

            // Dispatch event for other components to refresh
            window.dispatchEvent(new CustomEvent('transaction-changed'));

            if (onSuccess) onSuccess();

        } catch (error) {
            console.error(error);
            showToast('Failed to save transaction', { type: 'error' });
        }
    });
}
