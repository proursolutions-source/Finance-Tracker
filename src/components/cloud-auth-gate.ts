/**
 * Shared "sign in to your MoneyFlow Cloud account" gate, used by both the
 * Subscription page and the Admin Portal. Separate from the local device
 * PIN/password — this is a real Supabase Auth identity.
 */
import { isCloudConfigured } from '../lib/supabase';
import { signInCloud, signUpCloud, getMyProfile, requestPasswordReset, signInWithGoogle, checkCloudEmailExists } from '../cloud/cloud-auth';
import { showToast } from './toast';
import { getIcon } from '../utils';

export function renderCloudAuthGate(container: HTMLElement, opts: { title: string; onSuccess: (result: { isNewAccount: boolean; fullName: string; email: string }) => void }): void {
    if (!isCloudConfigured()) {
        container.innerHTML = `
      <div class="glass-card p-8 text-center max-w-lg mx-auto">
        ${getIcon('cloud-off', 40)}
        <h2 class="text-xl font-bold mt-4 mb-2">Cloud features aren't set up yet</h2>
        <p class="text-slate-400 text-sm">
          ${opts.title} needs a MoneyFlow Cloud backend, which hasn't been configured for this build.
          See <code class="text-primary-400">SETUP_SUPABASE.md</code> for the one-time setup steps
          (create a free Supabase project, run the migration, add two environment variables).
          Every other part of MoneyFlow keeps working fully offline without this.
        </p>
      </div>
    `;
        if ((window as any).lucide) (window as any).lucide.createIcons();
        return;
    }

    let mode: 'login' | 'signup' | 'forgot' | 'forgot-sent' | 'confirm-email' = 'login';
    let pendingConfirmEmail = '';
    // Carries an email + a one-line explanation across an automatic mode
    // switch (e.g. "no account for that email" while logging in -> Sign Up).
    let carryEmail = '';
    let switchMessage = '';

    const render = () => {
        if (mode === 'forgot' || mode === 'forgot-sent') {
            renderForgotPassword();
            return;
        }
        if (mode === 'confirm-email') {
            container.innerHTML = `
        <div class="glass-card p-8 max-w-md mx-auto text-center">
          ${getIcon('mail-check', 40, 'text-primary-400 mx-auto')}
          <h2 class="text-xl font-bold mt-4 mb-2">Confirm your email</h2>
          <p class="text-sm text-slate-400 mb-6">Your account was created, but you need to confirm <strong>${pendingConfirmEmail}</strong> first — check your inbox for a confirmation link, then come back and log in.</p>
          <button id="back-to-login-btn" class="glass-button-secondary">Back to Log In</button>
        </div>
      `;
            if ((window as any).lucide) (window as any).lucide.createIcons();
            container.querySelector('#back-to-login-btn')?.addEventListener('click', () => {
                mode = 'login';
                render();
            });
            return;
        }

        const message = switchMessage;
        switchMessage = ''; // shown once, then cleared

        container.innerHTML = `
      <div class="glass-card p-8 max-w-md mx-auto">
        <h2 class="text-xl font-bold mb-1">${opts.title}</h2>
        <p class="text-sm text-slate-400 mb-6">Sign in with your MoneyFlow Cloud account. This is separate from your local device login.</p>
        <div class="flex gap-2 mb-6">
          <button data-mode="login" class="flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'login' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Log In</button>
          <button data-mode="signup" class="flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'signup' ? 'bg-primary-500 text-white' : 'glass-button-secondary'}">Sign Up</button>
        </div>
        ${message ? `<div class="text-sm text-primary-300 bg-primary-500/10 border border-primary-500/30 rounded-lg px-3 py-2 mb-4">${message}</div>` : ''}
        <button type="button" id="google-auth-btn" class="glass-button-secondary w-full flex items-center justify-center gap-2 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.96 11.96 0 000 12c0 1.93.46 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/></svg>
          Continue with Google
        </button>
        <div class="flex items-center gap-3 mb-4">
          <div class="flex-1 h-px bg-white/10"></div>
          <span class="text-xs text-slate-500">or</span>
          <div class="flex-1 h-px bg-white/10"></div>
        </div>
        <form id="cloud-auth-form" class="space-y-4">
          ${mode === 'signup' ? `
            <div>
              <label class="block text-sm font-medium mb-1">Full Name</label>
              <input type="text" name="fullName" required class="glass-input w-full">
            </div>
          ` : ''}
          <div>
            <label class="block text-sm font-medium mb-1">Email</label>
            <input type="email" name="email" required value="${carryEmail}" class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Password</label>
            <input type="password" name="password" required minlength="6" class="glass-input w-full">
          </div>
          <p id="cloud-auth-error" class="text-sm text-red-400 h-5"></p>
          <button type="submit" class="glass-button w-full">${mode === 'signup' ? 'Create Cloud Account' : 'Log In'}</button>
          ${mode === 'login' ? `<button type="button" id="forgot-password-link" class="text-sm text-slate-400 hover:text-white hover:underline w-full text-center">Forgot password?</button>` : ''}
        </form>
      </div>
    `;
        carryEmail = '';

        container.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                mode = btn.dataset.mode as 'login' | 'signup';
                render();
            });
        });

        container.querySelector('#google-auth-btn')?.addEventListener('click', async () => {
            try {
                // Navigates the whole page away to Google — there's nothing more to
                // do here on success; the redirect back is handled by requireCloudAuth()
                // picking up the now-established session on the next boot.
                await signInWithGoogle();
            } catch (error: any) {
                showToast(error?.message || 'Could not start Google sign-in', { type: 'error' });
            }
        });

        container.querySelector('#forgot-password-link')?.addEventListener('click', () => {
            mode = 'forgot';
            render();
        });

        const form = container.querySelector('#cloud-auth-form') as HTMLFormElement;
        const errorEl = container.querySelector('#cloud-auth-error') as HTMLElement;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const email = (formData.get('email') as string).trim();
            const password = formData.get('password') as string;
            try {
                const isNewAccount = mode === 'signup';
                let fullName = '';
                if (isNewAccount) {
                    // Steer an existing account to Log In instead of attempting (and
                    // ambiguously failing) a duplicate signup.
                    const exists = await checkCloudEmailExists(email).catch(() => false);
                    if (exists) {
                        carryEmail = email;
                        switchMessage = `An account already exists for ${email} — log in below instead.`;
                        mode = 'login';
                        render();
                        return;
                    }
                    fullName = (formData.get('fullName') as string).trim();
                    const result = await signUpCloud(email, password, fullName);
                    if (!result.sessionEstablished) {
                        // The Supabase project requires email confirmation before issuing a
                        // session — the account row exists, but there is no one signed in yet.
                        // Proceeding past this point would let the app in with no real
                        // session (exactly the bug this screen exists to prevent).
                        pendingConfirmEmail = email;
                        mode = 'confirm-email';
                        render();
                        return;
                    }
                    showToast('Cloud account created', { type: 'success' });
                } else {
                    try {
                        await signInCloud(email, password);
                    } catch (loginError: any) {
                        // Supabase deliberately returns the same generic error whether the
                        // password is wrong or the account doesn't exist at all (anti-
                        // enumeration). Only after a real failed attempt do we check which
                        // case this is, and steer to Sign Up if there's truly no account.
                        const exists = await checkCloudEmailExists(email).catch(() => true);
                        if (!exists) {
                            carryEmail = email;
                            switchMessage = `No account found for ${email} — sign up below to create one.`;
                            mode = 'signup';
                            render();
                            return;
                        }
                        throw loginError;
                    }
                    showToast('Signed in', { type: 'success' });
                    const profile = await getMyProfile().catch(() => null);
                    fullName = profile?.fullName || '';
                }
                opts.onSuccess({ isNewAccount, fullName, email });
            } catch (error: any) {
                errorEl.textContent = error?.message || 'Something went wrong';
            }
        });
    };

    const renderForgotPassword = () => {
        if (mode === 'forgot-sent') {
            container.innerHTML = `
        <div class="glass-card p-8 max-w-md mx-auto text-center">
          ${getIcon('mail-check', 40, 'text-primary-400 mx-auto')}
          <h2 class="text-xl font-bold mt-4 mb-2">Check your email</h2>
          <p class="text-sm text-slate-400 mb-6">We've sent a link to reset the password. It'll bring you right back here.</p>
          <button id="back-to-login-btn" class="glass-button-secondary">Back to Log In</button>
        </div>
      `;
            if ((window as any).lucide) (window as any).lucide.createIcons();
            container.querySelector('#back-to-login-btn')?.addEventListener('click', () => {
                mode = 'login';
                render();
            });
            return;
        }

        container.innerHTML = `
      <div class="glass-card p-8 max-w-md mx-auto">
        <h2 class="text-xl font-bold mb-1">Reset your password</h2>
        <p class="text-sm text-slate-400 mb-6">Enter the email for your MoneyFlow Cloud account and we'll send you a reset link.</p>
        <form id="forgot-password-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Email</label>
            <input type="email" name="email" required class="glass-input w-full" autofocus>
          </div>
          <p id="forgot-password-error" class="text-sm text-red-400 h-5"></p>
          <button type="submit" class="glass-button w-full">Send Reset Link</button>
          <button type="button" id="back-to-login-btn" class="text-sm text-slate-400 hover:text-white hover:underline w-full text-center">Back to Log In</button>
        </form>
      </div>
    `;

        container.querySelector('#back-to-login-btn')?.addEventListener('click', () => {
            mode = 'login';
            render();
        });

        const form = container.querySelector('#forgot-password-form') as HTMLFormElement;
        const errorEl = container.querySelector('#forgot-password-error') as HTMLElement;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = (new FormData(form).get('email') as string).trim();
            try {
                // Unlike login, we can safely tell the truth here up front: this
                // is the account-recovery *starting point*, not a failed-attempt
                // fallback, so there's no ambiguity to preserve by staying generic.
                const exists = await checkCloudEmailExists(email).catch(() => true);
                if (!exists) {
                    carryEmail = email;
                    switchMessage = `No account found for ${email} — sign up below to create one.`;
                    mode = 'signup';
                    render();
                    return;
                }
                await requestPasswordReset(email);
                mode = 'forgot-sent';
                render();
            } catch (error: any) {
                errorEl.textContent = error?.message || 'Something went wrong';
            }
        });
    };

    render();
}
