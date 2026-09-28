-- Onboarding completion must live on the cloud profile, not just the local
-- device profile — otherwise an existing account opening MoneyFlow in a new
-- browser/device (which has no local profile yet) always sees onboarding
-- again, even though they already finished it once on their original device.
alter table public.profiles add column if not exists onboarding_complete boolean not null default false;
