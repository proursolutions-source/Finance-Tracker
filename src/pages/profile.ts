/**
 * Profile page — every detail MoneyFlow knows about the user: the account
 * identity (MoneyFlow Cloud, when configured) plus the full local profile
 * (demographics, location, preferences, financial profile, debt & savings,
 * goals & risk, notifications, privacy) that Settings only ever showed a
 * three-field slice of.
 */
import { db } from '../db';
import { store } from '../stores';
import { showToast } from '../components/toast';
import { formatDate, getIcon, escapeHtml } from '../utils';
import { isCloudConfigured, getCloudUser, getMyProfile } from '../cloud/cloud-auth';
import { getMySubscription } from '../cloud/cloud-db';
import { getCachedTier, TIER_LABELS } from '../cloud/entitlements';
import { renderAnimatedLoader } from '../components/animated-loader';
import type { UserProfile } from '../types';
import type { CloudProfile, CloudSubscription } from '../cloud/types';

export async function renderProfile(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `<div id="profile-root" class="max-w-4xl mx-auto pb-20"></div>`;
    const root = document.getElementById('profile-root')!;
    renderAnimatedLoader(root);

    const profile = store.getState().userProfile;

    let cloudProfile: CloudProfile | null = null;
    let cloudSub: CloudSubscription | null = null;
    if (isCloudConfigured()) {
        const user = await getCloudUser();
        if (user) {
            [cloudProfile, cloudSub] = await Promise.all([
                getMyProfile().catch(() => null),
                getMySubscription().catch(() => null),
            ]);
        }
    }

    render(root, profile, cloudProfile, cloudSub);
}

function render(root: HTMLElement, profile: UserProfile | null, cloudProfile: CloudProfile | null, cloudSub: CloudSubscription | null): void {
    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('user-circle', 26)} Profile</h1>
      <p class="text-sm text-slate-400 mt-1">Everything MoneyFlow knows about you.</p>
    </div>

    ${cloudProfile ? `
      <div class="glass-card p-5 mb-6">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xl font-bold flex-shrink-0">
            ${escapeHtml((cloudProfile.fullName || cloudProfile.email).charAt(0).toUpperCase())}
          </div>
          <div class="min-w-0">
            <p class="font-bold text-lg truncate">${escapeHtml(cloudProfile.fullName) || 'MoneyFlow Cloud user'}</p>
            <p class="text-sm text-slate-400 truncate">${escapeHtml(cloudProfile.email)}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div>
            <p class="text-xs uppercase text-slate-500">Role</p>
            <p class="font-medium capitalize">${cloudProfile.role}</p>
          </div>
          <div>
            <p class="text-xs uppercase text-slate-500">Status</p>
            <p class="font-medium capitalize ${cloudProfile.status === 'active' ? 'text-green-400' : 'text-red-400'}">${cloudProfile.status}</p>
          </div>
          <div>
            <p class="text-xs uppercase text-slate-500">Plan</p>
            <p class="font-medium">${cloudSub?.plan?.name || TIER_LABELS[getCachedTier()]}</p>
          </div>
          <div>
            <p class="text-xs uppercase text-slate-500">Member since</p>
            <p class="font-medium">${formatDate(cloudProfile.createdAt)}</p>
          </div>
        </div>
        <a href="#/subscription" class="text-primary-400 text-sm hover:underline mt-3 inline-block">Manage subscription &rarr;</a>
      </div>
    ` : ''}

    <form id="basic-info-form" class="glass-card p-5 mb-6">
      <h2 class="font-semibold mb-4 flex items-center gap-2">${getIcon('id-card', 16, 'text-primary-400')} Basic Info</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium mb-1">Full Name</label>
          <input type="text" name="fullName" value="${escapeHtml(profile?.fullName)}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Preferred Name</label>
          <input type="text" name="preferredName" value="${escapeHtml(profile?.preferredName)}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Date of Birth</label>
          <input type="date" name="dateOfBirth" value="${profile?.dateOfBirth || ''}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Gender</label>
          <select name="gender" class="glass-input w-full">
            <option value="">Prefer not to say</option>
            ${['male', 'female', 'non-binary', 'prefer-not-to-say'].map(g => `<option value="${g}" ${profile?.gender === g ? 'selected' : ''}>${labelize(g)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Marital Status</label>
          <select name="maritalStatus" class="glass-input w-full">
            <option value="">Not set</option>
            ${['single', 'married', 'divorced', 'widowed'].map(m => `<option value="${m}" ${profile?.maritalStatus === m ? 'selected' : ''}>${labelize(m)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Household Size</label>
          <input type="number" min="1" name="householdSize" value="${profile?.householdSize ?? ''}" class="glass-input w-full">
        </div>
      </div>
      <button type="submit" class="glass-button mt-4">Save Basic Info</button>
    </form>

    <form id="location-form" class="glass-card p-5 mb-6">
      <h2 class="font-semibold mb-4 flex items-center gap-2">${getIcon('map-pin', 16, 'text-primary-400')} Location &amp; Preferences</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium mb-1">City</label>
          <input type="text" name="city" value="${escapeHtml(profile?.city)}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">State / Province</label>
          <input type="text" name="stateProvince" value="${escapeHtml(profile?.stateProvince)}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Country</label>
          <input type="text" name="country" value="${escapeHtml(profile?.country)}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Postal Code</label>
          <input type="text" name="postalCode" value="${escapeHtml(profile?.postalCode)}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Preferred Language</label>
          <select name="preferredLanguage" class="glass-input w-full">
            ${[['en', 'English'], ['ta', 'Tamil'], ['hi', 'Hindi']].map(([v, l]) => `<option value="${v}" ${profile?.preferredLanguage === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Currency</label>
          <select name="primaryCurrency" class="glass-input w-full">
            ${['INR', 'USD', 'EUR', 'GBP', 'AED'].map(c => `<option value="${c}" ${profile?.primaryCurrency === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Timezone</label>
          <input type="text" name="timezone" value="${escapeHtml(profile?.timezone)}" placeholder="e.g. Asia/Kolkata" class="glass-input w-full">
        </div>
      </div>
      <button type="submit" class="glass-button mt-4">Save Location &amp; Preferences</button>
    </form>

    <form id="financial-form" class="glass-card p-5 mb-6">
      <h2 class="font-semibold mb-4 flex items-center gap-2">${getIcon('landmark', 16, 'text-primary-400')} Financial Profile</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium mb-1">Income Frequency</label>
          <select name="incomeFrequency" class="glass-input w-full">
            <option value="">Not set</option>
            ${['weekly', 'bi-weekly', 'monthly', 'semi-monthly', 'irregular'].map(v => `<option value="${v}" ${profile?.incomeFrequency === v ? 'selected' : ''}>${labelize(v)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Approx. Monthly Income</label>
          <input type="number" min="0" name="approximateMonthlyIncome" value="${profile?.approximateMonthlyIncome ?? ''}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Main Income Source</label>
          <select name="mainIncomeSource" class="glass-input w-full">
            <option value="">Not set</option>
            ${['salary', 'business', 'freelance', 'pension', 'investments', 'other'].map(v => `<option value="${v}" ${profile?.mainIncomeSource === v ? 'selected' : ''}>${labelize(v)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Risk Tolerance</label>
          <select name="riskTolerance" class="glass-input w-full">
            <option value="">Not set</option>
            ${['conservative', 'moderate', 'aggressive'].map(v => `<option value="${v}" ${profile?.riskTolerance === v ? 'selected' : ''}>${labelize(v)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Emergency Fund (months of expenses)</label>
          <input type="number" min="0" name="emergencyFundMonths" value="${profile?.emergencyFundMonths ?? ''}" class="glass-input w-full">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Retirement Age Goal</label>
          <input type="number" min="0" name="retirementAgeGoal" value="${profile?.retirementAgeGoal ?? ''}" class="glass-input w-full">
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 mt-4">
        ${checkbox('hasSideHustle', 'Has a side hustle', profile?.hasSideHustle)}
        ${checkbox('hasDebt', 'Currently has debt', profile?.hasDebt)}
        ${checkbox('hasEmergencyFund', 'Has an emergency fund', profile?.hasEmergencyFund)}
        ${checkbox('hasRetirementSavings', 'Has retirement savings', profile?.hasRetirementSavings)}
      </div>
      <div class="mt-4">
        <label class="block text-sm font-medium mb-2">Debt Types</label>
        <div class="grid gap-2 sm:grid-cols-2">
          ${(['credit-card', 'student-loan', 'personal-loan', 'mortgage', 'other'] as const).map(t => `
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" name="debtTypes" value="${t}" ${profile?.debtTypes?.includes(t) ? 'checked' : ''} class="rounded">
              ${labelize(t)}
            </label>
          `).join('')}
        </div>
      </div>
      <button type="submit" class="glass-button mt-4">Save Financial Profile</button>
    </form>

    <form id="privacy-form" class="glass-card p-5 mb-6">
      <h2 class="font-semibold mb-4 flex items-center gap-2">${getIcon('bell', 16, 'text-primary-400')} Notifications &amp; Privacy</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        ${checkbox('notif_reminders', 'Reminder notifications', profile?.notificationPreferences?.reminders)}
        ${checkbox('notif_overspending', 'Overspending alerts', profile?.notificationPreferences?.overspendingAlerts)}
        ${checkbox('notif_monthlyReports', 'Monthly report emails', profile?.notificationPreferences?.monthlyReports)}
        ${checkbox('dataSharingOptOut', 'Opt out of anonymous usage data sharing', profile?.dataSharingOptOut)}
      </div>
      <button type="submit" class="glass-button mt-4">Save Preferences</button>
    </form>
  `;

    if ((window as any).lucide) (window as any).lucide.createIcons();

    bindForm(root, '#basic-info-form', (fd) => ({
        fullName: str(fd, 'fullName'),
        preferredName: str(fd, 'preferredName'),
        dateOfBirth: str(fd, 'dateOfBirth'),
        gender: (str(fd, 'gender') || null) as UserProfile['gender'],
        maritalStatus: (str(fd, 'maritalStatus') || null) as UserProfile['maritalStatus'],
        householdSize: num(fd, 'householdSize'),
    }));

    bindForm(root, '#location-form', (fd) => ({
        city: str(fd, 'city'),
        stateProvince: str(fd, 'stateProvince'),
        country: str(fd, 'country'),
        postalCode: str(fd, 'postalCode'),
        preferredLanguage: fd.get('preferredLanguage') as UserProfile['preferredLanguage'],
        primaryCurrency: str(fd, 'primaryCurrency'),
        timezone: str(fd, 'timezone'),
    }));

    bindForm(root, '#financial-form', (fd) => ({
        incomeFrequency: (str(fd, 'incomeFrequency') || undefined) as UserProfile['incomeFrequency'],
        approximateMonthlyIncome: num(fd, 'approximateMonthlyIncome'),
        mainIncomeSource: (str(fd, 'mainIncomeSource') || undefined) as UserProfile['mainIncomeSource'],
        riskTolerance: (str(fd, 'riskTolerance') || null) as UserProfile['riskTolerance'],
        emergencyFundMonths: num(fd, 'emergencyFundMonths'),
        retirementAgeGoal: num(fd, 'retirementAgeGoal'),
        hasSideHustle: bool(fd, 'hasSideHustle'),
        hasDebt: bool(fd, 'hasDebt'),
        hasEmergencyFund: bool(fd, 'hasEmergencyFund'),
        hasRetirementSavings: bool(fd, 'hasRetirementSavings'),
        debtTypes: fd.getAll('debtTypes') as UserProfile['debtTypes'],
    }));

    bindForm(root, '#privacy-form', (fd) => ({
        notificationPreferences: {
            reminders: bool(fd, 'notif_reminders'),
            overspendingAlerts: bool(fd, 'notif_overspending'),
            monthlyReports: bool(fd, 'notif_monthlyReports'),
        },
        dataSharingOptOut: bool(fd, 'dataSharingOptOut'),
    }));
}

function bindForm(root: HTMLElement, selector: string, buildUpdates: (fd: FormData) => Partial<UserProfile>): void {
    const form = root.querySelector<HTMLFormElement>(selector);
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = store.getState().userProfile;
        const updated: UserProfile = {
            ...(current as UserProfile),
            id: 'current',
            createdAt: current?.createdAt || new Date().toISOString(),
            ...buildUpdates(new FormData(form)),
        };
        try {
            await db.saveProfile(updated);
            store.setProfile(updated);
            showToast('Saved', { type: 'success' });
        } catch (error) {
            console.error(error);
            showToast('Failed to save', { type: 'error' });
        }
    });
}

function checkbox(name: string, label: string, checked?: boolean): string {
    return `
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" name="${name}" ${checked ? 'checked' : ''} class="rounded">
      ${label}
    </label>
  `;
}

function labelize(value: string): string {
    return value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function str(fd: FormData, key: string): string | undefined {
    const v = (fd.get(key) as string || '').trim();
    return v || undefined;
}

function num(fd: FormData, key: string): number | undefined {
    const v = fd.get(key) as string;
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function bool(fd: FormData, key: string): boolean {
    return fd.get(key) === 'on';
}
