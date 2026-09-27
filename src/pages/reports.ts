/**
 * Reports Page - Financial analytics and charts
 */

import { db } from '../db';
import { store } from '../stores';
import { formatCurrency, getStartOfMonthISO, getEndOfMonthISO, getIcon } from '../utils';
import { createLineChart, createDoughnutChart, createBarChart, getGhostSeriesColors } from '../components/charts';
import { showToast } from '../components/toast';
import { hasFeature } from '../cloud/entitlements';

const MONTHLY_EQUIVALENT: Record<string, number> = {
  daily: 30.44,
  weekly: 4.345,
  'bi-weekly': 2.17,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

const BUDGET_PERIOD_MONTHLY: Record<string, number> = {
  weekly: 4.345,
  monthly: 1,
  yearly: 1 / 12,
};

export async function renderReports(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const fullReports = hasFeature('fullReports');

  mainContent.innerHTML = `
    <div class="max-w-6xl mx-auto pb-20">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Reports & Analytics</h1>
        <div class="flex gap-2 bg-white/5 p-1 rounded-lg">
           <button class="px-4 py-1.5 rounded-md bg-primary-500 text-white text-sm font-medium">Overview</button>
           <button class="px-4 py-1.5 rounded-md hover:bg-white/10 text-slate-400 text-sm font-medium transition-colors">Custom</button>
        </div>
      </div>

      ${fullReports ? `
      <!-- Projection vs Actual -->
      <div class="glass-card p-6 mb-6">
        <h3 class="text-lg font-bold mb-1 flex items-center gap-2">
          <i data-lucide="scale" class="w-5 h-5 text-indigo-400"></i>
          Projection vs Actual (This Month)
        </h3>
        <p class="text-sm text-slate-400 mb-4">Planned spend from budgets and recurring bills, compared to what's actually been spent so far this month.</p>
        <div id="projection-summary" class="grid grid-cols-3 gap-4 mb-4"></div>
        <div id="projection-list" class="space-y-3"></div>
      </div>
      ` : ''}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Income vs Expense Trend (Free) -->
        <div class="glass-card p-6 col-span-1 lg:col-span-2">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i data-lucide="trending-up" class="w-5 h-5 text-primary-400"></i>
                Income vs Expense (Last 12 Months)
            </h3>
            <div class="h-[300px] w-full">
                <canvas id="trendChart"></canvas>
            </div>
        </div>

        ${fullReports ? `
        <!-- Spending by Category -->
        <div class="glass-card p-6">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i data-lucide="pie-chart" class="w-5 h-5 text-purple-400"></i>
                Spending by Category (This Month)
            </h3>
            <div class="h-[300px] w-full flex items-center justify-center">
                <canvas id="categoryChart"></canvas>
            </div>
        </div>

        <!-- Budget Adherence -->
        <div class="glass-card p-6">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i data-lucide="target" class="w-5 h-5 text-emerald-400"></i>
                Budget vs Actual (This Month)
            </h3>
            <div class="h-[300px] w-full">
                <canvas id="budgetChart"></canvas>
            </div>
        </div>

        <!-- Savings Rate Trend -->
        <div class="glass-card p-6">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i data-lucide="percent" class="w-5 h-5 text-cyan-400"></i>
                Savings Rate Trend
            </h3>
            <div class="h-[300px] w-full">
                <canvas id="savingsRateChart"></canvas>
            </div>
        </div>

        <!-- Future Forecast -->
        <div class="glass-card p-6">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i data-lucide="line-chart" class="w-5 h-5 text-amber-400"></i>
                3-Month Forecast
            </h3>
            <div class="h-[300px] w-full">
                <canvas id="forecastChart"></canvas>
            </div>
        </div>
        ` : `
        <div class="glass-card p-8 text-center col-span-1 lg:col-span-2">
          ${getIcon('lock', 32, 'text-primary-400 mx-auto mb-3')}
          <h3 class="font-bold mb-1">Unlock Full Reports & Analytics</h3>
          <p class="text-sm text-slate-400 mb-4">Spending by Category, Budget vs Actual, Savings Rate Trend, 3-Month Forecast, and Projection vs Actual are Pro features.</p>
          <a href="#/subscription" class="glass-button inline-flex items-center gap-2">${getIcon('sparkles', 16)} View Plans</a>
        </div>
        `}
      </div>
    </div>
  `;

  // Initialize icons
  if ((window as any).lucide) {
    (window as any).lucide.createIcons();
  }

  try {
    const currency = store.getState().userProfile?.primaryCurrency || 'INR';
    const categories = store.getState().categories;

    if (fullReports) {
    // 0. Projection vs Actual (This Month) — combines budgets + recurring
    // expenses (converted to a monthly-equivalent) as "planned", compared
    // against this month's actual expense transactions per category.
    const [budgetsList, recurrings, monthTxns] = await Promise.all([
      db.getBudgets(),
      db.getRecurrings(),
      db.getTransactions({ startDate: getStartOfMonthISO(), endDate: getEndOfMonthISO(), type: 'expense' }),
    ]);

    const plannedByCategory = new Map<string, number>();
    for (const b of budgetsList) {
      const monthly = b.amount * (BUDGET_PERIOD_MONTHLY[b.period] ?? 1);
      plannedByCategory.set(b.categoryId, (plannedByCategory.get(b.categoryId) || 0) + monthly);
    }
    for (const r of recurrings) {
      if (r.type !== 'expense' || !r.categoryId) continue;
      const monthly = r.amount * (MONTHLY_EQUIVALENT[r.frequency] ?? 1);
      plannedByCategory.set(r.categoryId, (plannedByCategory.get(r.categoryId) || 0) + monthly);
    }

    const actualByCategory = new Map<string, number>();
    for (const t of monthTxns) {
      actualByCategory.set(t.categoryId, (actualByCategory.get(t.categoryId) || 0) + t.amount);
    }

    const allCategoryIds = new Set([...plannedByCategory.keys(), ...actualByCategory.keys()]);
    const projectionRows = Array.from(allCategoryIds).map(categoryId => {
      const category = categories.find(c => c.id === categoryId);
      const planned = plannedByCategory.get(categoryId) || 0;
      const actual = actualByCategory.get(categoryId) || 0;
      return { categoryId, name: category?.name || 'Unknown', icon: category?.icon || 'circle', planned, actual };
    }).sort((a, b) => b.planned - a.planned);

    const totalPlanned = projectionRows.reduce((sum, r) => sum + r.planned, 0);
    const totalActual = projectionRows.reduce((sum, r) => sum + r.actual, 0);
    const variance = totalPlanned - totalActual;

    const summaryEl = document.getElementById('projection-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="text-center">
          <p class="text-xs text-gray-400 uppercase tracking-wider">Projected</p>
          <p class="text-xl font-bold text-slate-300 mt-1">${formatCurrency(totalPlanned, currency)}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-400 uppercase tracking-wider">Actual So Far</p>
          <p class="text-xl font-bold text-primary-400 mt-1">${formatCurrency(totalActual, currency)}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-400 uppercase tracking-wider">${variance >= 0 ? 'Remaining' : 'Over Budget'}</p>
          <p class="text-xl font-bold ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'} mt-1">${formatCurrency(Math.abs(variance), currency)}</p>
        </div>
      `;
    }

    const listEl = document.getElementById('projection-list');
    if (listEl) {
      listEl.innerHTML = projectionRows.length === 0 ? `
        <p class="text-sm text-slate-400 text-center py-4">No budgets or recurring expenses set up yet — add one to see a projection.</p>
      ` : projectionRows.map(r => {
        const pct = r.planned > 0 ? Math.round((r.actual / r.planned) * 100) : (r.actual > 0 ? 100 : 0);
        const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
        return `
          <div>
            <div class="flex justify-between items-center mb-1 text-sm">
              <span class="flex items-center gap-2"><i data-lucide="${r.icon}" class="w-4 h-4 text-slate-400"></i> ${r.name}</span>
              <span class="text-slate-400">${formatCurrency(r.actual, currency)} <span class="text-slate-500">/ ${formatCurrency(r.planned, currency)}</span></span>
            </div>
            <div class="h-2 w-full bg-slate-700/50 rounded-full overflow-hidden">
              <div class="h-full rounded-full ${barColor}" style="width: ${Math.min(pct, 100)}%"></div>
            </div>
          </div>
        `;
      }).join('');
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
    } // end if (fullReports) — projection block

    // 1. Load Trend Data
    const trends = await db.getMonthlyTrends();
    // Reverse to show oldest to newest
    const trendLabels = trends.map(t => t.month).reverse();
    const incomeData = trends.map(t => t.income).reverse();
    const expenseData = trends.map(t => t.expense).reverse();

    createLineChart('trendChart', trendLabels, [
      {
        label: 'Income',
        data: incomeData,
        borderColor: '#10b981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Expenses',
        data: expenseData,
        borderColor: '#ef4444', // red-500
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]);

    if (!fullReports) return;

    // 2. Load Category Data (This Month)
    // We need to filter category_spend_trends for current month
    const currentMonth = new Date().toISOString().substring(0, 7);
    const categoryTrends = await db.getCategorySpendTrends();
    const currentMonthCategories = categoryTrends.filter(t => t.month === currentMonth);

    // Sort by spend desc
    currentMonthCategories.sort((a, b) => b.spend - a.spend);

    const categoryLabels = currentMonthCategories.map(c => c.category);
    const categoryData = currentMonthCategories.map(c => c.spend);
    const categoryColors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'
    ];

    createDoughnutChart('categoryChart', categoryLabels, categoryData, categoryColors);

    // 3. Load Budget Data
    const budgets = await db.getBudgetAnalytics();
    const budgetLabels = budgets.map(b => b.categoryName);
    const budgetLimits = budgets.map(b => b.budgeted);
    const budgetSpent = budgets.map(b => b.actualSpent);

    createBarChart('budgetChart', budgetLabels, [
      {
        label: 'Budget Limit',
        data: budgetLimits,
        ...getGhostSeriesColors(),
        borderWidth: 1,
        borderSkipped: false,
      },
      {
        label: 'Actual Spent',
        data: budgetSpent,
        backgroundColor: budgets.map(b => b.actualSpent > b.budgeted ? '#ef4444' : '#10b981'),
        borderRadius: 4,
      }
    ]);

    // 4. Savings Rate Trend
    const savingsRates = trends.map(t => t.income > 0 ? (t.savings / t.income) * 100 : 0).reverse();
    createLineChart('savingsRateChart', trendLabels, [
      {
        label: 'Savings Rate (%)',
        data: savingsRates,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]);

    // 5. Forecast
    const forecast = await db.getForecast();
    if (forecast) {
      const forecastLabels = [trendLabels[trendLabels.length - 1], forecast.nextMonth, 'Forecast +2', 'Forecast +3'];
      const lastIncome = incomeData[incomeData.length - 1];
      const lastExpense = expenseData[expenseData.length - 1];

      createLineChart('forecastChart', forecastLabels, [
        {
          label: 'Projected Income',
          data: [lastIncome, forecast.avgIncome, forecast.avgIncome, forecast.avgIncome],
          borderColor: '#10b981',
          borderDash: [5, 5],
          tension: 0.4
        },
        {
          label: 'Projected Expense',
          data: [lastExpense, forecast.avgExpense, forecast.avgExpense, forecast.avgExpense],
          borderColor: '#ef4444',
          borderDash: [5, 5],
          tension: 0.4
        }
      ]);
    }

  } catch (error) {
    console.error('[Reports] Error loading charts:', error);
    showToast('Failed to load report data', { type: 'error' });
  }
}
