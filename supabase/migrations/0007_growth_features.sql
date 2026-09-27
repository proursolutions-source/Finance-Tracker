-- Feedback submissions (Contact Us / Feedback page)
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "feedback_insert_any" on public.feedback;
create policy "feedback_insert_any" on public.feedback for insert with check (true);
drop policy if exists "feedback_select_admin" on public.feedback;
create policy "feedback_select_admin" on public.feedback for select using (public.is_admin());

-- Account deletion requests — self-service deletion isn't possible from the
-- client (no service-role key here), so a request is recorded for an admin
-- to action manually, consistent with this app's other admin-mediated flows.
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.account_deletion_requests enable row level security;
drop policy if exists "deletion_requests_insert_own" on public.account_deletion_requests;
create policy "deletion_requests_insert_own" on public.account_deletion_requests
  for insert with check (user_id = auth.uid());
drop policy if exists "deletion_requests_select_own_or_admin" on public.account_deletion_requests;
create policy "deletion_requests_select_own_or_admin" on public.account_deletion_requests
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "deletion_requests_update_admin" on public.account_deletion_requests;
create policy "deletion_requests_update_admin" on public.account_deletion_requests
  for update using (public.is_admin());
drop policy if exists "deletion_requests_delete_own" on public.account_deletion_requests;
create policy "deletion_requests_delete_own" on public.account_deletion_requests
  for delete using (user_id = auth.uid() and status = 'pending');

-- Feature flags — admin-configurable toggles, read by every client.
-- 'maintenance_mode' is a reserved key checked at boot for all non-admins.
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);
insert into public.feature_flags (key, enabled, description) values
  ('maintenance_mode', false, 'Blocks non-admin sign-in with a maintenance page when enabled.')
  on conflict (key) do nothing;
alter table public.feature_flags enable row level security;
drop policy if exists "feature_flags_select_any" on public.feature_flags;
create policy "feature_flags_select_any" on public.feature_flags for select using (true);
drop policy if exists "feature_flags_write_admin" on public.feature_flags;
create policy "feature_flags_write_admin" on public.feature_flags
  for update using (public.is_admin()) with check (public.is_admin());

-- Support tickets
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own" on public.support_tickets
  for insert with check (user_id = auth.uid());
drop policy if exists "support_tickets_select_own_or_admin" on public.support_tickets;
create policy "support_tickets_select_own_or_admin" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "support_tickets_update_admin" on public.support_tickets;
create policy "support_tickets_update_admin" on public.support_tickets
  for update using (public.is_admin());

-- Referrals — a shareable per-user code and a redemption log. No automated
-- reward payout is implemented; an admin can see redemptions and act manually
-- (e.g. apply a discount code), same manual-mediation pattern as payments.
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
drop policy if exists "referral_codes_select_own_or_admin" on public.referral_codes;
create policy "referral_codes_select_own_or_admin" on public.referral_codes
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "referral_codes_insert_own" on public.referral_codes;
create policy "referral_codes_insert_own" on public.referral_codes
  for insert with check (user_id = auth.uid());

create table if not exists public.referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null references public.referral_codes(code) on delete cascade,
  redeemed_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (redeemed_by)
);
alter table public.referral_redemptions enable row level security;
drop policy if exists "referral_redemptions_insert_any" on public.referral_redemptions;
create policy "referral_redemptions_insert_any" on public.referral_redemptions
  for insert with check (redeemed_by = auth.uid());
drop policy if exists "referral_redemptions_select_related_or_admin" on public.referral_redemptions;
create policy "referral_redemptions_select_related_or_admin" on public.referral_redemptions
  for select using (
    redeemed_by = auth.uid()
    or referral_code in (select code from public.referral_codes where user_id = auth.uid())
    or public.is_admin()
  );
