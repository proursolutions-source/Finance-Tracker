/**
 * Loan & Debt Tools — EMI calculator, interest calculator, amortization
 * schedule, and a debt payoff planner (snowball/avalanche) built from the
 * user's actual loan/credit-card accounts and lending records. Pure
 * client-side math, no new data model beyond what already exists.
 */
import { db } from '../db';
import { formatCurrency, formatDate, getIcon, escapeHtml } from '../utils';
import { withTierGate } from '../components/upgrade-gate';
import type { Account, LendingRecord } from '../types';

export async function renderLoanTools(): Promise<void> {
    return withTierGate('pro', 'Loan & Debt Tools', renderLoanToolsImpl);
}

type Tab = 'emi' | 'amortization' | 'payoff';
let activeTab: Tab = 'emi';

async function renderLoanToolsImpl(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="max-w-4xl mx-auto pb-20">
      <div class="mb-6">
        <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('calculator', 26)} Loan &amp; Debt Tools</h1>
        <p class="text-sm text-slate-400 mt-1">EMI/interest calculators, an amortization schedule, and a debt payoff planner.</p>
      </div>
      <div class="flex gap-2 mb-6 flex-wrap">
        <button data-tab="emi" class="tab-btn px-4 py-2 rounded-lg text-sm ${activeTab === 'emi' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">EMI &amp; Interest</button>
        <button data-tab="amortization" class="tab-btn px-4 py-2 rounded-lg text-sm ${activeTab === 'amortization' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Amortization Schedule</button>
        <button data-tab="payoff" class="tab-btn px-4 py-2 rounded-lg text-sm ${activeTab === 'payoff' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Debt Payoff Planner</button>
      </div>
      <div id="loan-tools-content"></div>
    </div>
  `;

    mainContent.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab as Tab;
            renderLoanTools();
        });
    });

    const content = document.getElementById('loan-tools-content')!;
    if (activeTab === 'emi') renderEmiCalculator(content);
    else if (activeTab === 'amortization') renderAmortization(content);
    else await renderPayoffPlanner(content);

    if ((window as any).lucide) (window as any).lucide.createIcons();
}

// EMI = P * r * (1+r)^n / ((1+r)^n - 1), where r is the monthly rate
function calcEmi(principal: number, annualRatePct: number, months: number): number {
    if (months <= 0) return 0;
    const r = annualRatePct / 12 / 100;
    if (r === 0) return principal / months;
    const factor = Math.pow(1 + r, months);
    return (principal * r * factor) / (factor - 1);
}

function renderEmiCalculator(content: HTMLElement): void {
    content.innerHTML = `
    <div class="glass-card p-5">
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="block text-sm font-medium mb-1">Loan Amount</label>
          <input type="number" id="emi-principal" value="1000000" min="0" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Annual Interest Rate (%)</label>
          <input type="number" id="emi-rate" value="9" min="0" step="0.01" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Tenure (months)</label>
          <input type="number" id="emi-months" value="60" min="1" class="glass-input w-full">
        </div>
      </div>
      <div id="emi-result" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6"></div>
    </div>
  `;

    const update = () => {
        const principal = parseFloat((document.getElementById('emi-principal') as HTMLInputElement).value) || 0;
        const rate = parseFloat((document.getElementById('emi-rate') as HTMLInputElement).value) || 0;
        const months = parseInt((document.getElementById('emi-months') as HTMLInputElement).value) || 0;
        const emi = calcEmi(principal, rate, months);
        const totalPayment = emi * months;
        const totalInterest = totalPayment - principal;

        document.getElementById('emi-result')!.innerHTML = `
      <div class="glass-card p-4 text-center">
        <p class="text-xs uppercase text-slate-400 mb-1">Monthly EMI</p>
        <p class="text-xl font-bold text-primary-400">${formatCurrency(emi)}</p>
      </div>
      <div class="glass-card p-4 text-center">
        <p class="text-xs uppercase text-slate-400 mb-1">Total Interest</p>
        <p class="text-xl font-bold">${formatCurrency(totalInterest)}</p>
      </div>
      <div class="glass-card p-4 text-center">
        <p class="text-xs uppercase text-slate-400 mb-1">Total Payment</p>
        <p class="text-xl font-bold">${formatCurrency(totalPayment)}</p>
      </div>
    `;
    };

    ['emi-principal', 'emi-rate', 'emi-months'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', update);
    });
    update();
}

function renderAmortization(content: HTMLElement): void {
    content.innerHTML = `
    <div class="glass-card p-5 mb-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="block text-sm font-medium mb-1">Loan Amount</label>
          <input type="number" id="amort-principal" value="1000000" min="0" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Annual Interest Rate (%)</label>
          <input type="number" id="amort-rate" value="9" min="0" step="0.01" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Tenure (months)</label>
          <input type="number" id="amort-months" value="12" min="1" max="600" class="glass-input w-full">
        </div>
      </div>
    </div>
    <div class="glass-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-slate-400 border-b border-white/10">
          <tr><th class="p-3">#</th><th class="p-3">Principal</th><th class="p-3">Interest</th><th class="p-3">EMI</th><th class="p-3">Balance</th></tr>
        </thead>
        <tbody id="amort-rows"></tbody>
      </table>
    </div>
  `;

    const update = () => {
        const principal = parseFloat((document.getElementById('amort-principal') as HTMLInputElement).value) || 0;
        const rate = parseFloat((document.getElementById('amort-rate') as HTMLInputElement).value) || 0;
        const months = Math.min(600, parseInt((document.getElementById('amort-months') as HTMLInputElement).value) || 0);
        const emi = calcEmi(principal, rate, months);
        const monthlyRate = rate / 12 / 100;

        let balance = principal;
        const rows: string[] = [];
        for (let i = 1; i <= months && balance > 0.01; i++) {
            const interest = balance * monthlyRate;
            const principalPaid = Math.min(emi - interest, balance);
            balance = Math.max(0, balance - principalPaid);
            rows.push(`
        <tr class="border-b border-white/5 last:border-0">
          <td class="p-3 text-slate-400">${i}</td>
          <td class="p-3">${formatCurrency(principalPaid)}</td>
          <td class="p-3">${formatCurrency(interest)}</td>
          <td class="p-3">${formatCurrency(emi)}</td>
          <td class="p-3">${formatCurrency(balance)}</td>
        </tr>
      `);
        }
        document.getElementById('amort-rows')!.innerHTML = rows.join('') || `<tr><td colspan="5" class="p-6 text-center text-slate-400">Enter loan details above.</td></tr>`;
    };

    ['amort-principal', 'amort-rate', 'amort-months'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', update);
    });
    update();
}

interface Debt { name: string; balance: number; rate: number; minPayment: number }

async function renderPayoffPlanner(content: HTMLElement): Promise<void> {
    const accounts = await db.getAccounts();
    const lendings = await db.getLendings(false); // unsettled only

    const debts: Debt[] = [
        ...accounts
            .filter((a: Account) => ['loan', 'credit-card'].includes(a.type) && a.balance > 0)
            .map((a: Account) => ({ name: a.name, balance: a.balance, rate: a.interestRate || 0, minPayment: a.emiAmount || Math.max(500, a.balance * 0.03) })),
        ...lendings
            .filter((l: LendingRecord) => l.direction === 'borrowed')
            .map((l: LendingRecord) => ({ name: `Owed to ${l.personName}`, balance: l.amount, rate: 0, minPayment: Math.max(500, l.amount * 0.1) })),
    ];

    content.innerHTML = `
    ${debts.length === 0 ? `
      <div class="glass-card p-8 text-center text-slate-400">
        ${getIcon('party-popper', 40, 'mx-auto mb-4 opacity-50')}
        <p>No outstanding debts found — nothing to plan.</p>
        <p class="text-xs mt-1">This looks at loan/credit-card accounts (Net Worth) and unsettled "borrowed" entries (Lending &amp; Debt).</p>
      </div>
    ` : `
      <div class="glass-card p-5 mb-4">
        <label class="block text-sm font-medium mb-1">Extra monthly payment (beyond minimums)</label>
        <input type="number" id="payoff-extra" value="0" min="0" class="glass-input w-full sm:w-64">
        <div class="flex gap-2 mt-3">
          <button data-strategy="avalanche" class="strategy-btn px-4 py-2 rounded-lg text-sm bg-primary-500 text-white">Avalanche (highest rate first)</button>
          <button data-strategy="snowball" class="strategy-btn px-4 py-2 rounded-lg text-sm glass-button-secondary">Snowball (smallest balance first)</button>
        </div>
      </div>
      <div id="payoff-result"></div>
    `}
  `;

    if (debts.length === 0) return;

    let strategy: 'avalanche' | 'snowball' = 'avalanche';

    const update = () => {
        const extra = parseFloat((document.getElementById('payoff-extra') as HTMLInputElement).value) || 0;
        const plan = simulatePayoff(debts, extra, strategy);
        document.getElementById('payoff-result')!.innerHTML = `
      <div class="glass-card p-5">
        <p class="text-sm text-slate-400 mb-3">Paying minimums on everything, plus ${formatCurrency(extra)}/month extra toward one debt at a time (${strategy}):</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div class="glass-card p-4 text-center"><p class="text-xs uppercase text-slate-400 mb-1">Debt-free in</p><p class="text-xl font-bold">${plan.months} month${plan.months === 1 ? '' : 's'}</p></div>
          <div class="glass-card p-4 text-center"><p class="text-xs uppercase text-slate-400 mb-1">Total Interest Paid</p><p class="text-xl font-bold">${formatCurrency(plan.totalInterest)}</p></div>
        </div>
        <h4 class="font-medium mb-2">Payoff order</h4>
        <ol class="text-sm space-y-1 list-decimal list-inside text-slate-300">
          ${plan.order.map(o => `<li>${escapeHtml(o.name)} — cleared month ${o.clearedMonth}</li>`).join('')}
        </ol>
      </div>
    `;
    };

    document.getElementById('payoff-extra')?.addEventListener('input', update);
    content.querySelectorAll<HTMLButtonElement>('.strategy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            strategy = btn.dataset.strategy as 'avalanche' | 'snowball';
            content.querySelectorAll('.strategy-btn').forEach(b => {
                b.classList.toggle('bg-primary-500', b === btn);
                b.classList.toggle('text-white', b === btn);
                b.classList.toggle('glass-button-secondary', b !== btn);
            });
            update();
        });
    });
    update();
}

/**
 * Simple month-by-month simulation: pay minimums on every debt, plus all
 * extra payment toward the debt prioritized by `strategy`, rolling a cleared
 * debt's minimum into the extra pool for the next one (avalanche/snowball).
 */
function simulatePayoff(debts: Debt[], extraPayment: number, strategy: 'avalanche' | 'snowball') {
    const remaining = debts.map(d => ({ ...d }));
    const order: { name: string; clearedMonth: number }[] = [];
    let month = 0;
    let totalInterest = 0;
    let extra = extraPayment;

    const pickTarget = () => {
        const active = remaining.filter(d => d.balance > 0.01);
        if (active.length === 0) return null;
        return strategy === 'avalanche'
            ? active.reduce((a, b) => (b.rate > a.rate ? b : a))
            : active.reduce((a, b) => (b.balance < a.balance ? b : a));
    };

    while (remaining.some(d => d.balance > 0.01) && month < 600) {
        month++;
        const target = pickTarget();
        for (const d of remaining) {
            if (d.balance <= 0.01) continue;
            const interest = (d.rate / 12 / 100) * d.balance;
            totalInterest += interest;
            const payment = d === target ? d.minPayment + extra : d.minPayment;
            const principalPaid = Math.min(payment - interest, d.balance);
            d.balance = Math.max(0, d.balance + interest - interest - principalPaid);
            if (d.balance <= 0.01 && !order.find(o => o.name === d.name)) {
                order.push({ name: d.name, clearedMonth: month });
                extra += d.minPayment; // roll the freed-up minimum into the extra pool
            }
        }
    }

    return { months: month, totalInterest, order };
}
