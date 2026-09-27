/**
 * MoneyFlow Cloud data access — subscription plans, subscriptions, discount
 * codes, user management, and the admin audit log. All access control is
 * enforced server-side by Postgres RLS policies (see supabase/migrations);
 * these functions are thin, honest wrappers, not a second layer of "fake" security.
 */
import { requireSupabase } from '../lib/supabase';
import { getCloudUser } from './cloud-auth';
import type {
    SubscriptionPlan,
    CloudSubscription,
    DiscountCode,
    CloudProfile,
    AdminAuditLogEntry,
    PaymentSettings,
} from './types';

// ---------- mappers (snake_case rows -> camelCase types) ----------

function mapPlan(row: any): SubscriptionPlan {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        priceInr: Number(row.price_inr),
        billingInterval: row.billing_interval,
        features: row.features ?? [],
        isActive: row.is_active,
        sortOrder: row.sort_order,
        tier: row.tier,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapSubscription(row: any): CloudSubscription {
    return {
        id: row.id,
        userId: row.user_id,
        planId: row.plan_id,
        status: row.status,
        discountCodeId: row.discount_code_id,
        discountApplied: row.discount_applied,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        paymentStatus: row.payment_status,
        notes: row.notes,
        paymentReference: row.payment_reference,
        paymentScreenshotPath: row.payment_screenshot_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        plan: row.subscription_plans ? mapPlan(row.subscription_plans) : undefined,
        profile: row.profiles ? mapProfile(row.profiles) : undefined,
    };
}

function mapDiscount(row: any): DiscountCode {
    return {
        id: row.id,
        code: row.code,
        type: row.type,
        value: Number(row.value),
        maxRedemptions: row.max_redemptions,
        redemptionsCount: row.redemptions_count,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        isActive: row.is_active,
        applicablePlanIds: row.applicable_plan_ids,
        notes: row.notes,
        createdAt: row.created_at,
    };
}

function mapProfile(row: any): CloudProfile {
    return {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapAudit(row: any): AdminAuditLogEntry {
    return {
        id: row.id,
        adminId: row.admin_id,
        action: row.action,
        targetUserId: row.target_user_id,
        details: row.details,
        createdAt: row.created_at,
    };
}

// ---------- Subscription plans ----------

export async function listPlans(includeInactive = false): Promise<SubscriptionPlan[]> {
    const supabase = requireSupabase();
    let query = supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true });
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapPlan);
}

export async function createPlan(plan: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
        .from('subscription_plans')
        .insert({
            name: plan.name,
            description: plan.description,
            price_inr: plan.priceInr,
            billing_interval: plan.billingInterval,
            features: plan.features,
            is_active: plan.isActive,
            sort_order: plan.sortOrder,
            tier: plan.tier,
        })
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

export async function updatePlan(id: string, updates: Partial<Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const supabase = requireSupabase();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.priceInr !== undefined) payload.price_inr = updates.priceInr;
    if (updates.billingInterval !== undefined) payload.billing_interval = updates.billingInterval;
    if (updates.features !== undefined) payload.features = updates.features;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
    if (updates.tier !== undefined) payload.tier = updates.tier;
    const { error } = await supabase.from('subscription_plans').update(payload).eq('id', id);
    if (error) throw error;
}

export async function deletePlan(id: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
    if (error) throw error;
}

// ---------- Discount codes ----------

export async function listDiscounts(): Promise<DiscountCode[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapDiscount);
}

export async function createDiscount(code: Omit<DiscountCode, 'id' | 'redemptionsCount' | 'createdAt'>): Promise<string> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
        .from('discount_codes')
        .insert({
            code: code.code.toUpperCase(),
            type: code.type,
            value: code.value,
            max_redemptions: code.maxRedemptions,
            valid_from: code.validFrom,
            valid_until: code.validUntil,
            is_active: code.isActive,
            applicable_plan_ids: code.applicablePlanIds,
            notes: code.notes,
        })
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

export async function updateDiscount(id: string, updates: Partial<Omit<DiscountCode, 'id' | 'createdAt'>>): Promise<void> {
    const supabase = requireSupabase();
    const payload: Record<string, unknown> = {};
    if (updates.code !== undefined) payload.code = updates.code.toUpperCase();
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.value !== undefined) payload.value = updates.value;
    if (updates.maxRedemptions !== undefined) payload.max_redemptions = updates.maxRedemptions;
    if (updates.redemptionsCount !== undefined) payload.redemptions_count = updates.redemptionsCount;
    if (updates.validFrom !== undefined) payload.valid_from = updates.validFrom;
    if (updates.validUntil !== undefined) payload.valid_until = updates.validUntil;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.applicablePlanIds !== undefined) payload.applicable_plan_ids = updates.applicablePlanIds;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    const { error } = await supabase.from('discount_codes').update(payload).eq('id', id);
    if (error) throw error;
}

export async function deleteDiscount(id: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    if (error) throw error;
}

export async function validateDiscountCode(code: string, planId: string): Promise<{ valid: boolean; message?: string; id?: string; type?: 'percent' | 'flat'; value?: number }> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc('redeem_discount_code', { p_code: code, p_plan_id: planId });
    if (error) throw error;
    return data;
}

// ---------- Subscriptions (end-user facing) ----------

export async function getMySubscription(): Promise<CloudSubscription | null> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) return null;
    // Fetched separately rather than via a PostgREST embed (`select('*, subscription_plans(*)')`):
    // that embed silently returned an empty result for a real, matching row —
    // an RLS/embedded-join interaction, not a permissions problem (both tables
    // read fine on their own). Two plain queries sidestep it entirely.
    const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const sub = mapSubscription(data);
    if (data.plan_id) {
        const { data: planRow, error: planError } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', data.plan_id)
            .maybeSingle();
        if (planError) throw planError;
        if (planRow) sub.plan = mapPlan(planRow);
    }
    return sub;
}

/**
 * Start a subscription. No live payment gateway is wired in yet, so this
 * honestly records intent — status starts at 'pending_payment' — rather than
 * pretending money changed hands. An admin can activate it manually from the
 * Admin Portal (e.g. for beta users, bank transfer, or comped access) until a
 * real gateway (Razorpay/Stripe) is connected.
 *
 * If the user already has a pending request, this updates that same row
 * instead of inserting a new one — otherwise re-opening the Subscribe modal
 * (e.g. to switch plans or fix a typo'd payment reference) before an admin
 * reviews it would pile up duplicate pending subscriptions for one person.
 */
export async function subscribeToPlan(planId: string, discount?: { id: string; code: string; type: 'percent' | 'flat'; value: number }, paymentReference?: string, paymentScreenshotPath?: string): Promise<string> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) throw new Error('Sign in to your MoneyFlow Cloud account first.');

    const { data: existingPending, error: findError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (findError) throw findError;

    const payload = {
        plan_id: planId,
        discount_code_id: discount?.id ?? null,
        discount_applied: discount ? { code: discount.code, type: discount.type, value: discount.value } : null,
        payment_reference: paymentReference || null,
        payment_screenshot_path: paymentScreenshotPath || null,
        updated_at: new Date().toISOString(),
    };

    if (existingPending) {
        const { error } = await supabase.from('subscriptions').update(payload).eq('id', existingPending.id);
        if (error) throw error;
        return existingPending.id;
    }

    const { data, error } = await supabase
        .from('subscriptions')
        .insert({ ...payload, user_id: user.id, status: 'pending_payment', payment_status: 'manual' })
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

/**
 * Attach or update a customer's submitted UTR/reference number on an existing
 * pending subscription — used when they pay after already creating the
 * subscription row, or want to correct a typo before the admin reviews it.
 */
export async function submitPaymentReference(subscriptionId: string, paymentReference: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase
        .from('subscriptions')
        .update({ payment_reference: paymentReference, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);
    if (error) throw error;
}

/**
 * Uploads a customer's UPI payment confirmation screenshot to a private
 * Storage bucket, under their own user id so RLS can scope access to just
 * them (and admins). Returns the storage path to save on the subscription
 * row — never a public URL, since the bucket isn't public.
 */
export async function uploadPaymentScreenshot(file: File): Promise<string> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) throw new Error('Sign in to your MoneyFlow Cloud account first.');

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('payment-screenshots').upload(path, file, {
        contentType: file.type,
        upsert: false,
    });
    if (error) throw error;
    return path;
}

/**
 * A short-lived signed URL for viewing a payment screenshot — the bucket is
 * private, so a plain public URL wouldn't work; only the uploader and admins
 * can generate one, enforced by the bucket's own RLS policies.
 */
export async function getPaymentScreenshotUrl(path: string): Promise<string> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.storage.from('payment-screenshots').createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
}

// ---------- Payment settings (admin's UPI ID, shown to customers) ----------

function mapPaymentSettings(row: any): PaymentSettings {
    return {
        upiId: row.upi_id,
        payeeName: row.payee_name,
        updatedAt: row.updated_at,
    };
}

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('payment_settings').select('*').maybeSingle();
    if (error) throw error;
    return data ? mapPaymentSettings(data) : null;
}

export async function updatePaymentSettings(upiId: string, payeeName: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase
        .from('payment_settings')
        .update({ upi_id: upiId, payee_name: payeeName, updated_at: new Date().toISOString() })
        .eq('id', true);
    if (error) throw error;
}

export async function cancelMySubscription(subscriptionId: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase
        .from('subscriptions')
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);
    if (error) throw error;
}

// ---------- Admin: users ----------

export async function adminListUsers(): Promise<CloudProfile[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapProfile);
}

export async function adminSetUserStatus(userId: string, status: 'active' | 'suspended'): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.from('profiles').update({ status, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) throw error;
    await logAdminAction('set_user_status', userId, { status });
}

export async function adminListSubscriptions(): Promise<CloudSubscription[]> {
    const supabase = requireSupabase();
    // Fetched as three plain queries and merged client-side rather than one
    // embedded select — see the comment in getMySubscription() for why.
    const [subsResult, plansResult, profilesResult] = await Promise.all([
        supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('subscription_plans').select('*'),
        supabase.from('profiles').select('*'),
    ]);
    if (subsResult.error) throw subsResult.error;
    if (plansResult.error) throw plansResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const plansById = new Map((plansResult.data ?? []).map(p => [p.id, mapPlan(p)]));
    const profilesById = new Map((profilesResult.data ?? []).map(p => [p.id, mapProfile(p)]));

    return (subsResult.data ?? []).map(row => {
        const sub = mapSubscription(row);
        sub.plan = plansById.get(row.plan_id);
        sub.profile = profilesById.get(row.user_id);
        return sub;
    });
}

export async function adminSetSubscriptionStatus(subscriptionId: string, status: CloudSubscription['status'], notes?: string): Promise<void> {
    const supabase = requireSupabase();
    const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'active') {
        payload.payment_status = 'manual';
        payload.current_period_start = new Date().toISOString();
    }
    if (notes !== undefined) payload.notes = notes;
    const { error } = await supabase.from('subscriptions').update(payload).eq('id', subscriptionId);
    if (error) throw error;
    await logAdminAction('set_subscription_status', null, { subscriptionId, status, notes });
}

export async function adminChangeUserPlan(subscriptionId: string, newPlanId: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase
        .from('subscriptions')
        .update({ plan_id: newPlanId, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);
    if (error) throw error;
    await logAdminAction('change_user_plan', null, { subscriptionId, newPlanId });
}

// ---------- Admin: audit log ----------

async function logAdminAction(action: string, targetUserId: string | null, details: Record<string, unknown>): Promise<void> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) return;
    await supabase.from('admin_audit_log').insert({
        admin_id: user.id,
        action,
        target_user_id: targetUserId,
        details,
    });
}

export async function adminListAuditLog(limit = 100): Promise<AdminAuditLogEntry[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapAudit);
}
