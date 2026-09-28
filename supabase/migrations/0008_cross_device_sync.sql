-- Cross-device sync for the core local (sql.js) tables. Each row's id is the
-- same client-generated UUID on every device, so a row is simply upserted by
-- id — user_id exists for RLS and defense-in-depth, not as part of identity.
-- Conflict resolution is last-write-wins by updatedAt, done client-side; this
-- schema just needs to store the data plus enough to compare who's newer.

create table if not exists public.sync_categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense', 'both')),
  icon text,
  budget numeric,
  hidden boolean not null default false,
  color text,
  "isEssential" boolean,
  "isFixed" boolean,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.sync_accounts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  balance numeric not null,
  "asOfDate" date,
  notes text,
  "interestRate" numeric default 0,
  "creditLimit" numeric,
  "dueDate" timestamptz,
  "emiAmount" numeric,
  status text not null default 'open',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.sync_transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  "categoryId" uuid not null,
  date timestamptz not null,
  payee text,
  notes text,
  "accountId" uuid,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.sync_budgets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  "categoryId" uuid not null,
  amount numeric not null,
  period text not null check (period in ('weekly', 'monthly', 'yearly')),
  "startDate" timestamptz not null,
  "endDate" timestamptz,
  notes text,
  color text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.sync_reminders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  "dueDate" timestamptz not null,
  "categoryId" uuid,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  notes text,
  completed boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.sync_goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  "targetAmount" numeric not null,
  "currentAmount" numeric default 0,
  "targetDate" timestamptz,
  priority text default 'medium',
  "linkedCategoryId" uuid,
  notes text,
  completed boolean default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.sync_recurrings (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  type text,
  "categoryId" uuid,
  frequency text,
  "startDate" timestamptz,
  "endDate" timestamptz,
  "nextDueDate" timestamptz,
  notes text,
  "isSubscription" boolean default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- Records that a row was deleted on one device, so other devices know to
-- delete their local copy on the next pull rather than treating a missing
-- row as "never existed / hasn't synced down yet".
create table if not exists public.sync_tombstones (
  id uuid not null,
  table_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  "deletedAt" timestamptz not null default now(),
  primary key (id, table_name)
);

alter table public.sync_categories enable row level security;
alter table public.sync_accounts enable row level security;
alter table public.sync_transactions enable row level security;
alter table public.sync_budgets enable row level security;
alter table public.sync_reminders enable row level security;
alter table public.sync_goals enable row level security;
alter table public.sync_recurrings enable row level security;
alter table public.sync_tombstones enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['sync_categories','sync_accounts','sync_transactions','sync_budgets','sync_reminders','sync_goals','sync_recurrings','sync_tombstones']
  loop
    execute format('
      create policy "select own rows" on public.%I for select using (user_id = auth.uid());
      create policy "insert own rows" on public.%I for insert with check (user_id = auth.uid());
      create policy "update own rows" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy "delete own rows" on public.%I for delete using (user_id = auth.uid());
    ', t, t, t, t);
  end loop;
end $$;

create index if not exists idx_sync_categories_user_updated on public.sync_categories (user_id, "updatedAt");
create index if not exists idx_sync_accounts_user_updated on public.sync_accounts (user_id, "updatedAt");
create index if not exists idx_sync_transactions_user_updated on public.sync_transactions (user_id, "updatedAt");
create index if not exists idx_sync_budgets_user_updated on public.sync_budgets (user_id, "updatedAt");
create index if not exists idx_sync_reminders_user_updated on public.sync_reminders (user_id, "updatedAt");
create index if not exists idx_sync_goals_user_updated on public.sync_goals (user_id, "updatedAt");
create index if not exists idx_sync_recurrings_user_updated on public.sync_recurrings (user_id, "updatedAt");
create index if not exists idx_sync_tombstones_user_deleted on public.sync_tombstones (user_id, "deletedAt");
