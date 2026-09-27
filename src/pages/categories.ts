/**
 * Categories Page - Manage income and expense categories
 */

import { db } from '../db';
import { store } from '../stores';
import { showToast } from '../components/toast';

export async function renderCategories(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const categories = await db.getCategories();

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Categories</h1>
        
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          ${categories.map(cat => `
            <div class="glass-card p-4 text-center">
              <i data-lucide="${cat.icon || 'circle'}" class="w-8 h-8 mx-auto mb-2 text-primary-400"></i>
              <h3 class="font-medium mb-1">${cat.name}</h3>
              <span class="text-xs text-slate-400">${cat.type}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }

    } catch (error) {
        console.error('[Categories] Error rendering:', error);
        showToast('Failed to load categories', { type: 'error' });
    }
}
