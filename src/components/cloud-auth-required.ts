/**
 * Full-screen MoneyFlow Cloud sign-in gate, shown at app boot whenever cloud
 * features are configured. Replaces the local-only auth-gate.ts in that case,
 * because feature gating by subscription tier needs a real identity the app
 * can check against the cloud — a local device password has no concept of
 * "which plan is this person on."
 *
 * When cloud isn't configured (no Supabase env vars), main.ts falls back to
 * the local auth-gate.ts instead — this keeps a from-source/offline build
 * fully usable without ever touching Supabase.
 */
import { renderCloudAuthGate } from './cloud-auth-gate';
import { getCloudUser, getMyProfile } from '../cloud/cloud-auth';

export interface CloudAuthResult {
    isNewAccount: boolean;
    fullName: string;
    email: string;
}

export async function requireCloudAuth(): Promise<CloudAuthResult> {
    // A session can already exist here for two reasons: a normal returning
    // visit (Supabase persists the session in localStorage), or landing back
    // from a Google OAuth redirect, which re-runs the whole app boot with the
    // session already established by the time this code runs. Either way,
    // showing the login form again would be wrong.
    const existingUser = await getCloudUser();
    if (existingUser) {
        const profile = await getMyProfile().catch(() => null);
        return { isNewAccount: false, fullName: profile?.fullName || '', email: existingUser.email || '' };
    }

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = 'cloud-auth-gate-overlay';
        overlay.className = 'fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-6 overflow-y-auto';
        document.body.appendChild(overlay);

        const wrapper = document.createElement('div');
        wrapper.className = 'w-full max-w-md';
        wrapper.innerHTML = `
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold" style="font-family:'Poppins',sans-serif"><span class="text-white">Money</span><span class="text-primary-400">Flow</span></h1>
        <p class="text-xs text-primary-300 mt-1 tracking-wide">Track Today &middot; A Better Tomorrow</p>
      </div>
      <div id="cloud-auth-required-content"></div>
    `;
        overlay.appendChild(wrapper);

        const content = wrapper.querySelector('#cloud-auth-required-content') as HTMLElement;
        renderCloudAuthGate(content, {
            title: 'Sign in to MoneyFlow',
            onSuccess: (result) => {
                overlay.remove();
                resolve(result);
            },
        });
    });
}
