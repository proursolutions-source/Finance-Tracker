/**
 * Main Application Entry Point
 * Initializes database, router, and renders navigation
 */

import { db } from './db';
import { router } from './router';
import { store } from './stores';
import { getTheme, setTheme } from './utils';
import { showToast } from './components/toast';

// Import all page handlers
import { renderDashboard } from './pages/dashboard';
import { renderOnboarding } from './pages/onboarding';
import { renderTransactions } from './pages/transactions';
import { renderCategories } from './pages/categories';
import { renderBudgets } from './pages/budgets';
import { renderReports } from './pages/reports';
import { renderReminders } from './pages/reminders';
import { renderSettings } from './pages/settings';

/**
 * Initialize the application
 */
async function initApp(): Promise<void> {
    try {
        console.log('[App] Initializing MoneyFlow...');

        // Apply theme
        const theme = getTheme();
        setTheme(theme);

        // Initialize database
        await db.init();
        console.log('[App] Database initialized');

        // Load user profile
        const profile = await db.getProfile();
        store.setProfile(profile);

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
        router.register('/settings', renderSettings);

        // Render navigation
        renderNavigation();

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

    } catch (error) {
        console.error('[App] Initialization error:', error);
        showToast('Failed to initialize app. Please refresh.', { type: 'error', duration: 0 });
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
          <h1 class="text-2xl font-bold text-white mb-1">MoneyFlow</h1>
          <p class="text-sm text-slate-400">Personal Finance Tracker</p>
        </div>
        
        <nav class="flex-1 space-y-2">
          <a href="#/" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
            <span>Dashboard</span>
          </a>
          <a href="#/transactions" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="receipt" class="w-5 h-5"></i>
            <span>Transactions</span>
          </a>
          <a href="#/categories" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="tag" class="w-5 h-5"></i>
            <span>Categories</span>
          </a>
          <a href="#/budgets" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="pie-chart" class="w-5 h-5"></i>
            <span>Budgets</span>
          </a>
          <a href="#/reports" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
            <span>Reports</span>
          </a>
          <a href="#/reminders" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="bell" class="w-5 h-5"></i>
            <span>Reminders</span>
          </a>
          <a href="#/settings" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="settings" class="w-5 h-5"></i>
            <span>Settings</span>
          </a>
        </nav>
        
        <div class="mt-auto pt-6 border-t border-white/10">
          <button id="theme-toggle" class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <i data-lucide="moon" class="w-5 h-5"></i>
            <span>Toggle Theme</span>
          </button>
        </div>
      </div>
      
      <!-- Spacer for desktop -->
      <div class="hidden md:block w-64"></div>
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
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
