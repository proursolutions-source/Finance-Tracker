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
import { requireAuth } from './components/auth-gate';
import { requireCloudAuth, type CloudAuthResult } from './components/cloud-auth-required';
import { showResetPasswordScreen } from './components/reset-password-screen';
import { initPasswordRecoveryListener, getMyProfile } from './cloud/cloud-auth';
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
import { isCloudConfigured, isCurrentUserAdmin } from './cloud/cloud-auth';
import { refreshEntitlement } from './cloud/entitlements';

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
 * Initialize the application
 */
async function initApp(): Promise<void> {
  try {
    console.log('[App] Initializing MoneyFlow...');

    // Apply theme
    const theme = getTheme();
    setTheme(theme);

    // With cloud features configured, identity is a real MoneyFlow Cloud
    // account (needed to check subscription tier) instead of the local-only
    // device account. Without cloud configured, nothing can be sold/gated
    // anyway, so the original fully-offline local login still applies.
    const recoveryAuth = await handlePasswordRecoveryIfPresent();
    const auth = recoveryAuth ?? (isCloudConfigured() ? await requireCloudAuth() : await requireAuth());

    // Require PIN unlock (no-op if no PIN has been set)
    await initAppLock();

    // Refresh the cached subscription tier used for feature gating. Runs
    // after auth so it has a signed-in cloud session to check; failures fall
    // back to the last cached tier (or 'free') rather than blocking boot.
    await refreshEntitlement();

    // Initialize database
    await db.init();
    console.log('[App] Database initialized');

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
    router.register('/settings', renderSettings);
    router.setNotFoundHandler(renderNotFound);

    // Render navigation
    renderNavigation();
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
          <h1 class="text-2xl font-bold mb-1" style="font-family:'Poppins',sans-serif"><span class="text-white">Money</span><span class="text-primary-400">Flow</span></h1>
          <p class="text-xs text-primary-300 tracking-wide">Track Today &middot; A Better Tomorrow</p>
        </div>
        
        <nav class="flex-1 space-y-2">
          <a href="#/" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
            <span>Dashboard</span>
          </a>
          <a href="#/budgets" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="pie-chart" class="w-5 h-5"></i>
            <span>Budgets</span>
          </a>
          <a href="#/transactions" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="receipt" class="w-5 h-5"></i>
            <span>Transactions</span>
          </a>
          <a href="#/networth" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="wallet" class="w-5 h-5"></i>
            <span>Net Worth</span>
            ${!hasFeature('networth') ? getIcon('lock', 14, 'ml-auto text-slate-500') : ''}
          </a>
          <a href="#/recurring" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="refresh-cw" class="w-5 h-5"></i>
            <span>Recurring</span>
            ${!hasFeature('recurring') ? getIcon('lock', 14, 'ml-auto text-slate-500') : ''}
          </a>
          <a href="#/lending" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="handshake" class="w-5 h-5"></i>
            <span>Lending & Debt</span>
            ${!hasFeature('lending') ? getIcon('lock', 14, 'ml-auto text-slate-500') : ''}
          </a>
          <a href="#/categories" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="tag" class="w-5 h-5"></i>
            <span>Categories</span>
          </a>
          <a href="#/goals" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="award" class="w-5 h-5"></i>
            <span>Goals</span>
          </a>
          <a href="#/memory" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="sparkles" class="w-5 h-5"></i>
            <span>Memory</span>
            ${!hasFeature('memory') ? getIcon('lock', 14, 'ml-auto text-slate-500') : ''}
          </a>
          <a href="#/reports" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
            <span>Reports</span>
          </a>
          <a href="#/reminders" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="bell" class="w-5 h-5"></i>
            <span>Reminders</span>
          </a>
          <a href="#/subscription" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="credit-card" class="w-5 h-5"></i>
            <span>Subscription</span>
          </a>
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
      <div class="flex items-center justify-around py-2">
        <a href="#/" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="layout-dashboard" class="w-6 h-6"></i>
          <span class="text-xs">Home</span>
        </a>
        <a href="#/transactions" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="receipt" class="w-6 h-6"></i>
          <span class="text-xs">Transactions</span>
        </a>
        <a href="#/budgets" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="pie-chart" class="w-6 h-6"></i>
          <span class="text-xs">Budgets</span>
        </a>
        <a href="#/goals" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="award" class="w-6 h-6"></i>
          <span class="text-xs">Goals</span>
        </a>
        <a href="#/memory" class="nav-link relative flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="sparkles" class="w-6 h-6"></i>
          ${!hasFeature('memory') ? `<span class="absolute top-0 right-2">${getIcon('lock', 10, 'text-slate-500')}</span>` : ''}
          <span class="text-xs">Memory</span>
        </a>
        <a href="#/reports" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="bar-chart-3" class="w-6 h-6"></i>
          <span class="text-xs">Reports</span>
        </a>
        <a href="#/settings" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="settings" class="w-6 h-6"></i>
          <span class="text-xs">More</span>
        </a>
      </div>
    `;
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
