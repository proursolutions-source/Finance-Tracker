/**
 * App PIN Lock - a lightweight privacy gate for shared devices.
 * The PIN hash lives in localStorage; this does not encrypt the underlying
 * IndexedDB data, it only gates the UI on app open.
 */

import { hashPassword } from '../utils';

const PIN_KEY = 'moneyflow-pin-hash';
const ATTEMPTS_KEY = 'moneyflow-pin-attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function getAttempts(): { count: number; lockedUntil: number | null } {
    try {
        const raw = localStorage.getItem(ATTEMPTS_KEY);
        return raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
    } catch {
        return { count: 0, lockedUntil: null };
    }
}

function recordFailedPinAttempt(): void {
    const state = getAttempts();
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
        state.lockedUntil = Date.now() + LOCKOUT_MS;
        state.count = 0;
    }
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
}

function remainingPinLockoutSeconds(): number {
    const { lockedUntil } = getAttempts();
    if (!lockedUntil) return 0;
    return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

export function isPinSet(): boolean {
    return !!localStorage.getItem(PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
    const hash = await hashPassword(pin);
    localStorage.setItem(PIN_KEY, hash);
}

export function removePin(): void {
    localStorage.removeItem(PIN_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return true;
    const hash = await hashPassword(pin);
    return hash === stored;
}

/**
 * Shows a full-screen PIN prompt if a PIN has been set.
 * Resolves once the correct PIN is entered (or immediately if no PIN is set).
 */
export function initAppLock(): Promise<void> {
    return new Promise((resolve) => {
        if (!isPinSet()) {
            resolve();
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'app-lock-overlay';
        overlay.className = 'fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center gap-6 p-6';
        overlay.innerHTML = `
      <div class="text-center">
        <i data-lucide="lock" class="w-10 h-10 mx-auto mb-3 text-primary-400"></i>
        <h2 class="text-xl font-bold text-white">MoneyFlow is locked</h2>
        <p class="text-sm text-slate-400 mt-1">Enter your PIN to continue</p>
        <p id="app-lock-error" class="text-sm text-red-400 mt-2 h-5"></p>
      </div>
      <input id="app-lock-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"
             class="glass-input text-center text-2xl tracking-[0.5em] w-48" placeholder="••••">
    `;
        document.body.appendChild(overlay);

        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }

        const input = overlay.querySelector('#app-lock-input') as HTMLInputElement;
        const errorEl = overlay.querySelector('#app-lock-error') as HTMLElement;

        let lockoutTimer: ReturnType<typeof setInterval> | null = null;
        const applyLockoutUI = () => {
            const remaining = remainingPinLockoutSeconds();
            if (remaining <= 0) {
                input.disabled = false;
                if (lockoutTimer) { clearInterval(lockoutTimer); lockoutTimer = null; errorEl.textContent = ''; }
                input.focus();
                return;
            }
            input.disabled = true;
            errorEl.textContent = `Too many attempts. Try again in ${remaining}s.`;
            if (!lockoutTimer) {
                lockoutTimer = setInterval(applyLockoutUI, 1000);
            }
        };
        applyLockoutUI();

        input.addEventListener('input', async () => {
            input.value = input.value.replace(/\D/g, '');
            if (input.value.length < 4) return;

            const ok = await verifyPin(input.value);
            if (ok) {
                localStorage.removeItem(ATTEMPTS_KEY);
                if (lockoutTimer) clearInterval(lockoutTimer);
                overlay.remove();
                resolve();
            } else {
                input.value = '';
                recordFailedPinAttempt();
                if (remainingPinLockoutSeconds() > 0) {
                    applyLockoutUI();
                } else {
                    errorEl.textContent = 'Incorrect PIN, try again';
                }
            }
        });
    });
}
