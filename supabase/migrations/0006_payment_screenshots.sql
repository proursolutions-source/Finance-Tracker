-- Private bucket for customer-submitted UPI payment confirmation screenshots.
-- Files are stored as "{user_id}/{filename}" so RLS can scope access by path.
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', false)
on conflict (id) do nothing;

drop policy if exists "payment_screenshots_insert_own" on storage.objects;
create policy "payment_screenshots_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'payment-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "payment_screenshots_select_own_or_admin" on storage.objects;
create policy "payment_screenshots_select_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'payment-screenshots'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "payment_screenshots_delete_own" on storage.objects;
create policy "payment_screenshots_delete_own" on storage.objects
  for delete using (
    bucket_id = 'payment-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.subscriptions add column if not exists payment_screenshot_path text;
