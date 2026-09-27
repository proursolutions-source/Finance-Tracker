-- Lets the (unauthenticated) login screen check whether an email is already
-- registered, so it can steer someone to Sign Up vs Log In automatically.
-- Note: this is a deliberate, narrow email-enumeration surface (returns only
-- a boolean, nothing else) — a product trade-off for UX, accepted explicitly.
-- Safe to re-run.

create or replace function public.email_exists(p_email text)
returns boolean as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(p_email)
  );
$$ language sql security definer stable set search_path = public;

grant execute on function public.email_exists(text) to anon, authenticated;
