/**
 * Settings Page - App preferences and profile management
 */

import { db } from '../db';
import { store } from '../stores';
import { formatBytes, getStorageEstimate } from '../utils';
import { showToast } from '../components/toast';

export async function renderSettings(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const profile = store.getState().userProfile;
        const storage = await getStorageEstimate();

        mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Settings</h1>
        
        <!-- Profile Section -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Profile</h2>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Name</span>
              <span class="font-medium">${profile?.fullName || 'Not set'}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Location</span>
              <span class="font-medium">${profile?.city}, ${profile?.country}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Currency</span>
              <span class="font-medium">${profile?.primaryCurrency}</span>
            </div>
          </div>
          <button class="glass-button w-full mt-4">Edit Profile</button>
        </div>
        
        <!-- Appearance -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Appearance</h2>
          <button id="theme-toggle-settings" class="glass-button-secondary w-full">
            Toggle Theme
          </button>
        </div>
        
        <!-- Storage -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Storage</h2>
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-slate-400">Used</span>
              <span class="font-medium">${formatBytes(storage.usage)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Available</span>
              <span class="font-medium">${formatBytes(storage.quota)}</span>
            </div>
            <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
              <div class="h-full bg-primary-500" style="width: ${storage.percentage}%"></div>
            </div>
          </div>
        </div>
        
        <!-- Data Management -->
        <div class="glass-card p-6">
          <h2 class="text-xl font-bold mb-4">Data Management</h2>
          <div class="space-y-3">
            <button class="glass-button-secondary w-full">Export Data (CSV)</button>
            <button class="glass-button-secondary w-full">Export Data (JSON)</button>
            <button class="glass-button-secondary w-full text-red-400">Reset All Data</button>
          </div>
        </div>
        
        <!-- About -->
        <div class="text-center mt-8 text-sm text-slate-400">
          <p>MoneyFlow v1.0.0</p>
          <p class="mt-1">Privacy-first offline finance tracker</p>
        </div>
      </div>
    `;

        // Theme toggle
        document.getElementById('theme-toggle-settings')?.addEventListener('click', () => {
            store.toggleTheme();
            showToast('Theme updated', { type: 'success', duration: 2000 });
        });

    } catch (error) {
        console.error('[Settings] Error rendering:', error);
        showToast('Failed to load settings', { type: 'error' });
    }
}
