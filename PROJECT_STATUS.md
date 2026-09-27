# MoneyFlow — Project Status & Roadmap

_Last updated: 2026-09-21. This file is the working memory for this project — read it first in any new session before making changes._

## What MoneyFlow is

A personal finance tracker: Vite + TypeScript, vanilla DOM (no framework), hash-based SPA router (`src/router.ts`). Data lives entirely client-side in **sql.js** (SQLite-via-WASM) inside a Web Worker (`src/worker/db-worker.ts`), persisted as a serialized blob in IndexedDB. There is **no backend server**. "Login" is a local front door only: SHA-256 hash (no salt) via `hashPassword` in `src/utils.ts`, stored in `localStorage` — documented everywhere as UX gating, not real security.

Styling: Tailwind (`darkMode: 'class'`), light/dark theme via CSS variables in `src/styles/main.css`. PWA: `manifest.json` + `service-worker.js` (network-first navigations, cache-first hashed assets). Charts via Chart.js (`src/components/charts.ts`). OCR bill-scanning via `tesseract.js` (dynamic import).

## Chronological history of this project (what's been done)

1. **Initial audit & bug sweep** — reviewed the whole codebase, fixed bugs, completed unfinished functionality.
2. **Suggested-improvements pass** — receipts, notifications, PIN lock, import, search, undo.
3. **Money-management expansion** — lending/debt tracking, bill splitting, inward/outward payments, bill scanning (OCR), credit card management, loan/EMI management, internal transfers, "Projection vs Actual" report.
4. **Net Worth chart fix** — root cause was giving the `<canvas>` an inline height directly instead of wrapping it in a fixed-height container (a general rule for every `createChart` usage in this app).
5. **Login/Signup pages** — added local Signup/Login integrated with the existing onboarding flow (not placeholder pages).
6. **20-point website-launch checklist** — applied literally, including to items that don't naturally fit an offline app, per explicit user choice. Also produced `SYNC_ARCHITECTURE.md`-style plan (see below) for a real multi-platform sync backend — **planning only, no code**, per user's explicit choice ("Yes, scope a real sync backend").
7. **Feature testing pass** — testing all app features; not fully completed (see Open Items below).
8. **Responsive + onboarding tour + Feature Guide** (mid-turn addition):
   - `src/components/product-tour.ts` — 9-step spotlight/tooltip tour, triggered via `setTimeout(startTour, 400)` at the end of `onboarding.ts`'s `completeOnboarding()`.
   - `public/guide.html` — static Feature Guide page, 16 feature sections, Lucide icon badges, TOC, deep links to `/#/route`.
   - Settings page got "Take the Tour" / "Feature Guide" buttons (Help section).
9. **Branding pass** (mid-turn addition, from user-provided moodboard + bug screenshot):
   - Brand palette: Primary Dark `#0B1020`, Primary Blue `#0EA5E9`, Light Blue `#38BDF8`, Accent `#93C5FD`, Success `#22C55E`, Alert `#EF4444`.
   - Fonts: Poppins + Inter (Google Fonts), wired into `tailwind.config.js` `fontFamily.sans`.
   - Regenerated favicon/icons/OG image from an arrow+bars logo mark (via a temporary `sharp` script, cleaned up after).
   - **Fixed a real desktop layout bug**: a dead `<div class="hidden md:block w-64"></div>` sidebar spacer lived inside `<nav>` (a sibling of `<main>`), so it never reserved space — `<main>` rendered underneath the fixed 256px sidebar at real desktop widths. Fixed with `md:ml-64` on `#main-content` and removing the dead spacer.
   - Fixed mobile flex-overflow bugs in `transactions.ts` (date filters → `grid grid-cols-2`) and `split-modal.ts` (participant rows → `min-w-0`/`flex-shrink-0`).
10. **"MoneyFlow Memory" transformation — Phase 1** (the current major initiative, see below).
11. **Theme bug fix** — `getTheme()` in `src/utils.ts` had both ternary branches returning `'dark'` (fixed to `'light'`/`'dark'`), and — the real root cause — the `.light`/`.dark` CSS variables in `main.css` were defined but never consumed anywhere. Fixed by rewiring shared classes (`.glass-card`, `.glass-input`, `.glass-button-secondary`, etc.) to the variables, plus pragmatic `.light .<hardcoded-tailwind-class>` overrides since every page hardcodes literal dark-mode Tailwind classes in template strings rather than using the variables directly.

## MoneyFlow Memory — the current initiative

**What it is:** transforming MoneyFlow from a pure expense tracker into "Financial Memory + Expense Tracking + Personal Financial Diary" — combining the existing tracker with a Memory Journal, Purchase Archive, Trip/Gift Memory, Financial Milestones, and (eventually, deferred) an AI Financial Memory Assistant. Full spec was a 50-section document from the user, with a dedicated top-level "Memory" nav, ~30 named sub-features, a 26-entity DB schema, and an explicit 6-phase build plan.

**User's explicit standing instructions for this initiative** (apply to all future phases):
- Do NOT create fake placeholder functionality and call it complete. If something can't be fully implemented yet, build the correct architecture/interface and clearly flag the remaining dependency.
- Keep existing MoneyFlow functionality working throughout.
- Work in phases; confirm before starting each phase (established via `AskUserQuestion`, not a one-shot build).

**User's explicit decisions so far:**
- **AI features deferred entirely** ("Defer AI entirely for now" — recommended, since AI search/chat is much more useful once there's real memory content to query). No AI Memory Search / Ask MoneyFlow AI work until the user says so.
- **Phase 1 approved and built** ("Yes, start Phase 1 now").

### Phase 1 — DONE ✅

- **Schema** (additive, non-destructive, in `migrateSchema()` in `src/worker/db-worker.ts`): `memories`, `memory_media`, `milestones` (partial unique index on `type` where `autoDetected=1`, for dedup), `life_events`.
- **Types**: `Memory`, `MemoryMedia`, `MilestoneType`, `Milestone`, `LifeEvent` in `src/types.ts`.
- **DB layer** (`src/db.ts`): full CRUD for all four entities, plus:
  - `getOnThisDayMemories(month, day)` — matches by month/day, excludes current year.
  - `detectMilestones()` — replays all transactions in date order, tracks running cumulative balance, auto-creates milestones for: first ₹1k/10k/50k/1L saved, first salary (`categoryId === 'cat-salary'`), first investment (`categoryId === 'cat-investments'`), first debt cleared (via lendings/lending_payments). Idempotent — safe to call on every Memory-page render.
- **Transaction modal** (`src/components/transaction-modal.ts`): optional, collapsed-by-default "Add a memory" section (title + body) on every add/edit transaction; saves/updates/deletes the linked `Memory` row on submit.
- **Memory dashboard** (`src/pages/memory.ts`, route `#/memory`): "On This Day" card, "Recent Memories" list, "Financial Milestones" list (icon-mapped, manual add via modal, delete for non-auto-detected ones).
- **Memory Timeline** (`src/pages/memory-timeline.ts`, route `#/memory/timeline`): unifies memories + milestones + life events, grouped by year, filterable (All/Memories/Milestones/Life Events), manual "Add Life Event" modal for pre-MoneyFlow history.
- **Dashboard nudge** (`src/pages/dashboard.ts`): subtle "On this day..." card near the top, gated by a Settings toggle.
- **Settings** (`src/pages/settings.ts`): "On This Day" privacy toggle (`moneyflow-on-this-day-enabled` in `localStorage`).
- **Nav**: added "Memory" to desktop sidebar (after Goals) and mobile bottom nav (replaced "Recurring" there — still reachable via sidebar) in `src/main.ts`.
- **Verified live** (dev server + browser): memory saved with a transaction and displayed correctly; milestones auto-detected correctly against real balances; timeline year-grouping and filters work; manual life event ("First bicycle", 2013, ₹4,500) correctly sorted before 2026 entries.
- **Build health**: `npx tsc --noEmit` and `npx vite build` both clean as of the last check.

### Phases 2–6 — NOT STARTED

Scoped in the architecture assessment but not built. Rough contents per the original spec:
- **Phase 2**: Purchase Museum / Archive, "Why Did I Buy This?" reflections, Small Money Big Story.
- **Phase 3**: Gift Memory Vault + Relationship Memory (People), Trip Financial Memory.
- **Phase 4**: Money Map (location-based, needs a maps solution — feasibility caveat flagged), Financial Life Timeline enrichments, Salary Evolution, Financial Calendar.
- **Phase 5**: Letter to Future Me, Future Me Simulator, Financial Time Machine, "If I Hadn't Bought It" what-if, inflation/purchasing-power tool ("What ₹100 Meant Then"), Money Graveyard, Financial DNA, Spending Mood, Money Investigation.
- **Phase 6**: Vault encryption (Web Crypto API — feasible, not yet built), full Privacy Controls, Export/Backup of Memory data, offline sync for Memory data, Digital Vault, My Year in Money.
- **Deferred indefinitely per user choice**: AI Memory Search, Ask MoneyFlow AI, and any other AI-assistant feature — do not start without a fresh explicit go-ahead.

## Subscriptions, Admin Portal, Discounts — built 2026-09-21

Per the user's decision to launch MoneyFlow as a paid product, the sync backend
(Supabase, previously "scoped but not built") was promoted to "build it now" as the
foundation for real subscriptions and admin control. **This is a real backend with
real access control, not a local-only mockup** — but it does not process real payments
yet (see below).

**What was built:**
- **Supabase schema + RLS** ([supabase/migrations/0001_subscriptions.sql](supabase/migrations/0001_subscriptions.sql)): `profiles`, `subscription_plans` (seeded with Free/Pro Monthly/Pro Yearly), `discount_codes`, `subscriptions`, `admin_audit_log`. Every table has Row Level Security — a user can only ever see their own data; only `role = 'admin'` can see/write everything. `proursolutions@gmail.com` is auto-promoted to admin on signup via a trigger (and the migration backfills it if that account already existed).
- **Cloud client layer**: [src/lib/supabase.ts](src/lib/supabase.ts) (client, gracefully no-op without env vars), [src/cloud/cloud-auth.ts](src/cloud/cloud-auth.ts) (real Supabase Auth signup/login, separate from the local device PIN/password), [src/cloud/cloud-db.ts](src/cloud/cloud-db.ts) (plans/subscriptions/discounts/users/audit-log CRUD).
- **Subscription page** ([src/pages/subscription.ts](src/pages/subscription.ts), `#/subscription`): view plans, subscribe, apply a discount code (validated server-side via the `redeem_discount_code` RPC so the discount table is never exposed wholesale), cancel at period end.
- **Admin Portal** (`#/admin`, `#/admin/users`, `#/admin/plans`, `#/admin/discounts`), gated both client-side (hides the nav link/shows a 403-style page) and server-side (RLS — the real security boundary):
  - **Dashboard**: total users, active/pending subscriptions, estimated MRR.
  - **Users**: directory, suspend/activate accounts, change a user's plan, and — since no live payment gateway exists yet — manually flip a subscription to `active` (for beta users, bank transfers, comps).
  - **Plans**: create/edit/deactivate plans, pricing, billing interval, feature lists.
  - **Discounts**: create/edit/deactivate percent or flat discount codes, redemption limits, expiry, plan restrictions.
  - Every admin write is recorded in `admin_audit_log`.
- **Setup docs**: [SETUP_SUPABASE.md](SETUP_SUPABASE.md) (step-by-step: create a Supabase project, run the migration, set env vars, sign up as the admin email) and `.env.example`.

**Deliberately not faked — explicitly per the user's own "no fake placeholder functionality" instruction:**
- **No live payment gateway is connected.** Per the user's own choice ("build the subscription/plan/discount system now, wire up real payments later"), "Subscribe" records an honest `pending_payment` status rather than pretending a card was charged. The UI says so plainly. An admin activates it manually in the meantime. Wiring in Razorpay/Stripe for real is separate future work — requires the user's own merchant account (Claude cannot create one on their behalf).
- **Local financial data is untouched.** Transactions/budgets/goals/etc. still live only in this device's sql.js/IndexedDB store, exactly as before. This Supabase backend currently holds only account/subscription/admin data — it is not yet the multi-device sync backend for financial data (that's still the separate "Sync backend" item below, which now shares the same Supabase project but is a distinct, unbuilt phase).
- **Without Supabase configured** (no `.env`), the Subscription and Admin pages show a clear "not set up yet" state with a link to the setup doc — never a silent failure or fake success screen. Verified live in the browser.

**Verified**: `tsc --noEmit` and `vite build` both clean; live-tested in the browser with no Supabase env vars configured — Subscription and Admin both show the honest not-configured state, the Admin nav link stays hidden, and all pre-existing MoneyFlow functionality (login, PIN lock, dashboard, transactions) is unaffected.

**Next steps when picked up**: the user creates a Supabase project and follows SETUP_SUPABASE.md, then a full walkthrough (sign up as admin, manage plans/discounts, subscribe as a second test user, manually activate it) should be done live before considering this production-ready. Real payment gateway integration is separate, later work once the user has chosen a gateway and set up a merchant account.

## Sync backend — decided 2026-09-21, not yet built

A plan was produced for connecting a website, mobile app, and desktop app via login. **Decisions are now locked in:**
1. **Backend**: **Supabase** (managed Postgres + auth + realtime).
2. **Sync strategy**: **last-write-wins** (timestamp-based).
3. **Multi-platform packaging**: **Capacitor (mobile) / Tauri (desktop)** wrapping the existing web app — no native rewrites.

Not yet built. Next steps when picked up: design the Supabase schema mirroring `src/types.ts`, add a `syncedAt`/`updatedAt` column per table for LWW, build an auth bridge (Supabase Auth replacing/augmenting the current local-only login), and a background sync worker that reconciles the local sql.js DB with Supabase on connectivity. This is a substantial, separate build — should be scoped as its own phase, not bundled silently into Memory work.

## Open items

1. ~~**Feature-testing pass incomplete.**~~ **Done 2026-09-21.** Goals, Recurring, Reports, Net Worth, Lending & Debt, and Settings were all exercised live in the browser (fresh account, real CRUD operations, not just visual inspection). Results below.
2. ~~**Sync backend decisions**~~ **Done 2026-09-21** — see "Sync backend" section above (Supabase, last-write-wins, Capacitor/Tauri). Not yet built.
3. **MoneyFlow Memory phase order** — which of Phases 2–6 to tackle next (recommend Phase 2, since Purchase Museum and reflections build most directly on Phase 1's memory/timeline infrastructure). Still awaiting user direction.
4. **AI features** — remain off the table until the user explicitly revisits, per their own stated reasoning (needs real memory content first).

## Visual audit — dropdown colors and theme-dependent visuals (2026-09-21, fourth pass)

Requested check: "check the dropdown colors, check every visual, correct what's necessary." Found and fixed the root cause of every dropdown/native-control color issue, plus a broad chart-readability bug, all specifically in **light theme** (dark theme, the app's default, was already fine):

1. **`color-scheme` was never declared anywhere in the app.** Without it, browsers render native form controls (a `<select>` dropdown's open option list, checkboxes, date pickers, scrollbars) using their light-mode default regardless of the app's own dark/light CSS — a latent mismatch risk for every dropdown in the app. Fixed by setting `color-scheme: dark` / `light` on `:root.dark` / `:root.light` in [main.css](src/styles/main.css), and setting it dynamically via `document.documentElement.style.colorScheme` inside `setTheme()` in [utils.ts](src/utils.ts) so it's correct immediately on toggle, not just on next load. Also added explicit `select.glass-input option` background/color rules as a second layer of defense. Verified via computed styles in both themes: option background/text now correctly resolve to the active theme's surface/text colors, and `color-scheme` correctly resolves to `dark`/`light`.
2. **A second, independent, duplicate implementation of `setTheme()` existed in [stores.ts](src/stores.ts)** — the one actually wired to the sidebar's "Toggle Theme" button — which had silently drifted out of sync with the fix above (it never set `color-scheme`, so toggling theme via the button didn't get the fix). Removed the duplication: `store.setTheme()` now delegates to the single canonical `utils.ts` implementation.
3. **The full-screen local-login and PIN-lock overlays hardcoded `bg-slate-950`** (near-black), which had no light-theme override. In light mode this left the login/lock screen's backdrop black while the glass-card on top of it correctly went semi-transparent white — producing a muddy gray, broken-looking card. Added the missing `.light .bg-slate-950` override in [main.css](src/styles/main.css). Verified live: both screens now render a clean light background with a crisp white card in light mode.
4. **Chart.js text/grid colors were hardcoded once at module load for dark mode** (`Chart.defaults.color = '#cbd5e1'`, a light gray meant for a dark background) and never revisited — every chart's axis labels, legend text, and gridlines were washed out and hard to read in light theme. Fixed in [charts.ts](src/components/charts.ts) with a `getThemeChartColors()` helper that reads the active theme at chart-creation time and supplies correctly-contrasted text/grid/tooltip colors either way.
5. **The Reports "Budget vs Actual" chart's "Budget Limit" reference bar used a hardcoded near-white ghost color** (`rgba(255,255,255,0.1)`) meant to be a subtle outline on a dark background — in light mode it was essentially invisible, with no visible legend swatch either. Fixed via a new `getGhostSeriesColors()` helper in charts.ts, used in [reports.ts](src/pages/reports.ts).
6. Also made the theme-toggle buttons (sidebar and Settings) re-render the current page immediately after switching, so anything computed at render time from the active theme (chart colors, in particular) updates right away instead of only on the next navigation.

Verified live end-to-end in both themes: dropdown option colors (via computed styles, since native popups don't capture in automated screenshots), the login/PIN-lock screens, and every chart on the Reports and Net Worth pages (line, bar, doughnut) — all correctly themed, all previously-invisible or washed-out elements now clearly visible. `tsc --noEmit` and `vite build` both clean. Dark theme re-confirmed unaffected throughout.

## Critical bug found via a real bill scan test (2026-09-21, third pass)

Tested Bill Scan/OCR end-to-end against a real photographed bus ticket (a TNSTC Thiruvannamalai depot ticket, ₹150, dated 15/08/2026). This surfaced the most serious bug found in the whole project:

**Attaching any receipt permanently broke the local database for that browser profile.** Root cause, in [src/worker/db-worker.ts](src/worker/db-worker.ts): the receipt-blob storage function (`writeBlobToStorage`) lazily created its IndexedDB object store the first time a receipt was ever saved, by dynamically opening the database at `idb.version + 1` (bumping it from 1 to 2). But every other function that opens the same database (`loadFromIndexedDB`, `saveToIndexedDB`, `readBlobFromStorage`) still hardcoded version `1`. Per the IndexedDB spec, opening a database with a version *lower* than its current on-disk version throws a `VersionError` — so the moment a user attached their very first receipt, every subsequent save and every future page load failed with "Failed to save transaction" / "Failed to initialize app. Please refresh," permanently, with no recovery path short of clearing site data. This reproduced exactly in testing: scanning the ticket attached the receipt fine, but saving the transaction then failed, and reloading the app afterward got stuck on the loading screen.

**Fix**: introduced one shared `DB_VERSION = 2` constant and made all four `indexedDB.open()` calls in db-worker.ts use it consistently, with the receipts object store now created unconditionally alongside the main store in `onupgradeneeded` (both in the initial load path and the save path, so ordering can never matter). Removed the old dynamic `idb.version + 1` special case entirely. Verified live: the already-"bricked" database from the failed test recovered and loaded normally under the fix with no data loss, and a fresh add-transaction-with-receipt flow (scan → extract amount → save) now completes and survives a full page reload.

**OCR accuracy, tested against the same real ticket photo**:
- Amount extraction: correct (₹150) both before and after the changes below.
- Date extraction: not recovered. The ticket prints its date as "15 08 2026" (space-separated, no slashes) on a thermal-style dot-matrix line that Tesseract's default English model read as garbage text regardless of preprocessing — this looks like a fundamental limit of a lightweight client-side OCR pass on a small, blurry, glare-affected line, not something a regex tweak fixes. Improved anyway, defensively: [src/ocr.ts](src/ocr.ts) now (a) broadens the date regex to also accept space-separated `DD MM YYYY` (a common thermal-printer format, for the cases where OCR text does come out clean), and (b) preprocesses the image (grayscale + percentile-clipped contrast stretch, not naive min/max — an initial min/max version actually made this specific photo worse by letting glare/background outliers dominate the stretch) before running Tesseract, which is a generally-accepted technique for low-contrast photographed receipts. Reported honestly rather than claimed as "fixed" for this specific ticket, since it measurably wasn't.

`tsc --noEmit` and `vite build` both clean after the fix. This is the highest-severity bug found across all three testing passes — worth being aware that **any existing user who has ever attached a receipt in a build before this fix would need this same code fix deployed** to recover (their data isn't lost — it's a version constant mismatch, not corruption — but they cannot self-recover by just refreshing).

## Real tiered subscriptions + merged auth + password reset (2026-09-27)

Per the user's direction to actually launch and sell this on a tiered basis, closed the biggest remaining gap: **subscriptions existed in the cloud but nothing in the app checked them.** Now they do.

**Auth model — merged, as decided:** when cloud is configured, the MoneyFlow Cloud account *is* the login — the old local-only device account ([auth-gate.ts](src/components/auth-gate.ts)) is now only used as a fallback when Supabase isn't configured at all (keeps the from-source/offline build fully usable). [main.ts](src/main.ts) picks between them via `isCloudConfigured()`. This is a real, load-bearing architecture decision: local financial data itself still lives only in this device's sql.js database (unscoped per cloud user — that's the separate, unbuilt "sync backend" phase), but *who can use the app and which tier they're on* is now real.

**Tiers, defined and enforced:**
- Migration `0002_plan_tiers.sql` added a `tier` (`free`/`pro`/`premium`) column to `subscription_plans`, independent of billing interval. Seeded: Free (₹0), Pro Monthly/Yearly (₹199 / ₹1990), Premium Monthly/Yearly (₹349 / ₹3490).
- New [src/cloud/entitlements.ts](src/cloud/entitlements.ts): `refreshEntitlement()` checks the signed-in user's active subscription against the cloud and caches the resulting tier locally; `hasTier()`/`hasFeature()` are the synchronous checks everything else uses. Explicitly documented as an ordinary client-side product gate, not DRM — a technical user could tamper with their own browser's cached value, and closing that fully would require moving gated operations server-side (a much larger change, out of scope here).
- **Free**: Transactions, Categories, Budgets, Goals, basic Reports (Income vs Expense only).
- **Pro** adds: Recurring, Lending & Debt, Net Worth, Bill Scan (OCR), full Reports & Analytics.
- **Premium** adds: MoneyFlow Memory (Timeline, Milestones, On This Day).
- Gated pages show a real "Upgrade to unlock" screen ([upgrade-gate.ts](src/components/upgrade-gate.ts)) instead of their content; the OCR Scan button shows a lock icon and blocks with a toast; Reports splits into an always-visible basic chart plus an upgrade banner over the rest; the sidebar/mobile nav show lock icons on gated items.
- Admin's Plans editor now has a Tier field controlling what a plan actually unlocks, separate from its price/billing-interval label.

**Real password reset**, since a paid product can't tell customers "forgot your password? reset all your data" (the old local-account fallback): [cloud-auth.ts](src/cloud/cloud-auth.ts) adds `requestPasswordReset`/`updatePassword` via Supabase Auth's real email flow. The tricky part — catching the `PASSWORD_RECOVERY` event reliably regardless of timing — is handled by registering the listener at Supabase-client-creation time in [lib/supabase.ts](src/lib/supabase.ts) (buffered, so a late subscriber still gets notified) plus a synchronous URL check at boot ([main.ts](src/main.ts)) so normal logins never wait on it. Landing via the reset-link email shows [reset-password-screen.ts](src/components/reset-password-screen.ts) and skips straight into the app afterward (no redundant re-login).

**Verified live**: the merged cloud login/signup gate, the full Forgot Password → email-sent → Back-to-Log-In round trip (found and fixed a real bug along the way — the confirmation screen's icon never rendered because it was missing a `lucide.createIcons()` call, the same class of bug found earlier in this project). `tsc --noEmit` and `vite build` both clean.

**Not yet done / operational note**: actually receiving the reset email depends on the Supabase project's email settings — Supabase's built-in email service is rate-limited and fine for testing, but a real launch should configure a custom SMTP provider in the Supabase dashboard (Auth → Email settings) before relying on this for real customers. Tier-gating itself was verified by code/logic and a dry run of the auth flows; a full walkthrough of an end-to-end **Free → Pro → Premium** upgrade with a real second test account is still worth doing before shipping (blocked on the same account-creation boundary noted below).

## Full application test pass — results (2026-09-21, second pass)

Went through Categories, Budgets, Reminders, Transactions (edit/delete/search/filter), Split Bill, OCR scan entry point, Settings Import/Export, the 404 page, `guide.html`, and a mobile-viewport regression, on top of the earlier pass below. Four real bugs found and fixed:

1. **New-category icon field defaulted to a real value (`"circle"`) instead of being empty.** Typing into it appended to "circle" instead of replacing it (e.g. typing "dog" produced the invalid icon name "circledog", silently rendering blank forever — Lucide has no fallback for an unrecognized icon). Fixed in [src/pages/categories.ts](src/pages/categories.ts): the field is now empty by default, and a **live icon preview** was added next to it that shows a warning ("Unrecognized icon name — will show as a plain circle") the moment an invalid name is typed, for both new and edited categories.
2. **A reminder due "today" immediately showed as "Overdue" in red.** Root cause: the same class of bug as the earlier transaction-timestamp fix — due dates are stored as UTC midnight of the picked day, which is already "in the past" relative to any later moment on the same local day. Fixed in [src/pages/reminders.ts](src/pages/reminders.ts) by comparing calendar days (via `startOf` truncation) instead of exact instants — a reminder is only "Overdue" starting the day *after* its due date, never on the due date itself. (`notifications.ts`'s due-date check was left alone — its "fire on the due date" semantics were already correct.)
3. **"Export Data (JSON)" / "Import Backup (JSON)" silently dropped entire feature areas.** The backup only ever covered transactions/categories/budgets/reminders/goals/accounts/recurrings — Lending & Debt records, lending payments, Memory data (memories, media, milestones, life events), and account Transfers were never included, so a user relying on this as a real backup (or migrating devices) would silently lose all of that. Fixed in [src/db.ts](src/db.ts) (added `getAllLendingPayments()` and `getAllMemoryMedia()`) and [src/pages/settings.ts](src/pages/settings.ts) (export and import now cover all of it symmetrically; old backup files still import fine since missing fields default to empty arrays).
4. **The Feature Guide (`guide.html`) never mentioned Memory, Subscription, or the Admin Portal** — written before those features existed, so it was actively misleading about what the app can do. Added matching sections (with the same icon-badge/description/bullet-list/Open-link pattern as the rest of the guide) and TOC entries for all three.

**Verified**: `tsc --noEmit` and `vite build` both clean after all four fixes; each fix re-tested live in the browser (icon preview, reminder label, export success with no console errors, guide sections rendering with working anchor links). Mobile viewport (375×812) spot-checked on the login screen, PIN lock, and Transactions — no overflow or overlap regressions.

## Feature test pass — results (2026-09-21)

Tested live against a fresh account in the dev server (existing QA Tester local data had no known password, so a new account was created; prior test data was not recoverable but was disposable QA data).

- **Goals**: create, add funds (partial progress), type-based color coding — all correct. Emergency Fund's red border is by design (goal-type color), not a bug.
- **Recurring**: create (with subscription flag + category), "due" detection on creation, "Process Due" correctly creates a real transaction and advances `nextDueDate` by the frequency interval — all correct.
- **Reports**: Projection vs Actual, Income vs Expense (12mo), Spending by Category, Budget vs Actual, Savings Rate Trend, 3-Month Forecast — all charts render correctly with real data, no crashes.
- **Net Worth**: Add Account (asset), Net Worth Trend chart, Asset Allocation donut — all correct, no crash (confirms the earlier chart-container fix holds).
- **Lending & Debt**: create entry, "Record Inward Payment" with a partial amount — remaining balance and payment count both update correctly.
- **Settings**: Edit Profile (persists), App Lock PIN set/enforce (verified the PIN gate actually engages on reload, layered on top of the local account login), "On This Day" toggle, Data Management section (export/import buttons present) — all correct.
- **Transaction modal**: income/expense toggle, category/payee/notes, and the Phase-1 "Add a memory" section — all correct, memory saved and linked properly.

### Bug found and fixed: transaction timestamps used inconsistent timezone handling

**Symptom**: a transaction manually dated "today" appeared *older* in "Recent Transactions" / relative-time displays than a same-day transaction auto-created by Recurring's "Process Due", even though the manual one was entered later.

**Root cause**: `new Date(dateOnlyString).toISOString()` parses a bare `YYYY-MM-DD` string as **UTC midnight**. In timezones ahead of UTC (e.g. IST, UTC+5:30), that's several hours before the actual local "now" — so every manually-dated "today" transaction was silently stamped hours earlier than reality, while `db.ts`'s recurring-processing code used `new Date().toISOString()` (true current timestamp) for its auto-generated transactions. The two code paths disagreed on what "today" means, breaking chronological ordering and relative-time labels whenever both existed on the same day.

**Fix**: added `dateInputToISO()` in [src/utils.ts](src/utils.ts) — combines the picked calendar date with the current local time-of-day (instead of UTC midnight) — and replaced the buggy `new Date(...).toISOString()` pattern at all 6 call sites: [transaction-modal.ts](src/components/transaction-modal.ts), [split-modal.ts](src/components/split-modal.ts), [lending.ts](src/pages/lending.ts) (×3), [networth.ts](src/pages/networth.ts). Deadline-type dates (goal target dates, lending due dates) were deliberately left alone — this only affects timestamps that need to sort/display as "when did this happen." Verified live: re-saving the Salary transaction now correctly shows "Just now" instead of "6 hours ago". `tsc --noEmit` and `vite build` both clean after the fix.

## Known non-bugs / gotchas (don't re-investigate these)

- **Stale service worker during dev testing**: recurring issue when testing in the browser pane — new routes/JS can 404 or show stale content. Not a code bug; fix by unregistering service workers (`navigator.serviceWorker.getRegistrations()`) and clearing caches (`caches.keys()`), then reloading.
- **`createChart` (Chart.js) usage rule**: always wrap the `<canvas>` in a fixed-height container div; never set height directly on the canvas. This was the root cause of the original "malfunctioning Net Worth chart" bug — apply this rule to any new chart.
- **Light theme fix is pragmatic, not exhaustive**: the `.light .<class>` overrides in `main.css` cover the common hardcoded Tailwind dark classes seen so far. If a new page introduces a hardcoded dark-mode class not yet covered, it may need its own override line — this was a deliberate scope decision (rewiring ~20 page files individually was judged not worth it vs. a shared override block).

## Working conventions established in this project

- sql.js migrations are additive/idempotent: `CREATE TABLE IF NOT EXISTS`, try/catch `ALTER TABLE`, partial unique indexes for dedup — never destructive schema changes.
- Always give an architecture assessment and get explicit phase/feature confirmation (via `AskUserQuestion`) before large builds — this project's owner prefers phased delivery with checkpoints over one-shot mega-builds, and has said explicitly not to build fake/placeholder functionality.
- Any devDependency installed for a one-off script (e.g. `sharp` for icon generation) gets uninstalled and its scratch directory cleaned up immediately after use.
- Verify UI changes live in the browser pane (not just `tsc`/`vite build`) before reporting a feature done, especially anything theme- or layout-related.
