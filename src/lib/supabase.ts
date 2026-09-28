/**
 * Supabase client — the cloud backend for MoneyFlow's subscription, admin,
 * and (later) multi-device sync features. Entirely separate from the local
 * sql.js database: local mode keeps working with zero Supabase configuration.
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time (see
 * .env.example and SETUP_SUPABASE.md). Until those are set, isCloudConfigured()
 * returns false and every cloud feature shows an honest "not set up yet" state
 * instead of silently failing or faking success.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isCloudConfigured(): boolean {
    return Boolean(url && anonKey);
}

export const supabase: SupabaseClient | null = isCloudConfigured()
    ? createClient(url as string, anonKey as string, {
        // PKCE (not the default 'implicit') so the OAuth redirect carries a
        // plain `?code=` query param rather than a `#access_token=` URL
        // fragment — fragments can get silently dropped when Android passes
        // a custom-scheme deep link through an Intent to the app, which
        // would otherwise break Google sign-in in the native app.
        auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
    })
    : null;

export function requireSupabase(): SupabaseClient {
    if (!supabase) {
        throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see SETUP_SUPABASE.md).');
    }
    return supabase;
}

/**
 * Registered here, at module load, so it's attached before Supabase's own
 * async URL-session-detection has a chance to fire the event — a subscriber
 * that only calls supabase.auth.onAuthStateChange() later (e.g. once main.ts
 * gets around to it) could miss the event entirely if it already fired.
 * `passwordRecoveryPending` covers that: a late subscriber still gets called.
 */
let passwordRecoveryPending = false;
const recoveryCallbacks: Array<() => void> = [];

supabase?.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryPending = true;
        recoveryCallbacks.forEach(cb => cb());
    }
});

export function onPasswordRecovery(callback: () => void): void {
    if (passwordRecoveryPending) {
        callback();
        return;
    }
    recoveryCallbacks.push(callback);
}
