-- ============================================================
-- SPARK — налаштування бази даних Supabase
-- Відкрий: Supabase → SQL Editor → New query → встав → Run
-- ============================================================

-- 1. Таблиця прогресу (назва spark_progress — без конфліктів)
create table if not exists public.spark_progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb        not null default '{}'::jsonb,
  updated_at timestamptz  not null default now()
);

-- 2. Захист рядків (Row Level Security)
alter table public.spark_progress enable row level security;

-- 3. Кожен учень бачить і змінює ЛИШЕ свій рядок
drop policy if exists "own_select" on public.spark_progress;
create policy "own_select" on public.spark_progress
  for select using ( auth.uid() = user_id );

drop policy if exists "own_insert" on public.spark_progress;
create policy "own_insert" on public.spark_progress
  for insert with check ( auth.uid() = user_id );

drop policy if exists "own_update" on public.spark_progress;
create policy "own_update" on public.spark_progress
  for update using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- 4. Перевірка: має повернути таблицю spark_progress
select table_name, row_security
  from information_schema.tables
 where table_schema = 'public'
   and table_name   = 'spark_progress';

-- Якщо бачиш рядок spark_progress | YES — все правильно!
