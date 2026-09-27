# MoneyFlow Multi-Platform Sync — Architecture Plan (DRAFT, for review)

**Status:** proposal only. No backend code has been written. Everything below needs
your sign-off — especially the marked **DECISION NEEDED** points — before implementation starts.

## 1. What this changes

MoneyFlow is currently **offline-only by design**: no server, no network calls for
data, everything in IndexedDB on one device. Every page in this app, and its
Privacy Policy, says data "never leaves this device."

Making the web app, a mobile app, and a desktop app "connected to each other
based on login details" requires reversing that: a real backend, a real
database, real authentication, and a sync protocol. This is not an add-on —
it's a second product built around the same features. Expect this to be the
largest single piece of work done on this codebase so far.

**What stays the same:** all the domain logic already built (transactions,
budgets, lending/debt, recurring, net worth, reports) — the SQL schema in
`db-worker.ts` maps almost directly onto server-side tables.

**What's new:** an account is no longer a `localStorage` password hash — it's
a row in a real database, reachable from any device, with real session
tokens, sync conflict handling, and infrastructure to run and pay for.

## 2. Proposed architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Web (PWA)  │   │   Mobile    │   │   Desktop   │
│  (existing)  │   │ (Capacitor) │   │   (Tauri)   │
└──────┬───────┘   └──────┬──────┘   └──────┬──────┘
       │                  │                  │
       │   HTTPS + JWT    │                  │
       └──────────────────┼──────────────────┘
                           │
                  ┌────────▼─────────┐
                  │   Sync API        │  (new)
                  │  (auth + REST/    │
                  │   realtime sync)  │
                  └────────┬──────────┘
                           │
                  ┌────────▼─────────┐
                  │   Postgres         │  (new)
                  │  (real accounts +  │
                  │   all financial    │
                  │   data)            │
                  └────────────────────┘
```

Each client keeps its **local SQLite/IndexedDB copy** for offline use (this is
the one part of the current design worth keeping) and syncs to the server
opportunistically — not a full rewrite to "always online."

### 2a. Backend — **DECISION NEEDED**

| Option | Pros | Cons |
|---|---|---|
| **Supabase** (Postgres + Auth + Realtime, hosted) | Fastest to stand up; real auth (email/password, magic links, OAuth) out of the box; row-level security maps naturally to per-user data; realtime subscriptions can drive live sync | Vendor dependency; free tier has limits; less control over sync conflict logic |
| **Firebase** (Firestore + Auth) | Same speed benefits; strong mobile SDKs | Firestore's document model is a worse fit than Postgres for this relational schema (budgets→categories, lendings→payments, etc.); would mean redesigning the schema, not reusing it |
| **Self-hosted Node/Express or Fastify + Postgres** | Full control; no vendor lock-in; schema ports over almost unchanged from `db-worker.ts` | You own the ops: hosting, backups, scaling, auth security — all built from scratch |

**Recommendation:** Supabase. It lets the existing Postgres-shaped schema
(transactions, categories, budgets, reminders, goals, accounts, recurrings,
lendings, transfers) port over close to as-is, ships real auth so the fragile
local password gate goes away entirely, and has a realtime layer usable for
live sync between a user's own devices.

### 2b. Authentication — replaces `auth-gate.ts` entirely

- Real signup/login against the backend (email + password, hashed server-side
  with bcrypt/argon2 — never client-side SHA-256 as today).
- Session via short-lived JWT + refresh token, stored securely per platform
  (httpOnly cookie on web where possible; secure storage APIs on mobile/desktop).
- The current local-only PIN lock can stay as a *second, local* quick-unlock
  layer on top of a real session — it solves a different problem (fast
  re-entry on a trusted device) and doesn't need to change.
- Migration: an existing local-only account (name/email/password hash in
  `localStorage`) becomes an offer to "create a synced account" — user
  re-enters their password once, server creates the real account, local data
  uploads as the initial sync.

### 2c. Sync protocol — **DECISION NEEDED**

| Option | How it works | Tradeoff |
|---|---|---|
| **Last-write-wins, timestamp-based** | Every row already has `createdAt`/`updatedAt`. On sync, newest `updatedAt` per row wins. | Simple, ports directly onto the existing schema. Risk: a genuine edit conflict (edited the same transaction on two devices while offline) silently loses one edit. Acceptable for a single-user finance app where simultaneous multi-device edits are rare. |
| **Operation log / CRDT-style** | Every change is an appended event; server merges event streams. | Handles conflicts correctly, no data loss. Meaningfully more complex to build and reason about — a real distributed-systems project. |

**Recommendation:** last-write-wins to start. It's a reasonable match for how
one person actually uses a finance tracker (rarely two simultaneous edits to
the exact same record), and it can be upgraded later if real conflicts turn
out to matter.

Sync flow per client, on reconnect:
1. Push local rows changed since last sync (`updatedAt > lastSyncedAt`).
2. Pull server rows changed since last sync for this account.
3. Apply pulls locally (upsert by id); resolve any id collisions by `updatedAt`.
4. Store new `lastSyncedAt`.

### 2d. Client platforms — **DECISION NEEDED**

| Platform | Approach | Why |
|---|---|---|
| **Web** | Keep the existing Vite/TS app; add the sync/auth client. | No rewrite. |
| **Mobile** | **Capacitor**, wrapping the existing web app in a native shell, vs. a from-scratch React Native/Flutter app. | Capacitor reuses 100% of the current UI/logic and just adds native APIs (camera for bill-scanning, secure storage, push notifications) — weeks not months. A native rewrite would look/feel more "native" but throws away this entire codebase's UI layer. |
| **Desktop** | **Tauri**, wrapping the existing web app, vs. Electron. | Tauri produces a much smaller, more secure binary (no bundled Chromium) and Rust-based backend; Electron is more battle-tested/documented if that matters more than binary size. |

**Recommendation:** Capacitor (mobile) + Tauri (desktop). Both let the single
existing web codebase become the "one app, three shells" the request is
asking for, instead of three separate codebases to maintain.

## 3. Data model changes needed

- Every table gains a `userId` foreign key (currently single-user, no owner column).
- Every table already has `id`/`createdAt`/`updatedAt` — good, sync reuses these as-is.
- New tables: `sync_state` (per-device `lastSyncedAt`), `sessions` (refresh tokens).
- Row-level security (if Supabase): policies scoped to `auth.uid() = userId`.

## 4. Security considerations

- Local password hashing (client-side SHA-256, no salt) must be **replaced**,
  not reused, for the real account — that scheme was explicitly built for a
  low-stakes local gate, not for a credential going over the network.
- HTTPS is mandatory end-to-end (this plan assumes the "Force HTTPS" work
  already done in the checklist).
- Rate limiting on the login endpoint (server-side), not just the client-side
  throttling already added — client-side throttling is trivially bypassed by
  anyone calling the API directly.
- Decide on data export/GDPR-style deletion request handling once data lives
  on a server you control (the current Privacy Policy's "we have nothing to
  delete on our end" line becomes false and needs rewriting).

## 5. Suggested phasing

1. **Phase 0** (this doc): agree on backend, sync strategy, and mobile/desktop packaging.
2. **Phase 1**: stand up Supabase project, port schema, build real signup/login/session on the web app only (no sync yet — just moves auth off `localStorage`).
3. **Phase 2**: add push/pull sync for the web app against the new backend; test with one account across two browser sessions.
4. **Phase 3**: Capacitor-wrap for mobile (app store accounts, icons, permissions, push notifications).
5. **Phase 4**: Tauri-wrap for desktop (installer, auto-update).
6. **Phase 5**: polish conflict edge cases, add account deletion/export flows, rewrite Privacy Policy to reflect real data storage.

## 6. Costs/decisions this doesn't make for you

- Supabase (or any hosted backend) has a real ongoing cost once past free tier.
- Apple Developer Program ($99/yr) and Google Play ($25 one-time) accounts are
  needed to ship to app stores.
- A domain + HTTPS certificate for the API and web app.
- Someone has to own running/monitoring the backend going forward — this app
  currently has zero operational burden; that changes completely.

---

**Next step:** confirm the three DECISION NEEDED points above (backend
platform, sync strategy, mobile/desktop packaging) — or tell me to just go
with the recommendations — and I'll start on Phase 1.
