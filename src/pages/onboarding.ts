/**
 * Onboarding Page - 7-step wizard for user profile setup
 */

import { db } from '../db';
import { router } from '../router';
import { store } from '../stores';
import { showToast } from '../components/toast';
import { getCurrentISODate, escapeHtml } from '../utils';
import { startTour } from '../components/product-tour';
import type { UserProfile, FinancialGoal } from '../types';

let currentStep = 1;
let formData: Partial<UserProfile> = {
    id: 'current',
    country: 'India',
    city: 'Chennai',
    stateProvince: 'Tamil Nadu',
    primaryCurrency: 'INR',
    preferredLanguage: 'en',
    dataSharingOptOut: true,
};

/**
 * Carries over fields already known (e.g. name from the signup form) so
 * onboarding doesn't ask for the same thing twice.
 */
export function primeOnboardingFromProfile(profile: Partial<UserProfile> | null): void {
    if (!profile) return;
    formData = { ...formData, ...profile };
}

export async function renderOnboarding(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="max-w-2xl mx-auto py-8">
      <!-- Progress Bar -->
      <div class="mb-8">
        <div class="flex justify-between text-xs text-slate-400 mb-2">
          <span>Step ${currentStep} of 7</span>
          <span>${Math.round((currentStep / 7) * 100)}% complete</span>
        </div>
        <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full bg-primary-500 transition-all duration-300" style="width: ${(currentStep / 7) * 100}%"></div>
        </div>
      </div>
      
      <!-- Step Content -->
      <div class="glass-card p-8 mb-6">
        <div id="step-content"></div>
      </div>
      
      <!-- Navigation Buttons -->
      <div class="flex gap-4">
        ${currentStep > 1 ? '<button id="prev-btn" class="glass-button-secondary flex-1">Previous</button>' : ''}
        <button id="next-btn" class="glass-button flex-1">${currentStep === 7 ? 'Complete' : 'Next'}</button>
        ${currentStep < 7 ? '<button id="skip-btn" class="glass-button-secondary">Skip</button>' : ''}
      </div>
    </div>
  `;

    renderStep();

    // Navigation handlers
    document.getElementById('next-btn')?.addEventListener('click', handleNext);
    document.getElementById('prev-btn')?.addEventListener('click', handlePrev);
    document.getElementById('skip-btn')?.addEventListener('click', handleSkip);
}

function renderStep(): void {
    const stepContent = document.getElementById('step-content');
    if (!stepContent) return;

    switch (currentStep) {
        case 1:
            stepContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-2">Welcome to MoneyFlow! 👋</h2>
        <p class="text-slate-400 mb-6">Let's set up your profile to personalize your experience</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Full Name</label>
            <input type="text" id="fullName" value="${escapeHtml(formData.fullName)}"
              class="glass-input w-full" placeholder="Enter your name">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Preferred Name (optional)</label>
            <input type="text" id="preferredName" value="${escapeHtml(formData.preferredName)}"
              class="glass-input w-full" placeholder="What should we call you?">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Country</label>
            <input type="text" id="country" value="${escapeHtml(formData.country) || 'India'}"
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Currency</label>
            <select id="primaryCurrency" class="glass-input w-full">
              <option value="INR" ${formData.primaryCurrency === 'INR' ? 'selected' : ''}>₹ Indian Rupee (INR)</option>
              <option value="USD" ${formData.primaryCurrency === 'USD' ? 'selected' : ''}>$ US Dollar (USD)</option>
              <option value="EUR" ${formData.primaryCurrency === 'EUR' ? 'selected' : ''}>€ Euro (EUR)</option>
              <option value="GBP" ${formData.primaryCurrency === 'GBP' ? 'selected' : ''}>£ British Pound (GBP)</option>
              <option value="AED" ${formData.primaryCurrency === 'AED' ? 'selected' : ''}>د.إ UAE Dirham (AED)</option>
            </select>
          </div>
        </div>
      `;
            break;

        case 2:
            stepContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-2">Personal Information</h2>
        <p class="text-slate-400 mb-6">This helps us tailor budget recommendations</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Date of Birth (optional)</label>
            <input type="date" id="dateOfBirth" value="${formData.dateOfBirth?.split('T')[0] || ''}" 
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Household Size</label>
            <input type="number" id="householdSize" value="${formData.householdSize || 1}" min="1" 
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">City</label>
            <input type="text" id="city" value="${escapeHtml(formData.city) || 'Chennai'}"
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">State/Province</label>
            <input type="text" id="stateProvince" value="${formData.stateProvince || 'Tamil Nadu'}" 
              class="glass-input w-full">
          </div>
        </div>
      `;
            break;

        case 3:
            stepContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-2">Financial Profile</h2>
        <p class="text-slate-400 mb-6">Help us understand your income pattern</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Income Frequency</label>
            <select id="incomeFrequency" class="glass-input w-full">
              <option value="monthly" ${formData.incomeFrequency === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="bi-weekly" ${formData.incomeFrequency === 'bi-weekly' ? 'selected' : ''}>Bi-weekly</option>
              <option value="weekly" ${formData.incomeFrequency === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="irregular" ${formData.incomeFrequency === 'irregular' ? 'selected' : ''}>Irregular</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Approximate Monthly Income (optional)</label>
            <input type="number" id="approximateMonthlyIncome" value="${formData.approximateMonthlyIncome || ''}" 
              step="1000" min="0" class="glass-input w-full" placeholder="₹">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Main Income Source</label>
            <select id="mainIncomeSource" class="glass-input w-full">
              <option value="salary" ${formData.mainIncomeSource === 'salary' ? 'selected' : ''}>Salary</option>
              <option value="business" ${formData.mainIncomeSource === 'business' ? 'selected' : ''}>Business</option>
              <option value="freelance" ${formData.mainIncomeSource === 'freelance' ? 'selected' : ''}>Freelance</option>
              <option value="investments" ${formData.mainIncomeSource === 'investments' ? 'selected' : ''}>Investments</option>
              <option value="pension" ${formData.mainIncomeSource === 'pension' ? 'selected' : ''}>Pension</option>
              <option value="other" ${formData.mainIncomeSource === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
      `;
            break;

        case 4:
            stepContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-2">Debt & Safety Net</h2>
        <p class="text-slate-400 mb-6">Understanding your financial obligations</p>
        <div class="space-y-4">
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="hasDebt" ${formData.hasDebt ? 'checked' : ''} class="w-5 h-5">
              <span>I have existing debt</span>
            </label>
          </div>
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="hasEmergencyFund" ${formData.hasEmergencyFund ? 'checked' : ''} class="w-5 h-5">
              <span>I have an emergency fund</span>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Emergency Fund (months of expenses)</label>
            <input type="number" id="emergencyFundMonths" value="${formData.emergencyFundMonths || 0}" 
              min="0" max="24" class="glass-input w-full">
          </div>
        </div>
      `;
            break;

        case 5:
            stepContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-2">Financial Goals</h2>
        <p class="text-slate-400 mb-6">What are you working towards?</p>
        <div class="space-y-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="emergency-fund" class="goal-checkbox w-5 h-5">
            <span>Build emergency fund</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="debt-payoff" class="goal-checkbox w-5 h-5">
            <span>Pay off debt</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="retirement" class="goal-checkbox w-5 h-5">
            <span>Save for retirement</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="home-purchase" class="goal-checkbox w-5 h-5">
            <span>Buy a home</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="education" class="goal-checkbox w-5 h-5">
            <span>Education expenses</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="vacation" class="goal-checkbox w-5 h-5">
            <span>Save for vacation</span>
          </label>
        </div>
      `;
            break;

        case 6:
            stepContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-2">Preferences</h2>
        <p class="text-slate-400 mb-6">Customize your experience</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Language</label>
            <select id="preferredLanguage" class="glass-input w-full">
              <option value="en" ${formData.preferredLanguage === 'en' ? 'selected' : ''}>English</option>
              <option value="ta" ${formData.preferredLanguage === 'ta' ? 'selected' : ''}>தமிழ் (Tamil)</option>
              <option value="hi" ${formData.preferredLanguage === 'hi' ? 'selected' : ''}>हिन्दी (Hindi)</option>
            </select>
          </div>
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="notifReminders" checked class="w-5 h-5">
              <span>Send bill reminders</span>
            </label>
          </div>
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="notifOverspending" checked class="w-5 h-5">
              <span>Alert me when I overspend</span>
            </label>
          </div>
        </div>
      `;
            break;

        case 7:
            stepContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-2">All Set! 🎉</h2>
        <p class="text-slate-400 mb-6">Review your profile before we get started</p>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Name:</span>
            <span class="font-medium">${escapeHtml(formData.fullName) || 'Not set'}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Location:</span>
            <span class="font-medium">${escapeHtml(formData.city)}, ${escapeHtml(formData.country)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Currency:</span>
            <span class="font-medium">${formData.primaryCurrency}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Income:</span>
            <span class="font-medium">${formData.incomeFrequency || 'Not set'}</span>
          </div>
        </div>
        <div class="mt-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg animate-pulse-soft">
          <p class="text-sm text-center">Click Complete to start tracking your finances!</p>
        </div>
      `;
            break;
    }
}

function collectStepData(): void {
    const getValue = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value;
    const getChecked = (id: string) => (document.getElementById(id) as HTMLInputElement)?.checked;

    switch (currentStep) {
        case 1:
            formData.fullName = getValue('fullName');
            formData.preferredName = getValue('preferredName');
            formData.country = getValue('country');
            formData.primaryCurrency = getValue('primaryCurrency');
            break;
        case 2:
            const dob = getValue('dateOfBirth');
            formData.dateOfBirth = dob ? new Date(dob).toISOString() : undefined;
            formData.householdSize = parseInt(getValue('householdSize')) || 1;
            formData.city = getValue('city');
            formData.stateProvince = getValue('stateProvince');
            break;
        case 3:
            formData.incomeFrequency = getValue('incomeFrequency') as any;
            const income = getValue('approximateMonthlyIncome');
            formData.approximateMonthlyIncome = income ? parseFloat(income) : undefined;
            formData.mainIncomeSource = getValue('mainIncomeSource') as any;
            break;
        case 4:
            formData.hasDebt = getChecked('hasDebt');
            formData.hasEmergencyFund = getChecked('hasEmergencyFund');
            formData.emergencyFundMonths = parseInt(getValue('emergencyFundMonths')) || 0;
            break;
        case 5:
            const goals: FinancialGoal[] = [];
            document.querySelectorAll('.goal-checkbox:checked').forEach((el) => {
                const type = (el as HTMLInputElement).value as FinancialGoal['type'];
                goals.push({ type, priority: 'medium' });
            });
            formData.financialGoals = goals;
            break;
        case 6:
            formData.preferredLanguage = getValue('preferredLanguage') as any;
            formData.notificationPreferences = {
                reminders: getChecked('notifReminders'),
                overspendingAlerts: getChecked('notifOverspending'),
            };
            break;
    }
}

async function handleNext(): Promise<void> {
    collectStepData();

    if (currentStep === 7) {
        // Complete onboarding
        await completeOnboarding();
    } else {
        currentStep++;
        renderOnboarding();
    }
}

function handlePrev(): void {
    collectStepData();
    if (currentStep > 1) {
        currentStep--;
        renderOnboarding();
    }
}

function handleSkip(): void {
    currentStep++;
    renderOnboarding();
}

async function completeOnboarding(): Promise<void> {
    try {
        const profile: UserProfile = {
            ...formData as UserProfile,
            id: 'current',
            createdAt: getCurrentISODate(),
            lastUpdated: getCurrentISODate(),
            onboardingComplete: true,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        await db.saveProfile(profile);
        store.setProfile(profile);
        router.setOnboardingRequired(false);

        showToast('Profile created successfully! Welcome to MoneyFlow 🎉', { type: 'success', duration: 3000 });

        // Reset and navigate to dashboard
        currentStep = 1;
        formData = {};
        router.navigate('/');

        // Let the dashboard finish rendering, then start the guided tour
        setTimeout(startTour, 400);

    } catch (error) {
        console.error('[Onboarding] Error saving profile:', error);
        showToast('Failed to save profile. Please try again.', { type: 'error' });
    }
}
