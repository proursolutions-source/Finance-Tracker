/**
 * Global State Management
 * Simple reactive store using Proxy for reactivity
 */

import type { UserProfile, Category, Transaction, Budget } from './types';

type StateChangeListener = (state: AppState) => void;

interface AppState {
    userProfile: UserProfile | null;
    categories: Category[];
    recentTransactions: Transaction[];
    budgets: Budget[];
    currentView: string;
    isLoading: boolean;
    theme: 'light' | 'dark';
}

class Store {
    private state: AppState;
    private listeners: Set<StateChangeListener> = new Set();

    constructor() {
        this.state = {
            userProfile: null,
            categories: [],
            recentTransactions: [],
            budgets: [],
            currentView: 'dashboard',
            isLoading: true,
            theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
        };

        // Apply theme immediately
        document.documentElement.classList.add(this.state.theme);
    }

    /**
     * Get current state
     */
    getState(): Readonly<AppState> {
        return { ...this.state };
    }

    /**
     * Update state and notify listeners
     */
    setState(updates: Partial<AppState>): void {
        this.state = { ...this.state, ...updates };
        this.notify();
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener);

        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Notify all listeners of state change
     */
    private notify(): void {
        this.listeners.forEach(listener => listener(this.getState()));
    }

    /**
     * Update user profile
     */
    setProfile(profile: UserProfile | null): void {
        this.setState({ userProfile: profile });
    }

    /**
     * Update categories
     */
    setCategories(categories: Category[]): void {
        this.setState({ categories });
    }

    /**
     * Update recent transactions
     */
    setRecentTransactions(transactions: Transaction[]): void {
        this.setState({ recentTransactions: transactions });
    }

    /**
     * Update budgets
     */
    setBudgets(budgets: Budget[]): void {
        this.setState({ budgets });
    }

    /**
     * Set current view
     */
    setCurrentView(view: string): void {
        this.setState({ currentView: view });
    }

    /**
     * Set loading state
     */
    setLoading(isLoading: boolean): void {
        this.setState({ isLoading });
    }

    /**
     * Set theme
     */
    setTheme(theme: 'light' | 'dark'): void {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        this.setState({ theme });
    }

    /**
     * Toggle theme
     */
    toggleTheme(): void {
        const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
}

// Singleton instance
export const store = new Store();
