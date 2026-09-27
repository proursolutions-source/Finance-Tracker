/**
 * 404 page - shown for any in-app hash route that doesn't match a page,
 * instead of silently rendering the dashboard.
 */

import { getIcon } from '../utils';

export function renderNotFound(path: string): void {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="max-w-md mx-auto text-center py-20">
      <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
        ${getIcon('compass', 40, 'text-slate-400')}
      </div>
      <h1 class="text-4xl font-bold mb-2">404</h1>
      <p class="text-slate-400 mb-1">There's no page at</p>
      <p class="text-slate-500 font-mono text-sm mb-6">#${path}</p>
      <a href="#/" class="glass-button inline-flex items-center gap-2 px-6 py-3">
        ${getIcon('home', 16)} Back to Dashboard
      </a>
    </div>
  `;

    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }
}
