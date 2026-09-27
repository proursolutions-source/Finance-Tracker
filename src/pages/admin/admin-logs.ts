/**
 * Admin: Logs — login/security events and client-side errors captured by
 * app-log.ts, giving the admin real in-app visibility instead of only
 * Supabase's own infrastructure logs (which aren't reachable from here).
 */
import { withAdminGuard, adminTabs } from './admin-guard';
import { adminListAppEvents } from '../../cloud/app-log';
import { formatDate, getIcon, escapeHtml } from '../../utils';
import type { AppEvent, AppEventType } from '../../cloud/types';

export async function renderAdminLogs(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="admin-root" class="max-w-6xl mx-auto pb-20"></div>`;
    const root = document.getElementById('admin-root')!;

    await withAdminGuard(root, async () => {
        try {
            const events = await adminListAppEvents(200);
            renderList(root, events);
        } catch (error) {
            console.error('[Admin Logs] Error:', error);
            root.innerHTML = `<div class="glass-card p-6 text-red-400">Failed to load logs.</div>`;
        }
    });
}

const TYPE_STYLES: Record<AppEventType, string> = {
    login_success: 'bg-green-500/20 text-green-400',
    login_failed: 'bg-yellow-500/20 text-yellow-400',
    signup: 'bg-primary-500/20 text-primary-400',
    logout: 'bg-white/10 text-slate-300',
    client_error: 'bg-red-500/20 text-red-400',
};

const TYPE_LABELS: Record<AppEventType, string> = {
    login_success: 'Login',
    login_failed: 'Failed login',
    signup: 'Sign up',
    logout: 'Logout',
    client_error: 'Client error',
};

function renderList(root: HTMLElement, events: AppEvent[]): void {
    const failedLogins = events.filter(e => e.eventType === 'login_failed').length;
    const errors = events.filter(e => e.eventType === 'client_error').length;

    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('shield', 26)} Admin Portal</h1>
      <p class="text-sm text-slate-400 mt-1">MoneyFlow subscription &amp; user management.</p>
    </div>
    ${adminTabs('logs')}

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="glass-card p-5">
        <p class="text-xs uppercase text-slate-400 mb-1">Events (last 200)</p>
        <p class="text-2xl font-bold">${events.length}</p>
      </div>
      <div class="glass-card p-5">
        <p class="text-xs uppercase text-slate-400 mb-1">Failed logins</p>
        <p class="text-2xl font-bold text-yellow-400">${failedLogins}</p>
      </div>
      <div class="glass-card p-5">
        <p class="text-xs uppercase text-slate-400 mb-1">Client errors</p>
        <p class="text-2xl font-bold text-red-400">${errors}</p>
      </div>
    </div>

    <div class="glass-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-slate-400 border-b border-white/10">
          <tr>
            <th class="p-4">Type</th>
            <th class="p-4">Message</th>
            <th class="p-4">When</th>
          </tr>
        </thead>
        <tbody>
          ${events.length === 0 ? `
            <tr><td colspan="3" class="p-8 text-center text-slate-400">No events logged yet.</td></tr>
          ` : events.map(e => `
            <tr class="border-b border-white/5 last:border-0">
              <td class="p-4"><span class="px-2 py-0.5 rounded-full text-xs ${TYPE_STYLES[e.eventType]}">${TYPE_LABELS[e.eventType]}</span></td>
              <td class="p-4">${escapeHtml(e.message)}</td>
              <td class="p-4 text-slate-400 whitespace-nowrap">${formatDate(e.createdAt, 'dd/MM/yyyy HH:mm')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-slate-500 mt-3">Events older than 90 days are eligible for pruning (public.prune_old_app_events()) but no scheduled job runs it automatically on this plan.</p>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();
}
