/**
 * Memory Dashboard - MoneyFlow Memory, Phase 1
 * "On This Day", recent memories, and milestones.
 */

import { db } from '../db';
import { formatCurrency, formatDate, getIcon, escapeHtml } from '../utils';
import { showToast } from '../components/toast';
import { withTierGate } from '../components/upgrade-gate';

const MILESTONE_ICONS: Record<string, string> = {
    'first-savings-1k': 'piggy-bank',
    'first-savings-10k': 'piggy-bank',
    'first-savings-50k': 'piggy-bank',
    'first-savings-1l': 'trophy',
    'first-salary': 'briefcase',
    'first-investment': 'trending-up',
    'first-debt-cleared': 'check-circle',
    'custom': 'star',
};

export async function renderMemory(): Promise<void> {
    return withTierGate('premium', 'MoneyFlow Memory', renderMemoryImpl);
}

async function renderMemoryImpl(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        // Detect any new milestones lazily (safe to call repeatedly)
        await db.detectMilestones().catch(() => { });

        const now = new Date();
        const [onThisDay, recentMemories, milestones] = await Promise.all([
            db.getOnThisDayMemories(now.getMonth() + 1, now.getDate()),
            db.getMemories({ excludeArchived: true, limit: 6 }),
            db.getMilestones(),
        ]);

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto pb-20">
        <div class="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('sparkles', 26)} Memory</h1>
            <p class="text-sm text-slate-400 mt-1">The story behind your money.</p>
          </div>
          <a href="#/memory/timeline" class="glass-button-secondary flex items-center gap-2 whitespace-nowrap">
            ${getIcon('history', 16)} Timeline
          </a>
        </div>

        ${onThisDay.length > 0 ? `
          <div class="glass-card p-5 mb-6 border border-primary-500/30">
            <h2 class="text-sm font-semibold text-primary-400 flex items-center gap-2 mb-3">${getIcon('clock', 16)} On This Day</h2>
            <div class="space-y-3">
              ${onThisDay.map(m => {
            const years = now.getFullYear() - new Date(m.occurredAt).getFullYear();
            return `
                  <div>
                    <p class="text-sm text-slate-300">${years} year${years !== 1 ? 's' : ''} ago</p>
                    <p class="font-medium">"${escapeHtml(m.title)}"</p>
                    ${m.body ? `<p class="text-sm text-slate-400 mt-1">${escapeHtml(m.body)}</p>` : ''}
                  </div>
                `;
        }).join('<div class="border-t border-white/5"></div>')}
            </div>
          </div>
        ` : ''}

        <div class="glass-card p-5 mb-6">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-slate-300 flex items-center gap-2">${getIcon('camera', 16)} Recent Memories</h2>
          </div>
          ${recentMemories.length === 0 ? `
            <div class="text-center py-8 text-slate-400">
              <p>No memories yet.</p>
              <p class="text-sm mt-1">Add one from any transaction &mdash; look for "Add a memory" in the Add Transaction form.</p>
            </div>
          ` : `
            <div class="space-y-3">
              ${recentMemories.map(m => `
                <div class="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p class="font-medium">${escapeHtml(m.title)}</p>
                    ${m.body ? `<p class="text-sm text-slate-400">${escapeHtml(m.body)}</p>` : ''}
                    <p class="text-xs text-slate-500 mt-1">${formatDate(m.occurredAt)}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="glass-card p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-slate-300 flex items-center gap-2">${getIcon('trophy', 16)} Financial Milestones</h2>
            <button id="add-milestone-btn" class="text-primary-400 text-sm hover:underline">+ Add</button>
          </div>
          ${milestones.length === 0 ? `
            <div class="text-center py-8 text-slate-400">
              <p>No milestones yet &mdash; they'll appear automatically as you save, or add one yourself.</p>
            </div>
          ` : `
            <div class="space-y-3">
              ${milestones.slice(0, 8).map(m => `
                <div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div class="w-9 h-9 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center flex-shrink-0">
                    ${getIcon(MILESTONE_ICONS[m.type] || 'star', 16)}
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-sm">${escapeHtml(m.title)}</p>
                    <p class="text-xs text-slate-500">${formatDate(m.occurredAt)}${m.amount ? ` &middot; ${formatCurrency(m.amount)}` : ''}</p>
                  </div>
                  ${!m.autoDetected ? `<button class="delete-milestone p-1.5 text-slate-500 hover:text-red-400" data-id="${m.id}" aria-label="Delete milestone">${getIcon('trash-2', 14)}</button>` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

        if ((window as any).lucide) (window as any).lucide.createIcons();

        document.getElementById('add-milestone-btn')?.addEventListener('click', () => openMilestoneModal());
        mainContent.querySelectorAll('.delete-milestone').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this milestone?')) {
                    await db.deleteMilestone((btn as HTMLElement).dataset.id!);
                    renderMemory();
                }
            });
        });

    } catch (error) {
        console.error('[Memory] Error rendering:', error);
        showToast('Failed to load memories', { type: 'error' });
    }
}

async function openMilestoneModal(): Promise<void> {
    const { showModal } = await import('../components/modal');
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Title</label>
      <input type="text" name="title" required class="glass-input w-full" placeholder="e.g., Paid off my education loan">
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Date</label>
        <input type="date" name="occurredAt" required value="${new Date().toISOString().split('T')[0]}" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Amount (optional)</label>
        <input type="number" name="amount" min="0" step="0.01" class="glass-input w-full" placeholder="0.00">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full" placeholder="What made this a milestone?"></textarea>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Add Milestone</button>
  `;

    const close = showModal({ title: 'New Milestone', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        try {
            await db.createMilestone({
                type: 'custom',
                title: formData.get('title') as string,
                occurredAt: new Date(formData.get('occurredAt') as string).toISOString(),
                amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
                notes: (formData.get('notes') as string) || undefined,
                autoDetected: false,
            });
            showToast('Milestone added', { type: 'success' });
            close();
            renderMemory();
        } catch (error) {
            console.error(error);
            showToast('Failed to add milestone', { type: 'error' });
        }
    });
}
