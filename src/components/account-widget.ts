/**
 * Top-right account widget — a persistent avatar circle (visible on every
 * page, unlike the per-page Settings/Profile sections) with a dropdown for
 * quick account glance + logout, so signing out doesn't require a trip to
 * Settings first.
 */
import { store } from '../stores';
import { getIcon } from '../utils';
import { showConfirm } from './modal';
import { isCloudConfigured, getCloudUser, signOutCloud } from '../cloud/cloud-auth';
import { getCachedTier, TIER_LABELS } from '../cloud/entitlements';
import type { CloudProfile } from '../cloud/types';

let mounted = false;

export async function mountAccountWidget(): Promise<void> {
    const container = document.getElementById('account-widget-container');
    if (!container) return;

    let cloudProfile: CloudProfile | null = null;
    let email = '';
    if (isCloudConfigured()) {
        const user = await getCloudUser();
        if (user) {
            email = user.email || '';
            const { getMyProfile } = await import('../cloud/cloud-auth');
            cloudProfile = await getMyProfile().catch(() => null);
        }
    }

    const localProfile = store.getState().userProfile;
    const displayName = cloudProfile?.fullName || localProfile?.fullName || (email ? email.split('@')[0] : 'Account');
    const initial = displayName.charAt(0).toUpperCase();

    container.innerHTML = `
    <div class="relative">
      <button id="account-widget-btn" class="w-10 h-10 rounded-full bg-primary-500/20 text-primary-400 font-bold flex items-center justify-center hover:bg-primary-500/30 transition-colors border border-primary-500/30" aria-label="Account menu">
        ${initial}
      </button>
      <div id="account-widget-dropdown" class="hidden absolute right-0 mt-2 w-64 glass-card p-3 shadow-xl z-50">
        <div class="px-2 py-1 mb-2">
          <p class="font-medium truncate">${displayName}</p>
          ${email ? `<p class="text-xs text-slate-400 truncate">${email}</p>` : ''}
          <div class="flex items-center gap-2 mt-2">
            ${cloudProfile ? `<span class="px-2 py-0.5 rounded-full text-xs bg-white/10 text-slate-300 capitalize">${cloudProfile.role}</span>` : ''}
            <span class="px-2 py-0.5 rounded-full text-xs bg-primary-500/20 text-primary-400">${TIER_LABELS[getCachedTier()]}</span>
          </div>
        </div>
        <div class="border-t border-white/10 pt-2 space-y-1">
          <a href="#/profile" class="flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">
            ${getIcon('user-circle', 16)} Profile
          </a>
          <a href="#/settings" class="flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">
            ${getIcon('settings', 16)} Settings
          </a>
          <button id="account-widget-logout" class="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors">
            ${getIcon('log-out', 16)} Log Out
          </button>
        </div>
      </div>
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    const btn = container.querySelector('#account-widget-btn') as HTMLButtonElement;
    const dropdown = container.querySelector('#account-widget-dropdown') as HTMLElement;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    dropdown.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => dropdown.classList.add('hidden'));
    });

    dropdown.querySelector('#account-widget-logout')?.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        const message = isCloudConfigured()
            ? 'You will need to sign back in to your MoneyFlow Cloud account to open MoneyFlow again.'
            : 'You will need to log back in with your password to open MoneyFlow again.';
        showConfirm('Log Out', message, async () => {
            if (isCloudConfigured()) {
                await signOutCloud().catch(() => { /* clearing local state below still logs the user out either way */ });
            }
            location.reload();
        });
    });

    if (!mounted) {
        mounted = true;
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target as Node)) dropdown.classList.add('hidden');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') dropdown.classList.add('hidden');
        });
    }
}
