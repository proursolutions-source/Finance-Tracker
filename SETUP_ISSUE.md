# SQLite WASM Setup Issue

## Problem
The `@sqlite.org/sqlite-wasm` npm package is not available on npm, preventing the build from completing.

## Solutions

### Option 1: Use SQL.js (Recommended - Quick Start)
SQL.js is an actively maintained SQLite port to JavaScript that works similarly.

**Pros:**
- Available on npm: `npm install sql.js`
- Similar API to SQLite WASM
- Works in all modern browsers
- ~500KB bundle size

**Cons:**
- Stores database in IndexedDB (not OPFS)
- Slightly slower than native WASM with OPFS

### Option 2: Manual SQLite WASM Files
Download the official SQLite WASM files manually.

**Steps:**
1. Visit: https://sqlite.org/download.html
2. Download "sqlite-wasm" package (sqlite-wasm-3XXXXXX.zip)
3. Extract `jswasm/` folder
4. Copy these files to `public/`:
   - `sqlite3.mjs`
   - `sqlite3.wasm`
   - `sqlite3-opfs-async-proxy.js`
5. Update `src/worker/db-worker.ts` to use local import instead of npm package

**Pros:**
- Official SQLite implementation
- Full OPFS support for high performance
- Best option for production

**Cons:**
- Manual setup required
- Need to update imports

### Option 3: Demo Mode (No Persistence)
Create a simplified version with mock data in memory.

**Pros:**
- Can see UI immediately
- No dependencies needed

**Cons:**
- Data lost on refresh
- Not a real finance tracker

## Recommended Approach

I recommend **Option 1 (SQL.js)** for immediate functionality:

```bash
cd "d:\Finance Tracker"
npm install sql.js
npm run build
npm run dev
```

Then I can quickly update the worker code to use SQL.js instead.

Would you like me to proceed with SQL.js?
