/**
 * Cross-device sync for the core local (sql.js) financial data — accounts,
 * categories, transactions, budgets, goals, reminders, recurrings. Everything
 * else in the app (investments, documents, achievements/challenges, memories,
 * lending, net worth snapshots, loan payments) stays local-only for now.
 *
 * Strategy: last-write-wins by `updatedAt`, keyed by the row's own
 * client-generated UUID (the same id on every device). No merging of
 * concurrent edits to the same row — whichever device's edit has the later
 * `updatedAt` simply overwrites the other. Deletes are tracked via
 * `sync_tombstones` (local and cloud) since a plain DELETE leaves no trace
 * for another device to pull.
 *
 * This is an honest, ordinary sync for a single person's own devices, not a
 * CRDT — two *simultaneous* edits to the same field on two offline devices
 * will pick one arbitrarily (whichever timestamp is later), not merge them.
 */
import { isCloudConfigured } from '../lib/supabase';
import { getCloudUser } from './cloud-auth';
import { db } from '../db';

const LAST_SYNCED_KEY = 'moneyflow-last-synced-at';

interface SyncTableDef {
    local: string;
    cloud: string;
    /** Columns shared 1:1 by name between the local and cloud tables (excluding id/user_id). */
    columns: string[];
    /** Columns that are 0/1 in sqlite but real booleans in Postgres. */
    boolColumns?: string[];
}

const SYNC_TABLES: SyncTableDef[] = [
    {
        local: 'categories', cloud: 'sync_categories',
        columns: ['name', 'type', 'icon', 'budget', 'hidden', 'color', 'isEssential', 'isFixed', 'createdAt', 'updatedAt'],
        boolColumns: ['hidden', 'isEssential', 'isFixed'],
    },
    {
        local: 'accounts', cloud: 'sync_accounts',
        columns: ['name', 'type', 'balance', 'asOfDate', 'notes', 'interestRate', 'creditLimit', 'dueDate', 'emiAmount', 'status', 'createdAt', 'updatedAt'],
    },
    {
        local: 'transactions', cloud: 'sync_transactions',
        columns: ['amount', 'type', 'categoryId', 'date', 'payee', 'notes', 'accountId', 'createdAt', 'updatedAt'],
    },
    {
        local: 'budgets', cloud: 'sync_budgets',
        columns: ['categoryId', 'amount', 'period', 'startDate', 'endDate', 'notes', 'color', 'createdAt', 'updatedAt'],
    },
    {
        local: 'reminders', cloud: 'sync_reminders',
        columns: ['name', 'amount', 'dueDate', 'categoryId', 'frequency', 'notes', 'completed', 'createdAt', 'updatedAt'],
        boolColumns: ['completed'],
    },
    {
        local: 'goals', cloud: 'sync_goals',
        columns: ['name', 'type', 'targetAmount', 'currentAmount', 'targetDate', 'priority', 'linkedCategoryId', 'notes', 'completed', 'createdAt', 'updatedAt'],
        boolColumns: ['completed'],
    },
    {
        local: 'recurrings', cloud: 'sync_recurrings',
        columns: ['name', 'amount', 'type', 'categoryId', 'frequency', 'startDate', 'endDate', 'nextDueDate', 'notes', 'isSubscription', 'createdAt', 'updatedAt'],
        boolColumns: ['isSubscription'],
    },
];

export function getLastSyncedAt(): string | null {
    try {
        return localStorage.getItem(LAST_SYNCED_KEY);
    } catch {
        return null;
    }
}

function setLastSyncedAt(iso: string): void {
    try {
        localStorage.setItem(LAST_SYNCED_KEY, iso);
    } catch { /* ignore */ }
}

let syncInFlight: Promise<void> | null = null;

/** Safe to call often — concurrent calls collapse into the single in-flight run. */
export async function runSync(): Promise<void> {
    if (syncInFlight) return syncInFlight;
    syncInFlight = doSync().finally(() => { syncInFlight = null; });
    return syncInFlight;
}

async function doSync(): Promise<void> {
    if (!isCloudConfigured() || !navigator.onLine) return;

    const { supabase } = await import('../lib/supabase');
    if (!supabase) return;

    const user = await getCloudUser();
    if (!user) return;

    const since = getLastSyncedAt() ?? '1970-01-01T00:00:00.000Z';
    const syncStartedAt = new Date().toISOString();
    let allOk = true;

    for (const table of SYNC_TABLES) {
        allOk = (await pushTable(supabase, user.id, table, since)) && allOk;
        allOk = (await pullTable(supabase, user.id, table, since)) && allOk;
    }
    allOk = (await pushTombstones(supabase, user.id, since)) && allOk;
    allOk = (await pullTombstones(supabase, user.id, since)) && allOk;

    // Only advance the watermark if everything succeeded — if any table
    // failed, moving it forward anyway would permanently skip retrying
    // whatever failed to push (its updatedAt would now be older than the
    // new "since", so a future sync would never look at it again).
    if (allOk) setLastSyncedAt(syncStartedAt);
}

function toCloudValue(value: any, isBool: boolean): any {
    if (isBool) return value === null || value === undefined ? null : !!value;
    return value;
}

function toLocalValue(value: any, isBool: boolean): any {
    if (isBool) return value === null || value === undefined ? null : (value ? 1 : 0);
    return value;
}

async function pushTable(supabase: any, userId: string, table: SyncTableDef, since: string): Promise<boolean> {
    const rows = await db.query<any>(`SELECT * FROM ${table.local} WHERE updatedAt > ?`, [since]);
    if (rows.length === 0) return true;

    const boolCols = new Set(table.boolColumns ?? []);
    const payload = rows.map(row => {
        const out: Record<string, any> = { id: row.id, user_id: userId };
        for (const col of table.columns) {
            out[col] = toCloudValue(row[col], boolCols.has(col));
        }
        return out;
    });

    const { error } = await supabase.from(table.cloud).upsert(payload, { onConflict: 'id' });
    if (error) { console.error(`[Sync] Failed to push ${table.local}:`, error); return false; }
    return true;
}

async function pullTable(supabase: any, userId: string, table: SyncTableDef, since: string): Promise<boolean> {
    const { data, error } = await supabase
        .from(table.cloud)
        .select('*')
        .eq('user_id', userId)
        .gt('updatedAt', since);

    if (error) { console.error(`[Sync] Failed to pull ${table.local}:`, error); return false; }
    if (!data || data.length === 0) return true;

    const boolCols = new Set(table.boolColumns ?? []);
    for (const cloudRow of data) {
        const [localRow] = await db.query<any>(`SELECT updatedAt FROM ${table.local} WHERE id = ?`, [cloudRow.id]);
        if (localRow && new Date(localRow.updatedAt).getTime() >= new Date(cloudRow.updatedAt).getTime()) {
            continue; // local copy is the same age or newer — don't overwrite it
        }

        const cols = ['id', ...table.columns];
        const values = [cloudRow.id, ...table.columns.map(col => toLocalValue(cloudRow[col], boolCols.has(col)))];
        const placeholders = cols.map(() => '?').join(', ');
        await db.exec(
            `INSERT OR REPLACE INTO ${table.local} (${cols.join(', ')}) VALUES (${placeholders})`,
            values
        );
    }
    return true;
}

async function pushTombstones(supabase: any, userId: string, since: string): Promise<boolean> {
    const rows = await db.query<{ id: string; tableName: string; deletedAt: string }>(
        'SELECT * FROM sync_tombstones WHERE deletedAt > ?', [since]
    );
    if (rows.length === 0) return true;

    const payload = rows.map(r => ({ id: r.id, table_name: r.tableName, user_id: userId, deletedAt: r.deletedAt }));
    const { error } = await supabase.from('sync_tombstones').upsert(payload, { onConflict: 'id,table_name' });
    if (error) { console.error('[Sync] Failed to push tombstones:', error); return false; }

    // Also actually delete the corresponding row in each cloud data table.
    const byTable = new Map<string, string[]>();
    for (const r of rows) {
        const def = SYNC_TABLES.find(t => t.local === r.tableName);
        if (!def) continue;
        if (!byTable.has(def.cloud)) byTable.set(def.cloud, []);
        byTable.get(def.cloud)!.push(r.id);
    }
    let allOk = true;
    for (const [cloudTable, ids] of byTable) {
        const { error: delError } = await supabase.from(cloudTable).delete().in('id', ids);
        if (delError) { console.error(`[Sync] Failed to apply deletes to ${cloudTable}:`, delError); allOk = false; }
    }
    return allOk;
}

async function pullTombstones(supabase: any, userId: string, since: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('sync_tombstones')
        .select('*')
        .eq('user_id', userId)
        .gt('deletedAt', since);

    if (error) { console.error('[Sync] Failed to pull tombstones:', error); return false; }
    if (!data || data.length === 0) return true;

    for (const tomb of data) {
        const def = SYNC_TABLES.find(t => t.local === tomb.table_name);
        if (!def) continue;
        await db.exec(`DELETE FROM ${def.local} WHERE id = ?`, [tomb.id]);
        await db.exec(
            `INSERT OR REPLACE INTO sync_tombstones (id, tableName, deletedAt) VALUES (?, ?, ?)`,
            [tomb.id, tomb.table_name, tomb.deletedAt]
        );
    }
    return true;
}
