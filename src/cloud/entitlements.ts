/**
 * Feature gating by subscription tier. This is the piece that actually makes
 * "sell it on tiers" real — without this, subscriptions existed only as rows
 * in a cloud database with nothing in the app checking them.
 *
 * MoneyFlow's core data lives in a local, offline-first sql.js database with
 * no server in the loop for reads/writes — so tier checks happen client-side,
 * against a cached value refreshed from the cloud whenever it's reachable.
 * That is an inherent limit of this architecture: a sufficiently technical
 * user could tamper with the cached value in their own browser storage.
 * Treat this as an honest, ordinary product gate (like most desktop/mobile
 * freemium apps), not as DRM — real protection against a determined attacker
 * would require moving the gated operations to a server, which is a much
 * larger, separate undertaking (see PROJECT_STATUS.md's "Sync backend").
 */
import { isCloudConfigured } from '../lib/supabase';
import { getMySubscription } from './cloud-db';
import type { PlanTier } from './types';

const CACHE_KEY = 'moneyflow-entitlement-cache';
const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, premium: 2 };

export const TIER_LABELS: Record<PlanTier, string> = {
    free: 'Free',
    pro: 'Pro',
    premium: 'Premium',
};

/** Which tier first unlocks each gated feature area. */
export const FEATURE_TIER = {
    recurring: 'pro',
    lending: 'pro',
    networth: 'pro',
    ocr: 'pro',
    fullReports: 'pro',
    memory: 'premium',
} as const satisfies Record<string, PlanTier>;

interface EntitlementCache {
    tier: PlanTier;
    checkedAt: string;
}

function readCache(): EntitlementCache | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeCache(tier: PlanTier): void {
    const cache: EntitlementCache = { tier, checkedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/**
 * The tier to enforce right now, synchronously, from the last cloud check.
 * Without cloud configured at all, there is nothing to sell against — every
 * feature stays unlocked, matching this app's "fully offline, no subscription"
 * mode. Without cloud configured, this always returns 'premium'.
 */
export function getCachedTier(): PlanTier {
    if (!isCloudConfigured()) return 'premium';
    return readCache()?.tier ?? 'free';
}

/**
 * Re-checks the current user's subscription against the cloud and updates the
 * cache. Call this once after sign-in and periodically (e.g. on app boot).
 * Falls back to the existing cache — never to 'premium' — if the check fails,
 * so a lapsed subscription can't be kept alive indefinitely just by staying offline.
 */
export async function refreshEntitlement(): Promise<PlanTier> {
    if (!isCloudConfigured()) return 'premium';
    try {
        const sub = await getMySubscription();
        const tier: PlanTier = sub?.status === 'active' && sub.plan ? sub.plan.tier : 'free';
        writeCache(tier);
        return tier;
    } catch (error) {
        console.warn('[Entitlements] Could not refresh from cloud, using cached tier:', error);
        return getCachedTier();
    }
}

export function hasTier(required: PlanTier): boolean {
    return TIER_RANK[getCachedTier()] >= TIER_RANK[required];
}

export function hasFeature(feature: keyof typeof FEATURE_TIER): boolean {
    return hasTier(FEATURE_TIER[feature]);
}
