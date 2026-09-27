/**
 * Document Vault — insurance/tax/loan/other documents, stored locally the
 * same way transaction receipts already are (local blob store, no cloud
 * sync). Includes expiry-date tracking so renewal-type documents (insurance
 * policies, etc.) can be flagged before they lapse.
 */
import { db } from '../db';
import { formatDate, getIcon, escapeHtml, fileToArrayBuffer, getFileExtension, uuid, isGenuineReceiptFile, MAX_RECEIPT_FILE_SIZE, formatBytes } from '../utils';
import { showToast } from '../components/toast';
import { showModal, showConfirm } from '../components/modal';
import { withTierGate } from '../components/upgrade-gate';
import type { FinanceDocument } from '../types';

const CATEGORY_LABELS: Record<FinanceDocument['category'], string> = {
    insurance: 'Insurance',
    tax: 'Tax',
    loan: 'Loan',
    other: 'Other',
};
const CATEGORY_ICONS: Record<FinanceDocument['category'], string> = {
    insurance: 'shield',
    tax: 'receipt',
    loan: 'file-text',
    other: 'file',
};

export async function renderDocuments(): Promise<void> {
    return withTierGate('pro', 'Document Vault', renderDocumentsImpl);
}

async function renderDocumentsImpl(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const docs = await db.getDocuments();
    const now = Date.now();
    const soon = now + 30 * 24 * 60 * 60 * 1000;
    const expiringSoon = docs.filter(d => d.expiryDate && new Date(d.expiryDate).getTime() <= soon && new Date(d.expiryDate).getTime() >= now);

    mainContent.innerHTML = `
    <div class="max-w-4xl mx-auto pb-20">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('folder-lock', 26)} Document Vault</h1>
          <p class="text-sm text-slate-400 mt-1">Insurance, tax, and loan documents — stored on this device only.</p>
        </div>
        <button id="add-doc-btn" class="glass-button flex items-center gap-2">${getIcon('plus', 16)} Add Document</button>
      </div>

      ${expiringSoon.length > 0 ? `
        <div class="glass-card p-4 mb-6 border border-yellow-500/30">
          <p class="text-sm font-medium flex items-center gap-2">${getIcon('clock', 14, 'text-yellow-400')} ${expiringSoon.length} document${expiringSoon.length === 1 ? '' : 's'} expiring within 30 days</p>
          <ul class="text-xs text-slate-400 mt-2 space-y-1">
            ${expiringSoon.map(d => `<li>${escapeHtml(d.name)} — ${formatDate(d.expiryDate!)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${docs.length === 0 ? `
        <div class="glass-card p-8 text-center text-slate-400">
          ${getIcon('folder-lock', 40, 'mx-auto mb-4 opacity-50')}
          <p>No documents yet.</p>
        </div>
      ` : `
        <div class="grid gap-3 sm:grid-cols-2">
          ${docs.map(d => `
            <div class="glass-card p-4">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center flex-shrink-0">
                    ${getIcon(CATEGORY_ICONS[d.category], 18)}
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium truncate">${escapeHtml(d.name)}</p>
                    <p class="text-xs text-slate-500">${CATEGORY_LABELS[d.category]}${d.expiryDate ? ` &middot; Expires ${formatDate(d.expiryDate)}` : ''}</p>
                  </div>
                </div>
                <div class="flex gap-1 flex-shrink-0">
                  <button class="view-doc-btn p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" data-path="${d.filePath}" aria-label="View">${getIcon('eye', 14)}</button>
                  <button class="delete-doc-btn p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" data-id="${d.id}" aria-label="Delete">${getIcon('trash-2', 14)}</button>
                </div>
              </div>
              ${d.notes ? `<p class="text-xs text-slate-500 mt-2 pt-2 border-t border-white/5">${escapeHtml(d.notes)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    mainContent.querySelector('#add-doc-btn')?.addEventListener('click', openAddDocumentModal);

    mainContent.querySelectorAll<HTMLButtonElement>('.view-doc-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                const buffer = await db.readBlob(btn.dataset.path!);
                const blob = new Blob([buffer]);
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            } catch (error) {
                console.error(error);
                showToast('Failed to open document', { type: 'error' });
            }
        });
    });

    mainContent.querySelectorAll<HTMLButtonElement>('.delete-doc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showConfirm('Delete Document', 'Remove this document from the vault?', async () => {
                await db.deleteDocument(btn.dataset.id!);
                showToast('Document deleted', { type: 'success' });
                renderDocuments();
            });
        });
    });
}

function openAddDocumentModal(): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Name</label>
      <input type="text" name="name" required class="glass-input w-full" placeholder="e.g., Health Insurance Policy">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Category</label>
      <select name="category" class="glass-input w-full">
        <option value="insurance">Insurance</option>
        <option value="tax">Tax</option>
        <option value="loan">Loan</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Expiry date (optional)</label>
      <input type="date" name="expiryDate" class="glass-input w-full">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">File (image or PDF)</label>
      <input type="file" name="file" required accept="image/*,application/pdf" class="glass-input w-full">
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
    <button type="submit" class="glass-button">Save</button>
  `;

    const close = showModal({ title: 'Add Document', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const name = (formData.get('name') as string).trim();
        const file = formData.get('file') as File | null;
        if (!name || !file || file.size === 0) {
            showToast('Name and file are required', { type: 'error' });
            return;
        }
        if (file.size > MAX_RECEIPT_FILE_SIZE) {
            showToast(`File is too large (max ${formatBytes(MAX_RECEIPT_FILE_SIZE)})`, { type: 'error' });
            return;
        }
        if (!(await isGenuineReceiptFile(file))) {
            showToast('That file doesn\'t look like a real image or PDF.', { type: 'error' });
            return;
        }
        try {
            const filePath = `documents/${uuid()}.${getFileExtension(file.name) || 'bin'}`;
            const buffer = await fileToArrayBuffer(file);
            await db.writeBlob(filePath, buffer);
            await db.createDocument({
                name,
                category: formData.get('category') as FinanceDocument['category'],
                filePath,
                expiryDate: (formData.get('expiryDate') as string) || undefined,
                notes: (formData.get('notes') as string || '').trim() || undefined,
            });
            showToast('Document added', { type: 'success' });
            close();
            renderDocuments();
        } catch (error) {
            console.error(error);
            showToast('Failed to save document', { type: 'error' });
        }
    });
}
