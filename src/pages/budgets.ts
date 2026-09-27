/**
 * Budgets Page - Create and track budgets
 */

import { db } from '../db';
import { formatCurrency } from '../utils';
import { showToast } from '../components/toast';

export async function renderBudgets(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const budgets = await db.getBudgets();

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Budgets</h1>
        
        <div class="glass-card p-6">
          ${budgets.length > 0 ? `
            <div class="space-y-4">
              ${budgets.map(budget => `
                <div class="py-3 border-b border-white/5 last:border-0">
                  <div class="flex justify-between items-center">
                    <span class="font-medium">Budget</span>
                    <span class="text-slate-400">${budget.period}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="pie-chart" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No budgets set</p>
            </div>
          `}
        </div>
      </div>
    `;

        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }

    } catch (error) {
        console.error('[Budgets] Error rendering:', error);
        showToast('Failed to load budgets', { type: 'error' });
    }
}
