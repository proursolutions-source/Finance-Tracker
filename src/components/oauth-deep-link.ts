/**
 * Catches the app being brought back to the foreground via the
 * `com.moneyflow.app://auth-callback` deep link after Google sign-in
 * finishes in an external Chrome Custom Tab (see signInWithGoogle() in
 * cloud-auth.ts for why this can't just happen inside the app's own
 * WebView). Exchanges the PKCE `code` in that URL for a real session, then
 * closes the browser tab and reloads so the rest of the app picks up the
 * now-signed-in session the same way it would after any other sign-in.
 */
import { isNativePlatform } from '../lib/platform';
import { supabase } from '../lib/supabase';

export function initOAuthDeepLinkListener(): void {
    if (!isNativePlatform() || !supabase) return;
    const client = supabase;

    import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', async ({ url }) => {
            if (!url.startsWith('com.moneyflow.app://auth-callback')) return;

            try {
                const { error } = await client.auth.exchangeCodeForSession(url);
                if (error) throw error;
            } catch (error) {
                console.error('[OAuth Deep Link] Failed to complete sign-in:', error);
            }

            try {
                const { Browser } = await import('@capacitor/browser');
                await Browser.close();
            } catch { /* the Custom Tab may already be closed — fine either way */ }

            location.reload();
        });
    });
}
