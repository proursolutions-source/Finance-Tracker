/**
 * Transactions Page - List, search/filter, and manage all transactions
 */

import { db } from '../db';
import { store } from '../stores';
import { formatCurrency, formatDate, debounce } from '../utils';
import { showToast } from '../components/toast';
import { openTransactionModal } from '../components/transaction-modal';
import { openSplitModal } from '../components/split-modal';
import type { Transaction } from '../types';

interface Filters {
    searchQuery: string;
    type: '' | 'income' | 'expense';
    categoryId: string;
    startDate: string;
    endDate: string;
}

let currentFilters: Filters = {
    searchQuery: '',
    type: '',
    categoryId: '',
    startDate: '',
    endDate: '',
};

export async function renderTransactions(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const categories = store.getState().categories;
        const profile = store.getState().userProfile;
        const currency = profile?.primaryCurrency || 'INR';

        const transactions = await db.getTransactions({
            limit: 200,
            searchQuery: currentFilters.searchQuery || undefined,
            type: currentFilters.type || undefined,
            categoryIds: currentFilters.categoryId ? [currentFilters.categoryId] : undefined,
            startDate: currentFilters.startDate ? new Date(currentFilters.startDate).toISOString() : undefined,
            endDate: currentFilters.endDate ? new Date(currentFilters.endDate).toISOString() : undefined,
        });

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto pb-20">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 class="text-3xl font-bold">Transactions</h1>
          <div class="flex gap-2">
            <button id="split-bill-btn" class="glass-button-secondary flex-1 sm:flex-none flex items-center justify-center gap-2">
              <i data-lucide="users" class="w-4 h-4"></i>
              Split Bill
            </button>
            <button id="add-txn-btn" class="glass-button flex-1 sm:flex-none flex items-center justify-center gap-2">
              <i data-lucide="plus" class="w-4 h-4"></i>
              Add Transaction
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="glass-card p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div class="md:col-span-2 relative">
            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input id="filter-search" type="text" placeholder="Search payee or notes..."
                   value="${currentFilters.searchQuery}" class="glass-input w-full pl-9">
          </div>
          <select id="filter-type" class="glass-input w-full">
            <option value="">All Types</option>
            <option value="expense" ${currentFilters.type === 'expense' ? 'selected' : ''}>Expense</option>
            <option value="income" ${currentFilters.type === 'income' ? 'selected' : ''}>Income</option>
          </select>
          <select id="filter-category" class="glass-input w-full">
            <option value="">All Categories</option>
            ${categories.map(c => `<option value="${c.id}" ${currentFilters.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
          <div class="grid grid-cols-2 gap-2">
            <input id="filter-start" type="date" value="${currentFilters.startDate}" class="glass-input w-full min-w-0" title="From">
            <input id="filter-end" type="date" value="${currentFilters.endDate}" class="glass-input w-full min-w-0" title="To">
          </div>
        </div>
        ${(currentFilters.searchQuery || currentFilters.type || currentFilters.categoryId || currentFilters.startDate || currentFilters.endDate) ? `
          <div class="flex justify-end mb-4">
            <button id="clear-filters-btn" class="text-sm text-slate-400 hover:text-white flex items-center gap-1">
              <i data-lucide="x" class="w-3.5 h-3.5"></i> Clear filters
            </button>
          </div>
        ` : ''}

        <div class="glass-card p-6">
          ${transactions.length > 0 ? `
            <div class="space-y-3">
              ${transactions.map(txn => {
            const cat = categories.find(c => c.id === txn.categoryId);
            return `
                  <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <i data-lucide="${cat?.icon || 'circle'}" class="w-5 h-5 text-primary-400"></i>
                      </div>
                      <div>
                        <h4 class="font-medium">${cat?.name || 'Unknown'}</h4>
                        <p class="text-sm text-slate-400">
                          ${formatDate(txn.date)}${txn.payee ? ' • ' + txn.payee : ''}
                          ${txn.receiptPath ? ' • <i data-lucide=\"paperclip\" class=\"w-3 h-3 inline\"></i>' : ''}
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <p class="font-semibold ${txn.type === 'income' ? 'text-green-400' : 'text-red-400'}">
                        ${txn.type === 'income' ? '+' : '-'}${formatCurrency(txn.amount, currency)}
                      </p>
                      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${txn.receiptPath ? `
                          <button class="view-receipt p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" data-id="${txn.id}" aria-label="View receipt">
                            <i data-lucide="paperclip" class="w-4 h-4"></i>
                          </button>
                        ` : ''}
                        <button class="edit-txn p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" data-id="${txn.id}" aria-label="Edit transaction">
                          <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button class="delete-txn p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" data-id="${txn.id}" aria-label="Delete transaction">
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                `;
        }).join('')}
            </div>
          ` : `
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="inbox" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No transactions match your filters</p>
            </div>
          `}
        </div>
      </div>
    `;

        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }

        // Filter events
        const debouncedSearch = debounce((value: string) => {
            currentFilters.searchQuery = value;
            renderTransactions();
        }, 300);

        document.getElementById('filter-search')?.addEventListener('input', (e) => {
            debouncedSearch((e.target as HTMLInputElement).value);
        });
        document.getElementById('filter-type')?.addEventListener('change', (e) => {
            currentFilters.type = (e.target as HTMLSelectElement).value as Filters['type'];
            renderTransactions();
        });
        document.getElementById('filter-category')?.addEventListener('change', (e) => {
            currentFilters.categoryId = (e.target as HTMLSelectElement).value;
            renderTransactions();
        });
        document.getElementById('filter-start')?.addEventListener('change', (e) => {
            currentFilters.startDate = (e.target as HTMLInputElement).value;
            renderTransactions();
        });
        document.getElementById('filter-end')?.addEventListener('change', (e) => {
            currentFilters.endDate = (e.target as HTMLInputElement).value;
            renderTransactions();
        });
        document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
            currentFilters = { searchQuery: '', type: '', categoryId: '', startDate: '', endDate: '' };
            renderTransactions();
        });

        // Add / Edit / Delete
        document.getElementById('add-txn-btn')?.addEventListener('click', () => {
            openTransactionModal(undefined, () => renderTransactions());
        });

        document.getElementById('split-bill-btn')?.addEventListener('click', () => {
            openSplitModal(() => renderTransactions());
        });

        mainContent.querySelectorAll('.edit-txn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = (btn as HTMLElement).dataset.id!;
                const txn = transactions.find(t => t.id === id);
                if (txn) openTransactionModal(txn, () => renderTransactions());
            });
        });

        mainContent.querySelectorAll('.view-receipt').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = (btn as HTMLElement).dataset.id!;
                const txn = transactions.find(t => t.id === id);
                if (!txn?.receiptPath) return;
                try {
                    const buffer = await db.readBlob(txn.receiptPath);
                    const blob = new Blob([buffer]);
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                } catch (error) {
                    console.error(error);
                    showToast('Failed to load receipt', { type: 'error' });
                }
            });
        });

        mainContent.querySelectorAll('.delete-txn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = (btn as HTMLElement).dataset.id!;
                const txn = transactions.find(t => t.id === id);
                if (!txn) return;

                try {
                    await db.deleteTransaction(id);
                    showToast('Transaction deleted', {
                        type: 'success',
                        duration: 6000,
                        action: {
                            label: 'Undo',
                            onClick: async () => {
                                await restoreDeletedTransaction(txn);
                            },
                        },
                    });
                    renderTransactions();
                } catch (error) {
                    console.error(error);
                    showToast('Failed to delete transaction', { type: 'error' });
                }
            });
        });

    } catch (error) {
        console.error('[Transactions] Error rendering:', error);
        showToast('Failed to load transactions', { type: 'error' });
    }
}

async function restoreDeletedTransaction(txn: Transaction): Promise<void> {
    try {
        await db.restoreTransaction(txn);
        showToast('Transaction restored', { type: 'success', duration: 2000 });
        window.dispatchEvent(new CustomEvent('transaction-changed'));
    } catch (error) {
        console.error(error);
        showToast('Failed to restore transaction', { type: 'error' });
    }
}
