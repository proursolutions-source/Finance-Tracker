/**
 * Feedback & Support — a quick feedback form (admin-visible, no reply loop)
 * plus a lightweight support ticket system (tracked, admin can reply/resolve).
 */
import { isCloudConfigured, getCloudUser } from '../cloud/cloud-auth';
import { renderCloudAuthGate } from '../components/cloud-auth-gate';
import { submitFeedback, createSupportTicket, getMySupportTickets, type SupportTicket } from '../cloud/growth';
import { showToast } from '../components/toast';
import { formatDate, getIcon, escapeHtml } from '../utils';
import { renderAnimatedLoader } from '../components/animated-loader';

export async function renderFeedback(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="feedback-root" class="max-w-2xl mx-auto pb-20"></div>`;
    const root = document.getElementById('feedback-root')!;
    renderAnimatedLoader(root);

    if (!isCloudConfigured()) {
        renderCloudAuthGate(root, { title: 'Feedback & Support', onSuccess: () => renderFeedback() });
        return;
    }
    const user = await getCloudUser();
    if (!user) {
        renderCloudAuthGate(root, { title: 'Feedback & Support', onSuccess: () => renderFeedback() });
        return;
    }

    const tickets = await getMySupportTickets().catch(() => []);
    render(root, tickets);
}

function render(root: HTMLElement, tickets: SupportTicket[]): void {
    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('life-buoy', 26)} Feedback &amp; Support</h1>
      <p class="text-sm text-slate-400 mt-1">Report a problem, ask a question, or just tell us what you think.</p>
    </div>

    <form id="feedback-form" class="glass-card p-5 mb-6 space-y-4">
      <h2 class="font-semibold">Quick Feedback</h2>
      <textarea name="message" rows="3" required class="glass-input w-full" placeholder="What's on your mind?"></textarea>
      <button type="submit" class="glass-button">Send Feedback</button>
    </form>

    <form id="ticket-form" class="glass-card p-5 mb-6 space-y-4">
      <h2 class="font-semibold">Report a Problem / Ask for Help</h2>
      <p class="text-xs text-slate-500">Unlike quick feedback, this is tracked — an admin can reply here.</p>
      <div>
        <label class="block text-sm font-medium mb-1">Subject</label>
        <input type="text" name="subject" required class="glass-input w-full" placeholder="e.g., Can't upload a receipt">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Details</label>
        <textarea name="message" rows="4" required class="glass-input w-full"></textarea>
      </div>
      <button type="submit" class="glass-button">Submit Ticket</button>
    </form>

    <div>
      <h2 class="font-semibold mb-3">Your Tickets</h2>
      ${tickets.length === 0 ? `<p class="text-sm text-slate-400">No tickets yet.</p>` : `
        <div class="space-y-3">
          ${tickets.map(t => `
            <div class="glass-card p-4">
              <div class="flex items-center justify-between mb-1">
                <p class="font-medium">${escapeHtml(t.subject)}</p>
                <span class="px-2 py-0.5 rounded-full text-xs ${t.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">${t.status}</span>
              </div>
              <p class="text-sm text-slate-400">${escapeHtml(t.message)}</p>
              <p class="text-xs text-slate-500 mt-1">${formatDate(t.createdAt)}</p>
              ${t.adminReply ? `
                <div class="mt-3 pt-3 border-t border-white/10">
                  <p class="text-xs text-primary-400 font-medium mb-1">Admin reply</p>
                  <p class="text-sm">${escapeHtml(t.adminReply)}</p>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    root.querySelector('#feedback-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const message = (new FormData(form).get('message') as string).trim();
        if (!message) return;
        try {
            await submitFeedback(message);
            showToast('Thanks for the feedback!', { type: 'success' });
            form.reset();
        } catch (error) {
            console.error(error);
            showToast('Failed to send feedback', { type: 'error' });
        }
    });

    root.querySelector('#ticket-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const subject = (formData.get('subject') as string).trim();
        const message = (formData.get('message') as string).trim();
        if (!subject || !message) return;
        try {
            await createSupportTicket(subject, message);
            showToast('Ticket submitted', { type: 'success' });
            form.reset();
            renderFeedback();
        } catch (error) {
            console.error(error);
            showToast('Failed to submit ticket', { type: 'error' });
        }
    });
}
