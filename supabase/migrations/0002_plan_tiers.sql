-- Adds a real tier concept (free/pro/premium) to subscription_plans so the
-- app can gate features by tier, independent of billing interval (monthly vs
-- yearly plans on the same tier both unlock the same features).
-- Safe to re-run.

alter table public.subscription_plans
  add column if not exists tier text not null default 'free' check (tier in ('free', 'pro', 'premium'));

update public.subscription_plans set tier = 'free' where name = 'Free';
update public.subscription_plans set tier = 'pro' where name in ('Pro (Monthly)', 'Pro (Yearly)');

insert into public.subscription_plans (name, description, price_inr, billing_interval, features, sort_order, tier)
values
  ('Premium (Monthly)', 'Everything in Pro, plus MoneyFlow Memory', 349, 'monthly',
    '["Everything in Pro", "MoneyFlow Memory (Timeline, Milestones, On This Day)", "Priority support"]'::jsonb, 3, 'premium'),
  ('Premium (Yearly)', 'Everything in Pro, plus MoneyFlow Memory — 2 months free vs. monthly', 3490, 'yearly',
    '["Everything in Pro (Yearly)", "MoneyFlow Memory (Timeline, Milestones, On This Day)", "Priority support"]'::jsonb, 4, 'premium')
on conflict (name) do nothing;
