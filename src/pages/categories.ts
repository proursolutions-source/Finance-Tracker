/**
 * Categories Page - Manage income and expense categories
 */

import { db } from '../db';
import { store } from '../stores';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import type { Category } from '../types';

export async function renderCategories(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const categories = await db.getCategories();

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto pb-20">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold">Categories</h1>
          <button id="create-category-btn" class="glass-button flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i>
            New Category
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          ${categories.map(cat => `
            <div class="glass-card p-4 text-center relative group">
              <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                    onclick="window.editCategory('${cat.id}')" aria-label="Edit category">
                  <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                </button>
                <button class="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400"
                    onclick="window.deleteCategory('${cat.id}')" aria-label="Delete category">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
              <i data-lucide="${cat.icon || 'circle'}" class="w-8 h-8 mx-auto mb-2" style="color: ${cat.color || '#60a5fa'}"></i>
              <h3 class="font-medium mb-1">${cat.name}</h3>
              <span class="text-xs text-slate-400 capitalize">${cat.type}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }

        document.getElementById('create-category-btn')?.addEventListener('click', () => openCategoryModal());

        (window as any).editCategory = (id: string) => {
            const category = categories.find(c => c.id === id);
            if (category) openCategoryModal(category);
        };

        (window as any).deleteCategory = async (id: string) => {
            if (confirm('Are you sure you want to delete this category? Transactions using it will keep the reference.')) {
                try {
                    await db.deleteCategory(id);
                    store.setCategories(await db.getCategories());
                    showToast('Category deleted', { type: 'success' });
                    renderCategories();
                } catch (error) {
                    console.error(error);
                    showToast('Failed to delete category', { type: 'error' });
                }
            }
        };

    } catch (error) {
        console.error('[Categories] Error rendering:', error);
        showToast('Failed to load categories', { type: 'error' });
    }
}

/**
 * Open create/edit category modal
 */
function openCategoryModal(category?: Category): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';

    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const colorOptions = colors.map(color => {
        const isChecked = category?.color === color || (!category && color === '#3b82f6');
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
      <label class="block text-sm font-medium mb-1">Name</label>
      <input type="text" name="name" required
             value="${category?.name || ''}" class="glass-input w-full" placeholder="e.g., Pets">
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Type</label>
      <select name="type" required class="glass-input w-full">
        <option value="expense" ${!category || category.type === 'expense' ? 'selected' : ''}>Expense</option>
        <option value="income" ${category?.type === 'income' ? 'selected' : ''}>Income</option>
        <option value="both" ${category?.type === 'both' ? 'selected' : ''}>Both</option>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Icon (Lucide name)</label>
      <div class="flex items-center gap-3">
        <div id="icon-preview-container" class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
          <i data-lucide="${category?.icon || 'circle'}" class="w-5 h-5"></i>
        </div>
        <input type="text" name="icon"
               value="${category?.icon || ''}" class="glass-input w-full" placeholder="e.g., paw-print (defaults to a plain circle)">
      </div>
      <p id="icon-preview-warning" class="text-xs text-yellow-400 mt-1 hidden">Unrecognized icon name — this category will show as a plain circle.</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Color</label>
      <div class="flex gap-2 flex-wrap">
        ${colorOptions}
      </div>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${category ? 'Update' : 'Create'} Category</button>
  `;

    const close = showModal({
        title: category ? 'Edit Category' : 'New Category',
        content: form,
        footer,
    });

    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    const iconInput = form.querySelector('input[name="icon"]') as HTMLInputElement;
    const iconPreviewContainer = form.querySelector('#icon-preview-container') as HTMLElement;
    const iconWarning = form.querySelector('#icon-preview-warning') as HTMLElement;
    const updateIconPreview = () => {
        const name = iconInput.value.trim() || 'circle';
        iconPreviewContainer.innerHTML = `<i data-lucide="${name}" class="w-5 h-5"></i>`;
        if ((window as any).lucide) (window as any).lucide.createIcons();
        // lucide replaces a recognized <i> with an <svg>; if it's still an <i>, the name didn't resolve.
        const unresolved = iconPreviewContainer.querySelector('i') !== null;
        iconWarning.classList.toggle('hidden', !(unresolved && name !== 'circle'));
    };
    iconInput.addEventListener('input', updateIconPreview);
    updateIconPreview();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data: any = {
            name: formData.get('name') as string,
            type: formData.get('type') as 'income' | 'expense' | 'both',
            icon: (formData.get('icon') as string) || undefined,
            color: formData.get('color') as string,
        };

        try {
            if (category) {
                await db.updateCategory(category.id, data);
                showToast('Category updated successfully', { type: 'success' });
            } else {
                await db.createCategory({ ...data, hidden: false });
                showToast('Category created successfully', { type: 'success' });
            }
            store.setCategories(await db.getCategories());
            close();
            renderCategories();
        } catch (error) {
            console.error(error);
            showToast('Failed to save category', { type: 'error' });
        }
    });
}
