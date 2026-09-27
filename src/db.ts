/**
 * Database API - Promise-based wrapper over worker messages
 * Provides a clean async API for database operations
 */

import type { WorkerMessage, WorkerResponse, Transaction, Category, Budget, Reminder, UserProfile } from './types';

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
            `INSERT INTO transactions (id, amount, type, categoryId, date, payee, notes, receiptPath, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, txn.amount, txn.type, txn.categoryId, txn.date, txn.payee || null, txn.notes || null, txn.receiptPath || null, now, now]
        );

        return id;
    }

    async getTransactions(filters?: {
        startDate?: string;
        endDate?: string;
        categoryIds?: string[];
        type?: 'income' | 'expense';
        searchQuery?: string;
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
            `INSERT INTO categories (id, name, type, icon, budget, hidden, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, cat.name, cat.type, cat.icon || null, cat.budget || null, cat.hidden ? 1 : 0, cat.color || null]
        );

        return id;
    }

    async updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<void> {
        const fields: string[] = [];
        const params: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'hidden') {
                fields.push(`${key} = ?`);
                params.push(value ? 1 : 0);
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
            `INSERT INTO budgets (id, categoryId, amount, period, startDate, endDate)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, budget.categoryId, budget.amount, budget.period, budget.startDate, budget.endDate || null]
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
}

// Singleton instance
export const db = new DatabaseAPI();
