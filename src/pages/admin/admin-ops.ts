/**
 * Admin: Ops — feature flags (including maintenance mode), account deletion
 * requests, and feedback, grouped together since each is a small, low-traffic
 * admin surface rather than deserving its own top-level tab.
 */
import { withAdminGuard, adminTabs } from './admin-guard';
import {
    adminListFeatureFlags, adminSetFeatureFlag,
    adminListDeletionRequests, adminMarkDeletionProcessed,
    adminListFeedback,
} from '../../cloud/growth';
import { formatDate, getIcon, escapeHtml } from '../../utils';
import { showToast } from '../../components/toast';
import { showConfirm } from '../../components/modal';
import type { FeatureFlag, DeletionRequest, FeedbackEntry } from '../../cloud/growth';

export async function renderAdminOps(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="admin-root" class="max-w-5xl mx-auto pb-20"></div>`;
    const root = document.getElementById('admin-root')!;

    await withAdminGuard(root, async () => {
        try {
            const [flags, deletionRequests, feedback] = await Promise.all([
                adminListFeatureFlags(),
                adminListDeletionRequests(),
                adminListFeedback(),
            ]);
            render(root, flags, deletionRequests, feedback);
        } catch (error) {
            console.error('[Admin Ops] Error:', error);
            root.innerHTML = `<div class="glass-card p-6 text-red-400">Failed to load.</div>`;
        }
    });
}

function render(root: HTMLElement, flags: FeatureFlag[], deletionRequests: DeletionRequest[], feedback: FeedbackEntry[]): void {
    const pendingDeletions = deletionRequests.filter(d => d.status === 'pending');

    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('shield', 26)} Admin Portal</h1>
      <p class="text-sm text-slate-400 mt-1">MoneyFlow subscription &amp; user management.</p>
    </div>
    ${adminTabs('ops')}

    <div class="glass-card p-5 mb-6">
      <h3 class="font-semibold mb-3">Feature Flags</h3>
      <div class="space-y-2">
        ${flags.map(f => `
          <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div>
              <p class="font-medium font-mono text-sm">${escapeHtml(f.key)}</p>
              ${f.description ? `<p class="text-xs text-slate-500">${escapeHtml(f.description)}</p>` : ''}
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="flag-toggle sr-only peer" data-key="${f.key}" ${f.enabled ? 'checked' : ''}>
              <div class="w-11 h-6 bg-white/10 peer-checked:bg-primary-500 rounded-full transition-colors"></div>
              <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="glass-card p-5 mb-6">
      <h3 class="font-semibold mb-3">Account Deletion Requests ${pendingDeletions.length > 0 ? `<span class="text-yellow-400">(${pendingDeletions.length} pending)</span>` : ''}</h3>
      ${deletionRequests.length === 0 ? `<p class="text-sm text-slate-400">No requests.</p>` : `
        <div class="space-y-2">
          ${deletionRequests.map(d => `
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
              <div>
                <p class="font-mono text-xs text-slate-500">${d.userId}</p>
                ${d.reason ? `<p>${escapeHtml(d.reason)}</p>` : ''}
                <p class="text-xs text-slate-500">${formatDate(d.createdAt)}</p>
              </div>
              ${d.status === 'pending'
            ? `<button class="process-deletion-btn glass-button-secondary text-xs" data-id="${d.id}">Mark Processed</button>`
            : `<span class="px-2 py-0.5 rounded-full text-xs bg-white/10 text-slate-300">${d.status}</span>`}
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <div class="glass-card p-5">
      <h3 class="font-semibold mb-3">Feedback</h3>
      ${feedback.length === 0 ? `<p class="text-sm text-slate-400">No feedback yet.</p>` : `
        <div class="space-y-2">
          ${feedback.slice(0, 20).map(f => `
            <div class="py-2 border-b border-white/5 last:border-0 text-sm">
              <p>${escapeHtml(f.message)}</p>
              <p class="text-xs text-slate-500">${escapeHtml(f.email) || 'anonymous'} &middot; ${formatDate(f.createdAt)}</p>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    root.querySelectorAll<HTMLInputElement>('.flag-toggle').forEach(toggle => {
        toggle.addEventListener('change', async () => {
            try {
                await adminSetFeatureFlag(toggle.dataset.key!, toggle.checked);
                showToast('Updated', { type: 'success' });
            } catch (error) {
                console.error(error);
                showToast('Failed to update flag', { type: 'error' });
                toggle.checked = !toggle.checked;
            }
        });
    });

    root.querySelectorAll<HTMLButtonElement>('.process-deletion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showConfirm('Mark Processed', 'Confirm you have manually deleted this user\'s account and data?', async () => {
                await adminMarkDeletionProcessed(btn.dataset.id!);
                showToast('Marked processed', { type: 'success' });
                renderAdminOps();
            });
        });
    });
}
