/**
 * Minimal, consent-gated product analytics.
 *
 * MoneyFlow ships with NO analytics provider configured by default — every
 * call here is a no-op until both of these are true:
 *   1. The visitor has accepted the cookie/analytics banner (see cookie-consent.ts)
 *   2. VITE_ANALYTICS_ENDPOINT (and optionally VITE_ANALYTICS_SITE_ID) are set
 *      at build time, pointing at a real collector you control (e.g. a
 *      self-hosted Plausible/Umami instance, or your own endpoint).
 *
 * Events never include financial data - only the page path / event name and
 * a randomly generated, non-identifying client id.
 */

import { hasAnalyticsConsent } from './components/cookie-consent';

const ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
const SITE_ID = import.meta.env.VITE_ANALYTICS_SITE_ID as string | undefined;
const CLIENT_ID_KEY = 'moneyflow-analytics-client-id';

function getClientId(): string {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
}

function isEnabled(): boolean {
    return hasAnalyticsConsent() && !!ENDPOINT;
}

function send(payload: Record<string, unknown>): void {
    if (!isEnabled()) return;

    try {
        const body = JSON.stringify({ siteId: SITE_ID, clientId: getClientId(), ...payload });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(ENDPOINT!, body);
        } else {
            fetch(ENDPOINT!, { method: 'POST', body, keepalive: true }).catch(() => { });
        }
    } catch {
        // Analytics must never break the app
    }
}

export function initAnalytics(): void {
    if (!ENDPOINT) {
        console.log('[Analytics] No VITE_ANALYTICS_ENDPOINT configured — analytics is a no-op.');
        return;
    }
    trackPageView(location.hash || '/');
}

export function trackPageView(path: string): void {
    send({ type: 'pageview', path, timestamp: new Date().toISOString() });
}

export function trackEvent(name: string, props: Record<string, unknown> = {}): void {
    send({ type: 'event', name, props, timestamp: new Date().toISOString() });
}
