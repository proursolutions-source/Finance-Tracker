/**
 * Budgets Page - Create, track, and manage budgets
 */

import { db } from '../db';
import { store } from '../stores';
import { formatCurrency, getBudgetPercentage, getBudgetStatusColor, escapeHtml } from '../utils';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import type { Budget } from '../types';

export async function renderBudgets(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    const budgets = await db.getBudgets();
    const categories = store.getState().categories;
    const profile = store.getState().userProfile;
    const currency = profile?.primaryCurrency || 'INR';

    // Calculate progress for each budget
    const budgetProgress = await Promise.all(
      budgets.map(async (budget) => {
        const cat = categories.find(c => c.id === budget.categoryId);
        if (!cat) return null;

        // Calculate date range based on period
        let startDate = budget.startDate;
        let endDate = budget.endDate || new Date().toISOString();

        // Get spent amount
        const txns = await db.getTransactions({
          startDate,
          endDate,
          categoryIds: [budget.categoryId],
          type: 'expense',
        });

        const spent = txns.reduce((sum, t) => sum + t.amount, 0);
        const percentage = getBudgetPercentage(spent, budget.amount);

        return {
          ...budget,
          categoryName: cat.name,
          categoryIcon: cat.icon || 'circle',
          spent,
          percentage,
        };
      })
    );

    const validBudgets = budgetProgress.filter((b): b is NonNullable<typeof b> => b !== null);

    mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto pb-20">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold">Budgets</h1>
          <button id="create-budget-btn" class="glass-button flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i>
            New Budget
          </button>
        </div>

        ${validBudgets.length > 0 ? `
          <div class="grid gap-6">
            ${validBudgets.map(b => `
              <div class="glass-card p-6 relative group">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background-color: ${b.color || '#3b82f6'}20; color: ${b.color || '#3b82f6'}">
                      <i data-lucide="${b.categoryIcon}" class="w-6 h-6"></i>
                    </div>
                    <div>
                      <h3 class="font-bold text-lg">${escapeHtml(b.categoryName)}</h3>
                      <p class="text-sm text-slate-400 capitalize">${b.period} Budget</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button class="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white" 
                        onclick="window.editBudget('${b.id}')" aria-label="Edit budget">
                      <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button class="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-red-400" 
                        onclick="window.deleteBudget('${b.id}')" aria-label="Delete budget">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>

                <div class="mb-2 flex justify-between items-end">
                  <div>
                    <span class="text-2xl font-bold">${formatCurrency(b.spent, currency)}</span>
                    <span class="text-slate-400 text-sm"> / ${formatCurrency(b.amount, currency)}</span>
                  </div>
                  <span class="font-bold ${getBudgetStatusColor(b.percentage)}">${b.percentage}%</span>
                </div>

                <!-- Progress Bar -->
                <div class="h-3 w-full bg-slate-700/50 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500 ${getBudgetStatusColor(b.percentage).replace('text-', 'bg-')}"
                       style="width: ${Math.min(b.percentage, 100)}%"></div>
                </div>

                ${b.notes ? `
                  <div class="mt-4 pt-4 border-t border-white/5 text-sm text-slate-400 flex items-start gap-2">
                    <i data-lucide="sticky-note" class="w-4 h-4 mt-0.5 opacity-50"></i>
                    <p>${escapeHtml(b.notes)}</p>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="glass-card p-12 text-center">
            <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <i data-lucide="piggy-bank" class="w-8 h-8 text-slate-400"></i>
            </div>
            <h3 class="text-xl font-bold mb-2">No budgets set</h3>
            <p class="text-slate-400 mb-6 max-w-sm mx-auto">Create budgets to track your spending and save more money.</p>
            <button id="create-budget-empty-btn" class="glass-button">Create Your First Budget</button>
          </div>
        `}
      </div>
    `;

    // Initialize icons
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }

    // Event Listeners
    const createBtn = document.getElementById('create-budget-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => openBudgetModal());
    }

    const emptyBtn = document.getElementById('create-budget-empty-btn');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => openBudgetModal());
    }

    // Expose helpers to window
    (window as any).editBudget = (id: string) => {
      const budget = budgets.find(b => b.id === id);
      if (budget) openBudgetModal(budget);
    };

    (window as any).deleteBudget = async (id: string) => {
      if (confirm('Are you sure you want to delete this budget?')) {
        try {
          await db.deleteBudget(id);
          showToast('Budget deleted', { type: 'success' });
          renderBudgets(); // Refresh
        } catch (error) {
          showToast('Failed to delete budget', { type: 'error' });
        }
      }
    };

  } catch (error) {
    console.error('[Budgets] Error rendering:', error);
    showToast('Failed to load budgets', { type: 'error' });
  }
}

/**
 * Open create/edit budget modal
 */
function openBudgetModal(budget?: Budget): void {
  const categories = store.getState().categories.filter(c => c.type === 'expense'); // Only expense budgets
  const profile = store.getState().userProfile;
  const currency = profile?.primaryCurrency || 'INR';

  const form = document.createElement('form');
  form.className = 'space-y-4';

  // Generate color options HTML
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  const colorOptions = colors.map(color => {
    const isChecked = budget?.color === color || (!budget && color === '#3b82f6');
    return `
            <label class="cursor-pointer">
                <input type="radio" name="color" value="${color}" class="peer sr-only" ${isChecked ? 'checked' : ''}>
                <div class="w-8 h-8 rounded-full border-2 border-transparent peer-checked:border-white transition-all transform peer-checked:scale-110" 
                     style="background-color: ${color}"></div>
            </label>
        `;
  }).join('');

  form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Category</label>
      <select name="categoryId" required class="glass-input w-full" ${budget ? 'disabled' : ''}>
        <option value="">Select category...</option>
        ${categories.map(c => `
          <option value="${c.id}" ${budget?.categoryId === c.id ? 'selected' : ''}>
            ${escapeHtml(c.name)}
          </option>
        `).join('')}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Budget Amount (${currency})</label>
      <input type="number" name="amount" required min="1" step="1" 
             value="${budget?.amount || ''}" class="glass-input w-full" placeholder="e.g. 5000">
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Period</label>
        <select name="period" required class="glass-input w-full">
          <option value="monthly" ${budget?.period === 'monthly' ? 'selected' : ''}>Monthly</option>
          <option value="weekly" ${budget?.period === 'weekly' ? 'selected' : ''}>Weekly</option>
          <option value="yearly" ${budget?.period === 'yearly' ? 'selected' : ''}>Yearly</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Start Date</label>
        <input type="date" name="startDate" required 
               value="${budget?.startDate ? budget.startDate.split('T')[0] : new Date().toISOString().split('T')[0]}" 
               class="glass-input w-full">
      </div>
    </div>

    <div>
        <label class="block text-sm font-medium mb-1">Color Code</label>
        <div class="flex gap-2 flex-wrap">
            ${colorOptions}
        </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Notes (Optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full" placeholder="Add details...">${escapeHtml(budget?.notes)}</textarea>
    </div>
  `;

  const footer = document.createElement('div');
  footer.className = 'flex gap-3 justify-end';
  footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${budget ? 'Update' : 'Create'} Budget</button>
  `;

  const close = showModal({
    title: budget ? 'Edit Budget' : 'Create New Budget',
    content: form,
    footer
  });

  const cancelBtn = footer.querySelector('[data-action="cancel"]');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data: any = {
      categoryId: formData.get('categoryId') as string,
      amount: parseFloat(formData.get('amount') as string),
      period: formData.get('period'),
      startDate: new Date(formData.get('startDate') as string).toISOString(),
      notes: formData.get('notes') as string,
      color: formData.get('color') as string
    };

    try {
      if (budget) {
        // Keep ID, remove categoryId (can't change category)
        const { categoryId, ...updates } = data;
        await db.updateBudget(budget.id, updates);
        showToast('Budget updated successfully', { type: 'success' });
      } else {
        await db.createBudget(data);
        showToast('Budget created successfully', { type: 'success' });
      }
      close();
      renderBudgets();
    } catch (error) {
      console.error(error);
      showToast('Failed to save budget', { type: 'error' });
    }
  });
}
