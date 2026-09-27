-- Supports a genuinely free payment path: the admin's own UPI ID, shown to a
-- subscribing customer as a QR code / deep link. Money moves peer-to-peer
-- with zero gateway fees; the customer submits a UTR/reference number, and
-- the admin manually confirms and activates from the Admin Portal (already
-- built) after checking their own UPI app. Safe to re-run.

-- Singleton settings row (the `id boolean ... check (id)` trick guarantees
-- at most one row can ever exist).
create table if not exists public.payment_settings (
  id boolean primary key default true check (id),
  upi_id text,
  payee_name text,
  updated_at timestamptz not null default now()
);

insert into public.payment_settings (id) values (true) on conflict (id) do nothing;

alter table public.payment_settings enable row level security;

drop policy if exists "payment_settings_select_authenticated" on public.payment_settings;
create policy "payment_settings_select_authenticated" on public.payment_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "payment_settings_admin_write" on public.payment_settings;
create policy "payment_settings_admin_write" on public.payment_settings
  for update using (public.is_admin()) with check (public.is_admin());

alter table public.subscriptions add column if not exists payment_reference text;
