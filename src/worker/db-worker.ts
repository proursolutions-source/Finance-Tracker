/**
 * Database Worker - SQL.js with IndexedDB Persistence
 * Handles all database operations in a dedicated worker thread
 */

/// <reference lib="webworker" />

import type { WorkerMessage, WorkerResponse } from '../types';
import initSqlJs, { Database } from 'sql.js';

declare const self: DedicatedWorkerGlobalScope;

// SQL.js Database instance
let db: Database | null = null;
let SQL: any = null;

// IndexedDB for persistence
const DB_NAME = 'moneyflow-db';
const DB_STORE = 'database';

/**
 * Load database from IndexedDB
 */
async function loadFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
        };

        request.onsuccess = () => {
            const idb = request.result;
            const transaction = idb.transaction([DB_STORE], 'readonly');
            const store = transaction.objectStore(DB_STORE);
            const getRequest = store.get('data');

            getRequest.onsuccess = () => {
                resolve(getRequest.result || null);
            };

            getRequest.onerror = () => reject(getRequest.error);
        };
    });
}

/**
 * Save database to IndexedDB
 */
async function saveToIndexedDB(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            const idb = request.result;
            const transaction = idb.transaction([DB_STORE], 'readwrite');
            const store = transaction.objectStore(DB_STORE);
            const putRequest = store.put(data, 'data');

            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
    });
}

/**
 * Save database to IndexedDB
 */
async function saveDatabase(): Promise<void> {
    if (!db) return;
    const data = db.export();
    await saveToIndexedDB(data);
}

/**
 * Initialize SQL.js database
 */
async function initDatabase(): Promise<void> {
    try {
        console.log('[DB Worker] Initializing SQL.js...');

        // Initialize SQL.js
        SQL = await initSqlJs({
            locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });

        console.log('[DB Worker] SQL.js loaded');

        // Try to load existing database from IndexedDB
        const savedData = await loadFromIndexedDB();

        if (savedData) {
            db = new SQL.Database(savedData);
            console.log('[DB Worker] Loaded existing database from IndexedDB');
        } else {
            db = new SQL.Database();
            console.log('[DB Worker] Created new database');
        }

        // Create schema
        await createSchema();

        // Pre-seed defaults if needed
        await seedDefaults();

        // Save to IndexedDB
        await saveDatabase();

        console.log('[DB Worker] Database initialization complete');
    } catch (error) {
        console.error('[DB Worker] Initialization error:', error);
        throw error;
    }
}

/**
 * Create database schema with all tables and indexes
 */
async function createSchema(): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    const schema = `
    -- Transactions Table
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      categoryId TEXT NOT NULL,
      date TEXT NOT NULL,
      payee TEXT,
      notes TEXT,
      receiptPath TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
    
    -- Indexes on transactions for performance
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(categoryId);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_category_date ON transactions(categoryId, date DESC);
    
    -- Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'both')),
      icon TEXT,
      budget REAL,
      hidden INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    -- Budgets Table
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'yearly')),
      startDate TEXT NOT NULL,
      endDate TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(categoryId);
    CREATE INDEX IF NOT EXISTS idx_budgets_dates ON budgets(startDate, endDate);
    
    -- Reminders Table
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      dueDate TEXT NOT NULL,
      categoryId TEXT,
      frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
      notes TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(dueDate);
    CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(completed, dueDate);
    
    -- User Profile Table (single row with JSON data)
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY DEFAULT 'current',
      profileData TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    -- Materialized view for dashboard summary (optional - can be computed on demand)
    CREATE VIEW IF NOT EXISTS monthly_summary AS
    SELECT 
      strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS balance
    FROM transactions
    GROUP BY month
    ORDER BY month DESC;
    
    -- Trigger to update updatedAt on transactions
    CREATE TRIGGER IF NOT EXISTS update_transaction_timestamp 
    AFTER UPDATE ON transactions
    BEGIN
      UPDATE transactions SET updatedAt = datetime('now') WHERE id = NEW.id;
    END;
    
    -- Trigger to update updatedAt on user_profiles
    CREATE TRIGGER IF NOT EXISTS update_profile_timestamp 
    AFTER UPDATE ON user_profiles
    BEGIN
      UPDATE user_profiles SET updatedAt = datetime('now') WHERE id = NEW.id;
    END;
  `;

    db.run(schema);
    await saveDatabase();
    console.log('[DB Worker] Schema created successfully');
}

/**
 * Pre-seed default categories (Indian context)
 */
async function seedDefaults(): Promise<void> {
    if (!db) return;
    // Check if categories already exist
    const result = db.exec('SELECT COUNT(*) as count FROM categories');
    const count = result[0]?.values[0]?.[0] as number || 0;

    if (count > 0) {
        console.log('[DB Worker] Categories already seeded');
        return;
    }

    const defaultCategories = [
        // Expense Categories (Indian context)
        { id: 'cat-food', name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#f59e0b' },
        { id: 'cat-groceries', name: 'Groceries', type: 'expense', icon: 'shopping-cart', color: '#84cc16' },
        { id: 'cat-transport', name: 'Transport', type: 'expense', icon: 'car', color: '#3b82f6' },
        { id: 'cat-rent', name: 'Rent/EMI', type: 'expense', icon: 'home', color: '#8b5cf6' },
        { id: 'cat-utilities', name: 'Utilities', type: 'expense', icon: 'zap', color: '#f97316' },
        { id: 'cat-healthcare', name: 'Healthcare', type: 'expense', icon: 'heart-pulse', color: '#ec4899' },
        { id: 'cat-education', name: 'Education', type: 'expense', icon: 'graduation-cap', color: '#06b6d4' },
        { id: 'cat-shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#a855f7' },
        { id: 'cat-entertainment', name: 'Entertainment', type: 'expense', icon: 'film', color: '#f43f5e' },
        { id: 'cat-mobile', name: 'Mobile/Internet', type: 'expense', icon: 'smartphone', color: '#10b981' },
        { id: 'cat-insurance', name: 'Insurance', type: 'expense', icon: 'shield', color: '#6366f1' },
        { id: 'cat-other-expense', name: 'Other Expense', type: 'expense', icon: 'circle-dot', color: '#64748b' },

        // Income Categories
        { id: 'cat-salary', name: 'Salary', type: 'income', icon: 'briefcase', color: '#22c55e' },
        { id: 'cat-freelance', name: 'Freelance', type: 'income', icon: 'laptop', color: '#14b8a6' },
        { id: 'cat-business', name: 'Business', type: 'income', icon: 'store', color: '#0ea5e9' },
        { id: 'cat-investments', name: 'Investments', type: 'income', icon: 'trending-up', color: '#8b5cf6' },
        { id: 'cat-rental', name: 'Rental Income', type: 'income', icon: 'key', color: '#06b6d4' },
        { id: 'cat-other-income', name: 'Other Income', type: 'income', icon: 'plus-circle', color: '#64748b' },
    ];

    for (const cat of defaultCategories) {
        db.run(
            'INSERT INTO categories (id, name, type, icon, color, hidden) VALUES (?, ?, ?, ?, ?, 0)',
            [cat.id, cat.name, cat.type, cat.icon, cat.color]
        );
    }

    await saveDatabase();
    console.log('[DB Worker] Default categories seeded:', defaultCategories.length);
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE)
 */
function execSQL(sql: string, params: any[] = []): void {
    if (!db) throw new Error('Database not initialized');
    db.run(sql, params);
}

/**
 * Query SQL and return rows
 */
function querySQL(sql: string, params: any[] = []): any[] {
    if (!db) throw new Error('Database not initialized');
    const result = db.exec(sql, params);

    if (!result || result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map((row: any) => {
        const obj: any = {};
        columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx];
        });
        return obj;
    });
}

/**
 * Execute multiple operations in a transaction
 */
async function executeTransaction(ops: { sql: string; params?: any[] }[]): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    db.run('BEGIN TRANSACTION;');

    try {
        for (const op of ops) {
            execSQL(op.sql, op.params || []);
        }
        db.run('COMMIT;');
        await saveDatabase();
    } catch (error) {
        db.run('ROLLBACK;');
        throw error;
    }
}

// Receipt storage using IndexedDB (simplified - OPFS not available with SQL.js)
const RECEIPT_STORE = 'receipts';

/**
 * Write blob to IndexedDB (for receipts)
 */
async function writeBlobToStorage(path: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onsuccess = () => {
            const idb = request.result;
            // Create receipts store if it doesn't exist
            if (!idb.objectStoreNames.contains(RECEIPT_STORE)) {
                idb.close();
                const upgradeRequest = indexedDB.open(DB_NAME, idb.version + 1);
                upgradeRequest.onupgradeneeded = (e) => {
                    const db = (e.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
                        db.createObjectStore(RECEIPT_STORE);
                    }
                };
                upgradeRequest.onsuccess = () => {
                    const transaction = upgradeRequest.result.transaction([RECEIPT_STORE], 'readwrite');
                    const store = transaction.objectStore(RECEIPT_STORE);
                    store.put(data, path);
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = () => reject(transaction.error);
                };
                return;
            }

            const transaction = idb.transaction([RECEIPT_STORE], 'readwrite');
            const store = transaction.objectStore(RECEIPT_STORE);
            store.put(data, path);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Read blob from IndexedDB
 */
async function readBlobFromStorage(path: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onsuccess = () => {
            const idb = request.result;
            if (!idb.objectStoreNames.contains(RECEIPT_STORE)) {
                reject(new Error('Receipt not found'));
                return;
            }

            const transaction = idb.transaction([RECEIPT_STORE], 'readonly');
            const store = transaction.objectStore(RECEIPT_STORE);
            const getRequest = store.get(path);

            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    resolve(getRequest.result);
                } else {
                    reject(new Error('Receipt not found'));
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Message handler - processes messages from main thread
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { type, sql, params, ops, path, data, requestId } = event.data;

    const response: WorkerResponse = {
        requestId,
        success: false,
    };

    try {
        switch (type) {
            case 'init':
                await initDatabase();
                response.success = true;
                break;

            case 'exec':
                if (!sql) throw new Error('SQL required for exec');
                execSQL(sql, params);
                await saveDatabase();
                response.success = true;
                break;

            case 'query':
                if (!sql) throw new Error('SQL required for query');
                response.rows = querySQL(sql, params);
                response.success = true;
                break;

            case 'transaction':
                if (!ops || ops.length === 0) throw new Error('Operations required for transaction');
                executeTransaction(ops);
                response.success = true;
                break;

            case 'blobWrite':
                if (!path || !data) throw new Error('Path and data required for blobWrite');
                await writeBlobToStorage(path, data);
                response.success = true;
                break;

            case 'blobRead':
                if (!path) throw new Error('Path required for blobRead');
                response.result = await readBlobFromStorage(path);
                response.success = true;
                break;

            case 'close':
                if (db) {
                    db.close();
                    db = null;
                }
                response.success = true;
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error: any) {
        response.success = false;
        response.error = error.message || String(error);
        console.error('[DB Worker] Error:', error);
    }

    self.postMessage(response);
};

console.log('[DB Worker] Worker initialized and ready');
