/**
 * Net Worth Page - Asset/Liability tracking with trend visualization
 */

import { db } from '../db';
import { formatCurrency, formatDate, getIcon, dateInputToISO } from '../utils';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { createChart } from '../components/charts';
import { withTierGate } from '../components/upgrade-gate';

const ACCOUNT_TYPES = [
  { value: 'savings', label: 'Savings Account', icon: 'landmark', group: 'asset' },
  { value: 'fd', label: 'Fixed Deposit', icon: 'lock', group: 'asset' },
  { value: 'ppf', label: 'PPF', icon: 'shield', group: 'asset' },
  { value: 'epf', label: 'EPF / PF', icon: 'building', group: 'asset' },
  { value: 'mutual-fund', label: 'Mutual Fund', icon: 'trending-up', group: 'asset' },
  { value: 'stocks', label: 'Stocks', icon: 'bar-chart-2', group: 'asset' },
  { value: 'gold', label: 'Gold', icon: 'circle', group: 'asset' },
  { value: 'property', label: 'Property', icon: 'home', group: 'asset' },
  { value: 'other', label: 'Other Asset', icon: 'box', group: 'asset' },
  { value: 'credit-card', label: 'Credit Card', icon: 'credit-card', group: 'liability' },
  { value: 'loan', label: 'Loan', icon: 'file-text', group: 'liability' },
];

const ASSET_COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#6366f1', '#14b8a6'];

function isLiability(type: string) { return ['credit-card', 'loan'].includes(type); }

export async function renderNetWorth(): Promise<void> {
  return withTierGate('pro', 'Net Worth tracking', renderNetWorthImpl);
}

async function renderNetWorthImpl(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const accounts = await db.getAccounts();
  const { totalAssets, totalLiabilities, netWorth } = await db.getNetWorthSummary();
  const history = await db.getNetWorthHistory();
  const transfers = await db.getTransfers(10);

  // Take snapshot for current month
  await db.snapshotNetWorth();

  const assets = accounts.filter((a: any) => !isLiability(a.type));
  const liabilities = accounts.filter((a: any) => isLiability(a.type));

  mainContent.innerHTML = `
    <div class="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-2">
            ${getIcon('wallet', 28)} Net Worth
          </h1>
          <p class="text-gray-400 text-sm mt-1">Track your complete financial picture</p>
        </div>
        <div class="flex gap-2">
          <button id="transfer-money-btn" class="glass-button-secondary px-4 py-2 rounded-xl flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium">
            ${getIcon('arrow-right-left', 18)} Transfer
          </button>
          <button id="add-account-btn" class="glass-button px-4 py-2 rounded-xl flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium">
            ${getIcon('plus', 18)} Add Account
          </button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="glass-card p-4 rounded-2xl text-center">
          <p class="text-xs text-gray-400 uppercase tracking-wider">Assets</p>
          <p class="text-xl font-bold text-emerald-400 mt-1">${formatCurrency(totalAssets)}</p>
        </div>
        <div class="glass-card p-4 rounded-2xl text-center">
          <p class="text-xs text-gray-400 uppercase tracking-wider">Liabilities</p>
          <p class="text-xl font-bold text-red-400 mt-1">${formatCurrency(totalLiabilities)}</p>
        </div>
        <div class="glass-card p-4 rounded-2xl text-center border-2 border-cyan-500/30">
          <p class="text-xs text-gray-400 uppercase tracking-wider">Net Worth</p>
          <p class="text-xl font-bold ${netWorth >= 0 ? 'text-cyan-400' : 'text-red-400'} mt-1">${formatCurrency(netWorth)}</p>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid md:grid-cols-2 gap-4">
        <!-- Net Worth Trend -->
        <div class="glass-card p-5 rounded-2xl">
          <h3 class="text-sm font-semibold text-white mb-3">Net Worth Trend</h3>
          <div class="h-[220px]"><canvas id="nw-trend-chart"></canvas></div>
          ${history.length < 2 ? '<p class="text-xs text-gray-500 text-center mt-2">More data points needed for trend</p>' : ''}
        </div>
        <!-- Asset Allocation -->
        <div class="glass-card p-5 rounded-2xl">
          <h3 class="text-sm font-semibold text-white mb-3">Asset Allocation</h3>
          <div class="h-[220px]"><canvas id="allocation-chart"></canvas></div>
          ${assets.length === 0 ? '<p class="text-xs text-gray-500 text-center mt-2">Add accounts to see allocation</p>' : ''}
        </div>
      </div>

      <!-- Assets List -->
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-emerald-400 flex items-center gap-2">${getIcon('trending-up', 20)} Assets (${assets.length})</h2>
        ${assets.length === 0 ? `
        <div class="glass-card p-6 rounded-xl text-center text-gray-400">No assets added yet</div>
        ` : `
        <div class="space-y-2">
          ${assets.map((a: any) => {
    const meta = ACCOUNT_TYPES.find(t => t.value === a.type);
    return `
            <div class="glass-card p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  ${getIcon(meta?.icon || 'box', 18)}
                </div>
                <div>
                  <p class="font-medium text-white">${a.name}</p>
                  <p class="text-xs text-gray-400">${meta?.label || a.type}${a.interestRate ? ` · ${a.interestRate}% p.a.` : ''}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-lg font-bold text-emerald-400">${formatCurrency(a.balance)}</span>
                <div class="flex gap-1">
                  <button class="edit-account p-1.5 rounded-lg hover:bg-white/10 text-gray-400" data-id="${a.id}">${getIcon('pencil', 14)}</button>
                  <button class="delete-account p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400" data-id="${a.id}">${getIcon('trash-2', 14)}</button>
                </div>
              </div>
            </div>`;
  }).join('')}
        </div>
        `}
      </div>

      <!-- Liabilities List -->
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-red-400 flex items-center gap-2">${getIcon('trending-down', 20)} Liabilities (${liabilities.length})</h2>
        ${liabilities.length === 0 ? `
        <div class="glass-card p-6 rounded-xl text-center text-gray-400">No liabilities — great job!</div>
        ` : `
        <div class="space-y-2">
          ${liabilities.map((a: any) => {
    const meta = ACCOUNT_TYPES.find(t => t.value === a.type);
    const utilization = a.type === 'credit-card' && a.creditLimit ? Math.min(Math.round((Math.abs(a.balance) / a.creditLimit) * 100), 100) : null;
    const dueSoon = a.dueDate && new Date(a.dueDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return `
            <div class="glass-card p-4 rounded-xl hover:bg-white/10 transition-colors">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    ${getIcon(meta?.icon || 'file-text', 18)}
                  </div>
                  <div>
                    <p class="font-medium text-white">${a.name}</p>
                    <p class="text-xs text-gray-400">
                      ${meta?.label || a.type}${a.interestRate ? ` · ${a.interestRate}% p.a.` : ''}
                      ${a.emiAmount ? ` · EMI ${formatCurrency(a.emiAmount)}` : ''}
                      ${a.dueDate ? ` · <span class="${dueSoon ? 'text-amber-400' : ''}">Due ${formatDate(a.dueDate)}</span>` : ''}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-lg font-bold text-red-400">-${formatCurrency(Math.abs(a.balance))}</span>
                  <div class="flex gap-1">
                    <button class="pay-liability p-1.5 rounded-lg hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400" data-id="${a.id}" aria-label="${a.type === 'loan' ? 'Pay EMI' : 'Pay Bill'}">${getIcon('banknote', 14)}</button>
                    <button class="edit-account p-1.5 rounded-lg hover:bg-white/10 text-gray-400" data-id="${a.id}">${getIcon('pencil', 14)}</button>
                    <button class="delete-account p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400" data-id="${a.id}">${getIcon('trash-2', 14)}</button>
                  </div>
                </div>
              </div>
              ${utilization !== null ? `
                <div class="mt-3">
                  <div class="flex justify-between text-xs text-gray-400 mb-1">
                    <span>${utilization}% of ${formatCurrency(a.creditLimit)} limit used</span>
                  </div>
                  <div class="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${utilization >= 90 ? 'bg-red-500' : utilization >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${utilization}%"></div>
                  </div>
                </div>
              ` : ''}
            </div>`;
  }).join('')}
        </div>
        `}
      </div>

      <!-- Recent Transfers -->
      ${transfers.length > 0 ? `
        <div class="space-y-3">
          <h2 class="text-lg font-semibold text-cyan-400 flex items-center gap-2">${getIcon('arrow-right-left', 20)} Recent Transfers</h2>
          <div class="space-y-2">
            ${transfers.map((t: any) => {
      const from = accounts.find((a: any) => a.id === t.fromAccountId);
      const to = accounts.find((a: any) => a.id === t.toAccountId);
      return `
                <div class="glass-card p-3 rounded-xl flex items-center justify-between text-sm">
                  <span class="text-gray-300">${from?.name || 'Unknown'} ${getIcon('arrow-right', 12)} ${to?.name || 'Unknown'}${t.notes ? ` · ${t.notes}` : ''}</span>
                  <div class="flex items-center gap-3">
                    <span class="text-gray-400 text-xs">${formatDate(t.date)}</span>
                    <span class="font-semibold text-cyan-400">${formatCurrency(t.amount)}</span>
                  </div>
                </div>`;
    }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Charts
  if (history.length >= 1) {
    createChart('nw-trend-chart', 'line', {
      labels: history.map((h: any) => h.date.slice(0, 7)),
      datasets: [
        { label: 'Net Worth', data: history.map((h: any) => h.netWorth), borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4 },
        { label: 'Assets', data: history.map((h: any) => h.totalAssets), borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.4, borderDash: [5, 5] },
      ],
    }, { plugins: { legend: { labels: { color: '#9ca3af' } } }, scales: { x: { ticks: { color: '#6b7280' } }, y: { ticks: { color: '#6b7280' } } } });
  }

  if (assets.length > 0) {
    createChart('allocation-chart', 'doughnut', {
      labels: assets.map((a: any) => a.name),
      datasets: [{ data: assets.map((a: any) => a.balance), backgroundColor: ASSET_COLORS.slice(0, assets.length), borderWidth: 0 }],
    }, { plugins: { legend: { position: 'right', labels: { color: '#9ca3af', boxWidth: 12 } } } });
  }

  // Events
  document.getElementById('add-account-btn')?.addEventListener('click', () => openAccountModal());
  document.getElementById('transfer-money-btn')?.addEventListener('click', () => openTransferModal(accounts));
  mainContent.querySelectorAll('.edit-account').forEach(btn => {
    btn.addEventListener('click', () => {
      const account = accounts.find((a: any) => a.id === (btn as HTMLElement).dataset.id);
      if (account) openAccountModal(account);
    });
  });
  mainContent.querySelectorAll('.delete-account').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this account?')) {
        await db.deleteAccount((btn as HTMLElement).dataset.id!);
        showToast('Account deleted', { type: 'success' });
        renderNetWorth();
      }
    });
  });
  mainContent.querySelectorAll('.pay-liability').forEach(btn => {
    btn.addEventListener('click', () => {
      const account = accounts.find((a: any) => a.id === (btn as HTMLElement).dataset.id);
      if (account) openTransferModal(accounts, account);
    });
  });
}

/**
 * Transfer money between two accounts (also used as "Pay Bill" / "Pay EMI"
 * by pre-selecting a liability account as the destination).
 */
function openTransferModal(accounts: any[], toAccount?: any): void {
  const accountOptions = (selectedId?: string) => accounts.map((a: any) =>
    `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${a.name} (${formatCurrency(a.balance)})</option>`
  ).join('');

  const form = document.createElement('form');
  form.className = 'space-y-4';
  form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">From</label>
      <select name="fromAccountId" required class="glass-input w-full">
        <option value="">Select account...</option>
        ${accountOptions()}
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">To</label>
      <select name="toAccountId" required class="glass-input w-full">
        <option value="">Select account...</option>
        ${accountOptions(toAccount?.id)}
      </select>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Amount</label>
        <input type="number" name="amount" required min="0.01" step="0.01" value="${toAccount?.emiAmount || ''}" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Date</label>
        <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="glass-input w-full">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Notes (optional)</label>
      <input type="text" name="notes" class="glass-input w-full" placeholder="e.g., ${toAccount?.type === 'loan' ? 'EMI payment' : toAccount?.type === 'credit-card' ? 'Bill payment' : ''}">
    </div>
  `;

  const footer = document.createElement('div');
  footer.className = 'flex gap-3 justify-end';
  footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${toAccount ? 'Pay' : 'Transfer'}</button>
  `;

  const close = showModal({ title: toAccount ? `Pay ${toAccount.name}` : 'Transfer Money', content: form, footer });
  footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const fromAccountId = formData.get('fromAccountId') as string;
    const toAccountId = formData.get('toAccountId') as string;

    if (fromAccountId === toAccountId) {
      showToast('Choose two different accounts', { type: 'error' });
      return;
    }

    try {
      await db.createTransfer({
        fromAccountId,
        toAccountId,
        amount: parseFloat(formData.get('amount') as string),
        date: dateInputToISO(formData.get('date') as string),
        notes: (formData.get('notes') as string) || undefined,
      });
      showToast('Transfer recorded', { type: 'success' });
      close();
      renderNetWorth();
    } catch (error) {
      console.error(error);
      showToast('Failed to record transfer', { type: 'error' });
    }
  });
}

async function openAccountModal(existing?: any): Promise<void> {
  const isEdit = !!existing;
  const html = `
    <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <h3 class="text-lg font-semibold text-white">${isEdit ? 'Edit Account' : 'Add Account'}</h3>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Account Name *</label>
        <input type="text" id="acc-name" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.name || ''}" placeholder="e.g., SBI Savings">
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Type</label>
        <select id="acc-type" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white">
          <optgroup label="Assets">
            ${ACCOUNT_TYPES.filter(t => t.group === 'asset').map(t => `<option value="${t.value}" ${existing?.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </optgroup>
          <optgroup label="Liabilities">
            ${ACCOUNT_TYPES.filter(t => t.group === 'liability').map(t => `<option value="${t.value}" ${existing?.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Balance (₹) *</label>
          <input type="number" id="acc-balance" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.balance || ''}" step="0.01">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Interest Rate (%)</label>
          <input type="number" id="acc-rate" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.interestRate || ''}" step="0.1" min="0">
        </div>
      </div>
      <div id="acc-liability-fields" class="grid grid-cols-2 gap-3 ${existing && !['credit-card', 'loan'].includes(existing.type) ? 'hidden' : ''}">
        <div id="acc-credit-limit-field" class="${existing?.type !== 'credit-card' ? 'hidden' : ''}">
          <label class="block text-sm text-gray-400 mb-1">Credit Limit (₹)</label>
          <input type="number" id="acc-credit-limit" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.creditLimit || ''}" step="1" min="0">
        </div>
        <div id="acc-emi-field" class="${existing?.type !== 'loan' ? 'hidden' : ''}">
          <label class="block text-sm text-gray-400 mb-1">EMI Amount (₹)</label>
          <input type="number" id="acc-emi" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.emiAmount || ''}" step="1" min="0">
        </div>
        <div class="col-span-2">
          <label class="block text-sm text-gray-400 mb-1">Next Due Date</label>
          <input type="date" id="acc-due-date" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.dueDate ? existing.dueDate.split('T')[0] : ''}">
        </div>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Notes</label>
        <textarea id="acc-notes" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" rows="2">${existing?.notes || ''}</textarea>
      </div>
      <div class="flex gap-3 pt-2">
        <button id="save-account" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold">${isEdit ? 'Update' : 'Add'}</button>
        <button id="cancel-account" class="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold">Cancel</button>
      </div>
    </div>
  `;
  const closeModal = showModal({
    title: isEdit ? 'Edit Account' : 'Add Account',
    content: html
  });

  const typeSelect = document.getElementById('acc-type') as HTMLSelectElement;
  const toggleLiabilityFields = () => {
    const type = typeSelect.value;
    document.getElementById('acc-liability-fields')?.classList.toggle('hidden', !['credit-card', 'loan'].includes(type));
    document.getElementById('acc-credit-limit-field')?.classList.toggle('hidden', type !== 'credit-card');
    document.getElementById('acc-emi-field')?.classList.toggle('hidden', type !== 'loan');
  };
  typeSelect.addEventListener('change', toggleLiabilityFields);

  document.getElementById('save-account')?.addEventListener('click', async () => {
    const name = (document.getElementById('acc-name') as HTMLInputElement).value.trim();
    const type = (document.getElementById('acc-type') as HTMLSelectElement).value;
    const balance = parseFloat((document.getElementById('acc-balance') as HTMLInputElement).value);
    const interestRate = parseFloat((document.getElementById('acc-rate') as HTMLInputElement).value) || 0;
    const notes = (document.getElementById('acc-notes') as HTMLTextAreaElement).value.trim() || undefined;
    const creditLimitRaw = (document.getElementById('acc-credit-limit') as HTMLInputElement).value;
    const emiRaw = (document.getElementById('acc-emi') as HTMLInputElement).value;
    const dueDateRaw = (document.getElementById('acc-due-date') as HTMLInputElement).value;

    if (!name || isNaN(balance)) { showToast('Name and balance required', { type: 'error' }); return; }

    const extra = {
      creditLimit: type === 'credit-card' && creditLimitRaw ? parseFloat(creditLimitRaw) : undefined,
      emiAmount: type === 'loan' && emiRaw ? parseFloat(emiRaw) : undefined,
      dueDate: ['credit-card', 'loan'].includes(type) && dueDateRaw ? new Date(dueDateRaw).toISOString() : undefined,
    };

    if (isEdit) {
      await db.updateAccount(existing.id, { name, type, balance, interestRate, notes, ...extra });
      showToast('Account updated!', { type: 'success' });
    } else {
      await db.createAccount({ name, type, balance, interestRate, notes, ...extra });
      showToast('Account added!', { type: 'success' });
    }
    closeModal();
    renderNetWorth();
  });

  document.getElementById('cancel-account')?.addEventListener('click', () => closeModal());
}
