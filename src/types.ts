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
    accountId?: string; // Links to an Account (Net Worth)
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
    /** Untagged (undefined) categories are excluded from fixed/variable and essential/non-essential breakdowns. */
    isEssential?: boolean;
    isFixed?: boolean;
}

export interface Challenge {
    id: string;
    type: 'no-spend-days' | 'savings-target' | 'budget-adherence';
    target: number;
    startDate: string;
    endDate: string;
    status: 'active' | 'completed' | 'failed';
    createdAt: string;
}

export interface Budget {
    id: string;
    categoryId: string;
    amount: number;
    period: 'weekly' | 'monthly' | 'yearly';
    startDate: string; // ISO 8601
    endDate?: string;
    notes?: string;
    color?: string; // Hex color code
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
    /** Cloud account id, when signed in — scopes the local database to this
     * account so a shared browser/device can't mix two different people's
     * financial data. Omitted entirely in fully-offline (no cloud) mode. */
    dbNamespace?: string;
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

// Goals
export interface Goal {
    id: string;
    name: string;
    type: 'emergency-fund' | 'debt-payoff' | 'home-purchase' | 'vacation' | 'retirement' | 'education' | 'wedding' | 'car' | 'custom';
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;
    priority: 'high' | 'medium' | 'low';
    linkedCategoryId?: string;
    notes?: string;
    createdAt: string;
    completed: boolean;
}

// Accounts for Net Worth
export interface Account {
    id: string;
    name: string;
    type: 'savings' | 'fd' | 'ppf' | 'epf' | 'mutual-fund' | 'stocks' | 'gold' | 'property' | 'recurring-deposit' | 'chit-fund' | 'credit-card' | 'loan' | 'other';
    balance: number;
    asOfDate: string;
    notes?: string;
    interestRate: number;
    creditLimit?: number; // credit-card only: total limit, used to show utilization
    dueDate?: string; // credit-card (next bill due) or loan (next EMI due)
    emiAmount?: number; // loan only: the recurring EMI amount
    status: 'open' | 'closed'; // loan/credit-card: whether it's still active or fully paid off/closed
    // recurring-deposit / chit-fund only — periodic contribution + eventual payout.
    // balance stays a manually-updated running valuation, same as fd/ppf/mutual-fund.
    contributionAmount?: number;
    contributionFrequency?: 'weekly' | 'monthly';
    durationPeriods?: number;
    maturityDate?: string; // RD maturity date / chit payout date
    maturityValue?: number; // RD expected maturity value / chit expected-or-actual payout
}

// A single EMI/installment due date on a loan or credit-card account.
// Multiple accounts can each have many of these, independently tracked.
export interface LoanPayment {
    id: string;
    accountId: string;
    dueDate: string;
    amount: number;
    status: 'paid' | 'due' | 'overdue';
    paidDate?: string;
    notes?: string;
    createdAt: string;
}

// Internal transfer between two of the user's own accounts.
// Not income or expense - moves/settles balance between accounts (e.g. paying
// a credit card bill or EMI from a bank account).
export interface Transfer {
    id: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string; // ISO 8601
    notes?: string;
    createdAt: string;
}

// Net Worth Snapshot
export interface NetWorthSnapshot {
    date: string;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
}

// Lending & Debt - IOUs between the user and another person
export interface LendingRecord {
    id: string;
    personName: string;
    direction: 'lent' | 'borrowed'; // 'lent' = they owe you, 'borrowed' = you owe them
    amount: number; // original principal
    date: string; // ISO 8601
    dueDate?: string;
    notes?: string;
    settled: boolean;
    createdAt: string;
}

// A partial or full repayment against a LendingRecord.
// For a 'lent' record, a payment is money coming inward (they're paying you back).
// For a 'borrowed' record, a payment is money going outward (you're paying them back).
export interface LendingPayment {
    id: string;
    lendingId: string;
    amount: number;
    date: string; // ISO 8601
    notes?: string;
    createdAt: string;
}

// Manual investment ledger against an investment-type Account (mutual-fund/
// stocks/gold/property). No live market-data feed — the account's own
// `balance` remains a manually-updated valuation; this is purely a history of
// buy/sell/dividend events for that holding.
export interface InvestmentTransaction {
    id: string;
    accountId: string;
    type: 'buy' | 'sell' | 'dividend' | 'other';
    date: string; // ISO 8601
    quantity?: number;
    pricePerUnit?: number;
    amount: number;
    notes?: string;
    createdAt: string;
}

// Document Vault — insurance/tax/loan documents, stored as a local blob the
// same way transaction receipts already are (see db.writeBlob/readBlob).
export interface FinanceDocument {
    id: string;
    category: 'insurance' | 'tax' | 'loan' | 'other';
    name: string;
    filePath: string;
    expiryDate?: string;
    notes?: string;
    createdAt: string;
}

// MoneyFlow Memory - Phase 1
export interface Memory {
    id: string;
    transactionId?: string;
    title: string;
    body?: string;
    occurredAt: string; // ISO 8601
    location?: string;
    people?: string; // comma-separated names, Phase 1 simplification (People entity comes in Phase 2)
    tags?: string; // comma-separated
    visibility: 'private' | 'locked' | 'archived';
    createdAt: string;
}

export interface MemoryMedia {
    id: string;
    memoryId: string;
    type: 'photo' | 'video' | 'voice';
    blobPath: string;
    createdAt: string;
}

export type MilestoneType =
    | 'first-savings-1k' | 'first-savings-10k' | 'first-savings-50k' | 'first-savings-1l'
    | 'first-salary' | 'first-investment' | 'first-debt-cleared' | 'custom';

export interface Milestone {
    id: string;
    type: MilestoneType;
    title: string;
    description?: string;
    amount?: number;
    occurredAt: string;
    autoDetected: boolean;
    photoPath?: string;
    notes?: string;
    createdAt: string;
}

export interface LifeEvent {
    id: string;
    occurredAt: string;
    title: string;
    amount?: number;
    notes?: string;
    createdAt: string;
}

// Recurring Transactions
export interface RecurringTransaction {
    id: string;
    name: string;
    amount: number;
    type: 'income' | 'expense';
    categoryId?: string;
    frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    endDate?: string;
    nextDueDate: string;
    notes?: string;
    isSubscription: boolean;
}

