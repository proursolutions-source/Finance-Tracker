/**
 * Types for the MoneyFlow Cloud layer (Supabase): subscriptions, admin, discounts.
 * Kept separate from src/types.ts, which describes the local sql.js schema.
 */

export interface CloudProfile {
    id: string;
    email: string;
    fullName: string | null;
    role: 'user' | 'admin';
    status: 'active' | 'suspended';
    createdAt: string;
    updatedAt: string;
}

export type BillingInterval = 'monthly' | 'yearly' | 'lifetime';
export type PlanTier = 'free' | 'pro' | 'premium';

export interface SubscriptionPlan {
    id: string;
    name: string;
    description: string | null;
    priceInr: number;
    billingInterval: BillingInterval;
    features: string[];
    isActive: boolean;
    sortOrder: number;
    tier: PlanTier;
    createdAt: string;
    updatedAt: string;
}

export type SubscriptionStatus = 'pending_payment' | 'active' | 'canceled' | 'expired' | 'past_due';
export type PaymentStatus = 'manual' | 'test' | 'paid';

export interface CloudSubscription {
    id: string;
    userId: string;
    planId: string;
    status: SubscriptionStatus;
    discountCodeId: string | null;
    discountApplied: { code: string; type: 'percent' | 'flat'; value: number } | null;
    currentPeriodStart: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    paymentStatus: PaymentStatus;
    notes: string | null;
    paymentReference: string | null;
    paymentScreenshotPath: string | null;
    createdAt: string;
    updatedAt: string;
    // joined, when fetched with a plan join
    plan?: SubscriptionPlan;
    profile?: CloudProfile;
}

/**
 * Singleton row holding the admin's own UPI ID — shown to a subscribing
 * customer as a QR code / deep link so they can pay peer-to-peer with zero
 * gateway fees. The customer submits a UTR/reference number back, and the
 * admin manually confirms it against their own UPI app before activating.
 */
export interface PaymentSettings {
    upiId: string | null;
    payeeName: string | null;
    updatedAt: string;
}

export type DiscountType = 'percent' | 'flat';

export interface DiscountCode {
    id: string;
    code: string;
    type: DiscountType;
    value: number;
    maxRedemptions: number | null;
    redemptionsCount: number;
    validFrom: string | null;
    validUntil: string | null;
    isActive: boolean;
    applicablePlanIds: string[] | null;
    notes: string | null;
    createdAt: string;
}

export interface AdminAuditLogEntry {
    id: string;
    adminId: string;
    action: string;
    targetUserId: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
}

export type AppEventType = 'login_success' | 'login_failed' | 'signup' | 'logout' | 'client_error';

export interface AppEvent {
    id: string;
    userId: string | null;
    eventType: AppEventType;
    message: string;
    details: Record<string, unknown> | null;
    createdAt: string;
}
