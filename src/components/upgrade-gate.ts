/**
 * Renders an "upgrade to unlock" screen in place of a gated page's content.
 * Used by any page whose feature requires a paid tier.
 */
import { hasTier, TIER_LABELS } from '../cloud/entitlements';
import type { PlanTier } from '../cloud/types';
import { getIcon } from '../utils';

export function isEntitled(requiredTier: PlanTier): boolean {
    return hasTier(requiredTier);
}

export function renderUpgradeGate(container: HTMLElement, opts: { feature: string; requiredTier: PlanTier }): void {
    const tierLabel = TIER_LABELS[opts.requiredTier];
    container.innerHTML = `
    <div class="max-w-lg mx-auto pb-20">
      <div class="glass-card p-8 text-center">
        ${getIcon('lock', 40, 'text-primary-400 mx-auto')}
        <h2 class="text-xl font-bold mt-4 mb-2">${opts.feature} is a ${tierLabel} feature</h2>
        <p class="text-slate-400 text-sm mb-6">Upgrade your MoneyFlow plan to unlock ${opts.feature.toLowerCase()} and everything else on ${tierLabel}.</p>
        <a href="#/subscription" class="glass-button inline-flex items-center gap-2">
          ${getIcon('sparkles', 16)} View Plans
        </a>
      </div>
    </div>
  `;
    if ((window as any).lucide) (window as any).lucide.createIcons();
}

/**
 * Guard for a whole-page render function: if the current user's tier doesn't
 * meet `requiredTier`, shows the upgrade screen instead of calling `render`.
 */
export function withTierGate(requiredTier: PlanTier, featureName: string, render: () => void | Promise<void>): void | Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    if (!isEntitled(requiredTier)) {
        renderUpgradeGate(mainContent, { feature: featureName, requiredTier });
        return;
    }
    return render();
}
