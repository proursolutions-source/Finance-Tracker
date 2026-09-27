-- Application-level event log: login/security events and client-side errors,
-- so the Admin Portal has real visibility instead of only Supabase's own
-- infrastructure logs (which admins can't see from inside the app).
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('login_success', 'login_failed', 'signup', 'logout', 'client_error')),
  message text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_at_idx on public.app_events (created_at desc);
create index if not exists app_events_event_type_idx on public.app_events (event_type);

alter table public.app_events enable row level security;

-- Insert is open to anon + authenticated: login_failed and signup events
-- happen before (or without) an established session, so there's no user to
-- scope the insert to yet. This is a known, accepted tradeoff (a client could
-- spam junk rows) rather than a security boundary -- see remarks in the app.
drop policy if exists "app_events_insert_any" on public.app_events;
create policy "app_events_insert_any" on public.app_events
  for insert with check (true);

drop policy if exists "app_events_select_admin" on public.app_events;
create policy "app_events_select_admin" on public.app_events
  for select using (public.is_admin());

-- Retention: keep 90 days of events. Admin-only (raises otherwise); callable
-- manually or by a scheduled job. This project's free tier doesn't have
-- pg_cron enabled, so it isn't auto-scheduled -- a known gap, not silently
-- assumed to run.
create or replace function public.prune_old_app_events()
returns void as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can prune app events';
  end if;
  delete from public.app_events where created_at < now() - interval '90 days';
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.prune_old_app_events() to authenticated;
