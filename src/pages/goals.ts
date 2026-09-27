/**
 * Goals Page - Financial goals with progress tracking
 */

import { db } from '../db';
import { formatCurrency, getIcon, escapeHtml } from '../utils';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';

const GOAL_TYPES = [
  { value: 'emergency-fund', label: 'Emergency Fund', icon: 'shield', color: '#ef4444' },
  { value: 'home-purchase', label: 'Home Down-Payment', icon: 'home', color: '#f59e0b' },
  { value: 'education', label: 'Child Education', icon: 'graduation-cap', color: '#3b82f6' },
  { value: 'wedding', label: 'Wedding', icon: 'heart', color: '#ec4899' },
  { value: 'car', label: 'Car Purchase', icon: 'car', color: '#8b5cf6' },
  { value: 'vacation', label: 'Vacation', icon: 'plane', color: '#06b6d4' },
  { value: 'retirement', label: 'Retirement', icon: 'sunset', color: '#f97316' },
  { value: 'debt-payoff', label: 'Debt Payoff', icon: 'trending-down', color: '#10b981' },
  { value: 'custom', label: 'Custom Goal', icon: 'target', color: '#6366f1' },
];

function getGoalColor(type: string): string {
  return GOAL_TYPES.find(g => g.value === type)?.color || '#6366f1';
}

function getGoalIcon(type: string): string {
  return GOAL_TYPES.find(g => g.value === type)?.icon || 'target';
}

export async function renderGoals(): Promise<void> {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const goals = await db.getGoals();

  const activeGoals = goals.filter((g: any) => !g.completed);
  const completedGoals = goals.filter((g: any) => g.completed);
  const totalTarget = activeGoals.reduce((s: number, g: any) => s + g.targetAmount, 0);
  const totalSaved = activeGoals.reduce((s: number, g: any) => s + g.currentAmount, 0);

  mainContent.innerHTML = `
    <div class="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-2">
            ${getIcon('target', 28)} Financial Goals
          </h1>
          <p class="text-gray-400 text-sm mt-1">${activeGoals.length} active goals · ${formatCurrency(totalSaved)} saved of ${formatCurrency(totalTarget)}</p>
        </div>
        <button id="add-goal-btn" class="glass-button px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium">
          ${getIcon('plus', 18)} New Goal
        </button>
      </div>

      <!-- Overall Progress -->
      ${totalTarget > 0 ? `
      <div class="glass-card p-5 rounded-2xl">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-400">Overall Progress</span>
          <span class="text-sm font-semibold text-emerald-400">${Math.round(totalSaved / totalTarget * 100)}%</span>
        </div>
        <div class="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style="width:${Math.min(100, totalSaved / totalTarget * 100)}%"></div>
        </div>
      </div>
      ` : ''}

      <!-- Active Goals -->
      <div class="space-y-4">
        <h2 class="text-lg font-semibold text-white">Active Goals</h2>
        ${activeGoals.length === 0 ? `
        <div class="glass-card p-8 rounded-2xl text-center">
          <div class="text-6xl mb-4">🎯</div>
          <p class="text-gray-400">No goals yet. Start by creating your first financial goal!</p>
        </div>
        ` : `
        <div class="grid gap-4 md:grid-cols-2">
          ${activeGoals.map((g: any) => {
    const pct = g.targetAmount > 0 ? Math.round(g.currentAmount / g.targetAmount * 100) : 0;
    const color = getGoalColor(g.type);
    const daysLeft = g.targetDate ? Math.max(0, Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000)) : null;
    return `
            <div class="glass-card p-5 rounded-2xl border-l-4 hover:bg-white/10 transition-colors" style="border-color:${color}">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${color}20;color:${color}">
                    ${getIcon(getGoalIcon(g.type), 20)}
                  </div>
                  <div>
                    <h3 class="font-semibold text-white">${escapeHtml(g.name)}</h3>
                    <span class="text-xs px-2 py-0.5 rounded-full capitalize" style="background:${color}20;color:${color}">${g.priority} priority</span>
                  </div>
                </div>
                <div class="flex gap-1">
                  <button class="edit-goal p-1.5 rounded-lg hover:bg-white/10 text-gray-400" data-id="${g.id}">${getIcon('pencil', 14)}</button>
                  <button class="delete-goal p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400" data-id="${g.id}">${getIcon('trash-2', 14)}</button>
                </div>
              </div>
              <div class="flex items-end justify-between mb-2">
                <div>
                  <span class="text-2xl font-bold text-white">${formatCurrency(g.currentAmount)}</span>
                  <span class="text-gray-400 text-sm"> / ${formatCurrency(g.targetAmount)}</span>
                </div>
                <span class="text-lg font-bold" style="color:${color}">${pct}%</span>
              </div>
              <div class="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full transition-all" style="width:${Math.min(100, pct)}%;background:${color}"></div>
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500">
                ${daysLeft !== null ? `<span>${daysLeft} days left</span>` : '<span>No deadline</span>'}
                <button class="add-funds text-emerald-400 font-medium hover:underline" data-id="${g.id}" data-name="${escapeHtml(g.name)}">+ Add Funds</button>
              </div>
              ${g.notes ? `<p class="text-xs text-gray-500 mt-2 line-clamp-1">${escapeHtml(g.notes)}</p>` : ''}
            </div>`;
  }).join('')}
        </div>
        `}
      </div>

      <!-- Completed Goals -->
      ${completedGoals.length > 0 ? `
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">${getIcon('check-circle', 20)} Completed</h2>
        <div class="grid gap-3 md:grid-cols-2">
          ${completedGoals.map((g: any) => `
          <div class="glass-card p-4 rounded-xl opacity-70">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">${getIcon('check', 16)}</div>
              <div>
                <h3 class="font-medium text-white line-through">${escapeHtml(g.name)}</h3>
                <span class="text-xs text-gray-400">${formatCurrency(g.targetAmount)} achieved</span>
              </div>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;

  // Event listeners
  document.getElementById('add-goal-btn')?.addEventListener('click', () => openGoalModal());
  mainContent.querySelectorAll('.edit-goal').forEach(btn => {
    btn.addEventListener('click', () => {
      const goal = goals.find((g: any) => g.id === (btn as HTMLElement).dataset.id);
      if (goal) openGoalModal(goal);
    });
  });
  mainContent.querySelectorAll('.delete-goal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      if (confirm('Delete this goal?')) {
        await db.deleteGoal(id);
        showToast('Goal deleted', { type: 'success' });
        renderGoals();
      }
    });
  });
  mainContent.querySelectorAll('.add-funds').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      const name = (btn as HTMLElement).dataset.name!;
      openAddFundsModal(id, name);
    });
  });
}

async function openAddFundsModal(goalId: string, goalName: string): Promise<void> {
  const html = `
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-white">Add Funds to "${escapeHtml(goalName)}"</h3>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Amount (₹)</label>
        <input type="number" id="fund-amount" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" placeholder="Enter amount" min="1">
      </div>
      <div class="flex gap-3">
        <button id="save-funds" class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors">Add</button>
        <button id="cancel-funds" class="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors">Cancel</button>
      </div>
    </div>
  `;
  const closeModal = showModal({
    title: `Add Funds to "${escapeHtml(goalName)}"`,
    content: html
  });
  document.getElementById('save-funds')?.addEventListener('click', async () => {
    const amount = parseFloat((document.getElementById('fund-amount') as HTMLInputElement).value);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', { type: 'error' }); return; }
    const goals = await db.getGoals();
    const goal = goals.find((g: any) => g.id === goalId);
    if (!goal) return;
    const newAmount = (goal.currentAmount || 0) + amount;
    const updates: any = { currentAmount: newAmount };
    const justCompleted = !goal.completed && newAmount >= goal.targetAmount;
    if (justCompleted) updates.completed = true;
    await db.updateGoal(goalId, updates);
    closeModal();
    if (justCompleted) {
      const { celebrate } = await import('../components/celebration');
      celebrate(`🎉 Goal "${goal.name}" complete!`);
    } else {
      showToast(`₹${amount.toLocaleString('en-IN')} added!`, { type: 'success' });
    }
    renderGoals();
  });
  document.getElementById('cancel-funds')?.addEventListener('click', () => closeModal());
}

async function openGoalModal(existing?: any): Promise<void> {
  const isEdit = !!existing;
  const html = `
    <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <h3 class="text-lg font-semibold text-white">${isEdit ? 'Edit Goal' : 'Create New Goal'}</h3>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Goal Name *</label>
        <input type="text" id="goal-name" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${escapeHtml(existing?.name)}" placeholder="e.g., Home Down-Payment">
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Goal Type</label>
        <select id="goal-type" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white">
          ${GOAL_TYPES.map(t => `<option value="${t.value}" ${existing?.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Target Amount (₹) *</label>
          <input type="number" id="goal-target" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.targetAmount || ''}" min="1">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Target Date</label>
          <input type="date" id="goal-date" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" value="${existing?.targetDate?.split('T')[0] || ''}">
        </div>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Priority</label>
        <div class="flex gap-2">
          ${['high', 'medium', 'low'].map(p => `
            <button type="button" class="priority-btn flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${(existing?.priority || 'medium') === p ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}" data-priority="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</button>
          `).join('')}
        </div>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Notes</label>
        <textarea id="goal-notes" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" rows="2" placeholder="Optional notes...">${escapeHtml(existing?.notes)}</textarea>
      </div>
      <div class="flex gap-3 pt-2">
        <button id="save-goal" class="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold transition-colors">${isEdit ? 'Update' : 'Create'} Goal</button>
        <button id="cancel-goal" class="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors">Cancel</button>
      </div>
    </div>
  `;
  const closeModal = showModal({
    title: isEdit ? 'Edit Goal' : 'Create New Goal',
    content: html
  });

  let selectedPriority = existing?.priority || 'medium';
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPriority = (btn as HTMLElement).dataset.priority!;
      document.querySelectorAll('.priority-btn').forEach(b => {
        b.classList.toggle('bg-emerald-600', (b as HTMLElement).dataset.priority === selectedPriority);
        b.classList.toggle('text-white', (b as HTMLElement).dataset.priority === selectedPriority);
        b.classList.toggle('bg-white/10', (b as HTMLElement).dataset.priority !== selectedPriority);
        b.classList.toggle('text-gray-400', (b as HTMLElement).dataset.priority !== selectedPriority);
      });
    });
  });

  document.getElementById('save-goal')?.addEventListener('click', async () => {
    const name = (document.getElementById('goal-name') as HTMLInputElement).value.trim();
    const type = (document.getElementById('goal-type') as HTMLSelectElement).value;
    const targetAmount = parseFloat((document.getElementById('goal-target') as HTMLInputElement).value);
    const targetDate = (document.getElementById('goal-date') as HTMLInputElement).value || undefined;
    const notes = (document.getElementById('goal-notes') as HTMLTextAreaElement).value.trim() || undefined;

    if (!name || !targetAmount) {
      showToast('Name and target amount are required', { type: 'error' });
      return;
    }

    if (isEdit) {
      await db.updateGoal(existing.id, { name, type, targetAmount, targetDate, priority: selectedPriority, notes });
      showToast('Goal updated!', { type: 'success' });
    } else {
      await db.createGoal({ name, type, targetAmount, targetDate, priority: selectedPriority, notes });
      showToast('Goal created!', { type: 'success' });
    }
    closeModal();
    renderGoals();
  });

  document.getElementById('cancel-goal')?.addEventListener('click', () => closeModal());
}
