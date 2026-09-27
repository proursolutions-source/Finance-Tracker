/**
 * Application-level event log — login/security events and client-side
 * errors, written to Supabase so the Admin Portal has real visibility.
 * Deliberately best-effort: a logging failure must never break the feature
 * that triggered it, so every call swallows its own errors.
 */
import { requireSupabase, isCloudConfigured } from '../lib/supabase';
import type { AppEvent, AppEventType } from './types';

export async function logEvent(eventType: AppEventType, message: string, details?: Record<string, unknown>): Promise<void> {
    if (!isCloudConfigured()) return;
    try {
        const supabase = requireSupabase();
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from('app_events').insert({
            user_id: userData.user?.id ?? null,
            event_type: eventType,
            message,
            details: details ?? null,
        });
    } catch {
        // Logging must never break the caller — swallow silently.
    }
}

function mapAppEvent(row: any): AppEvent {
    return {
        id: row.id,
        userId: row.user_id,
        eventType: row.event_type,
        message: row.message,
        details: row.details,
        createdAt: row.created_at,
    };
}

export async function adminListAppEvents(limit = 100): Promise<AppEvent[]> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
        .from('app_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapAppEvent);
}
