/**
 * Memory Timeline - chronological view combining memories, milestones,
 * and manually-entered life events (pre-MoneyFlow history).
 */

import { db } from '../db';
import { formatCurrency, formatDate, getIcon, escapeHtml } from '../utils';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { withTierGate } from '../components/upgrade-gate';

type TimelineKind = 'memory' | 'milestone' | 'life-event';
type FilterKind = 'all' | TimelineKind;

interface TimelineEntry {
    kind: TimelineKind;
    id: string;
    date: string;
    title: string;
    subtitle?: string;
    icon: string;
}

let currentFilter: FilterKind = 'all';

export async function renderMemoryTimeline(): Promise<void> {
    return withTierGate('premium', 'MoneyFlow Memory', renderMemoryTimelineImpl);
}

async function renderMemoryTimelineImpl(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const [memories, milestones, lifeEvents] = await Promise.all([
            db.getMemories({ excludeArchived: true }),
            db.getMilestones(),
            db.getLifeEvents(),
        ]);

        const entries: TimelineEntry[] = [
            ...memories.map(m => ({ kind: 'memory' as const, id: m.id, date: m.occurredAt, title: m.title, subtitle: m.body, icon: 'sparkles' })),
            ...milestones.map(m => ({ kind: 'milestone' as const, id: m.id, date: m.occurredAt, title: m.title, subtitle: m.amount ? formatCurrency(m.amount) : undefined, icon: 'trophy' })),
            ...lifeEvents.map(e => ({ kind: 'life-event' as const, id: e.id, date: e.occurredAt, title: e.title, subtitle: e.amount ? formatCurrency(e.amount) : e.notes, icon: 'map-pin' })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const filtered = currentFilter === 'all' ? entries : entries.filter(e => e.kind === currentFilter);

        // Group by year for the "2026 / 2025 / ..." style timeline
        const byYear = new Map<string, TimelineEntry[]>();
        for (const entry of filtered) {
            const year = new Date(entry.date).getFullYear().toString();
            if (!byYear.has(year)) byYear.set(year, []);
            byYear.get(year)!.push(entry);
        }

        const filterTabs: { key: FilterKind; label: string }[] = [
            { key: 'all', label: 'All' },
            { key: 'memory', label: 'Memories' },
            { key: 'milestone', label: 'Milestones' },
            { key: 'life-event', label: 'Life Events' },
        ];

        mainContent.innerHTML = `
      <div class="max-w-3xl mx-auto pb-20">
        <div class="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('history', 26)} Memory Timeline</h1>
            <p class="text-sm text-slate-400 mt-1">Your financial life, in order.</p>
          </div>
          <button id="add-life-event-btn" class="glass-button-secondary flex items-center gap-2 whitespace-nowrap">
            ${getIcon('plus', 16)} Life Event
          </button>
        </div>

        <div class="flex gap-2 mb-6 flex-wrap">
          ${filterTabs.map(t => `
            <button class="filter-tab px-4 py-1.5 rounded-full text-sm ${currentFilter === t.key ? 'bg-primary-500 text-white' : 'glass-button-secondary'}" data-filter="${t.key}">
              ${t.label}
            </button>
          `).join('')}
        </div>

        ${byYear.size === 0 ? `
          <div class="glass-card p-12 text-center text-slate-400">
            <p>Nothing here yet.</p>
            <p class="text-sm mt-1">Add a memory from a transaction, or record a life event from before you started using MoneyFlow.</p>
          </div>
        ` : Array.from(byYear.entries()).map(([year, yearEntries]) => `
          <div class="mb-8">
            <h2 class="text-xl font-bold text-slate-300 mb-3">${year}</h2>
            <div class="space-y-3 border-l-2 border-white/10 pl-4">
              ${yearEntries.map(entry => `
                <div class="relative glass-card p-4">
                  <div class="absolute -left-[26px] top-4 w-3 h-3 rounded-full bg-primary-500"></div>
                  <div class="flex items-start gap-3">
                    <div class="w-9 h-9 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center flex-shrink-0">
                      ${getIcon(entry.icon, 16)}
                    </div>
                    <div class="flex-1">
                      <p class="font-medium">${escapeHtml(entry.title)}</p>
                      ${entry.subtitle ? `<p class="text-sm text-slate-400 mt-0.5">${escapeHtml(entry.subtitle)}</p>` : ''}
                      <p class="text-xs text-slate-500 mt-1">${formatDate(entry.date)}</p>
                    </div>
                    ${entry.kind === 'life-event' ? `<button class="delete-life-event p-1.5 text-slate-500 hover:text-red-400" data-id="${entry.id}" aria-label="Delete">${getIcon('trash-2', 14)}</button>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

        if ((window as any).lucide) (window as any).lucide.createIcons();

        mainContent.querySelectorAll('.filter-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                currentFilter = (btn as HTMLElement).dataset.filter as FilterKind;
                renderMemoryTimeline();
            });
        });

        document.getElementById('add-life-event-btn')?.addEventListener('click', () => openLifeEventModal());

        mainContent.querySelectorAll('.delete-life-event').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this life event?')) {
                    await db.deleteLifeEvent((btn as HTMLElement).dataset.id!);
                    renderMemoryTimeline();
                }
            });
        });

    } catch (error) {
        console.error('[Memory Timeline] Error rendering:', error);
        showToast('Failed to load timeline', { type: 'error' });
    }
}

function openLifeEventModal(): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <p class="text-sm text-slate-400">Record something from before you started using MoneyFlow &mdash; your first pocket money, first bicycle, first salary.</p>
    <div>
      <label class="block text-sm font-medium mb-1">Title</label>
      <input type="text" name="title" required class="glass-input w-full" placeholder="e.g., First smartphone">
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Date (or year)</label>
        <input type="date" name="occurredAt" required class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Amount (optional)</label>
        <input type="number" name="amount" min="0" step="0.01" class="glass-input w-full" placeholder="0.00">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full"></textarea>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Add Life Event</button>
  `;

    const close = showModal({ title: 'New Life Event', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        try {
            await db.createLifeEvent({
                title: formData.get('title') as string,
                occurredAt: new Date(formData.get('occurredAt') as string).toISOString(),
                amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : undefined,
                notes: (formData.get('notes') as string) || undefined,
            });
            showToast('Life event added', { type: 'success' });
            close();
            renderMemoryTimeline();
        } catch (error) {
            console.error(error);
            showToast('Failed to add life event', { type: 'error' });
        }
    });
}
