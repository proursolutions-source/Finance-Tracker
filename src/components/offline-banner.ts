/**
 * Offline banner — the app previously gave no indication when the network
 * dropped, so cloud-dependent actions (sign-in, subscribe, admin changes)
 * could silently fail with a generic error and no context. Local, offline-first
 * features (transactions, budgets, etc.) keep working regardless; this only
 * warns about connectivity, it doesn't block anything.
 */
const BANNER_ID = 'offline-banner';

function render(): void {
    let banner = document.getElementById(BANNER_ID);
    if (!navigator.onLine) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = BANNER_ID;
            banner.setAttribute('role', 'status');
            banner.className = 'fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-slate-900 text-sm font-medium text-center py-1.5';
            banner.textContent = 'You\'re offline — local data keeps working, but cloud features (sign-in, subscription, admin) are unavailable until you\'re back online.';
            document.body.appendChild(banner);
        }
    } else if (banner) {
        banner.remove();
    }
}

export function initOfflineBanner(): void {
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    render();
}
