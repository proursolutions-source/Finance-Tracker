/**
 * MoneyFlow Cloud account — a real Supabase Auth identity, separate from the
 * local device PIN/password. Only needed for Subscription and Admin features;
 * the rest of the app works fully offline without ever touching this.
 */
import { requireSupabase, isCloudConfigured, onPasswordRecovery } from '../lib/supabase';
import { logEvent } from './app-log';
import type { CloudProfile } from './types';
import type { User } from '@supabase/supabase-js';

export { isCloudConfigured };

export interface SignUpResult {
    user: User;
    /** False when the Supabase project requires email confirmation before a
     * session is issued — the account exists, but the caller must not treat
     * this as "signed in" (there is no active session yet). */
    sessionEstablished: boolean;
}

export async function signUpCloud(email: string, password: string, fullName: string): Promise<SignUpResult> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign up did not return a user.');
    void logEvent('signup', `New account created: ${email}`);
    return { user: data.user, sessionEstablished: !!data.session };
}

export async function signInCloud(email: string, password: string): Promise<User> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        void logEvent('login_failed', `Failed login attempt for ${email}`, { email });
        throw error;
    }
    void logEvent('login_success', `Signed in: ${email}`);
    return data.user;
}

/**
 * Starts the Google OAuth flow.
 *
 * On the web this navigates the whole page away to Google's consent screen
 * and back, so it never resolves with a value here — the redirect lands on
 * this same app URL with a session already established, and
 * requireCloudAuth() picks that up on the next boot.
 *
 * Inside the native Android app, Google refuses to show its sign-in page
 * inside an embedded WebView at all, so Capacitor's WebView can't be used
 * for this step. Instead: get the OAuth URL without navigating
 * (`skipBrowserRedirect`), open it in a Chrome Custom Tab (`@capacitor/browser`,
 * which Google does allow), and let `initOAuthDeepLinkListener()` in
 * oauth-deep-link.ts catch the app coming back into the foreground via the
 * `com.moneyflow.app://auth-callback` redirect registered in
 * AndroidManifest.xml, exchanging the returned code for a session there.
 */
export async function signInWithGoogle(): Promise<void> {
    const supabase = requireSupabase();
    const { isNativePlatform } = await import('../lib/platform');

    if (isNativePlatform()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: 'com.moneyflow.app://auth-callback', skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data.url) throw new Error('Supabase did not return an OAuth URL.');
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url });
        return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
    const supabase = requireSupabase();
    const { data: userData } = await supabase.auth.getUser();
    await supabase.auth.signOut();
    void logEvent('logout', `Signed out: ${userData.user?.email ?? 'unknown'}`);
    try {
        const { setAdminCache } = await import('./entitlements');
        setAdminCache(false);
    } catch { /* ignore */ }
}

/**
 * Sends a real password-reset email via Supabase Auth. Unlike the old
 * local-only device account (which had no email to send anything to, and so
 * "forgot password" just wiped local data), this is real account recovery.
 * The link in that email brings the user back to this same app URL; Supabase
 * fires a `PASSWORD_RECOVERY` auth event once they land, which
 * `initPasswordRecoveryListener()` below listens for.
 */
export async function requestPasswordReset(email: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
}

/**
 * Changes the password for the currently signed-in user, from within the app
 * (Settings), as opposed to via a password-reset email. Re-verifies the
 * current password first by attempting a real sign-in with it — Supabase's
 * updateUser() alone doesn't check this (it trusts the existing session), so
 * without this check anyone at an already-unlocked device could silently
 * change the account password without knowing it.
 */
export async function changePasswordCloud(currentPassword: string, newPassword: string): Promise<void> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user?.email) throw new Error('Not signed in.');

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verifyError) throw new Error('Current password is incorrect.');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
}

/**
 * Call once at app boot. Fires `onRecovery` whenever the user arrives via a
 * password-reset email link, so the app can show a "set new password" screen
 * instead of silently dropping them into a signed-in session.
 */
export function initPasswordRecoveryListener(onRecovery: () => void): void {
    if (!isCloudConfigured()) return;
    onPasswordRecovery(onRecovery);
}

export async function getCloudUser(): Promise<User | null> {
    if (!isCloudConfigured()) return null;
    const supabase = requireSupabase();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
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

export async function getMyProfile(): Promise<CloudProfile | null> {
    const supabase = requireSupabase();
    const user = await getCloudUser();
    if (!user) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    return mapProfile(data);
}

/**
 * Whether an email is already a registered MoneyFlow Cloud account. Used to
 * steer someone to Sign Up vs Log In automatically instead of leaving them
 * stuck on a generic "invalid credentials" error. Deliberately narrow (a
 * single boolean, via a security-definer RPC) — see the migration comment
 * for the email-enumeration trade-off this accepts.
 */
export async function checkCloudEmailExists(email: string): Promise<boolean> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc('email_exists', { p_email: email });
    if (error) throw error;
    return !!data;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
    if (!isCloudConfigured()) return false;
    try {
        const profile = await getMyProfile();
        return profile?.role === 'admin';
    } catch {
        return false;
    }
}
