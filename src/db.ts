/**
 * Database API - Promise-based wrapper over worker messages
 * Provides a clean async API for database operations
 */

import type { WorkerMessage, WorkerResponse, Transaction, Category, Budget, Reminder, UserProfile, LendingRecord, LendingPayment, Transfer, Memory, MemoryMedia, Milestone, LifeEvent, InvestmentTransaction, FinanceDocument, Challenge } from './types';

import DBWorker from './worker/db-worker?worker';

class DatabaseAPI {
    private worker: Worker | null = null;
    private requestId = 0;
    private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize the database worker
     */
    async init(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            try {
                this.worker = new DBWorker();

                this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                    const { requestId, success, result, rows, error } = event.data;

                    if (requestId && this.pendingRequests.has(requestId)) {
                        const { resolve, reject } = this.pendingRequests.get(requestId)!;
                        this.pendingRequests.delete(requestId);

                        if (success) {
                            resolve(rows || result);
                        } else {
                            reject(new Error(error || 'Database operation failed'));
                        }
                    }
                };

                this.worker.onerror = (error) => {
                    console.error('[DB API] Worker error:', error);
                    reject(error);
                };

                // Send init message
                this.sendMessage({ type: 'init' })
                    .then(() => {
                        console.log('[DB API] Database initialized');
                        resolve();
                    })
                    .catch(reject);

            } catch (error) {
                reject(error);
            }
        });

        return this.initPromise;
    }

    /**
     * Send message to worker and return promise
     */
    private sendMessage(message: WorkerMessage): Promise<any> {
        if (!this.worker) {
            return Promise.reject(new Error('Worker not initialized'));
        }

        return new Promise((resolve, reject) => {
            const requestId = `req-${++this.requestId}`;
            this.pendingRequests.set(requestId, { resolve, reject });

            this.worker!.postMessage({ ...message, requestId });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Execute SQL (INSERT, UPDATE, DELETE)
     */
    async exec(sql: string, params: any[] = []): Promise<void> {
        return this.sendMessage({ type: 'exec', sql, params });
    }

    /**
     * Query SQL and return rows
     */
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        return this.sendMessage({ type: 'query', sql, params });
    }

    /**
     * Execute multiple operations in a transaction
     */
    async transaction(ops: { sql: string; params?: any[] }[]): Promise<void> {
        return this.sendMessage({ type: 'transaction', ops });
    }

    /**
     * Write blob to OPFS
     */
    async writeBlob(path: string, data: ArrayBuffer | Uint8Array): Promise<void> {
        return this.sendMessage({ type: 'blobWrite', path, data });
    }

    /**
     * Read blob from OPFS
     */
    async readBlob(path: string): Promise<ArrayBuffer> {
        return this.sendMessage({ type: 'blobRead', path });
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.worker) {
            await this.sendMessage({ type: 'close' });
            this.worker.terminate();
            this.worker = null;
        }
    }

    // === TRANSACTIONS ===

    async createTransaction(txn: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await this.exec(
            `INSERT INTO transactions (id, amount, type, categoryId, date, payee, notes, receiptPath, accountId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, txn.amount, txn.type, txn.categoryId, txn.date, txn.payee || null, txn.notes || null, txn.receiptPath || null, txn.accountId || null, now, now]
        );

        return id;
    }

    async getTransactions(filters?: {
        startDate?: string;
        endDate?: string;
        categoryIds?: string[];
        type?: 'income' | 'expense';
        searchQuery?: string;
        accountId?: string;
        limit?: number;
        offset?: number;
    }): Promise<Transaction[]> {
        let sql = 'SELECT * FROM transactions WHERE 1=1';
        const params: any[] = [];

        if (filters?.startDate) {
            sql += ' AND date >= ?';
            params.push(filters.startDate);
        }

        if (filters?.endDate) {
            sql += ' AND date <= ?';
            params.push(filters.endDate);
        }

        if (filters?.categoryIds && filters.categoryIds.length > 0) {
            sql += ` AND categoryId IN (${filters.categoryIds.map(() => '?').join(',')})`;
            params.push(...filters.categoryIds);
        }

        if (filters?.type) {
            sql += ' AND type = ?';
            params.push(filters.type);
        }

        if (filters?.searchQuery) {
            sql += ' AND (payee LIKE ? OR notes LIKE ?)';
            const search = `%${filters.searchQuery}%`;
            params.push(search, search);
        }

        if (filters?.accountId) {
            sql += ' AND accountId = ?';
            params.push(filters.accountId);
        }

        sql += ' ORDER BY date DESC';

        if (filters?.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);

            if (filters.offset) {
                sql += ' OFFSET ?';
                params.push(filters.offset);
            }
        }

        return this.query<Transaction>(sql, params);
    }

    async getTransactionById(id: string): Promise<Transaction | null> {
        const rows = await this.query<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]);
        return rows[0] || null;
    }

    async updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            params.push(value);
        });

        if (fields.length === 0) return;

        params.push(id);
        await this.exec(
            `UPDATE transactions SET ${fields.join(', ')}, updatedAt = datetime('now') WHERE id = ?`,
            params
        );
    }

    async deleteTransaction(id: string): Promise<void> {
        await this.exec('DELETE FROM transactions WHERE id = ?', [id]);
    }

    /**
     * Re-insert a previously deleted transaction with its original id intact (used for Undo)
     */
    async restoreTransaction(txn: Transaction): Promise<void> {
        await this.exec(
            `INSERT INTO transactions (id, amount, type, categoryId, date, payee, notes, receiptPath, accountId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [txn.id, txn.amount, txn.type, txn.categoryId, txn.date, txn.payee || null, txn.notes || null, txn.receiptPath || null, txn.accountId || null, txn.createdAt, txn.updatedAt]
        );
    }

    // === CATEGORIES ===

    async getCategories(includeHidden: boolean = false): Promise<Category[]> {
        const sql = includeHidden
            ? 'SELECT * FROM categories ORDER BY type, name'
            : 'SELECT * FROM categories WHERE hidden = 0 ORDER BY type, name';
        return this.query<Category>(sql);
    }

    async getCategoryById(id: string): Promise<Category | null> {
        const rows = await this.query<Category>('SELECT * FROM categories WHERE id = ?', [id]);
        return rows[0] || null;
    }

    async createCategory(cat: Omit<Category, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();

        await this.exec(
            `INSERT INTO categories (id, name, type, icon, budget, hidden, color, isEssential, isFixed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, cat.name, cat.type, cat.icon || null, cat.budget || null, cat.hidden ? 1 : 0, cat.color || null,
            cat.isEssential === undefined ? null : (cat.isEssential ? 1 : 0),
            cat.isFixed === undefined ? null : (cat.isFixed ? 1 : 0)]
        );

        return id;
    }

    async updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'hidden' || key === 'isEssential' || key === 'isFixed') {
                fields.push(`${key} = ?`);
                params.push(value === undefined ? null : (value ? 1 : 0));
            } else {
                fields.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (fields.length === 0) return;

        params.push(id);
        await this.exec(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async deleteCategory(id: string): Promise<void> {
        await this.exec('DELETE FROM categories WHERE id = ?', [id]);
    }

    // === BUDGETS ===

    async getBudgets(): Promise<Budget[]> {
        return this.query<Budget>('SELECT * FROM budgets ORDER BY startDate DESC');
    }

    async createBudget(budget: Omit<Budget, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();

        await this.exec(
            `INSERT INTO budgets (id, categoryId, amount, period, startDate, endDate, notes, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, budget.categoryId, budget.amount, budget.period, budget.startDate, budget.endDate || null, budget.notes || null, budget.color || '#3b82f6']
        );

        return id;
    }

    async updateBudget(id: string, updates: Partial<Omit<Budget, 'id'>>): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            params.push(value);
        });

        if (fields.length === 0) return;

        params.push(id);
        await this.exec(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async deleteBudget(id: string): Promise<void> {
        await this.exec('DELETE FROM budgets WHERE id = ?', [id]);
    }

    // === REMINDERS ===

    async getReminders(includeCompleted: boolean = false): Promise<Reminder[]> {
        const sql = includeCompleted
            ? 'SELECT * FROM reminders ORDER BY dueDate ASC'
            : 'SELECT * FROM reminders WHERE completed = 0 ORDER BY dueDate ASC';
        return this.query<Reminder>(sql);
    }

    async createReminder(reminder: Omit<Reminder, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();

        await this.exec(
            `INSERT INTO reminders (id, name, amount, dueDate, categoryId, frequency, notes, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, reminder.name, reminder.amount, reminder.dueDate, reminder.categoryId || null, reminder.frequency, reminder.notes || null, reminder.completed ? 1 : 0]
        );

        return id;
    }

    async updateReminder(id: string, updates: Partial<Omit<Reminder, 'id'>>): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'completed') {
                fields.push(`${key} = ?`);
                params.push(value ? 1 : 0);
            } else {
                fields.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (fields.length === 0) return;

        params.push(id);
        await this.exec(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async deleteReminder(id: string): Promise<void> {
        await this.exec('DELETE FROM reminders WHERE id = ?', [id]);
    }

    // === USER PROFILE ===

    async getProfile(): Promise<UserProfile | null> {
        const rows = await this.query<{ id: string; profileData: string }>('SELECT * FROM user_profiles WHERE id = \'current\'');
        if (rows.length === 0) return null;

        try {
            return JSON.parse(rows[0].profileData);
        } catch {
            return null;
        }
    }

    async saveProfile(profile: UserProfile): Promise<void> {
        const profileData = JSON.stringify(profile);

        await this.exec(
            `INSERT OR REPLACE INTO user_profiles (id, profileData, createdAt, updatedAt)
       VALUES ('current', ?, COALESCE((SELECT createdAt FROM user_profiles WHERE id='current'), datetime('now')), datetime('now'))`,
            [profileData]
        );
    }

    // === DASHBOARD QUERIES ===

    async getDashboardSummary(): Promise<{
        balance: number;
        monthlyIncome: number;
        monthlyExpense: number;
    }> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const [summaryRows] = await this.query<{ balance: number }>(
            `SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance FROM transactions`
        );

        const [monthlySummary] = await this.query<{ income: number; expense: number }>(
            `SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM transactions
       WHERE date >= ? AND date <= ?`,
            [startOfMonth, endOfMonth]
        );

        return {
            balance: summaryRows?.balance || 0,
            monthlyIncome: monthlySummary?.income || 0,
            monthlyExpense: monthlySummary?.expense || 0,
        };
    }

    // === ANALYTICS VIEWS ===

    async getBudgetAnalytics(): Promise<any[]> {
        return this.query('SELECT * FROM budget_vs_actual');
    }

    async getMonthlyTrends(): Promise<any[]> {
        return this.query('SELECT * FROM monthly_trends');
    }

    async getCategorySpendTrends(): Promise<any[]> {
        return this.query('SELECT * FROM category_spend_trends');
    }

    // === GOALS ===

    async getGoals(): Promise<any[]> {
        return this.query('SELECT * FROM goals ORDER BY completed ASC, priority DESC, createdAt DESC');
    }

    async getGoalProgress(): Promise<any[]> {
        return this.query('SELECT * FROM goal_progress');
    }

    async createGoal(goal: { name: string; type: string; targetAmount: number; targetDate?: string; priority?: string; linkedCategoryId?: string; notes?: string }): Promise<string> {
        const id = crypto.randomUUID();
        await this.exec(
            `INSERT INTO goals (id, name, type, targetAmount, currentAmount, targetDate, priority, linkedCategoryId, notes) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [id, goal.name, goal.type, goal.targetAmount, goal.targetDate || null, goal.priority || 'medium', goal.linkedCategoryId || null, goal.notes || null]
        );
        return id;
    }

    async updateGoal(id: string, updates: Partial<{ name: string; type: string; targetAmount: number; currentAmount: number; targetDate: string; priority: string; notes: string; completed: boolean }>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'completed') {
                fields.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            } else if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (fields.length === 0) return;
        values.push(id);
        await this.exec(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    async deleteGoal(id: string): Promise<void> {
        await this.exec('DELETE FROM goals WHERE id = ?', [id]);
    }

    // === ACCOUNTS (Net Worth) ===

    async getAccounts(): Promise<any[]> {
        return this.query('SELECT * FROM accounts ORDER BY type, name');
    }

    async createAccount(account: { name: string; type: string; balance: number; notes?: string; interestRate?: number; creditLimit?: number; dueDate?: string; emiAmount?: number }): Promise<string> {
        const id = crypto.randomUUID();
        await this.exec(
            `INSERT INTO accounts (id, name, type, balance, notes, interestRate, creditLimit, dueDate, emiAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, account.name, account.type, account.balance, account.notes || null, account.interestRate || 0, account.creditLimit || null, account.dueDate || null, account.emiAmount || null]
        );
        return id;
    }

    async updateAccount(id: string, updates: Partial<{ name: string; type: string; balance: number; notes: string; interestRate: number; creditLimit: number; dueDate: string; emiAmount: number }>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (fields.length === 0) return;
        fields.push("asOfDate = date('now')");
        values.push(id);
        await this.exec(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    async deleteAccount(id: string): Promise<void> {
        await this.exec('DELETE FROM accounts WHERE id = ?', [id]);
    }

    /**
     * Move money between two of the user's own accounts and update both
     * balances atomically. Not recorded as income/expense.
     * Liability accounts (credit-card, loan) store balance as "amount owed",
     * so paying money INTO one reduces its balance rather than increasing it.
     */
    async createTransfer(transfer: { fromAccountId: string; toAccountId: string; amount: number; date: string; notes?: string }): Promise<string> {
        const liabilityTypes = ['credit-card', 'loan'];
        const [fromAccount, toAccount] = await Promise.all([
            this.getAccountById(transfer.fromAccountId),
            this.getAccountById(transfer.toAccountId),
        ]);
        if (!fromAccount || !toAccount) throw new Error('Account not found');

        const fromDelta = liabilityTypes.includes(fromAccount.type) ? transfer.amount : -transfer.amount;
        const toDelta = liabilityTypes.includes(toAccount.type) ? -transfer.amount : transfer.amount;

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await this.transaction([
            {
                sql: `INSERT INTO transfers (id, fromAccountId, toAccountId, amount, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                params: [id, transfer.fromAccountId, transfer.toAccountId, transfer.amount, transfer.date, transfer.notes || null, now],
            },
            {
                sql: `UPDATE accounts SET balance = balance + ?, asOfDate = date('now') WHERE id = ?`,
                params: [fromDelta, transfer.fromAccountId],
            },
            {
                sql: `UPDATE accounts SET balance = balance + ?, asOfDate = date('now') WHERE id = ?`,
                params: [toDelta, transfer.toAccountId],
            },
        ]);

        return id;
    }

    async getAccountById(id: string): Promise<any | null> {
        const rows = await this.query<any>('SELECT * FROM accounts WHERE id = ?', [id]);
        return rows[0] || null;
    }

    async getTransfers(limit: number = 50): Promise<Transfer[]> {
        return this.query<Transfer>('SELECT * FROM transfers ORDER BY date DESC LIMIT ?', [limit]);
    }

    async getNetWorthSummary(): Promise<{ totalAssets: number; totalLiabilities: number; netWorth: number }> {
        const liabilityTypes = ['credit-card', 'loan'];
        const accounts = await this.getAccounts();
        let assets = 0, liabilities = 0;
        for (const a of accounts) {
            if (liabilityTypes.includes(a.type)) {
                liabilities += Math.abs(a.balance);
            } else {
                assets += a.balance;
            }
        }
        return { totalAssets: assets, totalLiabilities: liabilities, netWorth: assets - liabilities };
    }

    async snapshotNetWorth(): Promise<void> {
        const { totalAssets, totalLiabilities, netWorth } = await this.getNetWorthSummary();
        const date = new Date().toISOString().slice(0, 7) + '-01'; // YYYY-MM-01
        await this.exec(
            `INSERT OR REPLACE INTO networth_snapshots (date, totalAssets, totalLiabilities, netWorth) VALUES (?, ?, ?, ?)`,
            [date, totalAssets, totalLiabilities, netWorth]
        );
    }

    async getNetWorthHistory(): Promise<any[]> {
        return this.query('SELECT * FROM networth_snapshots ORDER BY date ASC');
    }

    // === RECURRING TRANSACTIONS ===

    async getRecurrings(): Promise<any[]> {
        return this.query('SELECT * FROM recurrings ORDER BY nextDueDate ASC');
    }

    async createRecurring(rec: { name: string; amount: number; type: string; categoryId?: string; frequency: string; startDate: string; endDate?: string; notes?: string; isSubscription?: boolean }): Promise<string> {
        const id = crypto.randomUUID();
        await this.exec(
            `INSERT INTO recurrings (id, name, amount, type, categoryId, frequency, startDate, endDate, nextDueDate, notes, isSubscription) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, rec.name, rec.amount, rec.type, rec.categoryId || null, rec.frequency, rec.startDate, rec.endDate || null, rec.startDate, rec.notes || null, rec.isSubscription ? 1 : 0]
        );
        return id;
    }

    async updateRecurring(id: string, updates: Record<string, any>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'isSubscription') {
                fields.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            } else if (value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (fields.length === 0) return;
        values.push(id);
        await this.exec(`UPDATE recurrings SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    async deleteRecurring(id: string): Promise<void> {
        await this.exec('DELETE FROM recurrings WHERE id = ?', [id]);
    }

    /**
     * Process all due recurring transactions — creates actual transactions
     * and advances nextDueDate.
     */
    async processRecurrings(): Promise<number> {
        const today = new Date().toISOString().split('T')[0];
        const due = await this.query<any>(`SELECT * FROM recurrings WHERE nextDueDate <= ? AND (endDate IS NULL OR endDate >= ?)`, [today, today]);
        let created = 0;
        for (const rec of due) {
            // Create the transaction
            await this.createTransaction({
                amount: rec.amount,
                type: rec.type,
                categoryId: rec.categoryId || 'misc',
                date: new Date().toISOString(),
                payee: rec.name,
                notes: `Auto-generated from recurring: ${rec.name}`,
            });
            // Advance nextDueDate
            const next = this.advanceDate(rec.nextDueDate, rec.frequency);
            await this.exec(`UPDATE recurrings SET nextDueDate = ? WHERE id = ?`, [next, rec.id]);
            created++;
        }
        return created;
    }

    private advanceDate(dateStr: string, frequency: string): string {
        const d = new Date(dateStr);
        switch (frequency) {
            case 'daily': d.setDate(d.getDate() + 1); break;
            case 'weekly': d.setDate(d.getDate() + 7); break;
            case 'bi-weekly': d.setDate(d.getDate() + 14); break;
            case 'monthly': d.setMonth(d.getMonth() + 1); break;
            case 'quarterly': d.setMonth(d.getMonth() + 3); break;
            case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
        }
        return d.toISOString().split('T')[0];
    }

    // === FORECAST ===

    async getForecast(): Promise<{ nextMonth: string; avgIncome: number; avgExpense: number } | null> {
        const res = await this.query<any>('SELECT * FROM forecast_monthly');
        return res[0] || null;
    }

    // === LENDING & DEBT ===

    async getLendings(includeSettled: boolean = true): Promise<LendingRecord[]> {
        const sql = includeSettled
            ? 'SELECT * FROM lendings ORDER BY settled ASC, date DESC'
            : 'SELECT * FROM lendings WHERE settled = 0 ORDER BY date DESC';
        const rows = await this.query<any>(sql);
        return rows.map(r => ({ ...r, settled: !!r.settled }));
    }

    async getLendingById(id: string): Promise<LendingRecord | null> {
        const rows = await this.query<any>('SELECT * FROM lendings WHERE id = ?', [id]);
        return rows[0] ? { ...rows[0], settled: !!rows[0].settled } : null;
    }

    async createLending(record: Omit<LendingRecord, 'id' | 'createdAt' | 'settled'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await this.exec(
            `INSERT INTO lendings (id, personName, direction, amount, date, dueDate, notes, settled, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [id, record.personName, record.direction, record.amount, record.date, record.dueDate || null, record.notes || null, now]
        );

        return id;
    }

    async updateLending(id: string, updates: Partial<Omit<LendingRecord, 'id' | 'createdAt'>>): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            params.push(key === 'settled' ? (value ? 1 : 0) : value);
        });

        if (fields.length === 0) return;

        params.push(id);
        await this.exec(`UPDATE lendings SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async deleteLending(id: string): Promise<void> {
        await this.exec('DELETE FROM lending_payments WHERE lendingId = ?', [id]);
        await this.exec('DELETE FROM lendings WHERE id = ?', [id]);
    }

    async getLendingPayments(lendingId: string): Promise<LendingPayment[]> {
        return this.query<LendingPayment>('SELECT * FROM lending_payments WHERE lendingId = ? ORDER BY date DESC', [lendingId]);
    }

    /** Every payment across every lending record — used for full-data backup/export. */
    async getAllLendingPayments(): Promise<LendingPayment[]> {
        return this.query<LendingPayment>('SELECT * FROM lending_payments ORDER BY date DESC');
    }

    /**
     * Record a repayment against a lending record. Automatically marks the
     * record settled once the total paid reaches the original amount.
     */
    async addLendingPayment(payment: Omit<LendingPayment, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await this.exec(
            `INSERT INTO lending_payments (id, lendingId, amount, date, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, payment.lendingId, payment.amount, payment.date, payment.notes || null, now]
        );

        const lending = await this.getLendingById(payment.lendingId);
        if (lending) {
            const payments = await this.getLendingPayments(payment.lendingId);
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
            if (totalPaid >= lending.amount && !lending.settled) {
                await this.updateLending(lending.id, { settled: true });
            }
        }

        return id;
    }

    async deleteLendingPayment(id: string, lendingId: string): Promise<void> {
        await this.exec('DELETE FROM lending_payments WHERE id = ?', [id]);
        // Re-evaluate settled status in case removing this payment un-settles the record
        const lending = await this.getLendingById(lendingId);
        if (lending) {
            const payments = await this.getLendingPayments(lendingId);
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
            if (totalPaid < lending.amount && lending.settled) {
                await this.updateLending(lendingId, { settled: false });
            }
        }
    }

    // === INVESTMENT TRANSACTIONS ===

    async getInvestmentTransactions(accountId?: string): Promise<InvestmentTransaction[]> {
        return accountId
            ? this.query<InvestmentTransaction>('SELECT * FROM investment_transactions WHERE accountId = ? ORDER BY date DESC', [accountId])
            : this.query<InvestmentTransaction>('SELECT * FROM investment_transactions ORDER BY date DESC');
    }

    async createInvestmentTransaction(txn: Omit<InvestmentTransaction, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.exec(
            `INSERT INTO investment_transactions (id, accountId, type, date, quantity, pricePerUnit, amount, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, txn.accountId, txn.type, txn.date, txn.quantity ?? null, txn.pricePerUnit ?? null, txn.amount, txn.notes || null, now]
        );
        return id;
    }

    async deleteInvestmentTransaction(id: string): Promise<void> {
        await this.exec('DELETE FROM investment_transactions WHERE id = ?', [id]);
    }

    // === DOCUMENT VAULT ===

    async getDocuments(category?: FinanceDocument['category']): Promise<FinanceDocument[]> {
        return category
            ? this.query<FinanceDocument>('SELECT * FROM documents WHERE category = ? ORDER BY createdAt DESC', [category])
            : this.query<FinanceDocument>('SELECT * FROM documents ORDER BY createdAt DESC');
    }

    async createDocument(doc: Omit<FinanceDocument, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.exec(
            `INSERT INTO documents (id, category, name, filePath, expiryDate, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, doc.category, doc.name, doc.filePath, doc.expiryDate || null, doc.notes || null, now]
        );
        return id;
    }

    async deleteDocument(id: string): Promise<void> {
        // Matches the existing receipt-deletion behavior elsewhere in this app:
        // the row is removed, but the underlying blob is left in place rather
        // than adding a new blob-delete worker message for this alone.
        await this.exec('DELETE FROM documents WHERE id = ?', [id]);
    }

    // === CHALLENGES (gamification) ===

    async getChallenges(): Promise<Challenge[]> {
        return this.query<Challenge>('SELECT * FROM challenges ORDER BY createdAt DESC');
    }

    async createChallenge(challenge: Omit<Challenge, 'id' | 'createdAt' | 'status'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.exec(
            `INSERT INTO challenges (id, type, target, startDate, endDate, status, createdAt)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
            [id, challenge.type, challenge.target, challenge.startDate, challenge.endDate, now]
        );
        return id;
    }

    async updateChallengeStatus(id: string, status: Challenge['status']): Promise<void> {
        await this.exec('UPDATE challenges SET status = ? WHERE id = ?', [status, id]);
    }

    async deleteChallenge(id: string): Promise<void> {
        await this.exec('DELETE FROM challenges WHERE id = ?', [id]);
    }

    // === MEMORY (Phase 1) ===

    async createMemory(memory: Omit<Memory, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.exec(
            `INSERT INTO memories (id, transactionId, title, body, occurredAt, location, people, tags, visibility, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, memory.transactionId || null, memory.title, memory.body || null, memory.occurredAt,
            memory.location || null, memory.people || null, memory.tags || null, memory.visibility, now]
        );
        return id;
    }

    async updateMemory(id: string, updates: Partial<Omit<Memory, 'id' | 'createdAt'>>): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];
        Object.entries(updates).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            params.push(value === undefined ? null : value);
        });
        if (fields.length === 0) return;
        params.push(id);
        await this.exec(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async deleteMemory(id: string): Promise<void> {
        await this.exec('DELETE FROM memory_media WHERE memoryId = ?', [id]);
        await this.exec('DELETE FROM memories WHERE id = ?', [id]);
    }

    async getMemoryByTransactionId(transactionId: string): Promise<Memory | null> {
        const rows = await this.query<Memory>('SELECT * FROM memories WHERE transactionId = ?', [transactionId]);
        return rows[0] || null;
    }

    async getMemories(options?: { excludeArchived?: boolean; limit?: number }): Promise<Memory[]> {
        let sql = 'SELECT * FROM memories WHERE 1=1';
        const params: any[] = [];
        if (options?.excludeArchived) {
            sql += " AND visibility != 'archived'";
        }
        sql += ' ORDER BY occurredAt DESC';
        if (options?.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }
        return this.query<Memory>(sql, params);
    }

    /** Memories that happened on this month/day in a previous year ("On This Day") */
    async getOnThisDayMemories(month: number, day: number): Promise<Memory[]> {
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return this.query<Memory>(
            `SELECT * FROM memories WHERE strftime('%m', occurredAt) = ? AND strftime('%d', occurredAt) = ?
       AND strftime('%Y', occurredAt) != strftime('%Y', 'now') ORDER BY occurredAt DESC`,
            [mm, dd]
        );
    }

    async addMemoryMedia(media: Omit<MemoryMedia, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.exec(
            `INSERT INTO memory_media (id, memoryId, type, blobPath, createdAt) VALUES (?, ?, ?, ?, ?)`,
            [id, media.memoryId, media.type, media.blobPath, now]
        );
        return id;
    }

    async getMemoryMedia(memoryId: string): Promise<MemoryMedia[]> {
        return this.query<MemoryMedia>('SELECT * FROM memory_media WHERE memoryId = ?', [memoryId]);
    }

    /** Every media attachment across every memory — used for full-data backup/export. */
    async getAllMemoryMedia(): Promise<MemoryMedia[]> {
        return this.query<MemoryMedia>('SELECT * FROM memory_media');
    }

    // === MILESTONES (Phase 1) ===

    async getMilestones(): Promise<Milestone[]> {
        const rows = await this.query<any>('SELECT * FROM milestones ORDER BY occurredAt DESC');
        return rows.map(r => ({ ...r, autoDetected: !!r.autoDetected }));
    }

    async createMilestone(milestone: Omit<Milestone, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.exec(
            `INSERT INTO milestones (id, type, title, description, amount, occurredAt, autoDetected, photoPath, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, milestone.type, milestone.title, milestone.description || null, milestone.amount ?? null,
            milestone.occurredAt, milestone.autoDetected ? 1 : 0, milestone.photoPath || null, milestone.notes || null, now]
        );
        return id;
    }

    async deleteMilestone(id: string): Promise<void> {
        await this.exec('DELETE FROM milestones WHERE id = ?', [id]);
    }

    /**
     * Scans transaction/lending history for milestone moments that haven't
     * been recorded yet, and inserts them. Safe to call repeatedly - a
     * partial unique index on (type) for autoDetected rows prevents duplicates.
     */
    async detectMilestones(): Promise<void> {
        const existing = await this.getMilestones();
        const existingTypes = new Set(existing.filter(m => m.autoDetected).map(m => m.type));

        const allTxns = await this.query<Transaction>('SELECT * FROM transactions ORDER BY date ASC');

        // Running savings (cumulative income - expense) thresholds
        const thresholds: { type: Milestone['type']; amount: number; title: string }[] = [
            { type: 'first-savings-1k', amount: 1000, title: 'First ₹1,000 saved' },
            { type: 'first-savings-10k', amount: 10000, title: 'First ₹10,000 saved' },
            { type: 'first-savings-50k', amount: 50000, title: 'First ₹50,000 saved' },
            { type: 'first-savings-1l', amount: 100000, title: 'First ₹1,00,000 saved' },
        ];
        let running = 0;
        const crossedAt = new Map<string, { date: string; amount: number }>();
        for (const t of allTxns) {
            running += t.type === 'income' ? t.amount : -t.amount;
            for (const th of thresholds) {
                if (running >= th.amount && !crossedAt.has(th.type)) {
                    crossedAt.set(th.type, { date: t.date, amount: running });
                }
            }
        }
        for (const th of thresholds) {
            if (existingTypes.has(th.type)) continue;
            const crossed = crossedAt.get(th.type);
            if (crossed) {
                await this.createMilestone({
                    type: th.type, title: th.title, amount: crossed.amount,
                    occurredAt: crossed.date, autoDetected: true,
                }).catch(() => { }); // unique index may race harmlessly
            }
        }

        // First salary / first investment (by category id, matching seeded defaults)
        const firstSalary = allTxns.find(t => t.type === 'income' && t.categoryId === 'cat-salary');
        if (firstSalary && !existingTypes.has('first-salary')) {
            await this.createMilestone({
                type: 'first-salary', title: 'First salary', amount: firstSalary.amount,
                occurredAt: firstSalary.date, autoDetected: true,
            }).catch(() => { });
        }

        const firstInvestment = allTxns.find(t => t.categoryId === 'cat-investments');
        if (firstInvestment && !existingTypes.has('first-investment')) {
            await this.createMilestone({
                type: 'first-investment', title: 'First investment', amount: firstInvestment.amount,
                occurredAt: firstInvestment.date, autoDetected: true,
            }).catch(() => { });
        }

        // First debt cleared (a 'borrowed' lending record that has been settled)
        if (!existingTypes.has('first-debt-cleared')) {
            const clearedDebts = await this.query<any>(
                `SELECT l.*, (SELECT MAX(p.date) FROM lending_payments p WHERE p.lendingId = l.id) AS clearedDate
         FROM lendings l WHERE l.direction = 'borrowed' AND l.settled = 1 ORDER BY clearedDate ASC LIMIT 1`
            );
            const firstCleared = clearedDebts[0];
            if (firstCleared) {
                await this.createMilestone({
                    type: 'first-debt-cleared', title: 'First debt fully cleared', amount: firstCleared.amount,
                    occurredAt: firstCleared.clearedDate || firstCleared.date, autoDetected: true,
                }).catch(() => { });
            }
        }
    }

    // === LIFE EVENTS (Phase 1) ===

    async getLifeEvents(): Promise<LifeEvent[]> {
        return this.query<LifeEvent>('SELECT * FROM life_events ORDER BY occurredAt ASC');
    }

    async createLifeEvent(event: Omit<LifeEvent, 'id' | 'createdAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await this.exec(
            `INSERT INTO life_events (id, occurredAt, title, amount, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, event.occurredAt, event.title, event.amount ?? null, event.notes || null, now]
        );
        return id;
    }

    async deleteLifeEvent(id: string): Promise<void> {
        await this.exec('DELETE FROM life_events WHERE id = ?', [id]);
    }
}

// Singleton instance
export const db = new DatabaseAPI();
