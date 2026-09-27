/**
 * Local Signup / Login gate.
 *
 * MoneyFlow has no server, so there is no real user database - this only
 * creates a local "account" (name, email, password hash) stored in
 * localStorage on this device, and gates app access behind it. It does not
 * protect the underlying data (already on this device in IndexedDB) the way
 * a real authentication system would; it is a familiar-feeling front door,
 * not a security boundary. There is deliberately no password recovery:
 * forgetting the password means resetting the local account (see the
 * "Forgot password" flow below), since there is nothing to email a reset
 * link to.
 */

import { hashPassword } from '../utils';
import { showToast } from './toast';
import { showConfirm } from './modal';

const ACCOUNT_KEY = 'moneyflow-account';
const ATTEMPTS_KEY = 'moneyflow-login-attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

interface AttemptState {
    count: number;
    lockedUntil: number | null;
}

function getAttemptState(): AttemptState {
    try {
        const raw = localStorage.getItem(ATTEMPTS_KEY);
        return raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
    } catch {
        return { count: 0, lockedUntil: null };
    }
}

function saveAttemptState(state: AttemptState): void {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
}

function clearAttempts(): void {
    localStorage.removeItem(ATTEMPTS_KEY);
}

function recordFailedAttempt(): AttemptState {
    const state = getAttemptState();
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
        state.lockedUntil = Date.now() + LOCKOUT_MS;
        state.count = 0;
    }
    saveAttemptState(state);
    return state;
}

function getRemainingLockoutSeconds(): number {
    const { lockedUntil } = getAttemptState();
    if (!lockedUntil) return 0;
    return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

interface LocalAccount {
    fullName: string;
    email: string;
    passwordHash: string;
}

export interface AuthResult {
    isNewAccount: boolean;
    fullName: string;
    email: string;
}

function getAccount(): LocalAccount | null {
    try {
        const raw = localStorage.getItem(ACCOUNT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveAccount(account: LocalAccount): void {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function hasAccount(): boolean {
    return !!getAccount();
}

/**
 * Blocks app rendering behind a full-screen Signup (first run) or Login
 * (returning user) form. Resolves once the user is authenticated.
 */
export function requireAuth(): Promise<AuthResult> {
    return new Promise((resolve) => {
        const account = getAccount();
        const overlay = document.createElement('div');
        overlay.id = 'auth-gate-overlay';
        overlay.className = 'fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-6 overflow-y-auto';
        document.body.appendChild(overlay);

        if (account) {
            renderLogin(overlay, account, resolve);
        } else {
            renderSignup(overlay, resolve);
        }
    });
}

function shell(title: string, subtitle: string, formHtml: string): string {
    return `
    <div class="w-full max-w-sm">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold" style="font-family:'Poppins',sans-serif"><span class="text-white">Money</span><span class="text-primary-400">Flow</span></h1>
        <p class="text-xs text-primary-300 mt-1 tracking-wide">Track Today &middot; A Better Tomorrow</p>
        <p class="text-sm text-slate-400 mt-2">${subtitle}</p>
      </div>
      <div class="glass-card p-6 space-y-4">
        <h2 class="text-lg font-semibold text-white">${title}</h2>
        ${formHtml}
      </div>
    </div>
  `;
}

function renderSignup(overlay: HTMLElement, resolve: (result: AuthResult) => void): void {
    overlay.innerHTML = shell('Create your account', 'All data stays on this device — nothing is sent anywhere.', `
    <form id="signup-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Full Name</label>
        <input type="text" name="fullName" required class="glass-input w-full" placeholder="Your name">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input type="email" name="email" required class="glass-input w-full" placeholder="you@example.com">
        <p class="text-xs text-slate-500 mt-1">Used only as your local login name — never sent anywhere.</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Password</label>
        <input type="password" name="password" required minlength="6" class="glass-input w-full" placeholder="At least 6 characters">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Confirm Password</label>
        <input type="password" name="confirmPassword" required minlength="6" class="glass-input w-full">
      </div>
      <label class="flex items-start gap-2 text-xs text-slate-400 cursor-pointer">
        <input type="checkbox" name="agreeTerms" required class="mt-0.5">
        <span>I agree to the <a href="/terms.html" target="_blank" class="text-primary-400 hover:underline">Terms & Conditions</a>
          and <a href="/privacy.html" target="_blank" class="text-primary-400 hover:underline">Privacy Policy</a>.</span>
      </label>
      <p id="signup-error" class="text-sm text-red-400 h-5"></p>
      <button type="submit" class="glass-button w-full">Create Account</button>
    </form>
  `);

    if ((window as any).lucide) (window as any).lucide.createIcons();

    const form = overlay.querySelector('#signup-form') as HTMLFormElement;
    const errorEl = overlay.querySelector('#signup-error') as HTMLElement;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const fullName = (formData.get('fullName') as string).trim();
        const email = (formData.get('email') as string).trim().toLowerCase();
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password !== confirmPassword) {
            errorEl.textContent = 'Passwords do not match';
            return;
        }
        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters';
            return;
        }

        const passwordHash = await hashPassword(password);
        saveAccount({ fullName, email, passwordHash });
        overlay.remove();
        resolve({ isNewAccount: true, fullName, email });
    });
}

function renderLogin(overlay: HTMLElement, account: LocalAccount, resolve: (result: AuthResult) => void): void {
    overlay.innerHTML = shell('Welcome back', `Log in as ${account.fullName || account.email}`, `
    <form id="login-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input type="email" name="email" required value="${account.email}" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Password</label>
        <input type="password" name="password" required class="glass-input w-full" placeholder="Password" autofocus>
      </div>
      <p id="login-error" class="text-sm text-red-400 h-5"></p>
      <button type="submit" class="glass-button w-full">Log In</button>
      <button type="button" id="forgot-password-btn" class="text-sm text-slate-400 hover:text-white hover:underline w-full text-center">Forgot password?</button>
    </form>
  `);

    if ((window as any).lucide) (window as any).lucide.createIcons();

    const form = overlay.querySelector('#login-form') as HTMLFormElement;
    const errorEl = overlay.querySelector('#login-error') as HTMLElement;
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    let lockoutTimer: ReturnType<typeof setInterval> | null = null;
    const applyLockoutUI = () => {
        const remaining = getRemainingLockoutSeconds();
        if (remaining <= 0) {
            submitBtn.disabled = false;
            errorEl.textContent = '';
            if (lockoutTimer) { clearInterval(lockoutTimer); lockoutTimer = null; }
            return;
        }
        submitBtn.disabled = true;
        errorEl.textContent = `Too many failed attempts. Try again in ${remaining}s.`;
        if (!lockoutTimer) {
            lockoutTimer = setInterval(() => applyLockoutUI(), 1000);
        }
    };
    applyLockoutUI();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (getRemainingLockoutSeconds() > 0) {
            applyLockoutUI();
            return;
        }

        const formData = new FormData(form);
        const email = (formData.get('email') as string).trim().toLowerCase();
        const password = formData.get('password') as string;

        const hash = await hashPassword(password);
        if (email !== account.email || hash !== account.passwordHash) {
            recordFailedAttempt();
            if (getRemainingLockoutSeconds() > 0) {
                applyLockoutUI();
            } else {
                errorEl.textContent = 'Incorrect email or password';
            }
            return;
        }

        clearAttempts();
        if (lockoutTimer) clearInterval(lockoutTimer);
        overlay.remove();
        resolve({ isNewAccount: false, fullName: account.fullName, email: account.email });
    });

    overlay.querySelector('#forgot-password-btn')?.addEventListener('click', () => {
        showConfirm(
            'Forgot Password',
            'MoneyFlow stores your account only on this device, so there is no way to recover a forgotten password. Continuing will erase your local account AND all financial data on this device, and start over.',
            () => {
                localStorage.removeItem(ACCOUNT_KEY);
                localStorage.removeItem(ATTEMPTS_KEY);
                indexedDB.deleteDatabase('moneyflow-db');
                location.reload();
            }
        );
    });
}
