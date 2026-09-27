/**
 * Notification Center — a persistent, browsable list of everything that
 * would otherwise only ever surface as a transient OS notification (see
 * notifications.ts) or not surface at all. Computed live each time the page
 * is opened rather than stored, since all of the underlying facts (reminders,
 * budgets, goals, documents) already exist and change independently.
 */
import { db } from '../db';
import { getBudgetPercentage, formatDate, formatCurrency, getIcon, escapeHtml } from '../utils';

interface NotificationItem {
    icon: string;
    color: string;
    title: string;
    detail: string;
    date?: string;
}

export async function renderNotificationCenter(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const items: NotificationItem[] = [];
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
        const reminders = await db.getReminders(false);
        for (const r of reminders) {
            const due = new Date(r.dueDate);
            if (due <= now) {
                items.push({ icon: 'bell-ring', color: 'text-red-400', title: `${r.name} is overdue`, detail: formatCurrency(r.amount), date: r.dueDate });
            } else if (due <= in7days) {
                items.push({ icon: 'bell', color: 'text-yellow-400', title: `${r.name} due soon`, detail: formatCurrency(r.amount), date: r.dueDate });
            }
        }
    } catch { /* non-fatal */ }

    try {
        const budgets = await db.getBudgetAnalytics();
        for (const b of budgets) {
            const pct = getBudgetPercentage(b.actualSpent, b.budgeted);
            if (pct >= 100) items.push({ icon: 'alert-triangle', color: 'text-red-400', title: `${b.categoryName} budget exceeded`, detail: `${pct}% used` });
            else if (pct >= 90) items.push({ icon: 'alert-circle', color: 'text-yellow-400', title: `${b.categoryName} budget almost used up`, detail: `${pct}% used` });
        }
    } catch { /* non-fatal */ }

    try {
        const goals = await db.getGoals();
        for (const g of goals) {
            if (g.completed) continue;
            const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
            if (pct >= 90) items.push({ icon: 'award', color: 'text-green-400', title: `${g.name} is almost complete`, detail: `${pct}% funded` });
        }
    } catch { /* non-fatal */ }

    try {
        const documents = await db.getDocuments();
        for (const d of documents) {
            if (!d.expiryDate) continue;
            const expiry = new Date(d.expiryDate);
            if (expiry <= in7days && expiry >= now) {
                items.push({ icon: 'file-clock', color: 'text-yellow-400', title: `${d.name} expires soon`, detail: formatDate(d.expiryDate), date: d.expiryDate });
            } else if (expiry < now) {
                items.push({ icon: 'file-x', color: 'text-red-400', title: `${d.name} has expired`, detail: formatDate(d.expiryDate), date: d.expiryDate });
            }
        }
    } catch { /* non-fatal */ }

    mainContent.innerHTML = `
    <div class="max-w-2xl mx-auto pb-20">
      <div class="mb-6">
        <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('bell', 26)} Notification Center</h1>
        <p class="text-sm text-slate-400 mt-1">Everything that needs your attention, in one place.</p>
      </div>
      ${items.length === 0 ? `
        <div class="glass-card p-8 text-center text-slate-400">
          ${getIcon('check-circle', 40, 'mx-auto mb-4 opacity-50 text-green-400')}
          <p>You're all caught up.</p>
        </div>
      ` : `
        <div class="space-y-2">
          ${items.map(item => `
            <div class="glass-card p-4 flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 ${item.color}">
                ${getIcon(item.icon, 18)}
              </div>
              <div class="min-w-0">
                <p class="font-medium truncate">${escapeHtml(item.title)}</p>
                <p class="text-xs text-slate-500">${escapeHtml(item.detail)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();
}
