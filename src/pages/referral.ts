/**
 * Referral — a shareable per-user code and redemption count. No automated
 * reward payout is wired up; an admin can see who redeemed what and apply a
 * discount manually, the same mediated pattern used for payments.
 */
import { isCloudConfigured, getCloudUser } from '../cloud/cloud-auth';
import { renderCloudAuthGate } from '../components/cloud-auth-gate';
import { getOrCreateMyReferralCode, getMyReferralRedemptionCount } from '../cloud/growth';
import { showToast } from '../components/toast';
import { getIcon } from '../utils';
import { renderAnimatedLoader } from '../components/animated-loader';

export async function renderReferral(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `<div id="referral-root" class="max-w-2xl mx-auto pb-20"></div>`;
    const root = document.getElementById('referral-root')!;
    renderAnimatedLoader(root);

    if (!isCloudConfigured()) {
        renderCloudAuthGate(root, { title: 'Referrals', onSuccess: () => renderReferral() });
        return;
    }
    const user = await getCloudUser();
    if (!user) {
        renderCloudAuthGate(root, { title: 'Referrals', onSuccess: () => renderReferral() });
        return;
    }

    try {
        const code = await getOrCreateMyReferralCode();
        const count = await getMyReferralRedemptionCount().catch(() => 0);
        render(root, code, count);
    } catch (error) {
        console.error('[Referral] Error:', error);
        root.innerHTML = `<div class="glass-card p-8 text-center text-red-400">Failed to load your referral code.</div>`;
    }
}

function render(root: HTMLElement, code: string, count: number): void {
    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('gift', 26)} Referrals</h1>
      <p class="text-sm text-slate-400 mt-1">Share MoneyFlow with friends and family.</p>
    </div>

    <div class="glass-card p-6 text-center mb-6">
      <p class="text-xs uppercase text-slate-400 mb-2">Your Referral Code</p>
      <p class="text-3xl font-bold font-mono tracking-widest text-primary-400 mb-4">${code}</p>
      <button id="copy-code-btn" class="glass-button-secondary">${getIcon('copy', 14, 'inline mr-1')} Copy Code</button>
    </div>

    <div class="glass-card p-5 text-center">
      <p class="text-xs uppercase text-slate-400 mb-1">People who used your code</p>
      <p class="text-2xl font-bold">${count}</p>
    </div>

    <p class="text-xs text-slate-500 mt-4 text-center">Ask anyone you refer to enter this code when they sign up. Rewards aren't automatic yet — reach out via Feedback &amp; Support and we'll sort it out.</p>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    root.querySelector('#copy-code-btn')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(code);
            showToast('Copied!', { type: 'success', duration: 2000 });
        } catch {
            showToast('Could not copy — copy it manually', { type: 'error' });
        }
    });
}
