/**
 * Dashboard Page - Main financial overview
 */

import { db } from '../db';
import { store } from '../stores';
import { formatCurrency, formatRelativeDate, getBudgetPercentage, getBudgetStatusColor, getIcon } from '../utils';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import type { Transaction } from '../types';

export async function renderDashboard(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    // Get dashboard data
    const summary = await db.getDashboardSummary();
    const recentTxns = await db.getTransactions({ limit: 10 });
    const budgets = await db.getBudgets();
    const categories = store.getState().categories;

    // Calculate budget progress
    const budgetProgress = await Promise.all(
      budgets.slice(0, 3).map(async (budget) => {
        const cat = categories.find(c => c.id === budget.categoryId);
        if (!cat) return null;

        // Calculate date range based on period
        const now = new Date();
        let startDate = budget.startDate;
        let endDate = new Date().toISOString();

        // Get spent amount for this period
        const txns = await db.getTransactions({
          startDate,
          endDate,
          categoryIds: [budget.categoryId],
          type: 'expense',
        });

        const spent = txns.reduce((sum, t) => sum + t.amount, 0);
        const percentage = getBudgetPercentage(spent, budget.amount);

        return {
          categoryName: cat.name,
          icon: cat.icon || 'circle',
          spent,
          budget: budget.amount,
          percentage,
        };
      })
    );

    const validBudgets = budgetProgress.filter((b): b is NonNullable<typeof b> => b !== null);

    const profile = store.getState().userProfile;
    const currency = profile?.primaryCurrency || 'INR';

    mainContent.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold mb-2">Welcome back${profile?.preferredName ? ', ' + profile.preferredName : ''}! 👋</h1>
          <p class="text-slate-400">Here's your financial overview</p>
        </div>
        
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- Balance Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Total Balance</span>
              <i data-lucide="wallet" class="w-5 h-5 text-primary-400"></i>
            </div>
            <h2 class="text-3xl font-bold mb-1">${formatCurrency(summary.balance, currency)}</h2>
            <p class="text-sm text-slate-500">All accounts</p>
          </div>
          
          <!-- Monthly Income Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Monthly Income</span>
              <i data-lucide="trending-up" class="w-5 h-5 text-green-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-green-400 mb-1">${formatCurrency(summary.monthlyIncome, currency)}</h2>
            <p class="text-sm text-slate-500">This month</p>
          </div>
          
          <!-- Monthly Expense Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Monthly Expense</span>
              <i data-lucide="trending-down" class="w-5 h-5 text-red-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-red-400 mb-1">${formatCurrency(summary.monthlyExpense, currency)}</h2>
            <p class="text-sm text-slate-500">This month</p>
          </div>
        </div>
        
        <!-- Budget Progress (if any budgets exist) -->
        ${validBudgets.length > 0 ? `
          <div class="glass-card p-6 mb-8">
            <h3 class="text-xl font-bold mb-4">Budget Progress</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              ${validBudgets.map(b => `
                <div class="flex flex-col items-center">
                  <div class="relative w-24 h-24 mb-3">
                    <svg class="transform -rotate-90 w-24 h-24">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="none" class="text-slate-700" />
                      <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="none" 
                        class="${getBudgetStatusColor(b.percentage)}"
                        stroke-dasharray="${2 * Math.PI * 40}"
                        stroke-dashoffset="${2 * Math.PI * 40 * (1 - b.percentage / 100)}"
                        stroke-linecap="round" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <span class="text-lg font-bold">${b.percentage}%</span>
                    </div>
                  </div>
                  <h4 class="font-semibold mb-1">${b.categoryName}</h4>
                  <p class="text-sm text-slate-400">${formatCurrency(b.spent, currency)} / ${formatCurrency(b.budget, currency)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Recent Transactions -->
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold">Recent Transactions</h3>
            <a href="#/transactions" class="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              View all
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </a>
          </div>
          
          ${recentTxns.length > 0 ? `
            <div class="space-y-3">
              ${recentTxns.map(txn => {
      const cat = categories.find(c => c.id === txn.categoryId);
      return `
                  <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <i data-lucide="${cat?.icon || 'circle'}" class="w-5 h-5 text-primary-400"></i>
                      </div>
                      <div>
                        <h4 class="font-medium">${cat?.name || 'Unknown'}</h4>
                        <p class="text-sm text-slate-400">${formatRelativeDate(txn.date)}${txn.payee ? ' • ' + txn.payee : ''}</p>
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
              <p class="text-sm mt-2">Tap the + button to add your first transaction</p>
            </div>
          `}
        </div>
        
        <!-- FAB for adding transaction -->
        <button id="add-transaction-fab" class="fab" aria-label="Add transaction">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    `;

    // Initialize icons
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }

    // Add transaction button
    const fab = document.getElementById('add-transaction-fab');
    fab?.addEventListener('click', openAddTransactionModal);

  } catch (error) {
    console.error('[Dashboard] Error rendering:', error);
    showToast('Failed to load dashboard', { type: 'error' });
  }
}

/**
 * Open modal to add transaction
 */
function openAddTransactionModal(): void {
  const categories = store.getState().categories;
  const profile = store.getState().userProfile;
  const currency = profile?.primaryCurrency || 'INR';

  const form = document.createElement('form');
  form.id = 'transaction-form';
  form.className = 'space-y-4';
  form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-2">Amount (${currency})</label>
      <input type="number" name="amount" step="0.01" min="0" required 
        class="glass-input w-full" placeholder="0.00">
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Type</label>
      <div class="flex gap-2">
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="type" value="expense" checked class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-red-500/20 peer-checked:border-red-500">
            Expense
          </div>
        </label>
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="type" value="income" class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-green-500/20 peer-checked:border-green-500">
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
          <option value="${cat.id}">${cat.icon ? cat.icon + ' ' : ''}${cat.name}</option>
        `).join('')}
      </select>
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Date</label>
      <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" 
        class="glass-input w-full">
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Payee (optional)</label>
      <input type="text" name="payee" class="glass-input w-full" placeholder="e.g., Grocery Store">
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full" placeholder="Add details..."></textarea>
    </div>
  `;

  const footer = document.createElement('div');
  footer.className = 'flex gap-3';
  footer.innerHTML = `
    <button type="button" class="glass-button-secondary flex-1" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button flex-1">Add Transaction</button>
  `;

  const close = showModal({
    title: 'Add Transaction',
    content: form,
    footer,
    size: 'lg',
  });

  footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData(form);
      const data = {
        amount: parseFloat(formData.get('amount') as string),
        type: formData.get('type') as 'income' | 'expense',
        categoryId: formData.get('categoryId') as string,
        date: new Date(formData.get('date') as string).toISOString(),
        payee: formData.get('payee') as string || undefined,
        notes: formData.get('notes') as string || undefined,
      };

      await db.createTransaction(data);
      close();
      showToast('Transaction added successfully', { type: 'success' });

      // Refresh dashboard
      renderDashboard();

    } catch (error) {
      showToast('Failed to add transaction', { type: 'error' });
      console.error(error);
    }
  });
}
