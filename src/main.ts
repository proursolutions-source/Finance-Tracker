/**
 * Main Application Entry Point
 * Initializes database, router, and renders navigation
 */

import { db } from './db';
import { router } from './router';
import { store } from './stores';
import { getTheme, setTheme, getIcon } from './utils';
import { hasFeature } from './cloud/entitlements';
import { showToast } from './components/toast';
import { runNotificationChecks } from './notifications';
import { initAppLock } from './components/lock-screen';
import { initIdleTimeout } from './components/idle-timeout';
import { initOfflineBanner } from './components/offline-banner';
import { initOAuthDeepLinkListener } from './components/oauth-deep-link';
import { runSync } from './cloud/sync';
import { getFeatureFlags } from './cloud/growth';
import { renderMaintenancePage, renderAccountSuspendedPage } from './pages/error-page';
import { renderNavDrawer, toggleNavDrawer, revealAdminInDrawer, NAV_ITEMS, navLinkHtml } from './components/nav-drawer';
import { requireAuth } from './components/auth-gate';
import { requireCloudAuth, type CloudAuthResult } from './components/cloud-auth-required';
import { showResetPasswordScreen } from './components/reset-password-screen';
import { initPasswordRecoveryListener, getMyProfile } from './cloud/cloud-auth';
import { logEvent } from './cloud/app-log';
import { initCookieConsent } from './components/cookie-consent';
import { initAnalytics, trackPageView } from './analytics';
import './styles/main.css';

// Import all page handlers
import { renderDashboard } from './pages/dashboard';
import { renderOnboarding, primeOnboardingFromProfile } from './pages/onboarding';
import { renderTransactions } from './pages/transactions';
import { renderCategories } from './pages/categories';
import { renderBudgets } from './pages/budgets';
import { renderReports } from './pages/reports';
import { renderReminders } from './pages/reminders';
import { renderSettings } from './pages/settings';
import { renderGoals } from './pages/goals';
import { renderNetWorth } from './pages/networth';
import { renderRecurring } from './pages/recurring';
import { renderLending } from './pages/lending';
import { renderNotFound } from './pages/not-found';
import { renderMemory } from './pages/memory';
import { renderMemoryTimeline } from './pages/memory-timeline';
import { renderSubscription } from './pages/subscription';
import { renderProfile } from './pages/profile';
import { mountAccountWidget } from './components/account-widget';
import { renderAdminDashboard } from './pages/admin/admin-dashboard';
import { renderAdminUsers } from './pages/admin/admin-users';
import { renderAdminPlans } from './pages/admin/admin-plans';
import { renderAdminDiscounts } from './pages/admin/admin-discounts';
import { renderAdminLogs } from './pages/admin/admin-logs';
import { renderAdminSupport } from './pages/admin/admin-support';
import { renderAdminOps } from './pages/admin/admin-ops';
import { renderInvestments } from './pages/investments';
import { renderDocuments } from './pages/documents';
import { renderLoanTools } from './pages/loan-tools';
import { renderMoneyTools } from './pages/money-tools';
import { renderAchievements } from './pages/achievements';
import { renderFeedback } from './pages/feedback';
import { renderReferral } from './pages/referral';
import { renderNotificationCenter } from './pages/notification-center';
import { renderUnauthorized401, renderForbidden403, renderRateLimited429, renderServerError500 } from './pages/error-page';
import { isCloudConfigured, isCurrentUserAdmin } from './cloud/cloud-auth';
import { refreshEntitlement, setAdminCache } from './cloud/entitlements';

/**
 * True only when the current URL is a Supabase password-reset redirect
 * (present as a query param for the PKCE flow, or in the hash for the
 * implicit flow) — checked synchronously so normal boots never wait on it.
 */
function isPasswordRecoveryLink(): boolean {
  return window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
}

/**
 * If the user arrived via a password-reset email link, blocks on a "set new
 * password" screen and returns an auth result built from their now-active
 * recovery session — skipping the normal login form, since they already have
 * a valid session at that point. Returns null on any other boot (the common
 * case), with zero added delay.
 */
async function handlePasswordRecoveryIfPresent(): Promise<CloudAuthResult | null> {
  if (!isCloudConfigured() || !isPasswordRecoveryLink()) return null;
  return new Promise((resolve) => {
    initPasswordRecoveryListener(() => {
      showResetPasswordScreen(async () => {
        const profile = await getMyProfile().catch(() => null);
        resolve({ isNewAccount: false, fullName: profile?.fullName || '', email: profile?.email || '' });
      });
    });
  });
}

/**
 * Best-effort client-error capture, registered at module load (before
 * initApp() runs) so it catches errors during boot too, not just after.
 * Gives the Admin Portal real visibility into runtime errors instead of only
 * the browser console, which no one is watching in production.
 */
window.addEventListener('error', (event) => {
  void logEvent('client_error', event.message || 'Uncaught error', {
    source: event.filename,
    line: event.lineno,
    col: event.colno,
    stack: event.error?.stack,
  });
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  void logEvent('client_error', 'Unhandled promise rejection: ' + (reason?.message || String(reason)), {
    stack: reason?.stack,
  });
});

/**
 * Initialize the application
 */
let backgroundSyncStarted = false;

/**
 * Keeps syncing after boot: periodically while the app is open, and
 * immediately whenever it regains network connectivity or the user
 * switches back into it (covers "I added something on my phone, then
 * opened the already-running desktop app" without waiting a full minute).
 */
function initBackgroundSync(): void {
    if (backgroundSyncStarted) return;
    backgroundSyncStarted = true;

    setInterval(() => { runSync().catch(() => { /* logged inside runSync */ }); }, 60_000);
    window.addEventListener('online', () => runSync().catch(() => { }));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') runSync().catch(() => { });
    });
}

async function initApp(): Promise<void> {
  try {
    console.log('[App] Initializing MoneyFlow...');

    // Independent of auth — shows even on the login screen, since that's
    // exactly when a dropped connection is most confusing (sign-in just
    // seems to silently fail otherwise).
    initOfflineBanner();

    // Also independent of auth, and needs to be listening before the user
    // ever taps "Continue with Google" — catches the app regaining focus
    // after Google sign-in completes in an external Chrome Custom Tab.
    initOAuthDeepLinkListener();

    // Apply theme
    const theme = getTheme();
    setTheme(theme);

    // With cloud features configured, identity is a real MoneyFlow Cloud
    // account (needed to check subscription tier) instead of the local-only
    // device account. Without cloud configured, nothing can be sold/gated
    // anyway, so the original fully-offline local login still applies.
    const recoveryAuth = await handlePasswordRecoveryIfPresent();
    const auth = recoveryAuth ?? (isCloudConfigured() ? await requireCloudAuth() : await requireAuth());

    // Surfaced once, right after a fresh sign-in following an idle timeout —
    // otherwise the forced logout looks like an unexplained silent kick.
    try {
        if (sessionStorage.getItem('moneyflow-session-expired')) {
            sessionStorage.removeItem('moneyflow-session-expired');
            showToast('You were signed out after a period of inactivity.', { type: 'info', duration: 6000 });
        }
    } catch { /* ignore */ }

    // Maintenance mode / account suspension: both block the whole app, so
    // they're checked before anything else loads. Admins bypass maintenance
    // mode so they can still get in to turn it back off.
    if (isCloudConfigured()) {
        const [flags, isAdmin, profile] = await Promise.all([
            getFeatureFlags().catch(() => ({} as Record<string, boolean>)),
            isCurrentUserAdmin().catch(() => false),
            getMyProfile().catch(() => null),
        ]);
        setAdminCache(isAdmin);
        if ((flags.maintenance_mode && !isAdmin) || profile?.status === 'suspended') {
            const loadingScreen = document.getElementById('loading-screen');
            const appContainer = document.getElementById('app');
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (appContainer) appContainer.classList.remove('hidden');
            if (flags.maintenance_mode && !isAdmin) renderMaintenancePage();
            else renderAccountSuspendedPage();
            return;
        }
    }

    // Require PIN unlock (no-op if no PIN has been set)
    await initAppLock();

    // Re-lock (or sign out) after a period of inactivity
    initIdleTimeout();

    // Refresh the cached subscription tier used for feature gating. Runs
    // after auth so it has a signed-in cloud session to check; failures fall
    // back to the last cached tier (or 'free') rather than blocking boot.
    await refreshEntitlement();

    // Initialize database
    await db.init();
    console.log('[App] Database initialized');

    // Cross-device sync (accounts/categories/transactions/budgets/goals/
    // reminders/recurrings) — awaited here so the very first paint already
    // reflects what other devices have written, then kept going in the
    // background (periodic + on focus/reconnect) so it doesn't have to wait
    // for a full app restart to catch up again.
    await runSync().catch(error => console.warn('[App] Initial sync failed:', error));
    initBackgroundSync();

    // Load user profile
    let profile = await db.getProfile();

    // Seed a bare profile from whatever name auth gave us (signup form, or a
    // Google account's name) so onboarding can pick up where signup left off
    // instead of asking for the name again. Keyed on "no local profile yet"
    // rather than auth.isNewAccount — a returning cloud account opening
    // MoneyFlow on a fresh device/browser has no local profile either, and
    // needs this exact same seeding.
    if (!profile) {
      profile = {
        id: 'current',
        createdAt: new Date().toISOString(),
        fullName: auth.fullName,
        country: 'India',
        city: 'Chennai',
        stateProvince: 'Tamil Nadu',
        primaryCurrency: 'INR',
        preferredLanguage: 'en',
        onboardingComplete: false,
      };
      await db.saveProfile(profile);
    }

    store.setProfile(profile);
    primeOnboardingFromProfile(profile);

    // Check if onboarding is complete
    const onboardingComplete = profile?.onboardingComplete || false;
    router.setOnboardingRequired(!onboardingComplete);

    // Load categories
    const categories = await db.getCategories();
    store.setCategories(categories);

    // Register routes
    router.register('/', renderDashboard);
    router.register('/onboarding', renderOnboarding, false); // No auth required
    router.register('/transactions', renderTransactions);
    router.register('/categories', renderCategories);
    router.register('/budgets', renderBudgets);
    router.register('/reports', renderReports);
    router.register('/reminders', renderReminders);
    router.register('/goals', renderGoals);
    router.register('/networth', renderNetWorth);
    router.register('/recurring', renderRecurring);
    router.register('/lending', renderLending);
    router.register('/memory', renderMemory);
    router.register('/memory/timeline', renderMemoryTimeline);
    router.register('/subscription', renderSubscription);
    router.register('/profile', renderProfile);
    router.register('/admin', renderAdminDashboard);
    router.register('/admin/users', renderAdminUsers);
    router.register('/admin/plans', renderAdminPlans);
    router.register('/admin/discounts', renderAdminDiscounts);
    router.register('/admin/logs', renderAdminLogs);
    router.register('/admin/support', renderAdminSupport);
    router.register('/admin/ops', renderAdminOps);
    router.register('/settings', renderSettings);
    router.register('/investments', renderInvestments);
    router.register('/documents', renderDocuments);
    router.register('/loan-tools', renderLoanTools);
    router.register('/money-tools', renderMoneyTools);
    router.register('/achievements', renderAchievements);
    router.register('/feedback', renderFeedback);
    router.register('/referral', renderReferral);
    router.register('/notifications', renderNotificationCenter);
    router.register('/401', renderUnauthorized401, false);
    router.register('/403', renderForbidden403, false);
    router.register('/429', renderRateLimited429, false);
    router.register('/500', renderServerError500, false);
    router.setNotFoundHandler(renderNotFound);

    // Render navigation
    renderNavigation();
    renderNavDrawer();
    revealAdminNavIfApplicable();
    mountAccountWidget();

    // Hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    const appContainer = document.getElementById('app');

    if (loadingScreen && appContainer) {
      loadingScreen.style.display = 'none';
      appContainer.classList.remove('hidden');
    }

    // Start router
    router.start();

    console.log('[App] Initialization complete');

    // Check for due reminders / budget overspend (no-op if permission not granted)
    runNotificationChecks();

    // Cookie consent gates analytics; both are no-ops unless a real
    // analytics endpoint is configured at build time (see analytics.ts).
    initAnalytics();
    initCookieConsent((choice) => {
      if (choice === 'accepted') initAnalytics();
    });
    window.addEventListener('hashchange', () => trackPageView(location.hash || '/'));

  } catch (error) {
    console.error('[App] Initialization error:', error);
    showToast('Failed to initialize app. Please refresh.', { type: 'error', duration: 0 });
  }
}

/**
 * Show the Admin Portal nav link only when the current MoneyFlow Cloud
 * session (not the local device login) belongs to the admin account.
 * No-op when cloud features aren't configured — the link simply stays hidden.
 */
async function revealAdminNavIfApplicable(): Promise<void> {
  if (!isCloudConfigured()) return;
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (isAdmin) {
      document.getElementById('admin-nav-link')?.classList.replace('hidden', 'flex');
      revealAdminInDrawer();
    }
  } catch {
    // cloud not reachable / not signed in — leave the link hidden
  }
}

/**
 * Render navigation bar
 */
function renderNavigation(): void {
  // Desktop sidebar navigation
  const navContainer = document.getElementById('nav-container');
  if (navContainer) {
    navContainer.innerHTML = `
      <div class="hidden md:flex fixed top-0 left-0 h-screen w-64 glass-card flex-col p-6 border-r border-white/10">
        <div class="mb-8">
          <div class="flex items-center gap-2 mb-1">
            <img src="/icons/icon.svg" alt="" width="28" height="28">
            <h1 class="text-2xl font-bold" style="font-family:'Poppins',sans-serif"><span class="text-white">Money</span><span class="text-primary-400">Flow</span></h1>
          </div>
          <p class="text-xs text-primary-300 tracking-wide">Track Today &middot; A Better Tomorrow</p>
        </div>
        
        <nav class="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
          ${NAV_ITEMS.map(item => navLinkHtml(item)).join('')}
          <a href="#/admin" id="admin-nav-link" class="nav-link hidden items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="shield" class="w-5 h-5"></i>
            <span>Admin Portal</span>
          </a>
        </nav>
        
        <div class="mt-auto pt-6 border-t border-white/10">
          <button id="theme-toggle" class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <i data-lucide="moon" class="w-5 h-5"></i>
            <span>Toggle Theme</span>
          </button>
        </div>
      </div>
    `;
  }

  // Mobile bottom navigation
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <div class="flex items-center py-2">
        <a href="#/" class="nav-link flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
          <span class="text-[10px] truncate w-full text-center">Home</span>
        </a>
        <a href="#/transactions" class="nav-link flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="receipt" class="w-5 h-5"></i>
          <span class="text-[10px] truncate w-full text-center">Transactions</span>
        </a>
        <a href="#/budgets" class="nav-link flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="pie-chart" class="w-5 h-5"></i>
          <span class="text-[10px] truncate w-full text-center">Budgets</span>
        </a>
        <a href="#/goals" class="nav-link flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="award" class="w-5 h-5"></i>
          <span class="text-[10px] truncate w-full text-center">Goals</span>
        </a>
        <a href="#/memory" class="nav-link relative flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="sparkles" class="w-5 h-5"></i>
          ${!hasFeature('memory') ? `<span class="absolute top-0 right-1/4">${getIcon('lock', 10, 'text-slate-500')}</span>` : ''}
          <span class="text-[10px] truncate w-full text-center">Memory</span>
        </a>
        <a href="#/reports" class="nav-link flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
          <span class="text-[10px] truncate w-full text-center">Reports</span>
        </a>
        <button id="bottom-nav-menu-btn" class="flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="menu" class="w-5 h-5"></i>
          <span class="text-[10px] truncate w-full text-center">Menu</span>
        </button>
      </div>
    `;
    bottomNav.querySelector('#bottom-nav-menu-btn')?.addEventListener('click', toggleNavDrawer);
  }

  // Initialize icons
  if ((window as any).lucide) {
    (window as any).lucide.createIcons();
  }

  // Highlight active nav item
  const updateActiveNav = () => {
    const currentHash = window.location.hash;
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentHash || (currentHash === '' && href === '#/')) {
        link.classList.add('bg-primary-500/20', 'text-primary-400');
      } else {
        link.classList.remove('bg-primary-500/20', 'text-primary-400');
      }
    });
  };

  window.addEventListener('hashchange', updateActiveNav);
  updateActiveNav();

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      store.toggleTheme();
      showToast('Theme updated', { type: 'success', duration: 2000 });
      // Re-render the current page so anything computed at render time from
      // the active theme (chart colors, in particular) picks up the change
      // immediately, instead of only updating on the next navigation.
      router.reload();
    });
  }

  // Global Floating Action Button (FAB)
  // Only show on main pages
  const fabContainer = document.getElementById('fab-container');
  if (!fabContainer) {
    const fab = document.createElement('div');
    fab.id = 'fab-container';
    fab.className = 'fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40';
    fab.innerHTML = `
            <button id="global-add-btn" class="fab shadow-lg shadow-primary-500/20 hover:scale-105 transition-transform" aria-label="Quick Add Transaction">
                <i data-lucide="plus" class="w-6 h-6"></i>
            </button>
        `;
    document.body.appendChild(fab);

    // Add listener
    document.getElementById('global-add-btn')?.addEventListener('click', () => {
      import('./components/transaction-modal').then(({ openTransactionModal }) => {
        openTransactionModal();
      });
    });
  }
}

// Global Event Listeners
window.addEventListener('transaction-changed', () => {
  console.log('[App] Transaction changed, reloading view...');
  router.reload();
});

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
