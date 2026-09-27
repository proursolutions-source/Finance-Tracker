/**
 * Toast Notification Component
 */

import { getIcon } from '../utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
    type?: ToastType;
    duration?: number; // milliseconds
    icon?: string;
}

const TOAST_ICONS: Record<ToastType, string> = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info',
};

const TOAST_COLORS: Record<ToastType, string> = {
    success: 'bg-green-500/90',
    error: 'bg-red-500/90',
    warning: 'bg-yellow-500/90',
    info: 'bg-blue-500/90',
};

/**
 * Show a toast notification
 */
export function showToast(message: string, options: ToastOptions = {}): void {
    const {
        type = 'info',
        duration = 3000,
        icon = TOAST_ICONS[type],
    } = options;

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `${TOAST_COLORS[type]} backdrop-blur-md text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-down max-w-sm`;

    toast.innerHTML = `
    ${getIcon(icon, 20, 'flex-shrink-0')}
    <p class="flex-1 text-sm font-medium">${message}</p>
    <button class="toast-close flex-shrink-0 hover:opacity-70 transition-opacity">
      ${getIcon('x', 16)}
    </button>
  `;

    container.appendChild(toast);

    // Initialize icons
    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }

    // Close button
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => {
        removeToast(toast);
    });

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }
}

function removeToast(toast: HTMLElement): void {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';

    setTimeout(() => {
        toast.remove();
    }, 300);
}

/**
 * Clear all toasts
 */
export function clearToasts(): void {
    const container = document.getElementById('toast-container');
    if (container) {
        container.innerHTML = '';
    }
}
