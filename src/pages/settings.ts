/**
 * Settings Page - App preferences and profile management
 */

import { db } from '../db';
import { store } from '../stores';
import { formatBytes, getStorageEstimate, downloadBlob, requestNotificationPermission, escapeHtml, formatRelativeDate } from '../utils';
import { runSync, getLastSyncedAt } from '../cloud/sync';
import { showToast } from '../components/toast';
import { showModal, showConfirm } from '../components/modal';
import { isPinSet, setPin, removePin, verifyPin } from '../components/lock-screen';
import { getConsentChoice, setConsentChoice } from '../components/cookie-consent';
import { initAnalytics } from '../analytics';
import { startTour } from '../components/product-tour';
import { signOutCloud, isCloudConfigured, changePasswordCloud } from '../cloud/cloud-auth';
import { requestAccountDeletion } from '../cloud/growth';
import type { UserProfile } from '../types';

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
              <span class="font-medium">${escapeHtml(profile?.fullName) || 'Not set'}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Location</span>
              <span class="font-medium">${escapeHtml(profile?.city)}, ${escapeHtml(profile?.country)}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Currency</span>
              <span class="font-medium">${profile?.primaryCurrency}</span>
            </div>
          </div>
          <div class="flex gap-3 mt-4">
            <button id="edit-profile-btn" class="glass-button flex-1">Edit Profile</button>
            <button id="logout-btn" class="glass-button-secondary flex-1">Log Out</button>
          </div>
          ${isCloudConfigured() ? `
          <button id="change-password-btn" class="glass-button-secondary w-full mt-3">Change Password</button>
          ` : ''}
        </div>
        
        <!-- Help -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Help</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button id="replay-tour-btn" class="glass-button-secondary">Take the Tour</button>
            <a href="/guide.html" target="_blank" class="glass-button-secondary text-center">Feature Guide</a>
            <a href="/faq.html" target="_blank" class="glass-button-secondary text-center">FAQ</a>
          </div>
          ${isCloudConfigured() ? `
          <div class="grid grid-cols-2 gap-3 mt-3">
            <a href="#/feedback" class="glass-button-secondary text-center">Feedback &amp; Support</a>
            <a href="#/referral" class="glass-button-secondary text-center">Referrals</a>
          </div>
          ` : ''}
        </div>

        <!-- Appearance -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Appearance</h2>
          <button id="theme-toggle-settings" class="glass-button-secondary w-full">
            Toggle Theme
          </button>
        </div>
        
        <!-- Privacy & Notifications -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Privacy & Notifications</h2>
          <div class="flex items-center justify-between py-2 border-b border-white/5 mb-3">
            <div>
              <p class="font-medium">Notifications</p>
              <p class="text-xs text-slate-400">
                ${typeof Notification === 'undefined' ? 'Not supported on this device' :
            Notification.permission === 'granted' ? 'Enabled — bill and budget alerts will show'
                : Notification.permission === 'denied' ? 'Blocked in browser settings'
                    : 'Not enabled yet'}
              </p>
            </div>
            ${typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? `
              <button id="enable-notifications-btn" class="glass-button-secondary text-sm px-3 py-1.5">Enable</button>
            ` : ''}
          </div>
          <div class="flex items-center justify-between py-2 border-b border-white/5 mb-3">
            <div>
              <p class="font-medium">"On This Day" Memories</p>
              <p class="text-xs text-slate-400">Show past memories on the Dashboard on matching dates</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="on-this-day-toggle" class="sr-only peer" ${localStorage.getItem('moneyflow-on-this-day-enabled') !== 'false' ? 'checked' : ''}>
              <div class="w-11 h-6 bg-white/10 peer-checked:bg-primary-500 rounded-full transition-colors"></div>
              <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>
          <div class="flex items-center justify-between py-2">
            <div>
              <p class="font-medium">App Lock (PIN)</p>
              <p class="text-xs text-slate-400">${isPinSet() ? 'PIN is set — required to open the app' : 'No PIN set'}</p>
            </div>
            <div class="flex gap-2">
              <button id="set-pin-btn" class="glass-button-secondary text-sm px-3 py-1.5">${isPinSet() ? 'Change PIN' : 'Set PIN'}</button>
              ${isPinSet() ? '<button id="remove-pin-btn" class="glass-button-secondary text-sm px-3 py-1.5 text-red-400">Remove</button>' : ''}
            </div>
          </div>
        </div>

        <!-- Cookies & Legal -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Cookies & Legal</h2>
          <div class="flex items-center justify-between py-2 border-b border-white/5 mb-3">
            <div>
              <p class="font-medium">Analytics Cookie Consent</p>
              <p class="text-xs text-slate-400">
                ${getConsentChoice() === 'accepted' ? 'Accepted — anonymous usage analytics may run'
            : getConsentChoice() === 'declined' ? 'Declined — no analytics will run'
                : 'Not decided yet'}
              </p>
            </div>
            <div class="flex gap-2">
              <button id="consent-accept-btn" class="glass-button-secondary text-sm px-3 py-1.5">Accept</button>
              <button id="consent-decline-btn" class="glass-button-secondary text-sm px-3 py-1.5">Decline</button>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 text-sm pt-2">
            <a href="/privacy.html" target="_blank" class="text-primary-400 hover:underline">Privacy Policy</a>
            <a href="/terms.html" target="_blank" class="text-primary-400 hover:underline">Terms & Conditions</a>
            <a href="/cookie-policy.html" target="_blank" class="text-primary-400 hover:underline">Cookie Policy</a>
            <a href="/disclaimers.html" target="_blank" class="text-primary-400 hover:underline">Disclaimers</a>
          </div>
        </div>

        ${isCloudConfigured() ? `
        <!-- Sync -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Cross-Device Sync</h2>
          <p class="text-xs text-slate-400 mb-3">Syncs accounts, categories, transactions, budgets, goals, reminders, and recurring items across your devices while signed in with the same MoneyFlow Cloud account. Investments, documents, achievements, and lending records stay local-only for now.</p>
          <div class="flex justify-between items-center py-2">
            <p id="last-synced-text" class="text-sm text-slate-400">Loading...</p>
            <button id="sync-now-btn" class="glass-button-secondary text-sm px-3 py-1.5">Sync Now</button>
          </div>
        </div>

        <!-- Account -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Account</h2>
          <div class="flex justify-between items-center py-2">
            <div>
              <p class="font-medium">Delete Account</p>
              <p class="text-xs text-slate-400">Requests permanent deletion — an admin processes this manually.</p>
            </div>
            <button id="request-deletion-btn" class="glass-button-secondary text-sm px-3 py-1.5 text-red-400">Request Deletion</button>
          </div>
        </div>
        ` : ''}

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
            <button id="export-csv-btn" class="glass-button-secondary w-full">Export Data (CSV)</button>
            <button id="export-json-btn" class="glass-button-secondary w-full">Export Data (JSON)</button>
            <button id="import-csv-btn" class="glass-button-secondary w-full">Import Transactions (CSV)</button>
            <input id="import-csv-input" type="file" accept=".csv,text/csv" class="hidden">
            <button id="import-json-btn" class="glass-button-secondary w-full">Import Backup (JSON)</button>
            <input id="import-json-input" type="file" accept=".json,application/json" class="hidden">
            <button id="reset-data-btn" class="glass-button-secondary w-full text-red-400">Reset All Data</button>
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
            renderSettings();
        });

        document.getElementById('edit-profile-btn')?.addEventListener('click', () => openEditProfileModal(profile));
        document.getElementById('replay-tour-btn')?.addEventListener('click', () => startTour());

        document.getElementById('logout-btn')?.addEventListener('click', () => {
            const message = isCloudConfigured()
                ? 'You will need to sign back in to your MoneyFlow Cloud account to open MoneyFlow again.'
                : 'You will need to log back in with your password to open MoneyFlow again.';
            showConfirm('Log Out', message, async () => {
                // Actually clear the Supabase session — previously this just reloaded
                // the page, which did nothing: a valid persisted session let the
                // user straight back in with no login prompt at all.
                if (isCloudConfigured()) {
                    await signOutCloud().catch(() => { /* clearing local state below still logs the user out either way */ });
                }
                location.reload();
            });
        });
        document.getElementById('change-password-btn')?.addEventListener('click', () => openChangePasswordModal());
        document.getElementById('request-deletion-btn')?.addEventListener('click', () => {
            showConfirm(
                'Request Account Deletion',
                'This submits a request for an admin to permanently delete your MoneyFlow Cloud account and data. This cannot be undone once processed.',
                async () => {
                    try {
                        await requestAccountDeletion();
                        showToast('Deletion request submitted', { type: 'success' });
                    } catch (error) {
                        console.error(error);
                        showToast('Failed to submit request', { type: 'error' });
                    }
                }
            );
        });
        if (isCloudConfigured()) {
            const lastSyncedText = document.getElementById('last-synced-text');
            const syncNowBtn = document.getElementById('sync-now-btn') as HTMLButtonElement | null;
            const refreshLastSyncedText = () => {
                if (!lastSyncedText) return;
                const last = getLastSyncedAt();
                lastSyncedText.textContent = last ? `Last synced ${formatRelativeDate(last)}` : 'Never synced yet';
            };
            refreshLastSyncedText();
            syncNowBtn?.addEventListener('click', async () => {
                syncNowBtn.disabled = true;
                syncNowBtn.textContent = 'Syncing...';
                try {
                    await runSync();
                    showToast('Synced', { type: 'success' });
                } catch (error) {
                    console.error(error);
                    showToast('Sync failed — check your connection', { type: 'error' });
                } finally {
                    syncNowBtn.disabled = false;
                    syncNowBtn.textContent = 'Sync Now';
                    refreshLastSyncedText();
                }
            });
        }

        document.getElementById('export-csv-btn')?.addEventListener('click', exportTransactionsAsCSV);
        document.getElementById('export-json-btn')?.addEventListener('click', exportAllDataAsJSON);
        document.getElementById('reset-data-btn')?.addEventListener('click', resetAllData);

        document.getElementById('enable-notifications-btn')?.addEventListener('click', async () => {
            const granted = await requestNotificationPermission();
            showToast(granted ? 'Notifications enabled' : 'Notifications permission denied', { type: granted ? 'success' : 'error' });
            renderSettings();
        });

        document.getElementById('on-this-day-toggle')?.addEventListener('change', (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            localStorage.setItem('moneyflow-on-this-day-enabled', String(enabled));
        });

        document.getElementById('set-pin-btn')?.addEventListener('click', () => openSetPinModal());
        document.getElementById('remove-pin-btn')?.addEventListener('click', () => openRemovePinModal());

        document.getElementById('consent-accept-btn')?.addEventListener('click', () => {
            setConsentChoice('accepted');
            initAnalytics();
            showToast('Analytics consent accepted', { type: 'success', duration: 2000 });
            renderSettings();
        });
        document.getElementById('consent-decline-btn')?.addEventListener('click', () => {
            setConsentChoice('declined');
            showToast('Analytics consent declined', { type: 'success', duration: 2000 });
            renderSettings();
        });

        const csvInput = document.getElementById('import-csv-input') as HTMLInputElement;
        document.getElementById('import-csv-btn')?.addEventListener('click', () => csvInput?.click());
        csvInput?.addEventListener('change', () => {
            if (csvInput.files?.[0]) importTransactionsFromCSV(csvInput.files[0]);
            csvInput.value = '';
        });

        const jsonInput = document.getElementById('import-json-input') as HTMLInputElement;
        document.getElementById('import-json-btn')?.addEventListener('click', () => jsonInput?.click());
        jsonInput?.addEventListener('change', () => {
            if (jsonInput.files?.[0]) importBackupFromJSON(jsonInput.files[0]);
            jsonInput.value = '';
        });

    } catch (error) {
        console.error('[Settings] Error rendering:', error);
        showToast('Failed to load settings', { type: 'error' });
    }
}

/**
 * Open a modal to edit the basic profile fields shown in Settings
 */
function openChangePasswordModal(): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Current Password</label>
      <input type="password" name="currentPassword" required class="glass-input w-full" autofocus>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">New Password</label>
      <input type="password" name="newPassword" required minlength="6" class="glass-input w-full" placeholder="At least 6 characters">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Confirm New Password</label>
      <input type="password" name="confirmPassword" required minlength="6" class="glass-input w-full">
    </div>
    <p id="change-password-error" class="text-sm text-red-400 h-5"></p>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Change Password</button>
  `;

    const close = showModal({ title: 'Change Password', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    const errorEl = form.querySelector('#change-password-error') as HTMLElement;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const currentPassword = formData.get('currentPassword') as string;
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (newPassword !== confirmPassword) {
            errorEl.textContent = 'New passwords do not match';
            return;
        }

        try {
            await changePasswordCloud(currentPassword, newPassword);
            showToast('Password changed', { type: 'success' });
            close();
        } catch (error: any) {
            errorEl.textContent = error?.message || 'Failed to change password';
        }
    });
}

function openEditProfileModal(profile: Readonly<UserProfile> | null): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <div>
      <label class="block text-sm font-medium mb-1">Full Name</label>
      <input type="text" name="fullName" value="${escapeHtml(profile?.fullName)}" class="glass-input w-full" placeholder="Your name">
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">City</label>
        <input type="text" name="city" value="${escapeHtml(profile?.city)}" class="glass-input w-full">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Country</label>
        <input type="text" name="country" value="${escapeHtml(profile?.country)}" class="glass-input w-full">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Currency</label>
      <select name="primaryCurrency" class="glass-input w-full">
        ${['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => `
          <option value="${c}" ${profile?.primaryCurrency === c ? 'selected' : ''}>${c}</option>
        `).join('')}
      </select>
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Save Profile</button>
  `;

    const close = showModal({ title: 'Edit Profile', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const updated: UserProfile = {
            ...(profile as UserProfile),
            id: 'current',
            createdAt: profile?.createdAt || new Date().toISOString(),
            fullName: (formData.get('fullName') as string) || undefined,
            city: (formData.get('city') as string) || undefined,
            country: (formData.get('country') as string) || undefined,
            primaryCurrency: formData.get('primaryCurrency') as string,
        };

        try {
            await db.saveProfile(updated);
            store.setProfile(updated);
            showToast('Profile updated successfully', { type: 'success' });
            close();
            renderSettings();
        } catch (error) {
            console.error(error);
            showToast('Failed to update profile', { type: 'error' });
        }
    });
}

/**
 * Escape a value for a CSV cell (RFC 4180 style: quote if it contains a comma, quote or newline)
 */
function csvCell(value: unknown): string {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function exportTransactionsAsCSV(): Promise<void> {
    try {
        const transactions = await db.getTransactions();
        const categories = store.getState().categories;

        const headers = ['Date', 'Type', 'Category', 'Amount', 'Payee', 'Notes'];
        const rows = transactions.map(t => {
            const cat = categories.find(c => c.id === t.categoryId);
            return [t.date, t.type, cat?.name || t.categoryId, t.amount, t.payee || '', t.notes || ''];
        });

        const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `moneyflow-transactions-${new Date().toISOString().split('T')[0]}.csv`);
        showToast('Transactions exported', { type: 'success' });
    } catch (error) {
        console.error(error);
        showToast('Failed to export CSV', { type: 'error' });
    }
}

async function exportAllDataAsJSON(): Promise<void> {
    try {
        const [
            transactions, categories, budgets, reminders, goals, accounts, recurrings, profile,
            transfers, lendings, lendingPayments, memories, memoryMedia, milestones, lifeEvents,
        ] = await Promise.all([
            db.getTransactions(),
            db.getCategories(true),
            db.getBudgets(),
            db.getReminders(true),
            db.getGoals(),
            db.getAccounts(),
            db.getRecurrings(),
            db.getProfile(),
            db.getTransfers(Number.MAX_SAFE_INTEGER),
            db.getLendings(true),
            db.getAllLendingPayments(),
            db.getMemories(),
            db.getAllMemoryMedia(),
            db.getMilestones(),
            db.getLifeEvents(),
        ]);

        const data = {
            exportedAt: new Date().toISOString(),
            profile,
            transactions,
            categories,
            budgets,
            reminders,
            goals,
            accounts,
            recurrings,
            transfers,
            lendings,
            lendingPayments,
            memories,
            memoryMedia,
            milestones,
            lifeEvents,
        };

        downloadBlob(
            new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
            `moneyflow-backup-${new Date().toISOString().split('T')[0]}.json`
        );
        showToast('Data exported', { type: 'success' });
    } catch (error) {
        console.error(error);
        showToast('Failed to export data', { type: 'error' });
    }
}

function resetAllData(): void {
    showConfirm(
        'Reset All Data',
        'This will permanently delete all your transactions, budgets, goals and settings from this device. This cannot be undone.',
        async () => {
            try {
                await db.close();
                await new Promise<void>((resolve, reject) => {
                    const req = indexedDB.deleteDatabase('moneyflow-db');
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                    req.onblocked = () => resolve();
                });
                localStorage.removeItem('theme');
                location.reload();
            } catch (error) {
                console.error(error);
                showToast('Failed to reset data', { type: 'error' });
            }
        }
    );
}

/**
 * Modal to set or change the app PIN
 */
function openSetPinModal(): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <p class="text-sm text-slate-400">Choose a 4-6 digit PIN. This only locks the app screen on this device — it does not encrypt your data.</p>
    <div>
      <label class="block text-sm font-medium mb-1">New PIN</label>
      <input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" required class="glass-input w-full text-center tracking-widest">
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Confirm PIN</label>
      <input type="password" name="confirmPin" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" required class="glass-input w-full text-center tracking-widest">
    </div>
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">Save PIN</button>
  `;

    const close = showModal({ title: isPinSet() ? 'Change PIN' : 'Set PIN', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const pin = (formData.get('pin') as string || '').replace(/\D/g, '');
        const confirmPin = (formData.get('confirmPin') as string || '').replace(/\D/g, '');

        if (pin.length < 4) {
            showToast('PIN must be at least 4 digits', { type: 'error' });
            return;
        }
        if (pin !== confirmPin) {
            showToast('PINs do not match', { type: 'error' });
            return;
        }

        await setPin(pin);
        showToast('PIN saved', { type: 'success' });
        close();
        renderSettings();
    });
}

/**
 * Modal to confirm current PIN before removing app lock
 */
function openRemovePinModal(): void {
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <p class="text-sm text-slate-400">Enter your current PIN to remove app lock.</p>
    <input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" required class="glass-input w-full text-center tracking-widest">
  `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button text-red-400">Remove PIN</button>
  `;

    const close = showModal({ title: 'Remove PIN', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const pin = (formData.get('pin') as string || '').replace(/\D/g, '');

        const ok = await verifyPin(pin);
        if (!ok) {
            showToast('Incorrect PIN', { type: 'error' });
            return;
        }

        removePin();
        showToast('App lock removed', { type: 'success' });
        close();
        renderSettings();
    });
}

/**
 * Coerce a JS value into something sql.js can bind (undefined -> null, boolean -> 0/1)
 */
function sqlSafe(value: unknown): unknown {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
}

function buildUpsertOps(table: string, rows: any[]): { sql: string; params: any[] }[] {
    return rows
        .filter(row => row && typeof row === 'object')
        .map(row => {
            const keys = Object.keys(row);
            const placeholders = keys.map(() => '?').join(', ');
            return {
                sql: `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                params: keys.map(k => sqlSafe(row[k])),
            };
        });
}

/**
 * Restore a full backup previously produced by "Export Data (JSON)".
 * Existing rows with matching ids are overwritten; nothing else is touched.
 */
async function importBackupFromJSON(file: File): Promise<void> {
    let data: any;
    try {
        data = JSON.parse(await file.text());
    } catch (error) {
        showToast('That file is not valid JSON', { type: 'error' });
        return;
    }

    showConfirm(
        'Restore Backup',
        'This will overwrite any existing records with matching IDs from this backup. Continue?',
        async () => {
            try {
                const ops: { sql: string; params: any[] }[] = [
                    ...buildUpsertOps('categories', data.categories || []),
                    ...buildUpsertOps('transactions', data.transactions || []),
                    ...buildUpsertOps('budgets', data.budgets || []),
                    ...buildUpsertOps('reminders', data.reminders || []),
                    ...buildUpsertOps('goals', data.goals || []),
                    ...buildUpsertOps('accounts', data.accounts || []),
                    ...buildUpsertOps('recurrings', data.recurrings || []),
                    ...buildUpsertOps('transfers', data.transfers || []),
                    ...buildUpsertOps('lendings', data.lendings || []),
                    ...buildUpsertOps('lending_payments', data.lendingPayments || []),
                    ...buildUpsertOps('memories', data.memories || []),
                    ...buildUpsertOps('memory_media', data.memoryMedia || []),
                    ...buildUpsertOps('milestones', data.milestones || []),
                    ...buildUpsertOps('life_events', data.lifeEvents || []),
                ];

                if (ops.length > 0) {
                    await db.transaction(ops);
                }

                if (data.profile) {
                    await db.saveProfile(data.profile);
                    store.setProfile(data.profile);
                }

                store.setCategories(await db.getCategories(true));
                showToast('Backup restored successfully', { type: 'success' });
                renderSettings();
            } catch (error) {
                console.error(error);
                showToast('Failed to restore backup', { type: 'error' });
            }
        }
    );
}

/**
 * Parse a simple RFC-4180-ish CSV (handles quoted fields with embedded commas/newlines)
 */
function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.some(c => c.length > 0)) rows.push(row);
            row = [];
        } else {
            field += char;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

/**
 * Import transactions from a CSV matching the "Export Data (CSV)" format:
 * Date, Type, Category, Amount, Payee, Notes
 */
async function importTransactionsFromCSV(file: File): Promise<void> {
    let rows: string[][];
    try {
        rows = parseCSV(await file.text());
    } catch (error) {
        showToast('Failed to read CSV file', { type: 'error' });
        return;
    }

    if (rows.length < 2) {
        showToast('CSV file has no data rows', { type: 'error' });
        return;
    }

    const header = rows[0].map(h => h.trim().toLowerCase());
    const idx = {
        date: header.indexOf('date'),
        type: header.indexOf('type'),
        category: header.indexOf('category'),
        amount: header.indexOf('amount'),
        payee: header.indexOf('payee'),
        notes: header.indexOf('notes'),
    };

    if (idx.date === -1 || idx.type === -1 || idx.category === -1 || idx.amount === -1) {
        showToast('CSV must have Date, Type, Category and Amount columns', { type: 'error' });
        return;
    }

    let categories = store.getState().categories;
    let imported = 0;
    let skipped = 0;

    for (const cols of rows.slice(1)) {
        const type = cols[idx.type]?.trim().toLowerCase();
        const amount = parseFloat(cols[idx.amount]);
        const categoryName = cols[idx.category]?.trim();
        const dateStr = cols[idx.date]?.trim();

        if ((type !== 'income' && type !== 'expense') || isNaN(amount) || !categoryName || !dateStr) {
            skipped++;
            continue;
        }

        let category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (!category) {
            const newId = await db.createCategory({ name: categoryName, type: type as 'income' | 'expense', hidden: false });
            categories = await db.getCategories(true);
            store.setCategories(categories);
            category = categories.find(c => c.id === newId)!;
        }

        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
            skipped++;
            continue;
        }

        try {
            await db.createTransaction({
                amount,
                type: type as 'income' | 'expense',
                categoryId: category.id,
                date: parsedDate.toISOString(),
                payee: cols[idx.payee]?.trim() || undefined,
                notes: cols[idx.notes]?.trim() || undefined,
            });
            imported++;
        } catch (error) {
            console.error(error);
            skipped++;
        }
    }

    showToast(`Imported ${imported} transaction${imported === 1 ? '' : 's'}${skipped > 0 ? `, skipped ${skipped}` : ''}`, {
        type: imported > 0 ? 'success' : 'error',
    });
    window.dispatchEvent(new CustomEvent('transaction-changed'));
    renderSettings();
}
