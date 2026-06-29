-- ============================================================
-- SPARK — налаштування бази даних Supabase
-- Відкрий Supabase → SQL Editor → New query → встав це → Run
-- ============================================================

-- Таблиця прогресу: один рядок на кожного учня
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Увімкнути захист на рівні рядків (Row Level Security)
alter table public.progress enable row level security;

-- Політики: кожен користувач бачить і змінює ЛИШЕ свій рядок
drop policy if exists "own_select" on public.progress;
create policy "own_select" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "own_insert" on public.progress;
create policy "own_insert" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_update" on public.progress;
create policy "own_update" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Готово. Тепер кожен учень працює лише зі своїми даними.
