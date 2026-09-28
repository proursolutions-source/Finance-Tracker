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
const RECEIPT_STORE = 'receipts';
// Bumped from 1 to 2 to create both object stores up front. IMPORTANT: every
// indexedDB.open(DB_NAME, ...) call in this file MUST use this same constant —
// opening with a lower version than the database's current version throws a
// VersionError and permanently breaks the app for that user until they clear
// site data. (This is exactly what happened before this store was created
// unconditionally: the first receipt attachment bumped the on-disk version to
// 2 via a one-off `idb.version + 1`, while every other call still hardcoded 1.)
const DB_VERSION = 2;

/**
 * Load database from IndexedDB
 */
async function loadFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
            if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
                db.createObjectStore(RECEIPT_STORE);
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
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
            if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
                db.createObjectStore(RECEIPT_STORE);
            }
        };

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

        // Initialize SQL.js. The wasm binary is bundled locally (public/sql-wasm.wasm,
        // copied from node_modules/sql.js/dist at build time) rather than fetched from
        // sql.js.org at runtime — this app's entire premise is offline-first local
        // storage, so its own database engine can't depend on internet access to even
        // start, especially once packaged as a native app with no guaranteed connectivity.
        SQL = await initSqlJs({
            locateFile: (file: string) => `/${file}`
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

    // Run migrations (safe to run every time)
    await migrateSchema();

    await saveDatabase();
    console.log('[DB Worker] Schema created/updated successfully');
}

/**
 * Migrate schema (add new columns/views)
 */
async function migrateSchema(): Promise<void> {
    if (!db) return;

    console.log('[DB Worker] ✨ Starting migration v2 for new tables...');

    try {
        // 1. Add columns to budgets table
        try {
            db.exec('SELECT notes, color FROM budgets LIMIT 1');
        } catch (e) {
            console.log('[DB Worker] Migrating budgets table...');
            try {
                db.run('ALTER TABLE budgets ADD COLUMN notes TEXT');
            } catch (ignored) { }
            try {
                db.run("ALTER TABLE budgets ADD COLUMN color TEXT DEFAULT '#3b82f6'");
            } catch (ignored) { }
        }

        // 1b. Add accountId column to transactions table (links a spend/income to a Net Worth account)
        try {
            db.exec('SELECT accountId FROM transactions LIMIT 1');
        } catch (e) {
            console.log('[DB Worker] Migrating transactions table (accountId)...');
            try {
                db.run('ALTER TABLE transactions ADD COLUMN accountId TEXT');
            } catch (ignored) { }
        }

        // 2. Create analytics views
        const views = `
        CREATE VIEW IF NOT EXISTS budget_vs_actual AS
        SELECT 
          b.id AS budgetId,
          b.categoryId,
          c.name AS categoryName,
          b.amount AS budgeted,
          b.period,
          b.color,
          COALESCE(SUM(CASE WHEN t.type = 'expense' AND strftime('%Y-%m', t.date) = strftime('%Y-%m', 'now') THEN t.amount ELSE 0 END), 0) AS actualSpent,
          (b.amount - COALESCE(SUM(CASE WHEN t.type = 'expense' AND strftime('%Y-%m', t.date) = strftime('%Y-%m', 'now') THEN t.amount ELSE 0 END), 0)) AS remaining
        FROM budgets b
        JOIN categories c ON b.categoryId = c.id
        LEFT JOIN transactions t ON t.categoryId = b.categoryId
        GROUP BY b.id;

        CREATE VIEW IF NOT EXISTS monthly_trends AS
        SELECT 
          strftime('%Y-%m', date) AS month,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS savings
        FROM transactions
        GROUP BY month
        ORDER BY month DESC LIMIT 12;

        CREATE VIEW IF NOT EXISTS category_spend_trends AS
        SELECT 
          strftime('%Y-%m', t.date) AS month,
          c.name AS category,
          SUM(t.amount) AS spend
        FROM transactions t
        JOIN categories c ON t.categoryId = c.id
        WHERE t.type = 'expense'
        GROUP BY month, category;
        `;

        db.run(views);
        console.log('[DB Worker] ✅ Analytics views created');

        // 3. Goals table
        console.log('[DB Worker] Creating goals table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS goals (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT CHECK(type IN ('emergency-fund','debt-payoff','home-purchase','vacation','retirement','education','wedding','car','custom')),
          targetAmount REAL NOT NULL,
          currentAmount REAL DEFAULT 0,
          targetDate TEXT,
          priority TEXT CHECK(priority IN ('high','medium','low')) DEFAULT 'medium',
          linkedCategoryId TEXT,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          completed INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_goals_targetDate ON goals(targetDate);
        `);
        console.log('[DB Worker] ✅ Goals table created');

        // 4. Accounts table
        console.log('[DB Worker] Creating accounts table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT CHECK(type IN ('savings','fd','ppf','epf','mutual-fund','stocks','gold','property','credit-card','loan','other')),
          balance REAL NOT NULL,
          asOfDate TEXT DEFAULT (strftime('%Y-%m-%d', 'now')),
          notes TEXT,
          interestRate REAL DEFAULT 0
        );
        `);
        console.log('[DB Worker] ✅ Accounts table created');

        // 5. Net Worth Snapshots
        console.log('[DB Worker] Creating networth_snapshots table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS networth_snapshots (
          date TEXT PRIMARY KEY,
          totalAssets REAL,
          totalLiabilities REAL,
          netWorth REAL
        );
        `);
        console.log('[DB Worker] ✅ Net worth snapshots table created');

        // 6. Recurring Transactions table
        console.log('[DB Worker] Creating recurrings table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS recurrings (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          type TEXT CHECK(type IN ('income','expense')),
          categoryId TEXT,
          frequency TEXT CHECK(frequency IN ('daily','weekly','bi-weekly','monthly','quarterly','yearly')),
          startDate TEXT,
          endDate TEXT,
          nextDueDate TEXT,
          notes TEXT,
          isSubscription INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_recurrings_nextDue ON recurrings(nextDueDate);
        `);
        console.log('[DB Worker] ✅ Recurrings table created');

        // 7. Goal progress view
        db.run(`
        CREATE VIEW IF NOT EXISTS goal_progress AS
        SELECT 
          g.id,
          g.name,
          g.type,
          g.targetAmount,
          g.currentAmount,
          g.targetDate,
          g.priority,
          g.completed,
          (g.currentAmount * 100.0 / MAX(g.targetAmount, 1)) AS percentComplete,
          CASE WHEN g.linkedCategoryId IS NOT NULL 
               THEN COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.categoryId = g.linkedCategoryId AND t.type = 'income'), 0)
               ELSE g.currentAmount END AS trackedAmount
        FROM goals g;
        `);
        console.log('[DB Worker] ✅ Goal progress view created');

        // 8. Forecast view
        db.run(`
        CREATE VIEW IF NOT EXISTS forecast_monthly AS
        SELECT 
          strftime('%Y-%m', 'now', '+1 month') AS nextMonth,
          COALESCE((SELECT AVG(income) FROM monthly_trends WHERE month >= strftime('%Y-%m', 'now', '-6 months')), 0) AS avgIncome,
          COALESCE((SELECT AVG(expense) FROM monthly_trends WHERE month >= strftime('%Y-%m', 'now', '-6 months')), 0) AS avgExpense
        ;
        `);
        console.log('[DB Worker] ✅ Forecast view created');

        // 8b. Extra account fields for credit cards & loans
        try {
            db.exec('SELECT creditLimit, dueDate, emiAmount FROM accounts LIMIT 1');
        } catch (e) {
            console.log('[DB Worker] Migrating accounts table (creditLimit/dueDate/emiAmount)...');
            try { db.run('ALTER TABLE accounts ADD COLUMN creditLimit REAL'); } catch (ignored) { }
            try { db.run('ALTER TABLE accounts ADD COLUMN dueDate TEXT'); } catch (ignored) { }
            try { db.run('ALTER TABLE accounts ADD COLUMN emiAmount REAL'); } catch (ignored) { }
        }

        // 8c. Internal transfers between accounts
        console.log('[DB Worker] Creating transfers table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS transfers (
          id TEXT PRIMARY KEY,
          fromAccountId TEXT NOT NULL,
          toAccountId TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
        `);
        console.log('[DB Worker] ✅ Transfers table created');

        // 9. Lending & Debt tables
        console.log('[DB Worker] Creating lendings table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS lendings (
          id TEXT PRIMARY KEY,
          personName TEXT NOT NULL,
          direction TEXT NOT NULL CHECK(direction IN ('lent','borrowed')),
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          dueDate TEXT,
          notes TEXT,
          settled INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_lendings_settled ON lendings(settled);

        CREATE TABLE IF NOT EXISTS lending_payments (
          id TEXT PRIMARY KEY,
          lendingId TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (lendingId) REFERENCES lendings(id)
        );
        CREATE INDEX IF NOT EXISTS idx_lending_payments_lendingId ON lending_payments(lendingId);
        `);
        console.log('[DB Worker] ✅ Lending & debt tables created');

        // 10. MoneyFlow Memory - Phase 1 (memories, media, milestones, life events)
        console.log('[DB Worker] Creating memory tables...');
        db.run(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          transactionId TEXT,
          title TEXT NOT NULL,
          body TEXT,
          occurredAt TEXT NOT NULL,
          location TEXT,
          people TEXT,
          tags TEXT,
          visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','locked','archived')),
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (transactionId) REFERENCES transactions(id)
        );
        CREATE INDEX IF NOT EXISTS idx_memories_transactionId ON memories(transactionId);
        CREATE INDEX IF NOT EXISTS idx_memories_occurredAt ON memories(occurredAt DESC);

        CREATE TABLE IF NOT EXISTS memory_media (
          id TEXT PRIMARY KEY,
          memoryId TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('photo','video','voice')),
          blobPath TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (memoryId) REFERENCES memories(id)
        );
        CREATE INDEX IF NOT EXISTS idx_memory_media_memoryId ON memory_media(memoryId);

        CREATE TABLE IF NOT EXISTS milestones (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          amount REAL,
          occurredAt TEXT NOT NULL,
          autoDetected INTEGER NOT NULL DEFAULT 0,
          photoPath TEXT,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_milestones_occurredAt ON milestones(occurredAt DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_milestones_type_unique ON milestones(type) WHERE autoDetected = 1;

        CREATE TABLE IF NOT EXISTS life_events (
          id TEXT PRIMARY KEY,
          occurredAt TEXT NOT NULL,
          title TEXT NOT NULL,
          amount REAL,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_life_events_occurredAt ON life_events(occurredAt DESC);
        `);
        console.log('[DB Worker] ✅ Memory tables created');

        // 12. Investment transactions — manual buy/sell/dividend ledger against
        // the existing investment-type accounts (mutual-fund/stocks/gold/property).
        // No live market-data feed is integrated; account balances remain the
        // user's own manually-updated valuations, same as before this table existed.
        console.log('[DB Worker] Creating investment_transactions table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS investment_transactions (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          type TEXT CHECK(type IN ('buy','sell','dividend','other')) NOT NULL,
          date TEXT NOT NULL,
          quantity REAL,
          pricePerUnit REAL,
          amount REAL NOT NULL,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_investment_transactions_accountId ON investment_transactions(accountId);
        CREATE INDEX IF NOT EXISTS idx_investment_transactions_date ON investment_transactions(date DESC);
        `);
        console.log('[DB Worker] ✅ Investment transactions table created');

        // 13. Document vault — insurance/tax/loan/other documents, stored the
        // same way receipts already are (local blob store), so no new cloud
        // storage or sync is introduced.
        console.log('[DB Worker] Creating documents table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          category TEXT CHECK(category IN ('insurance','tax','loan','other')) NOT NULL,
          name TEXT NOT NULL,
          filePath TEXT NOT NULL,
          expiryDate TEXT,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_documents_expiryDate ON documents(expiryDate);
        `);
        console.log('[DB Worker] ✅ Documents table created');

        // 14. Category tags — power the Fixed vs Variable and Essential vs
        // Non-Essential expense-analysis tools. Nullable/untagged categories
        // are simply excluded from those breakdowns rather than guessed at.
        try {
            db.exec('SELECT isEssential, isFixed FROM categories LIMIT 1');
        } catch (e) {
            console.log('[DB Worker] Migrating categories table (isEssential/isFixed)...');
            try { db.run('ALTER TABLE categories ADD COLUMN isEssential INTEGER'); } catch (ignored) { }
            try { db.run('ALTER TABLE categories ADD COLUMN isFixed INTEGER'); } catch (ignored) { }
        }

        // 15a. Loan/credit-card account open-vs-closed status, and a
        // per-installment payment log so a single loan account can track
        // many EMI cycles, each independently marked paid/due/overdue —
        // and multiple loans can each be tracked this way.
        try {
            db.exec('SELECT status FROM accounts LIMIT 1');
        } catch (e) {
            console.log('[DB Worker] Migrating accounts table (status)...');
            try { db.run("ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'open'"); } catch (ignored) { }
        }

        console.log('[DB Worker] Creating loan_payments table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS loan_payments (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          dueDate TEXT NOT NULL,
          amount REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'due' CHECK(status IN ('paid','due','overdue')),
          paidDate TEXT,
          notes TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (accountId) REFERENCES accounts(id)
        );
        CREATE INDEX IF NOT EXISTS idx_loan_payments_accountId ON loan_payments(accountId);
        CREATE INDEX IF NOT EXISTS idx_loan_payments_dueDate ON loan_payments(dueDate);
        `);
        console.log('[DB Worker] ✅ Loan payments table created');

        // 15. Challenges — user-started gamification goals (no-spend streak,
        // savings target, stay-under-budget) that the Achievements page
        // tracks progress against.
        console.log('[DB Worker] Creating challenges table...');
        db.run(`
        CREATE TABLE IF NOT EXISTS challenges (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('no-spend-days','savings-target','budget-adherence')),
          target REAL NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','failed')),
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        `);
        console.log('[DB Worker] ✅ Challenges table created');

        console.log('[DB Worker] 🎉 Migration v2 COMPLETE! All new tables created successfully!');

    } catch (error) {
        console.error('[DB Worker] ❌ Migration error:', error);
        throw error;
    }
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
// The RECEIPT_STORE object store is created unconditionally in loadFromIndexedDB's
// / saveToIndexedDB's onupgradeneeded, so it always exists by the time these run.

/**
 * Write blob to IndexedDB (for receipts)
 */
async function writeBlobToStorage(path: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
            if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
                db.createObjectStore(RECEIPT_STORE);
            }
        };

        request.onsuccess = () => {
            const idb = request.result;
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
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE);
            }
            if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
                db.createObjectStore(RECEIPT_STORE);
            }
        };

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
