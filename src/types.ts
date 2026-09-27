/**
 * TypeScript Interfaces for MoneyFlow
 * All domain entities with strict typing
 */

export interface Transaction {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    categoryId: string;
    date: string; // ISO 8601 format
    payee?: string;
    notes?: string;
    receiptPath?: string; // OPFS path like 'receipts/txn-uuid.jpg'
    createdAt: string;
    updatedAt: string;
}

export interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense' | 'both';
    icon?: string; // Lucide icon name
    budget?: number;
    hidden: boolean;
    color?: string;
}

export interface Budget {
    id: string;
    categoryId: string;
    amount: number;
    period: 'weekly' | 'monthly' | 'yearly';
    startDate: string; // ISO 8601
    endDate?: string;
    createdAt: string;
}

export interface Reminder {
    id: string;
    name: string;
    amount: number;
    dueDate: string; // ISO 8601
    categoryId?: string;
    frequency: 'weekly' | 'monthly' | 'yearly';
    notes?: string;
    completed: boolean;
    createdAt: string;
}

export interface FinancialGoal {
    type: 'emergency-fund' | 'debt-payoff' | 'home-purchase' | 'vacation' | 'retirement' | 'education' | 'wedding' | 'car' | 'other';
    targetAmount?: number;
    targetDate?: string;
    priority?: 'high' | 'medium' | 'low';
    description?: string;
}

export interface UserProfile {
    id: string; // Always 'current'
    createdAt: string;

    // Basic Info
    fullName?: string;
    preferredName?: string;
    dateOfBirth?: string;

    // Demographics
    gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
    maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | null;
    householdSize?: number;

    // Location (Indian defaults)
    city?: string; // Default: Chennai
    stateProvince?: string; // Default: Tamil Nadu
    country?: string; // Default: India
    postalCode?: string;

    // Preferences
    preferredLanguage?: 'en' | 'ta' | 'hi';
    primaryCurrency?: string; // Default: INR
    timezone?: string;

    // Notification Settings
    notificationPreferences?: {
        reminders?: boolean;
        overspendingAlerts?: boolean;
        monthlyReports?: boolean;
    };

    // Financial Profile
    incomeFrequency?: 'weekly' | 'bi-weekly' | 'monthly' | 'semi-monthly' | 'irregular';
    approximateMonthlyIncome?: number;
    mainIncomeSource?: 'salary' | 'business' | 'freelance' | 'pension' | 'investments' | 'other';
    hasSideHustle?: boolean;

    // Debt & Savings
    hasDebt?: boolean;
    debtTypes?: Array<'credit-card' | 'student-loan' | 'personal-loan' | 'mortgage' | 'other'>;
    hasEmergencyFund?: boolean;
    emergencyFundMonths?: number;
    hasRetirementSavings?: boolean;
    retirementAgeGoal?: number;

    // Goals & Risk
    financialGoals?: FinancialGoal[];
    riskTolerance?: 'conservative' | 'moderate' | 'aggressive' | null;

    // Privacy
    dataSharingOptOut?: boolean;

    // Metadata
    lastUpdated?: string;
    onboardingComplete?: boolean;
}

// Worker Message Types
export interface WorkerMessage {
    type: 'exec' | 'query' | 'transaction' | 'blobWrite' | 'blobRead' | 'init' | 'close';
    sql?: string;
    params?: any[];
    ops?: { sql: string; params?: any[] }[];
    path?: string;
    data?: ArrayBuffer | Uint8Array;
    requestId?: string;
}

export interface WorkerResponse {
    requestId?: string;
    success: boolean;
    result?: any;
    rows?: any[];
    error?: string;
}

// Dashboard Summary
export interface DashboardSummary {
    balance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    budgetProgress: {
        categoryId: string;
        categoryName: string;
        spent: number;
        budget: number;
        percentage: number;
    }[];
    recentTransactions: Transaction[];
}

// Filter Options
export interface TransactionFilters {
    startDate?: string;
    endDate?: string;
    categoryIds?: string[];
    type?: 'income' | 'expense';
    searchQuery?: string;
    limit?: number;
    offset?: number;
}

// Chart Data
export interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
    }[];
}
