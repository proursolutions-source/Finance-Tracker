# MoneyFlow - Development Notes

## Quick Start
```bash
npm install
npm run build
npm run dev
# Open http://localhost:8000
```

## Testing Offline Mode
1. Build project: `npm run build`
2. Open DevTools → Application → Service Workers → check "Offline"
3. Refresh page - should work fully offline

## Adding Fake Data for Testing
Open browser console on dashboard and run:
```javascript
// Add 100 random transactions
for (let i = 0; i < 100; i++) {
  const isIncome = Math.random() > 0.7;
  const amount = Math.floor(Math.random() * 5000) + 100;
  const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
  
  await db.createTransaction({
    amount,
    type: isIncome ? 'income' : 'expense',
    categoryId: isIncome ? 'cat-salary' : 'cat-food',
    date: date.toISOString(),
  });
}
console.log('Added 100 transactions');
window.location.reload();
```

## Database Access
```javascript
// Open console and access database directly
await db.query('SELECT * FROM transactions LIMIT 10');
await db.query('SELECT * FROM categories');
await db.query('SELECT * FROM monthly_summary');
```

## Troubleshooting

### "Worker failed to initialize"
- Check browser console for errors
- Ensure WASM file is copied to dist/
- Try hard refresh (Ctrl+Shift+R)

### "OPFS not available"
- Browser too old (need Chrome 102+, FF 111+, Safari 16.4+)
- Check HTTPS (OPFS requires secure context)

### Build fails
```bash
rm -rf node_modules dist
npm install
npm run build
```

## Performance Profiling
1. Open Chrome DevTools → Performance
2. Start recording
3. Trigger action (e.g., load dashboard with 5k transactions)
4. Look for long tasks in worker

## Adding New Page
1. Create `src/pages/newpage.ts`
2. Export async function `renderNewPage()`
3. Register route in `src/main.ts`: `router.register('/newpage', renderNewPage)`
4. Add nav link in main.ts navigation

## Modifying Database Schema
1. Edit `src/worker/db-worker.ts` → `createSchema()`
2. Delete OPFS database: DevTools → Application → Storage → Clear Site Data
3. Refresh page (will recreate with new schema)

## Default Categories
Modify `seedDefaults()` in `src/worker/db-worker.ts` to change pre-seeded categories.
