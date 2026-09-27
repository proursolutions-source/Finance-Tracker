/**
 * A single reusable full-screen state page for every "you can't be here right
 * now" scenario — 401/403/429/500, maintenance mode, a suspended account, or
 * a session that just expired — instead of a separate near-identical file
 * for each one.
 */
import { getIcon } from '../utils';

export interface ErrorPageOptions {
    code?: string;
    icon: string;
    title: string;
    message: string;
    showHomeLink?: boolean;
}

export function renderErrorPage(options: ErrorPageOptions): void {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="max-w-md mx-auto text-center py-20">
      <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
        ${getIcon(options.icon, 40, 'text-slate-400')}
      </div>
      ${options.code ? `<h1 class="text-4xl font-bold mb-2">${options.code}</h1>` : ''}
      <h2 class="text-xl font-bold mb-2">${options.title}</h2>
      <p class="text-slate-400 mb-6">${options.message}</p>
      ${options.showHomeLink !== false ? `
        <a href="#/" class="glass-button inline-flex items-center gap-2 px-6 py-3">
          ${getIcon('home', 16)} Back to Dashboard
        </a>
      ` : ''}
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();
}

export const renderUnauthorized401 = () => renderErrorPage({
    code: '401', icon: 'lock', title: 'Sign in required',
    message: 'You need to be signed in to view this page.',
});

export const renderForbidden403 = () => renderErrorPage({
    code: '403', icon: 'shield-alert', title: 'Access denied',
    message: 'You don\'t have permission to view this page.',
});

export const renderRateLimited429 = () => renderErrorPage({
    code: '429', icon: 'timer', title: 'Too many requests',
    message: 'Please slow down and try again in a moment.',
});

export const renderServerError500 = () => renderErrorPage({
    code: '500', icon: 'server-crash', title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again, or come back later.',
});

export const renderMaintenancePage = () => renderErrorPage({
    icon: 'construction', title: 'MoneyFlow is under maintenance',
    message: 'We\'re making some improvements. Please check back shortly.',
    showHomeLink: false,
});

export const renderAccountSuspendedPage = () => renderErrorPage({
    icon: 'user-x', title: 'Account suspended',
    message: 'Your MoneyFlow Cloud account has been suspended. Contact support if you believe this is a mistake.',
    showHomeLink: false,
});

export const renderSessionExpiredPage = () => renderErrorPage({
    icon: 'clock-alert', title: 'Session expired',
    message: 'You were signed out after a period of inactivity, to keep your financial data secure. Please sign in again.',
});
