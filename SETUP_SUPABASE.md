# Setting up MoneyFlow Cloud (Supabase)

MoneyFlow itself needs **no setup** — it's fully offline by default. This step is only
needed to turn on **Subscription management** and the **Admin Portal**
(proursolutions@gmail.com). Skip this and the app works exactly as before; the
Subscription and Admin pages will just show an honest "not set up yet" message.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (you'll need your own account —
   this is a decision Claude can't make or sign up for on your behalf).
2. Create a new project. Pick any name/region; the free tier is enough to start.
3. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema migration

1. In your Supabase project, open **SQL Editor**.
2. Open [supabase/migrations/0001_subscriptions.sql](supabase/migrations/0001_subscriptions.sql) from this repo, copy its entire contents.
3. Paste into the SQL Editor and click **Run**.
4. This creates: `profiles`, `subscription_plans` (seeded with Free/Pro Monthly/Pro Yearly),
   `discount_codes`, `subscriptions`, `admin_audit_log`, plus all Row Level Security
   policies and a trigger that auto-promotes `proursolutions@gmail.com` to admin on signup.
5. It's safe to re-run this file any time — every statement is idempotent.

## 3. Get your project's API keys

1. In Supabase, go to **Project Settings -> API**.
2. Copy the **Project URL** and the **anon / public key** (NOT the `service_role` key —
   that one must never be used in client-side code).

## 4. Configure MoneyFlow

1. Copy `.env.example` to `.env` in the project root.
2. Fill in:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Restart the dev server (`npm run dev`) or rebuild (`npm run build`).

## 5. Become the admin

1. Open the app, go to **Subscription** (or **Admin Portal**), and sign up for a
   MoneyFlow Cloud account using **proursolutions@gmail.com**.
2. That's it — the migration's trigger auto-assigns the `admin` role to that exact
   email on signup. The **Admin Portal** link appears in the sidebar automatically
   once you're signed in as that account.
3. Every other email that signs up gets the regular `user` role.

## What this does and doesn't do yet

- **Does**: real accounts, real Postgres-backed subscription/plan/discount data, real
  server-side access control (Row Level Security — not just a client-side check),
  an audit log of every admin action.
- **Doesn't yet**: charge any real money. No payment gateway (Razorpay/Stripe/etc.) is
  wired in. "Subscribe" records honest pending intent; an admin activates it manually
  from the Admin Portal's Users tab until a live gateway is connected. See
  [PROJECT_STATUS.md](PROJECT_STATUS.md) for what's next.
- **Local data stays local**: your transactions, budgets, goals, etc. still live only in
  this device's sql.js/IndexedDB store. This Supabase backend only holds account,
  subscription, and admin data — it is not yet the sync backend for your financial data
  (that's the separately-scoped Phase from PROJECT_STATUS.md's "Sync backend" section).
