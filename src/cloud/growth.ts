/**
 * Client functions for the newly added cloud-backed features: feedback,
 * support tickets, account deletion requests, feature flags, and referrals.
 * All admin-mediated writes (deletion processing, ticket replies) go through
 * RLS, the same pattern as the rest of this app's admin features.
 */
import { requireSupabase, isCloudConfigured } from '../lib/supabase';
import { getCloudUser } from './cloud-auth';

// ---------- Feedback ----------

export async function submitFeedback(message: string, email?: string): Promise<void> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    const { error } = await supabase.from('feedback').insert({
        user_id: user?.id ?? null,
        email: email || user?.email || null,
        message,
    });
    if (error) throw error;
}

export interface FeedbackEntry {
    id: string;
    userId: string | null;
    email: string | null;
    message: string;
    createdAt: string;
}

export async function adminListFeedback(): Promise<FeedbackEntry[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => ({ id: r.id, userId: r.user_id, email: r.email, message: r.message, createdAt: r.created_at }));
}

// ---------- Support tickets ----------

export interface SupportTicket {
    id: string;
    userId: string;
    subject: string;
    message: string;
    status: 'open' | 'resolved';
    adminReply: string | null;
    createdAt: string;
    updatedAt: string;
}

function mapTicket(row: any): SupportTicket {
    return {
        id: row.id, userId: row.user_id, subject: row.subject, message: row.message,
        status: row.status, adminReply: row.admin_reply, createdAt: row.created_at, updatedAt: row.updated_at,
    };
}

export async function createSupportTicket(subject: string, message: string): Promise<void> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) throw new Error('Sign in to your MoneyFlow Cloud account first.');
    const { error } = await supabase.from('support_tickets').insert({ user_id: user.id, subject, message });
    if (error) throw error;
}

export async function getMySupportTickets(): Promise<SupportTicket[]> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) return [];
    const { data, error } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTicket);
}

export async function adminListSupportTickets(): Promise<SupportTicket[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTicket);
}

export async function adminReplyToTicket(ticketId: string, reply: string, resolve: boolean): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase
        .from('support_tickets')
        .update({ admin_reply: reply, status: resolve ? 'resolved' : 'open', updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    if (error) throw error;
}

// ---------- Account deletion requests ----------

export async function requestAccountDeletion(reason?: string): Promise<void> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) throw new Error('Sign in to your MoneyFlow Cloud account first.');
    const { error } = await supabase.from('account_deletion_requests').insert({ user_id: user.id, reason: reason || null });
    if (error) throw error;
}

export async function getMyDeletionRequest(): Promise<{ id: string; status: string; createdAt: string } | null> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, status: data.status, createdAt: data.created_at } : null;
}

export async function cancelMyDeletionRequest(id: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.from('account_deletion_requests').delete().eq('id', id);
    if (error) throw error;
}

export interface DeletionRequest {
    id: string;
    userId: string;
    reason: string | null;
    status: string;
    createdAt: string;
}

export async function adminListDeletionRequests(): Promise<DeletionRequest[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('account_deletion_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => ({ id: r.id, userId: r.user_id, reason: r.reason, status: r.status, createdAt: r.created_at }));
}

export async function adminMarkDeletionProcessed(id: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase
        .from('account_deletion_requests')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

// ---------- Feature flags ----------

/**
 * Reads all flags in one call. Safe to call even when cloud isn't configured
 * or the request fails — callers get an empty map and treat every flag as off.
 */
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
    if (!isCloudConfigured()) return {};
    try {
        const supabase = requireSupabase();
        const { data, error } = await supabase.from('feature_flags').select('key, enabled');
        if (error) throw error;
        return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.enabled]));
    } catch {
        return {};
    }
}

export async function adminSetFeatureFlag(key: string, enabled: boolean): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.from('feature_flags').update({ enabled, updated_at: new Date().toISOString() }).eq('key', key);
    if (error) throw error;
}

export interface FeatureFlag { key: string; enabled: boolean; description: string | null }

export async function adminListFeatureFlags(): Promise<FeatureFlag[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('feature_flags').select('*').order('key');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ key: r.key, enabled: r.enabled, description: r.description }));
}

// ---------- Referrals ----------

function generateReferralCode(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function getOrCreateMyReferralCode(): Promise<string> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) throw new Error('Sign in to your MoneyFlow Cloud account first.');

    const { data: existing } = await supabase.from('referral_codes').select('code').eq('user_id', user.id).maybeSingle();
    if (existing) return existing.code;

    const code = generateReferralCode();
    const { error } = await supabase.from('referral_codes').insert({ user_id: user.id, code });
    if (error) throw error;
    return code;
}

export async function getMyReferralRedemptionCount(): Promise<number> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) return 0;
    const { data: codeRow } = await supabase.from('referral_codes').select('code').eq('user_id', user.id).maybeSingle();
    if (!codeRow) return 0;
    const { count, error } = await supabase
        .from('referral_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('referral_code', codeRow.code);
    if (error) throw error;
    return count ?? 0;
}

/** Called after a new signup if they entered someone else's referral code. */
export async function redeemReferralCode(code: string): Promise<void> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) return;
    await supabase.from('referral_redemptions').insert({ referral_code: code.toUpperCase(), redeemed_by: user.id });
    // Best-effort: a bad/unknown code or an already-redeemed user just fails
    // silently here rather than blocking signup over a non-essential feature.
}
