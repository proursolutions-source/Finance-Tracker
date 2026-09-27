/**
 * Money Tools — budgeting planners, quick-spend calculators, expense
 * analysis, and short-range forecasts, all computed live from data that
 * already exists (transactions, budgets, categories, goals, recurrings).
 * No new backend: "Money Rules" are simple locally-stored threshold
 * checks, and "Money Movement Map" is an honest text/bar breakdown rather
 * than a real Sankey diagram — there's no charting library wired in for that.
 */
import { db } from '../db';
import { formatCurrency, formatDate, getIcon, escapeHtml } from '../utils';
import { withTierGate } from '../components/upgrade-gate';
import { showToast } from '../components/toast';
import type { Category } from '../types';

const INVESTMENT_TYPES = ['mutual-fund', 'stocks', 'gold', 'property'];
const RULES_KEY = 'moneyflow-money-rules';

export async function renderMoneyTools(): Promise<void> {
    return withTierGate('pro', 'Money Tools', renderMoneyToolsImpl);
}

type Tab = 'planners' | 'calculators' | 'analysis' | 'forecasts';
let activeTab: Tab = 'planners';

interface Ctx {
    categories: Category[];
    monthTxns: any[];
    income: number;
    expense: number;
    budgets: any[];
    totalBudgeted: number;
    totalSpent: number;
    accounts: any[];
    cashAvailable: number;
    goals: any[];
    recurrings: any[];
    reminders: any[];
    monthlyTrends: any[];
    forecast: { nextMonth: string; avgIncome: number; avgExpense: number } | null;
    daysInMonth: number;
    daysElapsed: number;
    daysRemaining: number;
}

async function buildCtx(): Promise<Ctx> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [categories, monthTxns, budgets, accounts, goals, recurrings, reminders, monthlyTrends, forecast] = await Promise.all([
        db.getCategories(),
        db.getTransactions({ startDate: startOfMonth.toISOString(), endDate: endOfMonth.toISOString(), limit: 5000 }),
        db.getBudgetAnalytics(),
        db.getAccounts(),
        db.getGoals(),
        db.getRecurrings(),
        db.getReminders(false),
        db.getMonthlyTrends(),
        db.getForecast(),
    ]);

    const income = monthTxns.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
    const expense = monthTxns.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
    const totalBudgeted = budgets.reduce((s: number, b: any) => s + b.budgeted, 0);
    const totalSpent = budgets.reduce((s: number, b: any) => s + b.actualSpent, 0);
    const cashAvailable = accounts
        .filter((a: any) => !['credit-card', 'loan', ...INVESTMENT_TYPES].includes(a.type))
        .reduce((s: number, a: any) => s + a.balance, 0);

    const daysInMonth = endOfMonth.getDate();
    const daysElapsed = now.getDate();
    const daysRemaining = Math.max(1, daysInMonth - daysElapsed + 1);

    return {
        categories, monthTxns, income, expense, budgets, totalBudgeted, totalSpent,
        accounts, cashAvailable, goals, recurrings, reminders, monthlyTrends, forecast,
        daysInMonth, daysElapsed, daysRemaining,
    };
}

async function renderMoneyToolsImpl(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="max-w-5xl mx-auto pb-20">
      <div class="mb-6">
        <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('wand-2', 26)} Money Tools</h1>
        <p class="text-sm text-slate-400 mt-1">Budget planners, spend calculators, expense analysis, and short-range forecasts — all computed from your own data.</p>
      </div>
      <div class="flex gap-2 mb-6 flex-wrap">
        <button data-tab="planners" class="tab-btn px-4 py-2 rounded-lg text-sm ${activeTab === 'planners' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Planners</button>
        <button data-tab="calculators" class="tab-btn px-4 py-2 rounded-lg text-sm ${activeTab === 'calculators' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Calculators</button>
        <button data-tab="analysis" class="tab-btn px-4 py-2 rounded-lg text-sm ${activeTab === 'analysis' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Analysis</button>
        <button data-tab="forecasts" class="tab-btn px-4 py-2 rounded-lg text-sm ${activeTab === 'forecasts' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Forecasts</button>
      </div>
      <div id="money-tools-content"></div>
    </div>
  `;

    mainContent.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab as Tab;
            renderMoneyTools();
        });
    });

    const content = document.getElementById('money-tools-content')!;
    try {
        const ctx = await buildCtx();
        if (activeTab === 'planners') renderPlanners(content, ctx);
        else if (activeTab === 'calculators') renderCalculators(content, ctx);
        else if (activeTab === 'analysis') renderAnalysis(content, ctx);
        else renderForecasts(content, ctx);
    } catch (error) {
        console.error('[Money Tools] Error:', error);
        content.innerHTML = `<div class="glass-card p-8 text-center text-red-400">Failed to load Money Tools.</div>`;
    }

    if ((window as any).lucide) (window as any).lucide.createIcons();
}

function card(title: string, body: string, icon?: string): string {
    return `
    <div class="glass-card p-5">
      <h3 class="font-semibold mb-3 flex items-center gap-2">${icon ? getIcon(icon, 18) : ''} ${title}</h3>
      ${body}
    </div>
  `;
}

function progressBar(pct: number, colorClass = 'bg-primary-500'): string {
    const clamped = Math.max(0, Math.min(100, pct));
    return `<div class="w-full h-2 rounded-full bg-white/10 overflow-hidden"><div class="h-full ${colorClass}" style="width:${clamped}%"></div></div>`;
}

// ============================== PLANNERS ==============================

function renderPlanners(content: HTMLElement, ctx: Ctx): void {
    const unallocated = ctx.income - ctx.totalBudgeted;
    const weeklyLimit = (ctx.totalBudgeted - ctx.totalSpent) / (ctx.daysRemaining / 7);
    const dailyLimit = (ctx.totalBudgeted - ctx.totalSpent) / ctx.daysRemaining;

    const essentialSpend = ctx.monthTxns.filter((t: any) => t.type === 'expense' && catFlag(ctx.categories, t.categoryId, 'isEssential') === true).reduce((s: number, t: any) => s + t.amount, 0);
    const nonEssentialSpend = ctx.monthTxns.filter((t: any) => t.type === 'expense' && catFlag(ctx.categories, t.categoryId, 'isEssential') === false).reduce((s: number, t: any) => s + t.amount, 0);
    const savings = ctx.income - ctx.expense;
    const needsTarget = ctx.income * 0.5;
    const wantsTarget = ctx.income * 0.3;
    const savingsTarget = ctx.income * 0.2;

    const rules = loadRules();

    content.innerHTML = `
    <div class="grid gap-4 md:grid-cols-2">
      ${card('Zero-Based Budgeting', `
        <p class="text-sm text-slate-400 mb-2">Every rupee of this month's income should be assigned to a budget category.</p>
        <div class="flex justify-between text-sm mb-1"><span>Income</span><span>${formatCurrency(ctx.income)}</span></div>
        <div class="flex justify-between text-sm mb-1"><span>Allocated to budgets</span><span>${formatCurrency(ctx.totalBudgeted)}</span></div>
        <div class="flex justify-between font-semibold ${unallocated > 0 ? 'text-yellow-400' : unallocated < 0 ? 'text-red-400' : 'text-green-400'}">
          <span>${unallocated > 0 ? 'Unallocated' : unallocated < 0 ? 'Over-allocated' : 'Fully allocated'}</span><span>${formatCurrency(Math.abs(unallocated))}</span>
        </div>
      `, 'target')}

      ${card('Envelope Budgeting', `
        <p class="text-sm text-slate-400 mb-3">Each budget acts as an envelope — once it's empty, that category is done for the month.</p>
        <div class="space-y-3 max-h-56 overflow-y-auto custom-scrollbar">
          ${ctx.budgets.length === 0 ? '<p class="text-sm text-slate-500">No budgets set yet.</p>' : ctx.budgets.map((b: any) => {
        const pct = b.budgeted > 0 ? Math.round((b.actualSpent / b.budgeted) * 100) : 0;
        return `
              <div>
                <div class="flex justify-between text-xs mb-1"><span>${escapeHtml(b.categoryName)}</span><span>${formatCurrency(b.actualSpent)} / ${formatCurrency(b.budgeted)}</span></div>
                ${progressBar(pct, pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-yellow-500' : 'bg-primary-500')}
              </div>
            `;
    }).join('')}
        </div>
      `, 'mail')}

      ${card('50/30/20 Budget Planner', `
        <p class="text-sm text-slate-400 mb-3">Needs 50% &middot; Wants 30% &middot; Savings 20% of this month's income. Needs/Wants use each category's Essential tag (set under Categories).</p>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span>Needs (essential)</span><span>${formatCurrency(essentialSpend)} / ${formatCurrency(needsTarget)}</span></div>
          ${progressBar(needsTarget > 0 ? essentialSpend / needsTarget * 100 : 0)}
          <div class="flex justify-between mt-2"><span>Wants (non-essential)</span><span>${formatCurrency(nonEssentialSpend)} / ${formatCurrency(wantsTarget)}</span></div>
          ${progressBar(wantsTarget > 0 ? nonEssentialSpend / wantsTarget * 100 : 0)}
          <div class="flex justify-between mt-2"><span>Savings</span><span>${formatCurrency(savings)} / ${formatCurrency(savingsTarget)}</span></div>
          ${progressBar(savingsTarget > 0 ? savings / savingsTarget * 100 : 0, 'bg-green-500')}
        </div>
      `, 'pie-chart')}

      ${card('Paycheck Budget Planner', `
        <p class="text-sm text-slate-400 mb-3">Split your remaining budget across however many paychecks are left this month.</p>
        <div class="flex items-center gap-2 mb-3">
          <select id="paycheck-freq" class="glass-input text-sm">
            <option value="1">Monthly (1 paycheck)</option>
            <option value="2">Bi-weekly (2 paychecks)</option>
            <option value="4">Weekly (4 paychecks)</option>
          </select>
        </div>
        <p class="text-sm">Per paycheck: <strong id="paycheck-amount">${formatCurrency(Math.max(0, ctx.totalBudgeted - ctx.totalSpent))}</strong></p>
      `, 'wallet')}

      ${card('Weekly / Daily Spending Limit', `
        <p class="text-sm text-slate-400 mb-3">Remaining budget spread across the rest of the month (${ctx.daysRemaining} day${ctx.daysRemaining === 1 ? '' : 's'} left).</p>
        <div class="grid grid-cols-2 gap-4 text-center">
          <div><p class="text-xs uppercase text-slate-400">Daily</p><p class="text-xl font-bold ${dailyLimit < 0 ? 'text-red-400' : ''}">${formatCurrency(Math.max(0, dailyLimit))}</p></div>
          <div><p class="text-xs uppercase text-slate-400">Weekly</p><p class="text-xl font-bold ${weeklyLimit < 0 ? 'text-red-400' : ''}">${formatCurrency(Math.max(0, weeklyLimit))}</p></div>
        </div>
      `, 'calendar-days')}

      ${card('Money Rules Engine', `
        <p class="text-sm text-slate-400 mb-3">Simple rule: alert when a category's month-to-date spend crosses a threshold you set (stored on this device only).</p>
        <div id="money-rules-list" class="space-y-2 mb-3">
          ${rules.length === 0 ? '<p class="text-sm text-slate-500">No rules yet.</p>' : rules.map(r => {
        const cat = ctx.categories.find(c => c.id === r.categoryId);
        const spent = ctx.monthTxns.filter((t: any) => t.type === 'expense' && t.categoryId === r.categoryId).reduce((s: number, t: any) => s + t.amount, 0);
        const breached = spent > r.threshold;
        return `
              <div class="flex items-center justify-between text-sm p-2 rounded-lg ${breached ? 'bg-red-500/10 text-red-400' : 'bg-white/5'}">
                <span>${escapeHtml(cat?.name || 'Unknown')}: spend &gt; ${formatCurrency(r.threshold)}</span>
                <div class="flex items-center gap-2">
                  ${breached ? getIcon('alert-triangle', 14) : getIcon('check', 14)}
                  <button class="delete-rule-btn text-slate-400 hover:text-red-400" data-id="${r.id}">${getIcon('x', 14)}</button>
                </div>
              </div>
            `;
    }).join('')}
        </div>
        <div class="flex gap-2">
          <select id="rule-category" class="glass-input text-sm flex-1">
            ${ctx.categories.filter(c => c.type !== 'income').map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
          <input type="number" id="rule-threshold" placeholder="Threshold" class="glass-input text-sm w-28">
          <button id="add-rule-btn" class="glass-button text-sm">Add</button>
        </div>
      `, 'zap')}
    </div>
  `;

    const paycheckSelect = content.querySelector('#paycheck-freq') as HTMLSelectElement;
    const paycheckAmount = content.querySelector('#paycheck-amount') as HTMLElement;
    paycheckSelect?.addEventListener('change', () => {
        const n = parseInt(paycheckSelect.value, 10);
        const remaining = Math.max(0, ctx.totalBudgeted - ctx.totalSpent);
        paycheckAmount.textContent = formatCurrency(remaining / n);
    });

    content.querySelector('#add-rule-btn')?.addEventListener('click', () => {
        const categoryId = (content.querySelector('#rule-category') as HTMLSelectElement).value;
        const thresholdInput = content.querySelector('#rule-threshold') as HTMLInputElement;
        const threshold = parseFloat(thresholdInput.value);
        if (!categoryId || !threshold || threshold <= 0) {
            showToast('Pick a category and a positive threshold', { type: 'error' });
            return;
        }
        const rules = loadRules();
        rules.push({ id: crypto.randomUUID(), categoryId, threshold });
        saveRules(rules);
        renderMoneyTools();
    });

    content.querySelectorAll<HTMLButtonElement>('.delete-rule-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            saveRules(loadRules().filter(r => r.id !== btn.dataset.id));
            renderMoneyTools();
        });
    });
}

interface MoneyRule { id: string; categoryId: string; threshold: number; }
function loadRules(): MoneyRule[] {
    try {
        const raw = localStorage.getItem(RULES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}
function saveRules(rules: MoneyRule[]): void {
    try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch { /* ignore */ }
}

function catFlag(categories: Category[], categoryId: string | undefined, flag: 'isEssential' | 'isFixed'): boolean | undefined {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return undefined;
    const raw = (cat as any)[flag];
    if (raw === null || raw === undefined) return undefined;
    return !!raw;
}

// ============================== CALCULATORS ==============================

function renderCalculators(content: HTMLElement, ctx: Ctx): void {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming30 = [...ctx.reminders, ...ctx.recurrings.map((r: any) => ({ dueDate: r.nextDueDate, amount: r.amount }))]
        .filter((r: any) => r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30)
        .reduce((s: number, r: any) => s + (r.amount || 0), 0);

    const safeToSpend = ctx.cashAvailable - upcoming30;
    const availableToSpend = Math.max(0, ctx.totalBudgeted - ctx.totalSpent);
    const emiTotal = ctx.accounts.filter((a: any) => a.type === 'loan' && a.emiAmount).reduce((s: number, a: any) => s + a.emiAmount, 0);
    const essentialSpend = ctx.monthTxns.filter((t: any) => t.type === 'expense' && catFlag(ctx.categories, t.categoryId, 'isEssential') === true).reduce((s: number, t: any) => s + t.amount, 0);
    const discretionary = ctx.income - essentialSpend - emiTotal;
    const savingsRate = ctx.income > 0 ? ((ctx.income - ctx.expense) / ctx.income) * 100 : 0;
    const recentMonths = ctx.monthlyTrends.slice(0, 3);
    const burnRate = recentMonths.length > 0 ? recentMonths.reduce((s: number, m: any) => s + m.expense, 0) / recentMonths.length : ctx.expense;
    const runwayMonths = burnRate > 0 ? ctx.cashAvailable / burnRate : Infinity;
    const incomeExpenseRatio = ctx.expense > 0 ? ctx.income / ctx.expense : (ctx.income > 0 ? Infinity : 0);

    content.innerHTML = `
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      ${card('Safe-to-Spend', `<p class="text-2xl font-bold ${safeToSpend < 0 ? 'text-red-400' : 'text-green-400'}">${formatCurrency(safeToSpend)}</p><p class="text-xs text-slate-400 mt-1">Cash on hand minus bills due in the next 30 days.</p>`, 'shield-check')}
      ${card('Available-to-Spend', `<p class="text-2xl font-bold">${formatCurrency(availableToSpend)}</p><p class="text-xs text-slate-400 mt-1">What's left unspent across this month's budgets.</p>`, 'wallet')}
      ${card('Discretionary Income', `<p class="text-2xl font-bold ${discretionary < 0 ? 'text-red-400' : ''}">${formatCurrency(discretionary)}</p><p class="text-xs text-slate-400 mt-1">Income minus essential spend and EMIs.</p>`, 'coins')}
      ${card('Savings Rate', `<p class="text-2xl font-bold ${savingsRate >= 20 ? 'text-green-400' : ''}">${savingsRate.toFixed(1)}%</p><p class="text-xs text-slate-400 mt-1">Share of this month's income you kept.</p>`, 'piggy-bank')}
      ${card('Burn Rate', `<p class="text-2xl font-bold">${formatCurrency(burnRate)}<span class="text-sm font-normal text-slate-400">/mo</span></p><p class="text-xs text-slate-400 mt-1">${runwayMonths === Infinity ? 'No recent spending to project from.' : `Cash on hand covers ~${runwayMonths.toFixed(1)} months at this rate.`}</p>`, 'flame')}
      ${card('Income-to-Expense Ratio', `<p class="text-2xl font-bold">${ctx.income === 0 && ctx.expense === 0 ? 'N/A' : incomeExpenseRatio === Infinity ? '∞' : incomeExpenseRatio.toFixed(2)}</p><p class="text-xs text-slate-400 mt-1">${ctx.income === 0 && ctx.expense === 0 ? 'No activity yet this month.' : incomeExpenseRatio >= 1 ? 'You earned more than you spent.' : 'You spent more than you earned.'}</p>`, 'scale')}
    </div>
  `;
}

// ============================== ANALYSIS ==============================

function renderAnalysis(content: HTMLElement, ctx: Ctx): void {
    const expenseTxns = ctx.monthTxns.filter((t: any) => t.type === 'expense');
    const fixed = expenseTxns.filter((t: any) => catFlag(ctx.categories, t.categoryId, 'isFixed') === true).reduce((s: number, t: any) => s + t.amount, 0);
    const variable = expenseTxns.filter((t: any) => catFlag(ctx.categories, t.categoryId, 'isFixed') === false).reduce((s: number, t: any) => s + t.amount, 0);
    const untaggedFixed = expenseTxns.filter((t: any) => catFlag(ctx.categories, t.categoryId, 'isFixed') === undefined).reduce((s: number, t: any) => s + t.amount, 0);

    const essential = expenseTxns.filter((t: any) => catFlag(ctx.categories, t.categoryId, 'isEssential') === true).reduce((s: number, t: any) => s + t.amount, 0);
    const nonEssential = expenseTxns.filter((t: any) => catFlag(ctx.categories, t.categoryId, 'isEssential') === false).reduce((s: number, t: any) => s + t.amount, 0);
    const untaggedEssential = expenseTxns.filter((t: any) => catFlag(ctx.categories, t.categoryId, 'isEssential') === undefined).reduce((s: number, t: any) => s + t.amount, 0);

    const total = ctx.expense || 1;
    const byCategory = new Map<string, number>();
    expenseTxns.forEach((t: any) => byCategory.set(t.categoryId, (byCategory.get(t.categoryId) || 0) + t.amount));
    const movementRows = Array.from(byCategory.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([catId, amt]) => {
            const cat = ctx.categories.find(c => c.id === catId);
            const pct = (amt / total) * 100;
            return `
        <div class="mb-2">
          <div class="flex justify-between text-xs mb-1"><span>${escapeHtml(cat?.name || 'Unknown')}</span><span>${formatCurrency(amt)} (${pct.toFixed(0)}%)</span></div>
          ${progressBar(pct)}
        </div>
      `;
        }).join('');

    const timelineTxns = [...ctx.monthTxns].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);

    content.innerHTML = `
    <div class="grid gap-4 md:grid-cols-2">
      ${card('Fixed vs Variable Expenses', `
        <div class="flex justify-between text-sm mb-1"><span>Fixed</span><span>${formatCurrency(fixed)}</span></div>
        ${progressBar(ctx.expense > 0 ? fixed / ctx.expense * 100 : 0)}
        <div class="flex justify-between text-sm mb-1 mt-2"><span>Variable</span><span>${formatCurrency(variable)}</span></div>
        ${progressBar(ctx.expense > 0 ? variable / ctx.expense * 100 : 0, 'bg-amber-500')}
        ${untaggedFixed > 0 ? `<p class="text-xs text-slate-500 mt-2">${formatCurrency(untaggedFixed)} untagged — tag categories as Fixed/Variable under Categories to include them.</p>` : ''}
      `, 'repeat')}

      ${card('Essential vs Non-Essential', `
        <div class="flex justify-between text-sm mb-1"><span>Essential</span><span>${formatCurrency(essential)}</span></div>
        ${progressBar(ctx.expense > 0 ? essential / ctx.expense * 100 : 0, 'bg-green-500')}
        <div class="flex justify-between text-sm mb-1 mt-2"><span>Non-essential</span><span>${formatCurrency(nonEssential)}</span></div>
        ${progressBar(ctx.expense > 0 ? nonEssential / ctx.expense * 100 : 0, 'bg-pink-500')}
        ${untaggedEssential > 0 ? `<p class="text-xs text-slate-500 mt-2">${formatCurrency(untaggedEssential)} untagged — tag categories as Essential/Non-essential under Categories to include them.</p>` : ''}
      `, 'sparkles')}

      ${card('Money Movement Map', `
        <p class="text-xs text-slate-500 mb-3">A simplified breakdown of where this month's income went — not a full flow diagram.</p>
        ${movementRows || '<p class="text-sm text-slate-500">No expenses yet this month.</p>'}
      `, 'git-branch')}

      ${card('Monthly / Yearly Snapshots', `
        <div class="max-h-56 overflow-y-auto custom-scrollbar space-y-2">
          ${ctx.monthlyTrends.map((m: any) => `
            <div class="flex justify-between text-sm border-b border-white/5 pb-1">
              <span>${m.month}</span>
              <span class="text-green-400">${formatCurrency(m.income)}</span>
              <span class="text-red-400">${formatCurrency(m.expense)}</span>
              <span class="${m.savings >= 0 ? 'text-green-400' : 'text-red-400'}">${formatCurrency(m.savings)}</span>
            </div>
          `).join('') || '<p class="text-sm text-slate-500">Not enough history yet.</p>'}
        </div>
      `, 'history')}

      ${card('Money Flow Timeline', `
        <div class="max-h-56 overflow-y-auto custom-scrollbar space-y-2">
          ${timelineTxns.length === 0 ? '<p class="text-sm text-slate-500">No transactions yet this month.</p>' : timelineTxns.map((t: any) => {
        const cat = ctx.categories.find(c => c.id === t.categoryId);
        return `
              <div class="flex justify-between items-center text-sm border-b border-white/5 pb-1">
                <span class="text-slate-400 w-20 flex-shrink-0">${formatDate(t.date, 'dd MMM')}</span>
                <span class="flex-1">${escapeHtml(cat?.name || 'Uncategorized')}</span>
                <span class="${t.type === 'income' ? 'text-green-400' : 'text-red-400'}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
              </div>
            `;
    }).join('')}
        </div>
      `, 'route')}
    </div>
  `;
}

// ============================== FORECASTS ==============================

function renderForecasts(content: HTMLElement, ctx: Ctx): void {
    const avgIncome = ctx.forecast?.avgIncome || 0;
    const avgExpense = ctx.forecast?.avgExpense || 0;
    const projectedCash30d = ctx.cashAvailable + avgIncome - avgExpense;
    const projectedSavings = avgIncome - avgExpense;

    const activeGoals = ctx.goals.filter((g: any) => !g.completed);
    const goalForecasts = activeGoals.map((g: any) => {
        const monthsElapsed = Math.max(1, (Date.now() - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
        const avgContribution = g.currentAmount / monthsElapsed;
        const remaining = g.targetAmount - g.currentAmount;
        const monthsLeft = avgContribution > 0 ? remaining / avgContribution : Infinity;
        return { g, monthsLeft };
    });

    content.innerHTML = `
    <div class="grid gap-4 md:grid-cols-2">
      ${card('30-Day Financial Forecast', `
        <p class="text-sm text-slate-400 mb-3">Projected from your average income/expense over the last 6 months.</p>
        <div class="flex justify-between text-sm mb-1"><span>Cash today</span><span>${formatCurrency(ctx.cashAvailable)}</span></div>
        <div class="flex justify-between text-sm mb-1"><span>+ Avg. income</span><span class="text-green-400">${formatCurrency(avgIncome)}</span></div>
        <div class="flex justify-between text-sm mb-1"><span>- Avg. expense</span><span class="text-red-400">${formatCurrency(avgExpense)}</span></div>
        <div class="flex justify-between font-semibold border-t border-white/10 pt-2 mt-2"><span>Projected cash in 30 days</span><span>${formatCurrency(projectedCash30d)}</span></div>
      `, 'trending-up')}

      ${card('Income / Expense / Savings Forecast', `
        <p class="text-sm text-slate-400 mb-3">Next month, at the same pace as your last 6 months.</p>
        <div class="flex justify-between text-sm mb-1"><span>Income</span><span class="text-green-400">${formatCurrency(avgIncome)}</span></div>
        <div class="flex justify-between text-sm mb-1"><span>Expense</span><span class="text-red-400">${formatCurrency(avgExpense)}</span></div>
        <div class="flex justify-between font-semibold"><span>Savings</span><span class="${projectedSavings >= 0 ? 'text-green-400' : 'text-red-400'}">${formatCurrency(projectedSavings)}</span></div>
      `, 'calendar-clock')}

      ${card('Goal Completion Forecast', `
        <div class="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
          ${goalForecasts.length === 0 ? '<p class="text-sm text-slate-500">No active goals to forecast.</p>' : goalForecasts.map(({ g, monthsLeft }) => `
            <div>
              <div class="flex justify-between text-sm mb-1"><span>${escapeHtml(g.name)}</span><span>${monthsLeft === Infinity ? 'Not enough data' : `~${Math.ceil(monthsLeft)} mo left`}</span></div>
              ${progressBar(g.targetAmount > 0 ? g.currentAmount / g.targetAmount * 100 : 0, 'bg-green-500')}
            </div>
          `).join('')}
        </div>
      `, 'award')}
    </div>
  `;
}
