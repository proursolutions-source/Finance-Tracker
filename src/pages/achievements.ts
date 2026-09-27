/**
 * Achievements — gamification layer over the same underlying data as the
 * rest of the app: savings streaks, no-spend day tracking, opt-in
 * challenges (no-spend / savings target / budget adherence), goal
 * milestones, a small fixed badge catalog, a monthly scorecard, and an
 * auto-generated recap of last month. Nothing here is faked — every
 * number is derived from real transactions/budgets/goals, or from the
 * `challenges` table the user opts into.
 */
import { db } from '../db';
import { formatCurrency, formatDate, getIcon, escapeHtml, dateInputToISO } from '../utils';
import { showToast } from '../components/toast';
import { showModal, showConfirm } from '../components/modal';
import { celebrate } from '../components/celebration';
import type { Challenge } from '../types';

export async function renderAchievements(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [monthlyTrends, monthTxns, budgets, goals, challenges] = await Promise.all([
            db.getMonthlyTrends(),
            db.getTransactions({ startDate: startOfMonth.toISOString(), endDate: endOfMonth.toISOString(), limit: 5000 }),
            db.getBudgetAnalytics(),
            db.getGoals(),
            db.getChallenges(),
        ]);

        // Savings streak: consecutive months (most recent first) with positive savings.
        let savingsStreak = 0;
        for (const m of monthlyTrends) {
            if (m.savings > 0) savingsStreak++;
            else break;
        }

        // No-spend days this month so far.
        const expenseDays = new Set(monthTxns.filter((t: any) => t.type === 'expense').map((t: any) => t.date.slice(0, 10)));
        const daysElapsed = now.getDate();
        const noSpendDays = Math.max(0, daysElapsed - expenseDays.size);

        const income = monthTxns.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
        const expense = monthTxns.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
        const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
        const totalBudgeted = budgets.reduce((s: number, b: any) => s + b.budgeted, 0);
        const totalSpent = budgets.reduce((s: number, b: any) => s + b.actualSpent, 0);
        const budgetUsedPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

        const grade = scoreGrade(savingsRate, budgetUsedPct, totalBudgeted > 0);

        const badges = computeBadges({ savingsStreak, noSpendDays, goals, budgetUsedPct, hasBudgets: totalBudgeted > 0, savingsRate, challenges });

        // Recap of the most recently *completed* month (index 0 is the current, in-progress month).
        const recapMonth = monthlyTrends[1];

        const activeChallenges = challenges.filter(c => c.status === 'active');
        const pastChallenges = challenges.filter(c => c.status !== 'active');

        const activeGoals = goals.filter((g: any) => !g.completed);

        mainContent.innerHTML = `
      <div class="max-w-5xl mx-auto pb-20">
        <div class="mb-6">
          <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('trophy', 26)} Achievements</h1>
          <p class="text-sm text-slate-400 mt-1">Streaks, challenges, badges, and a monthly recap — all built from your real activity.</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <div class="glass-card p-5 text-center">
            ${getIcon('flame', 22, 'mx-auto mb-2 text-orange-400')}
            <p class="text-2xl font-bold">${savingsStreak}</p>
            <p class="text-xs text-slate-400">Month Savings Streak</p>
          </div>
          <div class="glass-card p-5 text-center">
            ${getIcon('ban', 22, 'mx-auto mb-2 text-cyan-400')}
            <p class="text-2xl font-bold">${noSpendDays}</p>
            <p class="text-xs text-slate-400">No-Spend Days This Month</p>
          </div>
          <div class="glass-card p-5 text-center">
            ${getIcon('percent', 22, 'mx-auto mb-2 text-green-400')}
            <p class="text-2xl font-bold">${savingsRate}%</p>
            <p class="text-xs text-slate-400">Savings Rate</p>
          </div>
          <div class="glass-card p-5 text-center">
            ${getIcon('graduation-cap', 22, 'mx-auto mb-2 text-primary-400')}
            <p class="text-2xl font-bold">${grade}</p>
            <p class="text-xs text-slate-400">Monthly Scorecard</p>
          </div>
        </div>

        ${recapMonth ? `
          <div class="glass-card p-6 mb-6 border border-primary-500/20">
            <h3 class="font-semibold mb-3 flex items-center gap-2">${getIcon('sparkles', 18)} ${recapMonth.month} Recap</h3>
            <div class="grid grid-cols-3 gap-4 text-center">
              <div><p class="text-xs text-slate-400">Income</p><p class="font-bold text-green-400">${formatCurrency(recapMonth.income)}</p></div>
              <div><p class="text-xs text-slate-400">Expenses</p><p class="font-bold text-red-400">${formatCurrency(recapMonth.expense)}</p></div>
              <div><p class="text-xs text-slate-400">Saved</p><p class="font-bold ${recapMonth.savings >= 0 ? 'text-green-400' : 'text-red-400'}">${formatCurrency(recapMonth.savings)}</p></div>
            </div>
          </div>
        ` : ''}

        <div class="glass-card p-6 mb-6">
          <h3 class="font-semibold mb-4 flex items-center gap-2">${getIcon('award', 18)} Achievement Badges</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            ${badges.map(b => `
              <div class="flex items-center gap-2 p-3 rounded-lg ${b.earned ? 'bg-primary-500/10' : 'bg-white/5 opacity-40'}">
                ${getIcon(b.icon, 20, b.earned ? 'text-primary-400' : 'text-slate-500')}
                <span class="text-sm">${escapeHtml(b.label)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="glass-card p-6 mb-6">
          <h3 class="font-semibold mb-4 flex items-center gap-2">${getIcon('target', 18)} Goal Milestones</h3>
          ${activeGoals.length === 0 ? '<p class="text-sm text-slate-400">No active goals yet.</p>' : `
            <div class="space-y-3">
              ${activeGoals.map((g: any) => {
            const pct = g.targetAmount > 0 ? Math.min(100, Math.round(g.currentAmount / g.targetAmount * 100)) : 0;
            const milestones = [25, 50, 75, 100];
            return `
                  <div>
                    <div class="flex justify-between text-sm mb-1"><span>${escapeHtml(g.name)}</span><span>${pct}%</span></div>
                    <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-1"><div class="h-full bg-green-500" style="width:${pct}%"></div></div>
                    <div class="flex gap-2">
                      ${milestones.map(m => `<span class="text-[10px] px-1.5 py-0.5 rounded ${pct >= m ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'}">${m}%</span>`).join('')}
                    </div>
                  </div>
                `;
        }).join('')}
            </div>
          `}
        </div>

        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold flex items-center gap-2">${getIcon('flag', 18)} Challenges</h3>
            <button id="new-challenge-btn" class="glass-button text-sm">+ New Challenge</button>
          </div>
          ${activeChallenges.length === 0 ? '<p class="text-sm text-slate-400 mb-4">No active challenges. Start one to keep yourself accountable.</p>' : `
            <div class="space-y-3 mb-4">
              ${activeChallenges.map(c => challengeRowHtml(c, monthTxns, income, expense, totalBudgeted)).join('')}
            </div>
          `}
          ${pastChallenges.length > 0 ? `
            <details class="text-sm">
              <summary class="cursor-pointer text-slate-400">Past challenges (${pastChallenges.length})</summary>
              <div class="mt-2 space-y-2">
                ${pastChallenges.map(c => `
                  <div class="flex justify-between text-sm p-2 rounded-lg bg-white/5">
                    <span>${challengeLabel(c)}</span>
                    <span class="${c.status === 'completed' ? 'text-green-400' : 'text-red-400'} capitalize">${c.status}</span>
                  </div>
                `).join('')}
              </div>
            </details>
          ` : ''}
        </div>
      </div>
    `;

        if ((window as any).lucide) (window as any).lucide.createIcons();

        document.getElementById('new-challenge-btn')?.addEventListener('click', openChallengeModal);

        mainContent.querySelectorAll<HTMLButtonElement>('.claim-challenge-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await db.updateChallengeStatus(btn.dataset.id!, 'completed');
                celebrate('🎉 Challenge complete!');
                renderAchievements();
            });
        });
        mainContent.querySelectorAll<HTMLButtonElement>('.abandon-challenge-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm('Abandon Challenge', 'Remove this challenge? This cannot be undone.', async () => {
                    await db.deleteChallenge(btn.dataset.id!);
                    showToast('Challenge removed', { type: 'success' });
                    renderAchievements();
                });
            });
        });

    } catch (error) {
        console.error('[Achievements] Error rendering:', error);
        showToast('Failed to load achievements', { type: 'error' });
    }
}

function scoreGrade(savingsRate: number, budgetUsedPct: number, hasBudgets: boolean): string {
    if (savingsRate >= 20 && (!hasBudgets || budgetUsedPct <= 100)) return 'A';
    if (savingsRate >= 10) return 'B';
    if (savingsRate >= 0) return 'C';
    return 'D';
}

function computeBadges(ctx: { savingsStreak: number; noSpendDays: number; goals: any[]; budgetUsedPct: number; hasBudgets: boolean; savingsRate: number; challenges: Challenge[] }) {
    return [
        { label: '3-Month Savings Streak', icon: 'flame', earned: ctx.savingsStreak >= 3 },
        { label: '10 No-Spend Days', icon: 'ban', earned: ctx.noSpendDays >= 10 },
        { label: 'First Goal Completed', icon: 'award', earned: ctx.goals.some((g: any) => g.completed) },
        { label: 'Budget Master', icon: 'shield-check', earned: ctx.hasBudgets && ctx.budgetUsedPct <= 100 },
        { label: 'Positive Month', icon: 'trending-up', earned: ctx.savingsRate > 0 },
        { label: 'Challenge Champion', icon: 'medal', earned: ctx.challenges.some(c => c.status === 'completed') },
    ];
}

function challengeLabel(c: Challenge): string {
    if (c.type === 'no-spend-days') return `No-spend: ${c.target} days`;
    if (c.type === 'savings-target') return `Save ${formatCurrency(c.target)}`;
    return `Stay under ${formatCurrency(c.target)}`;
}

function challengeRowHtml(c: Challenge, monthTxns: any[], income: number, expense: number, totalBudgeted: number): string {
    const start = new Date(c.startDate);
    const end = new Date(c.endDate);
    const inRange = (d: string) => new Date(d) >= start && new Date(d) <= end;
    const rangeTxns = monthTxns.filter((t: any) => inRange(t.date));

    let progress = 0;
    let current = 0;
    if (c.type === 'no-spend-days') {
        const spendDays = new Set(rangeTxns.filter((t: any) => t.type === 'expense').map((t: any) => t.date.slice(0, 10)));
        const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        current = Math.max(0, totalDays - spendDays.size);
        progress = Math.min(100, (current / c.target) * 100);
    } else if (c.type === 'savings-target') {
        const inc = rangeTxns.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
        const exp = rangeTxns.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
        current = inc - exp;
        progress = Math.min(100, Math.max(0, (current / c.target) * 100));
    } else {
        current = rangeTxns.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
        progress = Math.min(100, (current / c.target) * 100);
    }

    const complete = c.type === 'budget-adherence' ? current <= c.target && new Date() > end : current >= c.target;

    return `
    <div class="p-3 rounded-lg bg-white/5">
      <div class="flex justify-between text-sm mb-1">
        <span>${challengeLabel(c)}</span>
        <span class="text-slate-400">${formatDate(c.startDate, 'dd MMM')} – ${formatDate(c.endDate, 'dd MMM')}</span>
      </div>
      <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-2">
        <div class="h-full ${c.type === 'budget-adherence' && current > c.target ? 'bg-red-500' : 'bg-primary-500'}" style="width:${Math.min(100, progress)}%"></div>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-xs text-slate-400">${c.type === 'no-spend-days' ? `${current} / ${c.target} days` : formatCurrency(current) + ' / ' + formatCurrency(c.target)}</span>
        <div class="flex gap-2">
          ${complete ? `<button class="claim-challenge-btn text-xs text-green-400 hover:underline" data-id="${c.id}">Claim</button>` : ''}
          <button class="abandon-challenge-btn text-xs text-red-400 hover:underline" data-id="${c.id}">Abandon</button>
        </div>
      </div>
    </div>
  `;
}

function openChallengeModal(): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    const today = new Date().toISOString().split('T')[0];
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Type</label>
      <select name="type" class="glass-input w-full">
        <option value="no-spend-days">No-Spend Challenge (days without spending)</option>
        <option value="savings-target">Savings Challenge (save a target amount)</option>
        <option value="budget-adherence">Budget Challenge (stay under a spend cap)</option>
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Target</label>
      <input type="number" name="target" required min="1" class="glass-input w-full" placeholder="e.g. 10 (days) or 5000 (amount)">
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Start</label>
        <input type="date" name="startDate" required value="${today}" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">End</label>
        <input type="date" name="endDate" required value="${endOfMonth}" class="glass-input w-full">
      </div>
    </div>
  `;
    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Start Challenge</button>
  `;
    const close = showModal({ title: 'New Challenge', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const startDate = dateInputToISO(formData.get('startDate') as string);
        const endDate = dateInputToISO(formData.get('endDate') as string);
        if (new Date(endDate) < new Date(startDate)) {
            showToast('End date must be after the start date', { type: 'error' });
            return;
        }
        try {
            await db.createChallenge({
                type: formData.get('type') as Challenge['type'],
                target: parseFloat(formData.get('target') as string),
                startDate,
                endDate,
            });
            showToast('Challenge started!', { type: 'success' });
            close();
            renderAchievements();
        } catch (error) {
            console.error(error);
            showToast('Failed to start challenge', { type: 'error' });
        }
    });
}
