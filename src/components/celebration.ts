/**
 * A brief full-screen confetti burst for goal completions and savings
 * milestones. Pure CSS + DOM, no animation/canvas library — a few dozen
 * colored divs falling with randomized timing, auto-removed after they
 * finish. Respects prefers-reduced-motion by skipping the animation.
 */
const COLORS = ['#00c2ff', '#0099ff', '#10d39f', '#fbbf24', '#ec4899', '#8b5cf6'];

let stylesInjected = false;
function injectStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
    .mf-confetti-piece {
      position: fixed;
      top: -20px;
      width: 8px;
      height: 14px;
      opacity: 0.9;
      pointer-events: none;
      z-index: 9999;
      animation: mf-confetti-fall linear forwards;
    }
    @keyframes mf-confetti-fall {
      to { transform: translateY(105vh) rotate(540deg); opacity: 0.3; }
    }
  `;
    document.head.appendChild(style);
}

export function celebrate(message?: string): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (message) import('./toast').then(({ showToast }) => showToast(message, { type: 'success' }));
        return;
    }
    injectStyles();

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(container);

    const pieceCount = 60;
    for (let i = 0; i < pieceCount; i++) {
        const piece = document.createElement('div');
        piece.className = 'mf-confetti-piece';
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.background = COLORS[i % COLORS.length];
        piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
        piece.style.animationDelay = `${Math.random() * 0.4}s`;
        container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 3800);

    if (message) {
        import('./toast').then(({ showToast }) => showToast(message, { type: 'success', duration: 5000 }));
    }
}
