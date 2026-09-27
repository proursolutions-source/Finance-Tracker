/**
 * Investments — Portfolio view and a manual buy/sell/dividend transaction
 * ledger against the existing investment-type Net Worth accounts
 * (mutual-fund/stocks/gold/property). There is no live market-data feed here:
 * an account's balance stays a manually-updated valuation, same as it always
 * has been under Net Worth. This page adds the transaction history and a
 * simple invested-vs-current gain/loss view on top of that.
 */
import { db } from '../db';
import { formatCurrency, formatDate, getIcon, dateInputToISO, escapeHtml } from '../utils';
import { showToast } from '../components/toast';
import { showModal, showConfirm } from '../components/modal';
import { withTierGate } from '../components/upgrade-gate';
import type { Account, InvestmentTransaction } from '../types';

const INVESTMENT_TYPES = ['mutual-fund', 'stocks', 'gold', 'property'] as const;

export async function renderInvestments(): Promise<void> {
    return withTierGate('pro', 'Investments', renderInvestmentsImpl);
}

async function renderInvestmentsImpl(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const accounts = (await db.getAccounts()).filter((a: Account) => INVESTMENT_TYPES.includes(a.type as any));
    const allTxns = await db.getInvestmentTransactions();

    const holdingSummary = accounts.map(acc => {
        const txns = allTxns.filter(t => t.accountId === acc.id);
        const invested = txns.reduce((sum, t) => sum + (t.type === 'buy' ? t.amount : t.type === 'sell' ? -t.amount : 0), 0);
        const currentValue = acc.balance;
        const gain = currentValue - invested;
        const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
        return { acc, invested, currentValue, gain, gainPct, txnCount: txns.length };
    });

    const totalInvested = holdingSummary.reduce((s, h) => s + h.invested, 0);
    const totalCurrent = holdingSummary.reduce((s, h) => s + h.currentValue, 0);
    const totalGain = totalCurrent - totalInvested;

    mainContent.innerHTML = `
    <div class="max-w-5xl mx-auto pb-20">
      <div class="mb-6">
        <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('trending-up', 26)} Investments</h1>
        <p class="text-sm text-slate-400 mt-1">Manual portfolio tracking — no live market prices, you keep account values up to date under Net Worth.</p>
      </div>

      ${accounts.length === 0 ? `
        <div class="glass-card p-8 text-center text-slate-400">
          ${getIcon('trending-up', 40, 'mx-auto mb-4 opacity-50')}
          <p>No investment accounts yet.</p>
          <p class="text-sm mt-1">Add a Mutual Fund, Stocks, Gold, or Property account under <a href="#/networth" class="text-primary-400 hover:underline">Net Worth</a> to start tracking it here.</p>
        </div>
      ` : `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div class="glass-card p-5">
            <p class="text-xs uppercase text-slate-400 mb-1">Invested</p>
            <p class="text-2xl font-bold">${formatCurrency(totalInvested)}</p>
          </div>
          <div class="glass-card p-5">
            <p class="text-xs uppercase text-slate-400 mb-1">Current Value</p>
            <p class="text-2xl font-bold">${formatCurrency(totalCurrent)}</p>
          </div>
          <div class="glass-card p-5">
            <p class="text-xs uppercase text-slate-400 mb-1">Gain / Loss</p>
            <p class="text-2xl font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}">${totalGain >= 0 ? '+' : ''}${formatCurrency(totalGain)}</p>
          </div>
        </div>

        <div class="space-y-3">
          ${holdingSummary.map(h => `
            <div class="glass-card p-5">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <h3 class="font-semibold">${escapeHtml(h.acc.name)}</h3>
                  <p class="text-xs text-slate-500 capitalize">${h.acc.type.replace('-', ' ')} &middot; ${h.txnCount} transaction${h.txnCount === 1 ? '' : 's'}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold">${formatCurrency(h.currentValue)}</p>
                  ${h.invested > 0 ? `<p class="text-xs ${h.gain >= 0 ? 'text-green-400' : 'text-red-400'}">${h.gain >= 0 ? '+' : ''}${formatCurrency(h.gain)} (${h.gainPct >= 0 ? '+' : ''}${h.gainPct.toFixed(1)}%)</p>` : ''}
                </div>
              </div>
              <button class="add-txn-btn text-primary-400 text-sm hover:underline" data-account-id="${h.acc.id}" data-account-name="${escapeHtml(h.acc.name)}">+ Log a transaction</button>
            </div>
          `).join('')}
        </div>

        <div class="mt-8">
          <h2 class="text-lg font-semibold mb-3">Transaction History</h2>
          <div class="glass-card overflow-hidden">
            <table class="w-full text-sm">
              <thead class="text-left text-slate-400 border-b border-white/10">
                <tr><th class="p-3">Account</th><th class="p-3">Type</th><th class="p-3">Date</th><th class="p-3">Amount</th><th class="p-3"></th></tr>
              </thead>
              <tbody>
                ${allTxns.length === 0 ? `<tr><td colspan="5" class="p-6 text-center text-slate-400">No transactions logged yet.</td></tr>` : allTxns.map(t => {
        const acc = accounts.find(a => a.id === t.accountId);
        return `
                  <tr class="border-b border-white/5 last:border-0">
                    <td class="p-3">${escapeHtml(acc?.name) || 'Unknown'}</td>
                    <td class="p-3 capitalize">${t.type}</td>
                    <td class="p-3 text-slate-400">${formatDate(t.date)}</td>
                    <td class="p-3">${formatCurrency(t.amount)}</td>
                    <td class="p-3"><button class="delete-txn-btn text-red-400 hover:underline text-xs" data-id="${t.id}">Delete</button></td>
                  </tr>
                `;
    }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    mainContent.querySelectorAll<HTMLButtonElement>('.add-txn-btn').forEach(btn => {
        btn.addEventListener('click', () => openTransactionModal(btn.dataset.accountId!, btn.dataset.accountName!));
    });

    mainContent.querySelectorAll<HTMLButtonElement>('.delete-txn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showConfirm('Delete Transaction', 'Remove this investment transaction? This does not change the account\'s current balance.', async () => {
                await db.deleteInvestmentTransaction(btn.dataset.id!);
                showToast('Transaction deleted', { type: 'success' });
                renderInvestments();
            });
        });
    });
}

function openTransactionModal(accountId: string, accountName: string): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <p class="text-sm text-slate-400">Logging a transaction for <strong>${escapeHtml(accountName)}</strong>.</p>
    <div>
      <label class="block text-sm font-medium mb-1">Type</label>
      <select name="type" class="glass-input w-full">
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
        <option value="dividend">Dividend</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Amount</label>
        <input type="number" name="amount" required min="0.01" step="0.01" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Date</label>
        <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" class="glass-input w-full">
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Quantity (optional)</label>
        <input type="number" name="quantity" step="0.0001" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Price / unit (optional)</label>
        <input type="number" name="pricePerUnit" step="0.01" class="glass-input w-full">
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
    <button type="submit" class="glass-button">Save</button>
  `;

    const close = showModal({ title: 'Log Investment Transaction', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const txn: Omit<InvestmentTransaction, 'id' | 'createdAt'> = {
            accountId,
            type: formData.get('type') as InvestmentTransaction['type'],
            amount: parseFloat(formData.get('amount') as string),
            date: dateInputToISO(formData.get('date') as string),
            quantity: formData.get('quantity') ? parseFloat(formData.get('quantity') as string) : undefined,
            pricePerUnit: formData.get('pricePerUnit') ? parseFloat(formData.get('pricePerUnit') as string) : undefined,
            notes: (formData.get('notes') as string || '').trim() || undefined,
        };
        try {
            await db.createInvestmentTransaction(txn);
            showToast('Transaction logged', { type: 'success' });
            close();
            renderInvestments();
        } catch (error) {
            console.error(error);
            showToast('Failed to save transaction', { type: 'error' });
        }
    });
}
