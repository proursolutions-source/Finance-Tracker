import { Capacitor } from '@capacitor/core';

/**
 * Whether the app is running inside the native Capacitor shell (Android),
 * as opposed to a regular web browser or the Electron desktop shell. Used
 * to branch flows that Capacitor's WebView can't do itself — chiefly,
 * Google OAuth, which Google refuses to render inside any embedded WebView.
 */
export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}
