/**
 * Interactive product tour - a short, dismissible walkthrough shown once to
 * new users right after they finish onboarding, highlighting where the main
 * features live. Replayable any time from Settings.
 */

interface TourStep {
    selector?: string; // CSS selector of the element to highlight; omitted = centered intro/outro slide
    title: string;
    body: string;
}

const STEPS: TourStep[] = [
    {
        title: 'Welcome to MoneyFlow! 👋',
        body: "Here's a 60-second tour of where everything lives. You can skip this any time and replay it later from Settings.",
    },
    {
        selector: '#global-add-btn',
        title: 'Add anything, from anywhere',
        body: 'This button is always here. Use it to log a transaction in a couple of taps, no matter which page you\'re on.',
    },
    {
        selector: 'a[href="#/transactions"]',
        title: 'Transactions',
        body: 'Every income and expense, with search, filters, receipt photos, bill scanning, and splitting a bill with friends.',
    },
    {
        selector: 'a[href="#/budgets"]',
        title: 'Budgets',
        body: 'Set a spending limit per category and see exactly how close you are to it each month.',
    },
    {
        selector: 'a[href="#/networth"]',
        title: 'Net Worth',
        body: 'Track savings, investments, credit cards, and loans in one place, plus transfers between your own accounts.',
    },
    {
        selector: 'a[href="#/lending"]',
        title: 'Lending & Debt',
        body: 'Keep track of money you\'ve lent to or borrowed from people, with partial repayments.',
    },
    {
        selector: 'a[href="#/reports"]',
        title: 'Reports',
        body: 'See income vs. expense trends, and a Projection vs. Actual view comparing what you planned to spend against what you actually spent.',
    },
    {
        selector: 'a[href="#/settings"]',
        title: 'Settings',
        body: 'Your profile, an optional PIN lock, notifications, and one-click export of all your data.',
    },
    {
        title: "You're all set! 🎉",
        body: 'Start by adding your first transaction, or explore any section from the sidebar. You\'ve got this.',
    },
];

const COMPLETED_KEY = 'moneyflow-tour-completed';

export function hasTourCompleted(): boolean {
    return !!localStorage.getItem(COMPLETED_KEY);
}

function findVisible(selector: string): HTMLElement | null {
    const candidates = document.querySelectorAll<HTMLElement>(selector);
    for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
    }
    return null;
}

export function startTour(): void {
    let index = 0;

    const overlay = document.createElement('div');
    overlay.id = 'product-tour-overlay';
    overlay.className = 'fixed inset-0 z-[95]';
    document.body.appendChild(overlay);

    function cleanup(): void {
        overlay.remove();
        window.removeEventListener('resize', render);
    }

    function finish(): void {
        localStorage.setItem(COMPLETED_KEY, '1');
        cleanup();
    }

    function render(): void {
        const step = STEPS[index];
        const target = step.selector ? findVisible(step.selector) : null;
        const rect = target?.getBoundingClientRect();

        overlay.innerHTML = '';

        // Dimmed backdrop with a cut-out around the target (or fully dimmed for centered slides)
        const backdrop = document.createElement('div');
        backdrop.className = 'absolute inset-0 bg-black/70';
        overlay.appendChild(backdrop);

        if (rect) {
            const pad = 8;
            const highlight = document.createElement('div');
            highlight.className = 'absolute rounded-xl ring-4 ring-primary-400 transition-all';
            highlight.style.left = `${rect.left - pad}px`;
            highlight.style.top = `${rect.top - pad}px`;
            highlight.style.width = `${rect.width + pad * 2}px`;
            highlight.style.height = `${rect.height + pad * 2}px`;
            highlight.style.boxShadow = '0 0 0 4000px rgba(0,0,0,0.7)';
            highlight.style.background = 'transparent';
            overlay.appendChild(highlight);
            backdrop.remove(); // the highlight's giant box-shadow does the dimming so the cutout is truly clear
        }

        const card = document.createElement('div');
        card.className = 'absolute glass-card p-5 w-80 max-w-[90vw] shadow-2xl border border-white/10';

        if (rect) {
            // Position below the target if there's room, else above; clamp horizontally
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow > 220 ? rect.bottom + 12 : Math.max(12, rect.top - 200);
            let left = rect.left;
            left = Math.min(Math.max(12, left), window.innerWidth - 320 - 12);
            card.style.top = `${top}px`;
            card.style.left = `${left}px`;
        } else {
            card.style.top = '50%';
            card.style.left = '50%';
            card.style.transform = 'translate(-50%, -50%)';
        }

        card.innerHTML = `
      <p class="text-xs text-primary-400 font-semibold mb-1">STEP ${index + 1} OF ${STEPS.length}</p>
      <h3 class="text-lg font-bold text-white mb-2">${step.title}</h3>
      <p class="text-sm text-slate-300 mb-4">${step.body}</p>
      <div class="flex items-center justify-between">
        <button id="tour-skip" class="text-sm text-slate-400 hover:text-white">Skip tour</button>
        <div class="flex gap-2">
          ${index > 0 ? '<button id="tour-back" class="glass-button-secondary px-3 py-1.5 text-sm">Back</button>' : ''}
          <button id="tour-next" class="glass-button px-3 py-1.5 text-sm">${index === STEPS.length - 1 ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    `;
        overlay.appendChild(card);

        overlay.querySelector('#tour-skip')?.addEventListener('click', finish);
        overlay.querySelector('#tour-next')?.addEventListener('click', () => {
            if (index === STEPS.length - 1) {
                finish();
            } else {
                index++;
                render();
            }
        });
        overlay.querySelector('#tour-back')?.addEventListener('click', () => {
            index = Math.max(0, index - 1);
            render();
        });
    }

    window.addEventListener('resize', render);
    render();
}
