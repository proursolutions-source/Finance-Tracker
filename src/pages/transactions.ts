/**
 * Transactions Page - List and manage all transactions
 */

import { db } from '../db';
import { store } from '../stores';
import { formatCurrency, formatDate } from '../utils';
import { showToast } from '../components/toast';

export async function renderTransactions(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    const transactions = await db.getTransactions({ limit: 50 });
    const categories = store.getState().categories;
    const profile = store.getState().userProfile;
    const currency = profile?.primaryCurrency || 'INR';

    mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Transactions</h1>
        
        <div class="glass-card p-6">
          ${transactions.length > 0 ? `
            <div class="space-y-3">
              ${transactions.map(txn => {
      const cat = categories.find(c => c.id === txn.categoryId);
      return `
                  <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <i data-lucide="${cat?.icon || 'circle'}" class="w-5 h-5 text-primary-400"></i>
                      </div>
                      <div>
                        <h4 class="font-medium">${cat?.name || 'Unknown'}</h4>
                        <p class="text-sm text-slate-400">${formatDate(txn.date)}${txn.payee ? ' • ' + txn.payee : ''}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="font-semibold ${txn.type === 'income' ? 'text-green-400' : 'text-red-400'}">
                        ${txn.type === 'income' ? '+' : '-'}${formatCurrency(txn.amount, currency)}
                      </p>
                    </div>
                  </div>
                `;
    }).join('')}
            </div>
          ` : `
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="inbox" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No transactions yet</p>
            </div>
          `}
        </div>
      </div>
    `;

    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }

  } catch (error) {
    console.error('[Transactions] Error rendering:', error);
    showToast('Failed to load transactions', { type: 'error' });
  }
}
