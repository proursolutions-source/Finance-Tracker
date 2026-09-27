/**
 * Admin: Users — user directory, suspend/activate accounts, and manually
 * activate/change/cancel a user's subscription (until a live payment gateway
 * makes that automatic).
 */
import { withAdminGuard, adminTabs } from './admin-guard';
import {
    adminListUsers,
    adminListSubscriptions,
    adminSetUserStatus,
    adminSetSubscriptionStatus,
    adminChangeUserPlan,
    listPlans,
    getPaymentScreenshotUrl,
} from '../../cloud/cloud-db';
import { formatDate, getIcon, escapeHtml } from '../../utils';
import { showToast } from '../../components/toast';
import { showModal } from '../../components/modal';
import type { CloudProfile, CloudSubscription, SubscriptionPlan } from '../../cloud/types';

export async function renderAdminUsers(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="admin-root" class="max-w-6xl mx-auto pb-20"></div>`;
    const root = document.getElementById('admin-root')!;

    await withAdminGuard(root, async () => {
        try {
            const [users, subs, plans] = await Promise.all([adminListUsers(), adminListSubscriptions(), listPlans(true)]);
            renderList(root, users, subs, plans);
        } catch (error) {
            console.error('[Admin Users] Error:', error);
            root.innerHTML = `<div class="glass-card p-6 text-red-400">Failed to load users.</div>`;
        }
    });
}

function renderList(root: HTMLElement, users: CloudProfile[], subs: CloudSubscription[], plans: SubscriptionPlan[]): void {
    const subByUser = new Map(subs.map(s => [s.userId, s]));

    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('shield', 26)} Admin Portal</h1>
      <p class="text-sm text-slate-400 mt-1">MoneyFlow subscription &amp; user management.</p>
    </div>
    ${adminTabs('users')}
    <div class="glass-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-slate-400 border-b border-white/10">
          <tr>
            <th class="p-4">User</th>
            <th class="p-4">Role</th>
            <th class="p-4">Status</th>
            <th class="p-4">Plan</th>
            <th class="p-4">Subscription</th>
            <th class="p-4">Joined</th>
            <th class="p-4"></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
        const sub = subByUser.get(u.id);
        return `
              <tr class="border-b border-white/5 last:border-0">
                <td class="p-4">
                  <p class="font-medium">${escapeHtml(u.fullName) || '—'}</p>
                  <p class="text-slate-400 text-xs">${escapeHtml(u.email)}</p>
                </td>
                <td class="p-4"><span class="px-2 py-0.5 rounded-full text-xs ${u.role === 'admin' ? 'bg-primary-500/20 text-primary-400' : 'bg-white/10 text-slate-300'}">${u.role}</span></td>
                <td class="p-4"><span class="px-2 py-0.5 rounded-full text-xs ${u.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${u.status}</span></td>
                <td class="p-4">${sub?.plan?.name || 'None'}</td>
                <td class="p-4">${sub ? subStatusBadge(sub.status) : '—'}</td>
                <td class="p-4 text-slate-400">${formatDate(u.createdAt)}</td>
                <td class="p-4">
                  <button class="manage-user-btn text-primary-400 hover:underline text-xs" data-user-id="${u.id}">Manage</button>
                </td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    root.querySelectorAll<HTMLButtonElement>('.manage-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const user = users.find(u => u.id === btn.dataset.userId)!;
            const sub = subByUser.get(user.id);
            openManageUserModal(user, sub, plans);
        });
    });
}

function subStatusBadge(status: string): string {
    const colors: Record<string, string> = {
        active: 'bg-green-500/20 text-green-400',
        pending_payment: 'bg-yellow-500/20 text-yellow-400',
        canceled: 'bg-white/10 text-slate-300',
        expired: 'bg-white/10 text-slate-300',
        past_due: 'bg-red-500/20 text-red-400',
    };
    return `<span class="px-2 py-0.5 rounded-full text-xs ${colors[status] || 'bg-white/10 text-slate-300'}">${status.replace('_', ' ')}</span>`;
}

function openManageUserModal(user: CloudProfile, sub: CloudSubscription | undefined, plans: SubscriptionPlan[]): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <p class="font-medium">${escapeHtml(user.fullName || user.email)}</p>
      <p class="text-sm text-slate-400">${escapeHtml(user.email)}</p>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Account status</label>
      <select name="userStatus" class="glass-input w-full">
        <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspended</option>
      </select>
    </div>
    ${sub ? `
      <div>
        <label class="block text-sm font-medium mb-1">Plan</label>
        <select name="planId" class="glass-input w-full">
          ${plans.map(p => `<option value="${p.id}" ${p.id === sub.planId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Subscription status</label>
        <select name="subStatus" class="glass-input w-full">
          ${['pending_payment', 'active', 'past_due', 'canceled', 'expired'].map(s => `<option value="${s}" ${s === sub.status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
        </select>
        <p class="text-xs text-slate-500 mt-1">Set to "active" to manually activate — e.g. for a bank transfer, comped access, or a beta user, since no live payment gateway is connected yet.</p>
      </div>
      ${sub.paymentReference ? `
        <div>
          <label class="block text-sm font-medium mb-1">Payment reference / UTR submitted</label>
          <p class="glass-input w-full font-mono text-sm">${escapeHtml(sub.paymentReference)}</p>
          <p class="text-xs text-slate-500 mt-1">Check this against your UPI app before activating.</p>
        </div>
      ` : ''}
      ${sub.paymentScreenshotPath ? `
        <div>
          <label class="block text-sm font-medium mb-1">Payment screenshot</label>
          <button type="button" id="view-screenshot-btn" class="glass-button-secondary w-full flex items-center justify-center gap-2">
            ${getIcon('image', 16)} View Screenshot
          </button>
        </div>
      ` : ''}
      <div>
        <label class="block text-sm font-medium mb-1">Admin notes</label>
        <textarea name="notes" rows="2" class="glass-input w-full">${sub.notes || ''}</textarea>
      </div>
    ` : `<p class="text-sm text-slate-400">This user has no subscription record yet.</p>`}
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Close</button>
    <button type="submit" class="glass-button">Save Changes</button>
  `;

    const close = showModal({ title: 'Manage User', content: form, footer, size: 'lg' });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.querySelector('#view-screenshot-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.disabled = true;
        try {
            const url = await getPaymentScreenshotUrl(sub!.paymentScreenshotPath!);
            window.open(url, '_blank');
        } catch (error) {
            console.error(error);
            showToast('Failed to load screenshot', { type: 'error' });
        } finally {
            btn.disabled = false;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        try {
            const newUserStatus = formData.get('userStatus') as 'active' | 'suspended';
            if (newUserStatus !== user.status) {
                await adminSetUserStatus(user.id, newUserStatus);
            }
            if (sub) {
                const newPlanId = formData.get('planId') as string;
                const newSubStatus = formData.get('subStatus') as CloudSubscription['status'];
                const notes = formData.get('notes') as string;
                if (newPlanId !== sub.planId) await adminChangeUserPlan(sub.id, newPlanId);
                if (newSubStatus !== sub.status || notes !== (sub.notes || '')) {
                    await adminSetSubscriptionStatus(sub.id, newSubStatus, notes);
                }
            }
            showToast('User updated — takes effect next time they open the app', { type: 'success' });
            close();
            renderAdminUsers();
        } catch (error) {
            console.error(error);
            showToast('Failed to update user', { type: 'error' });
        }
    });
}
