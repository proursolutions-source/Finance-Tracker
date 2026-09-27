/**
 * Admin Portal access guard. Real security, not cosmetic: every query the
 * admin pages make is also re-checked server-side by Postgres RLS
 * (public.is_admin()), so even a tampered client can't read/write admin data.
 * This client-side check only decides what to render.
 */
import { isCloudConfigured, getCloudUser, isCurrentUserAdmin } from '../../cloud/cloud-auth';
import { renderCloudAuthGate } from '../../components/cloud-auth-gate';
import { getIcon } from '../../utils';

export async function withAdminGuard(root: HTMLElement, render: () => Promise<void>): Promise<void> {
    if (!isCloudConfigured()) {
        renderCloudAuthGate(root, { title: 'Admin Portal', onSuccess: render });
        return;
    }

    const user = await getCloudUser();
    if (!user) {
        renderCloudAuthGate(root, { title: 'Admin Portal', onSuccess: render });
        return;
    }

    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
        root.innerHTML = `
      <div class="glass-card p-8 text-center max-w-lg mx-auto">
        ${getIcon('shield-alert', 40, 'text-red-400 mx-auto')}
        <h2 class="text-xl font-bold mt-4 mb-2">Not authorized</h2>
        <p class="text-slate-400 text-sm">Signed in as <strong>${user.email}</strong>, which isn't the admin account for this MoneyFlow instance.</p>
      </div>
    `;
        if ((window as any).lucide) (window as any).lucide.createIcons();
        return;
    }

    await render();
}

export function adminTabs(active: string): string {
    const tabs = [
        { key: 'dashboard', label: 'Dashboard', href: '#/admin', icon: 'layout-dashboard' },
        { key: 'users', label: 'Users', href: '#/admin/users', icon: 'users' },
        { key: 'plans', label: 'Plans', href: '#/admin/plans', icon: 'package' },
        { key: 'discounts', label: 'Discounts', href: '#/admin/discounts', icon: 'percent' },
    ];
    return `
    <div class="flex gap-2 mb-6 flex-wrap">
      ${tabs.map(t => `
        <a href="${t.href}" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${t.key === active ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">
          ${getIcon(t.icon, 14)} ${t.label}
        </a>
      `).join('')}
    </div>
  `;
}
