/**
 * Hidable side navigation drawer — the mobile bottom-nav can only ever fit a
 * handful of items before overflowing, so it deliberately shows a curated
 * subset. This drawer is the "quick links" counterpart: every feature, in the
 * exact same hierarchy as the desktop sidebar, reachable via a hamburger
 * toggle instead of depending on screen width alone. Available at any width
 * (not just mobile) so navigation is never solely at the mercy of a resize.
 */
import { getIcon } from '../utils';
import { hasFeature } from '../cloud/entitlements';

export interface NavItem {
    href: string;
    icon: string;
    label: string;
    feature?: Parameters<typeof hasFeature>[0];
}

export const NAV_ITEMS: NavItem[] = [
    { href: '#/', icon: 'layout-dashboard', label: 'Dashboard' },
    { href: '#/budgets', icon: 'pie-chart', label: 'Budgets' },
    { href: '#/transactions', icon: 'receipt', label: 'Transactions' },
    { href: '#/networth', icon: 'wallet', label: 'Net Worth', feature: 'networth' },
    { href: '#/recurring', icon: 'refresh-cw', label: 'Recurring', feature: 'recurring' },
    { href: '#/lending', icon: 'handshake', label: 'Lending & Debt', feature: 'lending' },
    { href: '#/categories', icon: 'tag', label: 'Categories' },
    { href: '#/goals', icon: 'award', label: 'Goals' },
    { href: '#/memory', icon: 'sparkles', label: 'Memory', feature: 'memory' },
    { href: '#/reports', icon: 'bar-chart-3', label: 'Reports' },
    { href: '#/reminders', icon: 'bell', label: 'Reminders' },
    { href: '#/investments', icon: 'trending-up', label: 'Investments', feature: 'investments' },
    { href: '#/loan-tools', icon: 'calculator', label: 'Loan & Debt Tools', feature: 'loanTools' },
    { href: '#/money-tools', icon: 'wand-2', label: 'Money Tools', feature: 'moneyTools' },
    { href: '#/achievements', icon: 'trophy', label: 'Achievements' },
    { href: '#/documents', icon: 'folder-lock', label: 'Document Vault', feature: 'documents' },
    { href: '#/notifications', icon: 'bell-ring', label: 'Notification Center' },
    { href: '#/subscription', icon: 'credit-card', label: 'Subscription' },
    { href: '#/referral', icon: 'gift', label: 'Referrals' },
    { href: '#/feedback', icon: 'life-buoy', label: 'Feedback & Support' },
];

/**
 * Shared by both the mobile drawer and the desktop sidebar, so the two
 * surfaces can never drift out of sync with each other again.
 */
export function navLinkHtml(item: NavItem, extraClass = ''): string {
    const locked = item.feature ? !hasFeature(item.feature) : false;
    return `
    <a href="${item.href}" class="nav-link drawer-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors ${extraClass}">
      <i data-lucide="${item.icon}" class="w-5 h-5"></i>
      <span>${item.label}</span>
      ${locked ? getIcon('lock', 14, 'ml-auto text-slate-500') : ''}
    </a>
  `;
}

let drawerOpen = false;

function setOpen(open: boolean): void {
    drawerOpen = open;
    const panel = document.getElementById('nav-drawer-panel');
    const backdrop = document.getElementById('nav-drawer-backdrop');
    if (!panel || !backdrop) return;
    if (open) {
        backdrop.classList.remove('hidden');
        requestAnimationFrame(() => panel.classList.remove('-translate-x-full'));
    } else {
        panel.classList.add('-translate-x-full');
        setTimeout(() => backdrop.classList.add('hidden'), 200);
    }
}

export function toggleNavDrawer(): void {
    setOpen(!drawerOpen);
}

export function closeNavDrawer(): void {
    setOpen(false);
}

/** Call once at boot to build the drawer's DOM into #nav-drawer-container. */
export function renderNavDrawer(): void {
    const container = document.getElementById('nav-drawer-container');
    if (!container) return;

    container.innerHTML = `
    <div id="nav-drawer-backdrop" class="hidden fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm">
      <div id="nav-drawer-panel" class="fixed top-0 left-0 h-full w-72 max-w-[85vw] glass-card border-r border-white/10 p-6 flex flex-col -translate-x-full transition-transform duration-200 ease-out">
        <div class="flex items-center justify-between mb-8">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <img src="/icons/icon.svg" alt="" width="24" height="24">
              <h1 class="text-xl font-bold" style="font-family:'Poppins',sans-serif"><span class="text-white">Money</span><span class="text-primary-400">Flow</span></h1>
            </div>
            <p class="text-xs text-primary-300 tracking-wide">Track Today &middot; A Better Tomorrow</p>
          </div>
          <button id="nav-drawer-close" class="p-1.5 rounded-lg hover:bg-white/10" aria-label="Close menu">
            ${getIcon('x', 20)}
          </button>
        </div>
        <nav class="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          ${NAV_ITEMS.map(item => navLinkHtml(item)).join('')}
          <a href="#/admin" id="drawer-admin-link" class="nav-link drawer-link hidden items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            ${getIcon('shield', 20)}
            <span>Admin Portal</span>
          </a>
        </nav>
      </div>
    </div>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    container.querySelector('#nav-drawer-backdrop')?.addEventListener('click', (e) => {
        if (e.target === container.querySelector('#nav-drawer-backdrop')) closeNavDrawer();
    });
    container.querySelector('#nav-drawer-close')?.addEventListener('click', closeNavDrawer);
    container.querySelectorAll('.drawer-link').forEach(link => {
        link.addEventListener('click', closeNavDrawer);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawerOpen) closeNavDrawer();
    });
}

/** Shows the Admin Portal link inside the drawer too, mirroring the sidebar. */
export function revealAdminInDrawer(): void {
    document.getElementById('drawer-admin-link')?.classList.replace('hidden', 'flex');
}
