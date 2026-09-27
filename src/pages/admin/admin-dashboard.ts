/**
 * Admin Dashboard — top-line subscription metrics.
 */
import { withAdminGuard, adminTabs } from './admin-guard';
import { adminListUsers, adminListSubscriptions, getPaymentSettings, updatePaymentSettings } from '../../cloud/cloud-db';
import { formatCurrency, getIcon, escapeHtml } from '../../utils';
import { showToast } from '../../components/toast';

export async function renderAdminDashboard(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="admin-root" class="max-w-6xl mx-auto pb-20"></div>`;
    const root = document.getElementById('admin-root')!;

    await withAdminGuard(root, async () => {
        try {
            const [users, subs, paymentSettings] = await Promise.all([adminListUsers(), adminListSubscriptions(), getPaymentSettings()]);
            const activeSubs = subs.filter(s => s.status === 'active');
            const pendingSubs = subs.filter(s => s.status === 'pending_payment');
            const mrr = activeSubs.reduce((sum, s) => {
                if (!s.plan) return sum;
                const monthly = s.plan.billingInterval === 'yearly' ? s.plan.priceInr / 12 : s.plan.priceInr;
                return sum + monthly;
            }, 0);

            root.innerHTML = `
        <div class="mb-6">
          <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('shield', 26)} Admin Portal</h1>
          <p class="text-sm text-slate-400 mt-1">MoneyFlow subscription &amp; user management.</p>
        </div>
        ${adminTabs('dashboard')}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="glass-card p-5">
            <p class="text-xs uppercase text-slate-400 mb-1">Total Users</p>
            <p class="text-2xl font-bold">${users.length}</p>
          </div>
          <div class="glass-card p-5">
            <p class="text-xs uppercase text-slate-400 mb-1">Active Subscriptions</p>
            <p class="text-2xl font-bold text-green-400">${activeSubs.length}</p>
          </div>
          <div class="glass-card p-5">
            <p class="text-xs uppercase text-slate-400 mb-1">Pending Activation</p>
            <p class="text-2xl font-bold text-yellow-400">${pendingSubs.length}</p>
          </div>
          <div class="glass-card p-5">
            <p class="text-xs uppercase text-slate-400 mb-1">Est. MRR</p>
            <p class="text-2xl font-bold">${formatCurrency(mrr)}</p>
          </div>
        </div>
        ${pendingSubs.length > 0 ? `
          <div class="glass-card p-5 border border-yellow-500/30">
            <h3 class="font-semibold mb-3 flex items-center gap-2">${getIcon('clock', 16, 'text-yellow-400')} Awaiting activation</h3>
            <p class="text-sm text-slate-400 mb-3">No payment gateway is connected yet — these subscriptions need a manual activation from the Users tab.</p>
            <div class="space-y-2">
              ${pendingSubs.slice(0, 5).map(s => `
                <div class="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                  <span>${escapeHtml(s.profile?.email) || s.userId}</span>
                  <span class="text-slate-400">${escapeHtml(s.plan?.name)}${s.paymentReference ? ` &middot; ref: <span class="font-mono">${escapeHtml(s.paymentReference)}</span>` : ''}</span>
                </div>
              `).join('')}
            </div>
            <a href="#/admin/users" class="text-primary-400 text-sm hover:underline mt-3 inline-block">Go to Users &rarr;</a>
          </div>
        ` : ''}

        <div class="glass-card p-5 mt-6" id="payment-settings-card">
          <h3 class="font-semibold mb-1 flex items-center gap-2">${getIcon('qr-code', 16, 'text-primary-400')} UPI Payment Settings</h3>
          <p class="text-sm text-slate-400 mb-4">Shown to customers as a QR code at checkout — they pay you directly, peer-to-peer, with zero gateway fees. Submit the reference number they give you against theirs in your UPI app, then activate manually from the Users tab.</p>
          <form id="payment-settings-form" class="grid gap-4 sm:grid-cols-2 items-end">
            <div>
              <label class="block text-sm font-medium mb-1">Your UPI ID</label>
              <input type="text" name="upiId" class="glass-input w-full" placeholder="yourname@upi" value="${escapeHtml(paymentSettings?.upiId)}">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Payee name</label>
              <input type="text" name="payeeName" class="glass-input w-full" placeholder="Your name or business" value="${escapeHtml(paymentSettings?.payeeName)}">
            </div>
            <div class="sm:col-span-2">
              <button type="submit" class="glass-button">Save Payment Settings</button>
            </div>
          </form>
        </div>
      `;

            root.querySelector('#payment-settings-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const upiId = (formData.get('upiId') as string).trim();
                const payeeName = (formData.get('payeeName') as string).trim();
                try {
                    await updatePaymentSettings(upiId, payeeName);
                    showToast('Payment settings saved', { type: 'success' });
                } catch (error) {
                    console.error(error);
                    showToast('Failed to save payment settings', { type: 'error' });
                }
            });
        } catch (error) {
            console.error('[Admin Dashboard] Error:', error);
            root.innerHTML += `<div class="glass-card p-6 text-red-400">Failed to load admin data.</div>`;
        }
    });

    if ((window as any).lucide) (window as any).lucide.createIcons();
}
