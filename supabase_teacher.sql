-- ============================================================
-- SPARK — ролі, класи та коди приєднання
-- Виконати ПІСЛЯ supabase_setup.sql. Ідемпотентний — можна
-- запускати повторно (безпечно оновлює наявну схему).
-- Supabase → SQL Editor → New query → встав усе → Run
-- ============================================================

-- ---------- ПРОФІЛІ (ім'я + роль + клас) ----------
create table if not exists public.spark_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text        not null default '',
  role       text        not null default 'student',
  class_id   uuid,
  created_at timestamptz not null default now()
);
alter table public.spark_profiles enable row level security;

-- ---------- КЛАСИ (з кодом приєднання) ----------
create table if not exists public.spark_classes (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text        not null default '',
  teacher_id uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.spark_classes enable row level security;

-- зв'язок профілю з класом (якщо колонки ще немає)
alter table public.spark_profiles
  add column if not exists class_id uuid references public.spark_classes(id) on delete set null;

-- ---------- ФУНКЦІЇ (security definer → обходять RLS, без рекурсії) ----------
create or replace function public.is_teacher()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.spark_profiles where user_id = auth.uid() and role = 'teacher');
$$;

-- перевірка коду класу для НЕзалогінених (повертає id класу або null)
create or replace function public.class_id_for_code(p_code text)
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.spark_classes where code = upper(btrim(p_code)) limit 1;
$$;
grant execute on function public.class_id_for_code(text) to anon, authenticated;

-- чи існує клас із таким id (для перевірки під час створення профілю)
create or replace function public.class_exists(p_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.spark_classes where id = p_id);
$$;
grant execute on function public.class_exists(uuid) to anon, authenticated;

-- ---------- ПОЛІТИКИ: spark_classes ----------
drop policy if exists "class_teacher_all" on public.spark_classes;
create policy "class_teacher_all" on public.spark_classes
  for all using ( teacher_id = auth.uid() )
  with check ( teacher_id = auth.uid() and public.is_teacher() );

-- ---------- ПОЛІТИКИ: spark_profiles ----------
-- перегляд: свій рядок АБО вчитель цього класу
drop policy if exists "prof_select"       on public.spark_profiles;
drop policy if exists "prof_own_select"   on public.spark_profiles;
drop policy if exists "teacher_select_all" on public.spark_profiles;
create policy "prof_select" on public.spark_profiles
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.spark_classes c
               where c.id = spark_profiles.class_id and c.teacher_id = auth.uid())
  );

-- створення: ЛИШЕ власний рядок, роль student, з валідним класом
-- (це закриває самопризначення ролі «вчитель» і відкриту реєстрацію без коду)
drop policy if exists "prof_insert"     on public.spark_profiles;
drop policy if exists "prof_own_insert" on public.spark_profiles;
create policy "prof_insert" on public.spark_profiles
  for insert with check (
    auth.uid() = user_id
    and role = 'student'
    and class_id is not null
    and public.class_exists(class_id)
  );

-- ОНОВЛЕННЯ профілю з боку клієнта заборонено (роль/клас змінює лише адмін через SQL)
drop policy if exists "prof_update"     on public.spark_profiles;
drop policy if exists "prof_own_update" on public.spark_profiles;

-- ---------- ПОЛІТИКИ: spark_progress ----------
-- вчитель бачить прогрес лише учнів СВОЇХ класів
drop policy if exists "teacher_select_all"   on public.spark_progress;
drop policy if exists "teacher_class_select" on public.spark_progress;
create policy "teacher_class_select" on public.spark_progress
  for select using (
    exists (
      select 1 from public.spark_profiles p
      join public.spark_classes c on c.id = p.class_id
      where p.user_id = spark_progress.user_id and c.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- СТВОРИТИ ВЧИТЕЛЯ (одноразово, через адмінку)
-- Учитель НЕ реєструється на сайті (там потрібен код класу).
-- 1) Authentication → Users → Add user: пошта + пароль.
-- 2) Виконай (заміни пошту та ім'я):
--
-- insert into public.spark_profiles (user_id, name, role)
-- values (
--   (select id from auth.users where email = 'teacher@spark.class'),
--   'Ім''я Вчителя', 'teacher'
-- )
-- on conflict (user_id) do update set role = 'teacher';
-- ============================================================

-- (опційно) прив'язати вже наявних учнів до класу за кодом:
-- update public.spark_profiles set class_id = public.class_id_for_code('SPARK-XXXX')
-- where role = 'student' and class_id is null;

-- Перевірка ролей і класів:
-- select p.name, p.role, c.code as class_code, u.email
--   from public.spark_profiles p
--   left join public.spark_classes c on c.id = p.class_id
--   join auth.users u on u.id = p.user_id
--  order by p.role desc, p.name;
