/**
 * MoneyFlow's animated loader — the same design used across the boot screen,
 * route transitions, and any other "please wait" moment, so loading always
 * looks and feels like one consistent product instead of a generic spinner.
 * Pure inline SVG + CSS (no Lottie/external asset), matching the app's
 * existing dark-navy/electric-blue identity.
 */

let stylesInjected = false;

function injectStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
    .mf-loader { width: var(--mf-loader-size, 96px); height: var(--mf-loader-size, 96px); position: relative; display: inline-grid; place-items: center; }
    .mf-loader::before {
      content: ""; position: absolute; inset: 4%; border-radius: 50%;
      background: radial-gradient(circle at 50% 45%, #101c35 0%, #080e1d 72%);
      box-shadow: 0 0 35px rgba(32,184,255,.12), inset 0 0 25px rgba(32,184,255,.08);
    }
    .mf-loader svg { width: 100%; height: 100%; position: relative; z-index: 2; overflow: visible; }
    .mf-loader .mf-track { fill: none; stroke: #17355e; stroke-width: 7; }
    .mf-loader .mf-progress {
      fill: none; stroke: url(#mf-loader-blue); stroke-width: 7; stroke-linecap: round;
      stroke-dasharray: 490; stroke-dashoffset: 490;
      transform: rotate(-90deg); transform-origin: 90px 90px;
      animation: mf-ring 2.8s cubic-bezier(.65,0,.35,1) infinite;
      filter: url(#mf-loader-glow);
    }
    .mf-loader .mf-bar { fill: url(#mf-loader-bar); transform-box: fill-box; transform-origin: bottom center; }
    .mf-loader .mf-b1 { animation: mf-bar1 2.8s cubic-bezier(.65,0,.35,1) infinite; }
    .mf-loader .mf-b2 { animation: mf-bar2 2.8s cubic-bezier(.65,0,.35,1) infinite; }
    .mf-loader .mf-b3 { animation: mf-bar3 2.8s cubic-bezier(.65,0,.35,1) infinite; }
    .mf-loader .mf-dot { fill: #20b8ff; filter: url(#mf-loader-glow); }
    .mf-loader .mf-base1 { animation: mf-dot1 2.8s ease-in-out infinite; }
    .mf-loader .mf-base2 { animation: mf-dot2 2.8s ease-in-out infinite; }
    .mf-loader .mf-base3 { animation: mf-dot3 2.8s ease-in-out infinite; }
    .mf-loader .mf-pointer-dot { animation: mf-pointerDot 2.8s ease-in-out infinite; }
    .mf-loader .mf-pointer {
      fill: none; stroke: #20b8ff; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round;
      stroke-dasharray: 160; stroke-dashoffset: 160;
      animation: mf-pointer 2.8s cubic-bezier(.65,0,.35,1) infinite;
      filter: url(#mf-loader-glow);
    }
    .mf-loader .mf-arrow {
      fill: none; stroke: #20b8ff; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round;
      stroke-dasharray: 70; stroke-dashoffset: 70;
      animation: mf-arrow 2.8s cubic-bezier(.65,0,.35,1) infinite;
      filter: url(#mf-loader-glow);
    }
    @keyframes mf-ring { 0%,8% { stroke-dashoffset: 490; } 78%,90% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 490; } }
    @keyframes mf-bar1 { 0%,12% { transform: scaleY(.08); } 30%,88% { transform: scaleY(1); } 100% { transform: scaleY(.08); } }
    @keyframes mf-bar2 { 0%,20% { transform: scaleY(.08); } 38%,88% { transform: scaleY(1); } 100% { transform: scaleY(.08); } }
    @keyframes mf-bar3 { 0%,28% { transform: scaleY(.08); } 46%,88% { transform: scaleY(1); } 100% { transform: scaleY(.08); } }
    @keyframes mf-pointer { 0%,34% { stroke-dashoffset: 160; } 58%,88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 160; } }
    @keyframes mf-arrow { 0%,48% { stroke-dashoffset: 70; } 68%,88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 70; } }
    @keyframes mf-dot1 { 0%,20% { r: 5; } 28%,88% { r: 3.5; } 100% { r: 5; } }
    @keyframes mf-dot2 { 0%,26% { r: 5; } 34%,88% { r: 3.5; } 100% { r: 5; } }
    @keyframes mf-dot3 { 0%,32% { r: 5; } 40%,88% { r: 3.5; } 100% { r: 5; } }
    @keyframes mf-pointerDot { 0%,34% { opacity: 1; transform: translate(0,0); } 58%,88% { opacity: .15; transform: translate(0,-3px); } 100% { opacity: 1; transform: translate(0,0); } }
    @media (prefers-reduced-motion: reduce) {
      .mf-loader .mf-progress, .mf-loader .mf-bar, .mf-loader .mf-dot, .mf-loader .mf-pointer, .mf-loader .mf-arrow, .mf-loader .mf-pointer-dot {
        animation: none !important;
      }
    }
  `;
    document.head.appendChild(style);
}

/**
 * Returns the loader's markup as a string, for direct innerHTML use (e.g. the
 * boot screen, which exists before any DOM-building helpers can run).
 * `size` sets both width/height in px; a repeated `id` suffix keeps multiple
 * simultaneous loaders' SVG defs (gradients/filters) from colliding.
 */
export function animatedLoaderHtml(size = 96): string {
    injectStyles();
    const uid = Math.random().toString(36).slice(2, 8);
    return `
    <div class="mf-loader" style="--mf-loader-size:${size}px" role="status" aria-label="Loading">
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <defs>
          <linearGradient id="mf-loader-blue-${uid}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#168ff0"/>
            <stop offset="55%" stop-color="#20b8ff"/>
            <stop offset="100%" stop-color="#55d2ff"/>
          </linearGradient>
          <linearGradient id="mf-loader-bar-${uid}" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#168ff0"/>
            <stop offset="100%" stop-color="#25c0ff"/>
          </linearGradient>
          <filter id="mf-loader-glow-${uid}" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle class="mf-track" cx="90" cy="90" r="78"/>
        <circle class="mf-progress" cx="90" cy="90" r="78" style="stroke:url(#mf-loader-blue-${uid});filter:url(#mf-loader-glow-${uid})"/>
        <circle class="mf-dot mf-base1" cx="55" cy="130" r="5" style="filter:url(#mf-loader-glow-${uid})"/>
        <circle class="mf-dot mf-base2" cx="90" cy="130" r="5" style="filter:url(#mf-loader-glow-${uid})"/>
        <circle class="mf-dot mf-base3" cx="125" cy="130" r="5" style="filter:url(#mf-loader-glow-${uid})"/>
        <rect class="mf-bar mf-b1" x="49" y="91" width="12" height="39" rx="3" style="fill:url(#mf-loader-bar-${uid})"/>
        <rect class="mf-bar mf-b2" x="84" y="72" width="12" height="58" rx="3" style="fill:url(#mf-loader-bar-${uid})"/>
        <rect class="mf-bar mf-b3" x="119" y="52" width="12" height="78" rx="3" style="fill:url(#mf-loader-bar-${uid})"/>
        <circle class="mf-dot mf-pointer-dot" cx="70" cy="73" r="5" style="filter:url(#mf-loader-glow-${uid})"/>
        <path class="mf-pointer" d="M70 73 L91 56 L111 64 L132 43" style="filter:url(#mf-loader-glow-${uid})"/>
        <path class="mf-arrow" d="M120 43 H132 V55" style="filter:url(#mf-loader-glow-${uid})"/>
      </svg>
    </div>
  `;
}

/** Renders the loader into a container element, optionally with a message beneath it. */
export function renderAnimatedLoader(container: HTMLElement, options?: { size?: number; message?: string }): void {
    container.innerHTML = `
    <div class="flex flex-col items-center justify-center gap-3 py-10">
      ${animatedLoaderHtml(options?.size ?? 96)}
      ${options?.message ? `<p class="text-slate-400 text-sm">${options.message}</p>` : ''}
    </div>
  `;
}
