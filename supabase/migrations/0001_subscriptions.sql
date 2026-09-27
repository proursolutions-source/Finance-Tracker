-- MoneyFlow Cloud — subscriptions, admin, discounts
-- Run this once in the Supabase SQL Editor for your project (see SETUP_SUPABASE.md).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE / guarded backfills).

create extension if not exists "pgcrypto";

-- ============================================================
-- Profiles — one row per Supabase Auth user
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The one hardcoded admin: proursolutions@gmail.com. New signups matching this
-- email are auto-promoted; this backfill covers an account that already existed
-- before this migration ran.
update public.profiles set role = 'admin' where lower(email) = 'proursolutions@gmail.com';

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    case when lower(new.email) = 'proursolutions@gmail.com' then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer helper so RLS policies can check "is this caller an admin"
-- without recursively re-triggering RLS on profiles.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = 'user');

drop policy if exists "profiles_admin_update_any" on public.profiles;
create policy "profiles_admin_update_any" on public.profiles
  for update using (public.is_admin());

-- ============================================================
-- Subscription plans
-- ============================================================
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price_inr numeric(10, 2) not null default 0,
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly', 'lifetime')),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

drop policy if exists "plans_select_authenticated" on public.subscription_plans;
create policy "plans_select_authenticated" on public.subscription_plans
  for select using (auth.role() = 'authenticated');

drop policy if exists "plans_admin_write" on public.subscription_plans;
create policy "plans_admin_write" on public.subscription_plans
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.subscription_plans (name, description, price_inr, billing_interval, features, sort_order)
values
  ('Free', 'Core expense tracking, forever free', 0, 'monthly',
    '["Unlimited transactions", "Budgets & categories", "Basic reports"]'::jsonb, 0),
  ('Pro (Monthly)', 'The full MoneyFlow experience', 199, 'monthly',
    '["Everything in Free", "Bill scanning (OCR)", "Lending & Debt tracking", "MoneyFlow Memory", "Net Worth tracking", "Priority support"]'::jsonb, 1),
  ('Pro (Yearly)', 'The full MoneyFlow experience — 2 months free vs. monthly', 1990, 'yearly',
    '["Everything in Pro (Monthly)", "2 months free vs. paying monthly"]'::jsonb, 2)
on conflict (name) do nothing;

-- ============================================================
-- Discount codes — never exposed wholesale to regular users;
-- validated one at a time via the redeem_discount_code() RPC below.
-- ============================================================
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent', 'flat')),
  value numeric(10, 2) not null,
  max_redemptions integer,
  redemptions_count integer not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  applicable_plan_ids uuid[],
  notes text,
  created_at timestamptz not null default now()
);

alter table public.discount_codes enable row level security;

drop policy if exists "discounts_admin_all" on public.discount_codes;
create policy "discounts_admin_all" on public.discount_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Subscriptions — one row per user's subscription lifecycle.
-- payment_status stays 'manual'/'test' until a live payment gateway is wired in;
-- admins can activate/override manually from the Admin Portal in the meantime.
-- ============================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'canceled', 'expired', 'past_due')),
  discount_code_id uuid references public.discount_codes(id),
  discount_applied jsonb,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  payment_status text not null default 'manual' check (payment_status in ('manual', 'test', 'paid')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subs_select_own_or_admin" on public.subscriptions;
create policy "subs_select_own_or_admin" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "subs_insert_own" on public.subscriptions;
create policy "subs_insert_own" on public.subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "subs_update_own_cancel" on public.subscriptions;
create policy "subs_update_own_cancel" on public.subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "subs_admin_write" on public.subscriptions;
create policy "subs_admin_write" on public.subscriptions
  for update using (public.is_admin());

drop policy if exists "subs_admin_delete" on public.subscriptions;
create policy "subs_admin_delete" on public.subscriptions
  for delete using (public.is_admin());

-- ============================================================
-- Admin audit log — every admin action against a user/subscription is recorded.
-- ============================================================
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  action text not null,
  target_user_id uuid references public.profiles(id),
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "audit_admin_all" on public.admin_audit_log;
create policy "audit_admin_all" on public.admin_audit_log
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- RPC: validate a discount code for a given plan without exposing the table
-- ============================================================
create or replace function public.redeem_discount_code(p_code text, p_plan_id uuid)
returns jsonb as $$
declare
  v_code public.discount_codes;
begin
  select * into v_code from public.discount_codes
  where code = upper(p_code)
    and is_active = true
    and (valid_from is null or valid_from <= now())
    and (valid_until is null or valid_until >= now())
    and (max_redemptions is null or redemptions_count < max_redemptions)
    and (applicable_plan_ids is null or p_plan_id = any(applicable_plan_ids));

  if v_code.id is null then
    return jsonb_build_object('valid', false, 'message', 'Invalid, expired, or inapplicable code');
  end if;

  return jsonb_build_object(
    'valid', true,
    'id', v_code.id,
    'code', v_code.code,
    'type', v_code.type,
    'value', v_code.value
  );
end;
$$ language plpgsql security definer set search_path = public;
