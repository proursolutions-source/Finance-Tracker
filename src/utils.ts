/**
 * Utility Functions for MoneyFlow
 * Indian-first formatting, date handling, validation helpers
 */

import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// Manually calculate difference in days

/**
 * Generate UUID using Web Crypto API
 */
export function uuid(): string {
    return crypto.randomUUID();
}

/**
 * Escape a string for safe interpolation into an `innerHTML` template.
 * Pages build their markup as template strings rather than DOM APIs, so any
 * free-text field a user can type (payee, notes, names, etc.) must go
 * through this before interpolation — otherwise a payee like
 * `<img src=x onerror=alert(1)>` renders as live HTML instead of text.
 */
export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Convert a `<input type="date">` value (YYYY-MM-DD, no time/timezone) into an ISO timestamp,
 * combining the picked calendar date with the current local time-of-day.
 * `new Date(dateStr).toISOString()` parses date-only strings as UTC midnight, which in
 * timezones ahead of UTC (e.g. IST) makes "today" look several hours in the past relative to
 * other timestamps recorded with `new Date().toISOString()` (e.g. auto-generated recurring
 * transactions) — breaking relative-time display and chronological ordering for same-day entries.
 */
export function dateInputToISO(dateStr: string): string {
    const now = new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
}

/**
 * Format currency with Indian numbering system
 * @param amount - Amount in base unit (e.g., rupees)
 * @param currency - Currency code (default: INR)
 * @param locale - Locale for formatting (default: en-IN)
 */
export function formatCurrency(
    amount: number,
    currency: string = 'INR',
    locale: string = 'en-IN'
): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format number with Indian numbering system (1,23,456.00)
 */
export function formatNumber(num: number, decimals: number = 2): string {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Format date in DD/MM/YYYY format (Indian standard)
 */
export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
}

/**
 * Format date as relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffMins < 1 ? 'Just now' : `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        }
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return formatDate(dateObj, 'dd MMM yyyy');
    }
}

/**
 * Get current date as ISO string (for DB storage)
 */
export function getCurrentISODate(): string {
    return new Date().toISOString();
}

/**
 * Get start of current month as ISO string
 */
export function getStartOfMonthISO(): string {
    return startOfMonth(new Date()).toISOString();
}

/**
 * Get end of current month as ISO string
 */
export function getEndOfMonthISO(): string {
    return endOfMonth(new Date()).toISOString();
}

/**
 * Get date range for last N months
 */
export function getLastNMonths(n: number): { start: string; end: string } {
    const end = new Date();
    const start = subMonths(end, n);
    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}

/**
 * Hash password using Web Crypto API (for local auth)
 * @param password - Plain text password
 * @returns Hex string of hash
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;

        if (timeout !== null) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;

        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Parse JSON safely
 */
export function safeJSONParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * Convert File to ArrayBuffer
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

export const MAX_RECEIPT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** Magic-byte signatures for the file types the receipt uploader accepts. */
const FILE_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
    { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
    { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // 'RIFF'; WEBP marker follows at offset 8, checked separately below
    { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // '%PDF'
];

/**
 * Verifies a file's actual content matches a real image (or PDF), rather than
 * trusting its extension or declared MIME type — both of which are trivial to
 * spoof (e.g. renaming a `.html` file with an embedded `<script>` to
 * `photo.jpg`). Reads only the first 12 bytes, not the whole file.
 */
export async function isGenuineReceiptFile(file: File): Promise<boolean> {
    if (file.size === 0 || file.size > MAX_RECEIPT_FILE_SIZE) return false;

    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    for (const sig of FILE_SIGNATURES) {
        if (sig.bytes.every((byte, i) => head[i] === byte)) {
            if (sig.mime === 'image/webp') {
                // RIFF container also covers WAV/AVI; confirm the WEBP tag at byte 8.
                const tag = String.fromCharCode(head[8], head[9], head[10], head[11]);
                if (tag !== 'WEBP') continue;
            }
            return true;
        }
    }
    return false;
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Get lucide icon HTML
 * Requires lucide to be loaded globally
 */
export function getIcon(name: string, size: number = 24, className: string = ''): string {
    return `<i data-lucide="${name}" class="${className}" style="width:${size}px;height:${size}px"></i>`;
}

/**
 * Calculate budget percentage
 */
export function getBudgetPercentage(spent: number, budget: number): number {
    if (budget === 0) return 0;
    return Math.round((spent / budget) * 100);
}

/**
 * Get budget status color
 */
export function getBudgetStatusColor(percentage: number): string {
    if (percentage < 70) return 'text-green-500';
    if (percentage < 90) return 'text-yellow-500';
    if (percentage < 100) return 'text-orange-500';
    return 'text-red-500';
}

/**
 * Truncate text
 */
export function truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Check if dark mode is preferred
 */
export function isDarkModePreferred(): boolean {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Get stored theme or system preference
 */
export function getTheme(): 'light' | 'dark' {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return isDarkModePreferred() ? 'dark' : 'light';
}

/**
 * Set theme
 */
export function setTheme(theme: 'light' | 'dark'): void {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    // Without this, browsers default to light-themed native controls (select
    // dropdown popups, checkboxes, date pickers, scrollbars) regardless of the
    // app's own dark styling — e.g. a category dropdown's closed control matches
    // dark mode, but its open option list renders black-on-black or otherwise
    // mismatched because the browser never knew this page was dark.
    document.documentElement.style.colorScheme = theme;
}

/**
 * Toggle theme
 */
export function toggleTheme(): 'light' | 'dark' {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    return newTheme;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

/**
 * Show browser notification
 */
export function showNotification(title: string, options?: NotificationOptions): void {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png',
            ...options,
        });
    }
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentage = quota > 0 ? Math.round((usage / quota) * 100) : 0;

        return { usage, quota, percentage };
    }

    return { usage: 0, quota: 0, percentage: 0 };
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
