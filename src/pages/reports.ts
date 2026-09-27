/**
 * Reports Page - Financial analytics and charts
 */

export async function renderReports(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <h1 class="text-3xl font-bold mb-6">Reports & Analytics</h1>
      
      <div class="glass-card p-6">
        <div class="text-center py-12 text-slate-400">
          <i data-lucide="bar-chart-3" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
          <p>Reports coming soon</p>
          <p class="text-sm mt-2">We're working on beautiful charts for your financial insights</p>
        </div>
      </div>
    </div>
  `;

    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }
}
