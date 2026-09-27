/**
 * Dashboard Page - Main financial overview
 */

import { db } from '../db';
import { store } from '../stores';
import { formatCurrency, formatRelativeDate, formatDate, getBudgetPercentage, getBudgetStatusColor, getIcon, escapeHtml } from '../utils';
import { showToast } from '../components/toast';

const INVESTMENT_TYPES = ['mutual-fund', 'stocks', 'gold', 'property'];

function eventLabel(date: Date, now: Date): string {
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return formatDate(date.toISOString(), 'dd MMM');
}

export async function renderDashboard(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    // Get dashboard data
    const summary = await db.getDashboardSummary();
    const recentTxns = await db.getTransactions({ limit: 10 });
    const budgets = await db.getBudgets();
    const categories = store.getState().categories;

    // Calculate budget progress
    const budgetProgress = await Promise.all(
      budgets.slice(0, 3).map(async (budget) => {
        const cat = categories.find(c => c.id === budget.categoryId);
        if (!cat) return null;

        // Calculate date range based on period
        const now = new Date();
        let startDate = budget.startDate;
        let endDate = new Date().toISOString();

        // Get spent amount for this period
        const txns = await db.getTransactions({
          startDate,
          endDate,
          categoryIds: [budget.categoryId],
          type: 'expense',
        });

        const spent = txns.reduce((sum, t) => sum + t.amount, 0);
        const percentage = getBudgetPercentage(spent, budget.amount);

        return {
          categoryName: cat.name,
          icon: cat.icon || 'circle',
          spent,
          budget: budget.amount,
          percentage,
        };
      })
    );

    const validBudgets = budgetProgress.filter((b): b is NonNullable<typeof b> => b !== null);

    const profile = store.getState().userProfile;
    const currency = profile?.primaryCurrency || 'INR';

    // Command Center data — cash available, upcoming bills, budget/savings
    // rate, quick-glance tiles, and a chronological "financial events" list.
    // Merged directly into the dashboard so there's one home screen instead
    // of two near-duplicate ones.
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [accounts, budgetAnalytics, goals, reminders, recurrings] = await Promise.all([
      db.getAccounts(),
      db.getBudgetAnalytics(),
      db.getGoals(),
      db.getReminders(false),
      db.getRecurrings(),
    ]);

    const cashAvailable = accounts
      .filter((a: any) => !['credit-card', 'loan', ...INVESTMENT_TYPES].includes(a.type))
      .reduce((s: number, a: any) => s + a.balance, 0);
    const savingsRate = summary.monthlyIncome > 0 ? Math.round(((summary.monthlyIncome - summary.monthlyExpense) / summary.monthlyIncome) * 100) : 0;
    const totalBudgetedAll = budgetAnalytics.reduce((s: number, b: any) => s + b.budgeted, 0);
    const totalSpentAll = budgetAnalytics.reduce((s: number, b: any) => s + b.actualSpent, 0);
    const budgetUsedPct = totalBudgetedAll > 0 ? getBudgetPercentage(totalSpentAll, totalBudgetedAll) : 0;

    type FinEvent = { date: Date; label: string; amount?: number };
    const events: FinEvent[] = [];
    for (const r of reminders) {
      const d = new Date(r.dueDate);
      if (d >= now && d <= in30) events.push({ date: d, label: r.name, amount: r.amount });
    }
    for (const rec of recurrings) {
      if (!rec.nextDueDate) continue;
      const d = new Date(rec.nextDueDate);
      if (d >= now && d <= in30) events.push({ date: d, label: rec.name, amount: rec.amount });
    }
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    const upcoming7 = events.filter(e => e.date <= in7).reduce((s, e) => s + (e.amount || 0), 0);
    const upcoming30 = events.reduce((s, e) => s + (e.amount || 0), 0);
    const upcomingBillsCount = reminders.filter((r: any) => new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30).length;
    const goalsOnTrack = goals.filter((g: any) => !g.completed && (g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0) >= 0.01).length;
    const subscriptionsMonthly = recurrings
      .filter((r: any) => r.isSubscription)
      .reduce((s: number, r: any) => s + (r.frequency === 'yearly' ? r.amount / 12 : r.amount), 0);
    const investmentsValue = accounts
      .filter((a: any) => INVESTMENT_TYPES.includes(a.type))
      .reduce((s: number, a: any) => s + a.balance, 0);
    const financialEvents = events.slice(0, 8);

    // Savings milestone celebration — fires once per month, the first time
    // that month's savings rate crosses each 25/50/75/100% threshold.
    try {
      const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
      const celebratedKey = 'moneyflow-savings-milestones';
      const celebrated: Record<string, number> = JSON.parse(localStorage.getItem(celebratedKey) || '{}');
      const highestMilestone = [100, 75, 50, 25].find(m => savingsRate >= m);
      if (highestMilestone && (celebrated[monthKey] || 0) < highestMilestone) {
        celebrated[monthKey] = highestMilestone;
        localStorage.setItem(celebratedKey, JSON.stringify(celebrated));
        const { celebrate } = await import('../components/celebration');
        celebrate(`🎉 You've hit a ${highestMilestone}% savings rate this month!`);
      }
    } catch { /* ignore */ }

    // "On This Day" - a subtle, optional nudge into MoneyFlow Memory (disable via Settings)
    const onThisDayEnabled = localStorage.getItem('moneyflow-on-this-day-enabled') !== 'false';
    let onThisDayHtml = '';
    if (onThisDayEnabled) {
      const now = new Date();
      const [memories, pastYearTxns] = await Promise.all([
        db.getOnThisDayMemories(now.getMonth() + 1, now.getDate()),
        db.getTransactions({
          startDate: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString(),
          endDate: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59).toISOString(),
        }),
      ]);

      if (memories.length > 0) {
        onThisDayHtml = `
          <div class="glass-card p-4 mb-6 border border-primary-500/30 flex items-center gap-3">
            ${getIcon('clock', 20)}
            <p class="text-sm"><span class="text-primary-400 font-medium">On this day, ${new Date(memories[0].occurredAt).getFullYear()}:</span> "${memories[0].title}"</p>
          </div>
        `;
      } else if (pastYearTxns.length > 0) {
        const spentLastYear = pastYearTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        if (spentLastYear > 0) {
          onThisDayHtml = `
            <div class="glass-card p-4 mb-6 border border-primary-500/30 flex items-center gap-3">
              ${getIcon('clock', 20)}
              <p class="text-sm"><span class="text-primary-400 font-medium">On this day last year</span>, you spent ${formatCurrency(spentLastYear, currency)}.</p>
            </div>
          `;
        }
      }
    }

    mainContent.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold mb-2">Welcome back${profile?.preferredName ? ', ' + escapeHtml(profile.preferredName) : ''}! 👋</h1>
          <p class="text-slate-400">Here's your financial overview</p>
        </div>

        ${onThisDayHtml}

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- Balance Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Total Balance</span>
              <i data-lucide="wallet" class="w-5 h-5 text-primary-400"></i>
            </div>
            <h2 class="text-3xl font-bold mb-1">${formatCurrency(summary.balance, currency)}</h2>
            <p class="text-sm text-slate-500">All accounts</p>
          </div>
          
          <!-- Monthly Income Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Monthly Income</span>
              <i data-lucide="trending-up" class="w-5 h-5 text-green-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-green-400 mb-1">${formatCurrency(summary.monthlyIncome, currency)}</h2>
            <p class="text-sm text-slate-500">This month</p>
          </div>
          
          <!-- Monthly Expense Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Monthly Expense</span>
              <i data-lucide="trending-down" class="w-5 h-5 text-red-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-red-400 mb-1">${formatCurrency(summary.monthlyExpense, currency)}</h2>
            <p class="text-sm text-slate-500">This month</p>
          </div>
        </div>

        <!-- Command Center: cash available, upcoming bills, budget/savings rate -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Cash Available</span>
              ${getIcon('banknote', 20, 'text-primary-400')}
            </div>
            <h2 class="text-2xl font-bold mb-3">${formatCurrency(cashAvailable, currency)}</h2>
            <div class="flex justify-between text-sm border-t border-white/5 pt-3">
              <span class="text-slate-400">Upcoming 7 days</span>
              <span class="font-medium">${formatCurrency(upcoming7, currency)}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
              <span class="text-slate-400">Upcoming 30 days</span>
              <span class="font-medium">${formatCurrency(upcoming30, currency)}</span>
            </div>
          </div>
          <div class="glass-card p-6 grid grid-cols-2 gap-4">
            <div class="text-center">
              <p class="text-xs uppercase text-slate-400 mb-1">Budget Used</p>
              <p class="text-2xl font-bold ${budgetUsedPct >= 100 ? 'text-red-400' : budgetUsedPct >= 90 ? 'text-yellow-400' : ''}">${budgetUsedPct}%</p>
            </div>
            <div class="text-center">
              <p class="text-xs uppercase text-slate-400 mb-1">Savings Rate</p>
              <p class="text-2xl font-bold ${savingsRate >= 20 ? 'text-green-400' : ''}">${savingsRate}%</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <a href="#/reminders" class="glass-card p-4 hover:bg-white/10 transition-colors">
            <p class="text-xs uppercase text-slate-400 mb-1 flex items-center gap-1">${getIcon('bell', 12)} Bills</p>
            <p class="font-semibold">${upcomingBillsCount} Upcoming</p>
          </a>
          <a href="#/goals" class="glass-card p-4 hover:bg-white/10 transition-colors">
            <p class="text-xs uppercase text-slate-400 mb-1 flex items-center gap-1">${getIcon('award', 12)} Goals</p>
            <p class="font-semibold">${goalsOnTrack} On Track</p>
          </a>
          <a href="#/recurring" class="glass-card p-4 hover:bg-white/10 transition-colors">
            <p class="text-xs uppercase text-slate-400 mb-1 flex items-center gap-1">${getIcon('refresh-cw', 12)} Subscriptions</p>
            <p class="font-semibold">${formatCurrency(subscriptionsMonthly, currency)}/mo</p>
          </a>
          <a href="#/investments" class="glass-card p-4 hover:bg-white/10 transition-colors">
            <p class="text-xs uppercase text-slate-400 mb-1 flex items-center gap-1">${getIcon('trending-up', 12)} Investments</p>
            <p class="font-semibold">${formatCurrency(investmentsValue, currency)}</p>
          </a>
        </div>

        ${financialEvents.length > 0 ? `
          <div class="glass-card p-6 mb-8">
            <h3 class="text-xl font-bold mb-4">Financial Events</h3>
            <div class="space-y-2">
              ${financialEvents.map(e => `
                <div class="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
                  <span class="text-slate-400 w-24 flex-shrink-0">${eventLabel(e.date, now)}</span>
                  <span class="flex-1 flex items-center gap-1">${getIcon('arrow-right', 12, 'text-slate-500')} ${escapeHtml(e.label)}</span>
                  ${e.amount ? `<span class="font-medium">${formatCurrency(e.amount, currency)}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Budget Progress (if any budgets exist) -->
        ${validBudgets.length > 0 ? `
          <div class="glass-card p-6 mb-8">
            <h3 class="text-xl font-bold mb-4">Budget Progress</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              ${validBudgets.map(b => `
                <div class="flex flex-col items-center">
                  <div class="relative w-24 h-24 mb-3">
                    <svg class="transform -rotate-90 w-24 h-24">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="none" class="text-slate-700" />
                      <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="none" 
                        class="${getBudgetStatusColor(b.percentage)}"
                        stroke-dasharray="${2 * Math.PI * 40}"
                        stroke-dashoffset="${2 * Math.PI * 40 * (1 - b.percentage / 100)}"
                        stroke-linecap="round" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <span class="text-lg font-bold">${b.percentage}%</span>
                    </div>
                  </div>
                  <h4 class="font-semibold mb-1">${b.categoryName}</h4>
                  <p class="text-sm text-slate-400">${formatCurrency(b.spent, currency)} / ${formatCurrency(b.budget, currency)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Recent Transactions -->
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold">Recent Transactions</h3>
            <a href="#/transactions" class="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              View all
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </a>
          </div>
          
          ${recentTxns.length > 0 ? `
            <div class="space-y-3">
              ${recentTxns.map(txn => {
      const cat = categories.find(c => c.id === txn.categoryId);
      return `
                  <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <i data-lucide="${cat?.icon || 'circle'}" class="w-5 h-5 text-primary-400"></i>
                      </div>
                      <div>
                        <h4 class="font-medium">${escapeHtml(cat?.name) || 'Unknown'}</h4>
                        <p class="text-sm text-slate-400">${formatRelativeDate(txn.date)}${txn.payee ? ' • ' + escapeHtml(txn.payee) : ''}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="font-semibold ${txn.type === 'income' ? 'text-green-400' : 'text-red-400'}">
                        ${txn.type === 'income' ? '+' : '-'}${formatCurrency(txn.amount, currency)}
                      </p>
                    </div>
                  </div>
                `;
    }).join('')}
            </div>
          ` : `
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="inbox" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No transactions yet</p>
              <p class="text-sm mt-2">Tap the + button to add your first transaction</p>
            </div>
          `}
        </div>
        
            <!-- FAB is now global in main.ts -->
      </div>
    `;

    // Initialize icons
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }

  } catch (error) {
    console.error('[Dashboard] Error rendering:', error);
    showToast('Failed to load dashboard', { type: 'error' });
  }
}
