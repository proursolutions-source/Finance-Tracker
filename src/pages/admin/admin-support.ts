/**
 * Admin: Support — view and reply to user-submitted support tickets.
 */
import { withAdminGuard, adminTabs } from './admin-guard';
import { adminListSupportTickets, adminReplyToTicket } from '../../cloud/growth';
import { formatDate, getIcon, escapeHtml } from '../../utils';
import { showToast } from '../../components/toast';
import { showModal } from '../../components/modal';
import type { SupportTicket } from '../../cloud/growth';

export async function renderAdminSupport(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="admin-root" class="max-w-5xl mx-auto pb-20"></div>`;
    const root = document.getElementById('admin-root')!;

    await withAdminGuard(root, async () => {
        try {
            const tickets = await adminListSupportTickets();
            render(root, tickets);
        } catch (error) {
            console.error('[Admin Support] Error:', error);
            root.innerHTML = `<div class="glass-card p-6 text-red-400">Failed to load tickets.</div>`;
        }
    });
}

function render(root: HTMLElement, tickets: SupportTicket[]): void {
    const open = tickets.filter(t => t.status === 'open');

    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('shield', 26)} Admin Portal</h1>
      <p class="text-sm text-slate-400 mt-1">MoneyFlow subscription &amp; user management.</p>
    </div>
    ${adminTabs('support')}

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div class="glass-card p-5"><p class="text-xs uppercase text-slate-400 mb-1">Open Tickets</p><p class="text-2xl font-bold text-yellow-400">${open.length}</p></div>
      <div class="glass-card p-5"><p class="text-xs uppercase text-slate-400 mb-1">Total Tickets</p><p class="text-2xl font-bold">${tickets.length}</p></div>
    </div>

    <div class="glass-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-slate-400 border-b border-white/10">
          <tr><th class="p-4">Subject</th><th class="p-4">Status</th><th class="p-4">Submitted</th><th class="p-4"></th></tr>
        </thead>
        <tbody>
          ${tickets.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-slate-400">No tickets.</td></tr>` : tickets.map(t => `
            <tr class="border-b border-white/5 last:border-0">
              <td class="p-4">${escapeHtml(t.subject)}</td>
              <td class="p-4"><span class="px-2 py-0.5 rounded-full text-xs ${t.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">${t.status}</span></td>
              <td class="p-4 text-slate-400">${formatDate(t.createdAt)}</td>
              <td class="p-4"><button class="reply-btn text-primary-400 hover:underline text-xs" data-id="${t.id}">Reply</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    root.querySelectorAll<HTMLButtonElement>('.reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ticket = tickets.find(t => t.id === btn.dataset.id)!;
            openReplyModal(ticket);
        });
    });
}

function openReplyModal(ticket: SupportTicket): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <p class="font-medium">${escapeHtml(ticket.subject)}</p>
      <p class="text-sm text-slate-400 mt-1">${escapeHtml(ticket.message)}</p>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Reply</label>
      <textarea name="reply" rows="4" class="glass-input w-full">${escapeHtml(ticket.adminReply) || ''}</textarea>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" name="resolve" ${ticket.status === 'resolved' ? 'checked' : ''}>
      Mark as resolved
    </label>
  `;
    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Save</button>
  `;

    const close = showModal({ title: 'Reply to Ticket', content: form, footer, size: 'lg' });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        try {
            await adminReplyToTicket(ticket.id, (formData.get('reply') as string).trim(), formData.get('resolve') === 'on');
            showToast('Saved', { type: 'success' });
            close();
            renderAdminSupport();
        } catch (error) {
            console.error(error);
            showToast('Failed to save reply', { type: 'error' });
        }
    });
}
