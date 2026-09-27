/**
 * Modal Component
 */

import { getIcon } from '../utils';

interface ModalOptions {
    title: string;
    content: string | HTMLElement;
    footer?: string | HTMLElement;
    onClose?: () => void;
    closeOnBackdrop?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
};

/**
 * Show a modal dialog
 */
export function showModal(options: ModalOptions): () => void {
    const {
        title,
        content,
        footer,
        onClose,
        closeOnBackdrop = true,
        size = 'md',
    } = options;

    const container = document.getElementById('modal-container');
    if (!container) {
        console.error('Modal container not found');
        return () => { };
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in';

    const modalContent = document.createElement('div');
    modalContent.className = `glass-card ${SIZE_CLASSES[size]} w-full max-h-[90vh] flex flex-col animate-slide-up`;

    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-6 border-b border-white/10';
    header.innerHTML = `
    <h2 class="text-xl font-bold">${title}</h2>
    <button class="modal-close hover:opacity-70 transition-opacity">
      ${getIcon('x', 24)}
    </button>
  `;

    // Body
    const body = document.createElement('div');
    body.className = 'flex-1 overflow-y-auto p-6 custom-scrollbar';

    if (typeof content === 'string') {
        body.innerHTML = content;
    } else {
        body.appendChild(content);
    }

    // Footer
    let footerEl: HTMLElement | null = null;
    if (footer) {
        footerEl = document.createElement('div');
        footerEl.className = 'flex items-center justify-end gap-3 p-6 border-t border-white/10';

        if (typeof footer === 'string') {
            footerEl.innerHTML = footer;
        } else {
            footerEl.appendChild(footer);
        }
    }

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    if (footerEl) {
        modalContent.appendChild(footerEl);
    }

    modal.appendChild(modalContent);
    container.appendChild(modal);

    // Initialize icons
    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }

    // Close function
    const close = () => {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
            if (onClose) onClose();
        }, 200);
    };

    // Close button click
    const closeBtn = header.querySelector('.modal-close');
    closeBtn?.addEventListener('click', close);

    // Backdrop click
    if (closeOnBackdrop) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                close();
            }
        });
    }

    // Escape key
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', handleEscape);
        }
    };

    document.addEventListener('keydown', handleEscape);

    // Return close function
    return close;
}

/**
 * Show confirmation dialog
 */
export function showConfirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
): () => void {
    const footer = document.createElement('div');
    footer.className = 'flex gap-3';
    footer.innerHTML = `
    <button class="glass-button-secondary flex-1" data-action="cancel">Cancel</button>
    <button class="glass-button flex-1" data-action="confirm">Confirm</button>
  `;

    const close = showModal({
        title,
        content: `<p class="text-slate-300">${message}</p>`,
        footer,
        closeOnBackdrop: false,
    });

    // Attach handlers
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        close();
        if (onCancel) onCancel();
    });

    footer.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        close();
        onConfirm();
    });

    return close;
}
