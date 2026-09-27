/**
 * Admin: Subscription Plans — create/edit/deactivate plans and their pricing/features.
 */
import { withAdminGuard, adminTabs } from './admin-guard';
import { listPlans, createPlan, updatePlan, deletePlan } from '../../cloud/cloud-db';
import { formatCurrency, getIcon } from '../../utils';
import { showToast } from '../../components/toast';
import { showModal, showConfirm } from '../../components/modal';
import type { SubscriptionPlan, BillingInterval, PlanTier } from '../../cloud/types';

export async function renderAdminPlans(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="admin-root" class="max-w-6xl mx-auto pb-20"></div>`;
    const root = document.getElementById('admin-root')!;

    await withAdminGuard(root, async () => {
        try {
            const plans = await listPlans(true);
            renderList(root, plans);
        } catch (error) {
            console.error('[Admin Plans] Error:', error);
            root.innerHTML = `<div class="glass-card p-6 text-red-400">Failed to load plans.</div>`;
        }
    });
}

function renderList(root: HTMLElement, plans: SubscriptionPlan[]): void {
    root.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('shield', 26)} Admin Portal</h1>
        <p class="text-sm text-slate-400 mt-1">MoneyFlow subscription &amp; user management.</p>
      </div>
      <button id="new-plan-btn" class="glass-button flex items-center gap-2">${getIcon('plus', 16)} New Plan</button>
    </div>
    ${adminTabs('plans')}
    <div class="grid gap-4 md:grid-cols-3">
      ${plans.map(plan => `
        <div class="glass-card p-5 ${!plan.isActive ? 'opacity-50' : ''}">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold">${plan.name}</h3>
            <div class="flex gap-1.5">
              <span class="text-xs px-2 py-0.5 rounded-full capitalize ${{ free: 'bg-white/10 text-slate-300', pro: 'bg-primary-500/20 text-primary-400', premium: 'bg-purple-500/20 text-purple-400' }[plan.tier]}">${plan.tier}</span>
              <span class="text-xs px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-slate-400'}">${plan.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-2">${plan.description || ''}</p>
          <p class="text-xl font-bold mb-3">${plan.priceInr === 0 ? 'Free' : formatCurrency(plan.priceInr)}<span class="text-sm text-slate-400 font-normal">${plan.priceInr === 0 ? '' : ` / ${plan.billingInterval}`}</span></p>
          <ul class="text-xs text-slate-400 space-y-1 mb-4">
            ${plan.features.map(f => `<li>&bull; ${f}</li>`).join('')}
          </ul>
          <div class="flex gap-2">
            <button class="edit-plan-btn glass-button-secondary flex-1 text-sm" data-id="${plan.id}">Edit</button>
            <button class="delete-plan-btn p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400" data-id="${plan.id}">${getIcon('trash-2', 14)}</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    document.getElementById('new-plan-btn')?.addEventListener('click', () => openPlanModal());
    root.querySelectorAll<HTMLButtonElement>('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', () => openPlanModal(plans.find(p => p.id === btn.dataset.id)));
    });
    root.querySelectorAll<HTMLButtonElement>('.delete-plan-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showConfirm('Delete Plan', 'This cannot be undone. Existing subscriptions on this plan will keep referencing it.', async () => {
                try {
                    await deletePlan(btn.dataset.id!);
                    showToast('Plan deleted', { type: 'success' });
                    renderAdminPlans();
                } catch (error) {
                    console.error(error);
                    showToast('Failed to delete plan — it may have active subscriptions', { type: 'error' });
                }
            });
        });
    });
}

function openPlanModal(existing?: SubscriptionPlan): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Plan Name</label>
      <input type="text" name="name" required value="${existing?.name || ''}" class="glass-input w-full">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Description</label>
      <input type="text" name="description" value="${existing?.description || ''}" class="glass-input w-full">
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Price (INR)</label>
        <input type="number" name="priceInr" min="0" step="1" required value="${existing?.priceInr ?? 0}" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Billing Interval</label>
        <select name="billingInterval" class="glass-input w-full">
          ${(['monthly', 'yearly', 'lifetime'] as BillingInterval[]).map(i => `<option value="${i}" ${existing?.billingInterval === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Tier</label>
      <select name="tier" class="glass-input w-full">
        ${(['free', 'pro', 'premium'] as PlanTier[]).map(t => `<option value="${t}" ${(existing?.tier ?? 'free') === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <p class="text-xs text-slate-500 mt-1">Controls which features this plan unlocks in the app — not just its price/billing label.</p>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Features (one per line)</label>
      <textarea name="features" rows="4" class="glass-input w-full">${(existing?.features || []).join('\n')}</textarea>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" name="isActive" ${existing?.isActive !== false ? 'checked' : ''}>
      Active (visible to subscribers)
    </label>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${existing ? 'Save Changes' : 'Create Plan'}</button>
  `;

    const close = showModal({ title: existing ? 'Edit Plan' : 'New Plan', content: form, footer, size: 'lg' });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const features = (formData.get('features') as string).split('\n').map(f => f.trim()).filter(Boolean);
        const payload = {
            name: formData.get('name') as string,
            description: (formData.get('description') as string) || null,
            priceInr: parseFloat(formData.get('priceInr') as string),
            billingInterval: formData.get('billingInterval') as BillingInterval,
            features,
            isActive: formData.get('isActive') === 'on',
            sortOrder: existing?.sortOrder ?? 99,
            tier: formData.get('tier') as PlanTier,
        };
        try {
            if (existing) await updatePlan(existing.id, payload);
            else await createPlan(payload);
            showToast(existing ? 'Plan updated' : 'Plan created', { type: 'success' });
            close();
            renderAdminPlans();
        } catch (error) {
            console.error(error);
            showToast('Failed to save plan', { type: 'error' });
        }
    });
}
