/**
 * Idle session timeout — re-locks (or signs out) after a period of no
 * interaction, so a finance app left open on a shared or unattended device
 * doesn't stay accessible indefinitely. Previously there was no idle timeout
 * at all: a signed-in session stayed open forever.
 */
import { isPinSet, initAppLock } from './lock-screen';
import { isCloudConfigured, signOutCloud } from '../cloud/cloud-auth';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

let timer: ReturnType<typeof setTimeout> | null = null;
let locked = false;

async function handleIdleTimeout(): Promise<void> {
    if (locked) return;
    locked = true;

    if (isPinSet()) {
        // Re-show the same PIN overlay used at boot; unlocking clears the flag
        // so idle tracking resumes normally.
        await initAppLock();
        locked = false;
        resetTimer();
        return;
    }

    // No PIN configured — the only available gate is a full sign-out, mirroring
    // the same logout path used elsewhere (Settings, account widget).
    if (isCloudConfigured()) {
        await signOutCloud().catch(() => { /* clearing local state below still logs the user out either way */ });
    }
    try { sessionStorage.setItem('moneyflow-session-expired', '1'); } catch { /* ignore */ }
    location.reload();
}

function resetTimer(): void {
    if (timer) clearTimeout(timer);
    if (locked) return;
    timer = setTimeout(() => { void handleIdleTimeout(); }, IDLE_TIMEOUT_MS);
}

/** Call once at app boot, after the initial auth/lock gate has resolved. */
export function initIdleTimeout(): void {
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();
}
