/**
 * Cookie consent banner.
 *
 * MoneyFlow's only cookie is `moneyflow_consent`, which stores this very
 * choice (accepted/declined) - there is nothing else to consent to unless
 * analytics is configured (see analytics.ts). The banner still gates that
 * possibility up front, and the choice can be changed later from Settings.
 */

const COOKIE_NAME = 'moneyflow_consent';

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string): void {
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${oneYear}; path=/; samesite=lax`;
}

export function getConsentChoice(): 'accepted' | 'declined' | null {
    const value = getCookie(COOKIE_NAME);
    return value === 'accepted' || value === 'declined' ? value : null;
}

export function hasAnalyticsConsent(): boolean {
    return getConsentChoice() === 'accepted';
}

export function setConsentChoice(choice: 'accepted' | 'declined'): void {
    setCookie(COOKIE_NAME, choice);
}

/**
 * Shows the consent banner if no choice has been recorded yet.
 * `onChoice` fires with the user's decision so the caller can (re)initialize
 * analytics without a page reload.
 */
export function initCookieConsent(onChoice: (choice: 'accepted' | 'declined') => void): void {
    if (getConsentChoice() !== null) return;

    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.className = 'fixed bottom-0 left-0 right-0 z-[90] p-4 md:p-6';
    banner.innerHTML = `
    <div class="max-w-3xl mx-auto glass-card p-5 flex flex-col md:flex-row items-start md:items-center gap-4 border border-white/10">
      <p class="text-sm text-slate-300 flex-1">
        MoneyFlow uses a single cookie to remember this choice, and — only if you accept — anonymous,
        non-financial usage analytics to help improve the app. Your financial data never leaves this device
        either way. See the <a href="/privacy.html" target="_blank" class="text-primary-400 hover:underline">Privacy Policy</a>.
      </p>
      <div class="flex gap-2 flex-shrink-0">
        <button id="cookie-decline-btn" class="glass-button-secondary px-4 py-2 text-sm">Decline</button>
        <button id="cookie-accept-btn" class="glass-button px-4 py-2 text-sm">Accept</button>
      </div>
    </div>
  `;
    document.body.appendChild(banner);

    const close = (choice: 'accepted' | 'declined') => {
        setConsentChoice(choice);
        banner.remove();
        onChoice(choice);
    };

    banner.querySelector('#cookie-accept-btn')?.addEventListener('click', () => close('accepted'));
    banner.querySelector('#cookie-decline-btn')?.addEventListener('click', () => close('declined'));
}
