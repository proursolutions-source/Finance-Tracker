-- Local ids aren't all UUIDs — default-seeded categories use readable slugs
-- like 'cat-food', not crypto.randomUUID() — so the sync tables' id/foreign-
-- key-ish columns need to be text, not uuid, or a push fails outright for
-- anyone still using a default category.
alter table public.sync_categories alter column id type text;
alter table public.sync_accounts alter column id type text;
alter table public.sync_transactions alter column id type text, alter column "categoryId" type text, alter column "accountId" type text;
alter table public.sync_budgets alter column id type text, alter column "categoryId" type text;
alter table public.sync_reminders alter column id type text, alter column "categoryId" type text;
alter table public.sync_goals alter column id type text, alter column "linkedCategoryId" type text;
alter table public.sync_recurrings alter column id type text, alter column "categoryId" type text;
alter table public.sync_tombstones alter column id type text;
