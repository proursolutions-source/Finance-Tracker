/**
 * Admin: Discount Codes — create/edit/deactivate promo codes.
 */
import { withAdminGuard, adminTabs } from './admin-guard';
import { listDiscounts, createDiscount, updateDiscount, deleteDiscount, listPlans } from '../../cloud/cloud-db';
import { formatCurrency, formatDate, getIcon } from '../../utils';
import { showToast } from '../../components/toast';
import { showModal, showConfirm } from '../../components/modal';
import type { DiscountCode, DiscountType, SubscriptionPlan } from '../../cloud/types';

export async function renderAdminDiscounts(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="admin-root" class="max-w-6xl mx-auto pb-20"></div>`;
    const root = document.getElementById('admin-root')!;

    await withAdminGuard(root, async () => {
        try {
            const [codes, plans] = await Promise.all([listDiscounts(), listPlans(true)]);
            renderList(root, codes, plans);
        } catch (error) {
            console.error('[Admin Discounts] Error:', error);
            root.innerHTML = `<div class="glass-card p-6 text-red-400">Failed to load discount codes.</div>`;
        }
    });
}

function renderList(root: HTMLElement, codes: DiscountCode[], plans: SubscriptionPlan[]): void {
    root.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('shield', 26)} Admin Portal</h1>
        <p class="text-sm text-slate-400 mt-1">MoneyFlow subscription &amp; user management.</p>
      </div>
      <button id="new-discount-btn" class="glass-button flex items-center gap-2">${getIcon('plus', 16)} New Code</button>
    </div>
    ${adminTabs('discounts')}
    <div class="glass-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-slate-400 border-b border-white/10">
          <tr>
            <th class="p-4">Code</th>
            <th class="p-4">Discount</th>
            <th class="p-4">Redemptions</th>
            <th class="p-4">Valid</th>
            <th class="p-4">Status</th>
            <th class="p-4"></th>
          </tr>
        </thead>
        <tbody>
          ${codes.length === 0 ? `<tr><td colspan="6" class="p-8 text-center text-slate-400">No discount codes yet.</td></tr>` : codes.map(c => `
            <tr class="border-b border-white/5 last:border-0">
              <td class="p-4 font-mono font-medium">${c.code}</td>
              <td class="p-4">${c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value)}</td>
              <td class="p-4">${c.redemptionsCount}${c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</td>
              <td class="p-4 text-slate-400">${c.validUntil ? `until ${formatDate(c.validUntil)}` : 'no expiry'}</td>
              <td class="p-4"><span class="px-2 py-0.5 rounded-full text-xs ${c.isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-slate-400'}">${c.isActive ? 'Active' : 'Inactive'}</span></td>
              <td class="p-4 flex gap-2">
                <button class="edit-discount-btn text-primary-400 hover:underline text-xs" data-id="${c.id}">Edit</button>
                <button class="delete-discount-btn text-red-400 hover:underline text-xs" data-id="${c.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    document.getElementById('new-discount-btn')?.addEventListener('click', () => openDiscountModal(undefined, plans));
    root.querySelectorAll<HTMLButtonElement>('.edit-discount-btn').forEach(btn => {
        btn.addEventListener('click', () => openDiscountModal(codes.find(c => c.id === btn.dataset.id), plans));
    });
    root.querySelectorAll<HTMLButtonElement>('.delete-discount-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showConfirm('Delete Discount Code', 'This cannot be undone.', async () => {
                try {
                    await deleteDiscount(btn.dataset.id!);
                    showToast('Discount code deleted', { type: 'success' });
                    renderAdminDiscounts();
                } catch (error) {
                    console.error(error);
                    showToast('Failed to delete code', { type: 'error' });
                }
            });
        });
    });
}

function openDiscountModal(existing: DiscountCode | undefined, plans: SubscriptionPlan[]): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Code</label>
      <input type="text" name="code" required value="${existing?.code || ''}" class="glass-input w-full uppercase" placeholder="e.g., LAUNCH20">
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Type</label>
        <select name="type" class="glass-input w-full">
          <option value="percent" ${existing?.type === 'percent' ? 'selected' : ''}>Percent off</option>
          <option value="flat" ${existing?.type === 'flat' ? 'selected' : ''}>Flat amount off (INR)</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Value</label>
        <input type="number" name="value" min="0" step="0.01" required value="${existing?.value ?? ''}" class="glass-input w-full">
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Max redemptions (optional)</label>
        <input type="number" name="maxRedemptions" min="1" value="${existing?.maxRedemptions ?? ''}" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Valid until (optional)</label>
        <input type="date" name="validUntil" value="${existing?.validUntil?.split('T')[0] || ''}" class="glass-input w-full">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Applicable plans (leave empty for all)</label>
      <select name="applicablePlanIds" multiple class="glass-input w-full h-24">
        ${plans.map(p => `<option value="${p.id}" ${existing?.applicablePlanIds?.includes(p.id) ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <input type="text" name="notes" value="${existing?.notes || ''}" class="glass-input w-full">
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" name="isActive" ${existing?.isActive !== false ? 'checked' : ''}>
      Active
    </label>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${existing ? 'Save Changes' : 'Create Code'}</button>
  `;

    const close = showModal({ title: existing ? 'Edit Discount Code' : 'New Discount Code', content: form, footer, size: 'lg' });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const selectedPlans = Array.from((form.querySelector('select[name="applicablePlanIds"]') as HTMLSelectElement).selectedOptions).map(o => o.value);
        const validUntilRaw = formData.get('validUntil') as string;
        const payload = {
            code: (formData.get('code') as string).toUpperCase(),
            type: formData.get('type') as DiscountType,
            value: parseFloat(formData.get('value') as string),
            maxRedemptions: formData.get('maxRedemptions') ? parseInt(formData.get('maxRedemptions') as string, 10) : null,
            validFrom: existing?.validFrom ?? null,
            validUntil: validUntilRaw ? new Date(validUntilRaw).toISOString() : null,
            isActive: formData.get('isActive') === 'on',
            applicablePlanIds: selectedPlans.length > 0 ? selectedPlans : null,
            notes: (formData.get('notes') as string) || null,
        };
        try {
            if (existing) await updateDiscount(existing.id, payload);
            else await createDiscount(payload);
            showToast(existing ? 'Discount code updated' : 'Discount code created', { type: 'success' });
            close();
            renderAdminDiscounts();
        } catch (error: any) {
            console.error(error);
            showToast(error?.message?.includes('duplicate') ? 'That code already exists' : 'Failed to save discount code', { type: 'error' });
        }
    });
}
