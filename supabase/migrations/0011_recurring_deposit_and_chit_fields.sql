-- Recurring Deposit / Chit Fund account types: periodic contribution +
-- eventual maturity/payout fields on sync_accounts, mirroring the new
-- nullable columns added to the local accounts table.
alter table public.sync_accounts
  add column if not exists "contributionAmount" numeric,
  add column if not exists "contributionFrequency" text,
  add column if not exists "durationPeriods" integer,
  add column if not exists "maturityDate" text,
  add column if not exists "maturityValue" numeric;
