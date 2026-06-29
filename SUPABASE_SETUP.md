# Під'єднання бази даних Supabase (покроково)

Щоб прогрес учнів зберігався у хмарі й був доступний із будь-якого пристрою, сайт використовує **Supabase** — безкоштовну базу даних з авторизацією. GitHub Pages залишається хостингом сайту, а Supabase зберігає акаунти й прогрес.

Час налаштування — ~15 хвилин. Програмувати нічого не треба: лише скопіювати кілька значень.

---

## Крок 1. Створи проєкт Supabase

1. Зайди на **https://supabase.com** → **Start your project** → увійди (зручно через GitHub-акаунт).
2. Натисни **New project**.
3. Заповни:
   - **Name:** напр. `spark`
   - **Database Password:** придумай надійний пароль і **збережи його** (знадобиться рідко, але втрачати не варто).
   - **Region:** обери найближчий, напр. **Central EU (Frankfurt)**.
4. Натисни **Create new project** і зачекай 1–2 хв, поки проєкт запуститься.

---

## Крок 2. Створи таблицю прогресу

1. У лівому меню відкрий **SQL Editor** → **New query**.
2. Відкрий файл **`supabase_setup.sql`** з цього проєкту, скопіюй увесь його вміст у вікно запиту.
3. Натисни **Run** (або Ctrl/Cmd + Enter).
4. У нижній частині редактора з'явиться результат — має бути рядок:

   | table_name      | row_security |
   |-----------------|--------------|
   | spark_progress  | YES          |

   Якщо бачиш цей рядок — таблицю створено правильно. Якщо результат порожній — спробуй виконати скрипт ще раз або перевір, що не залишилось незакритих транзакцій.

> **Важливо:** таблиця називається `spark_progress` (не просто `progress`) — це уникає конфліктів із зарезервованими словами PostgreSQL.

---

## Крок 3. Налаштуй вхід учнів

1. Ліве меню → **Authentication** → **Sign In / Providers** (або **Providers**).
2. Переконайся, що провайдер **Email** увімкнено.
3. **Вимкни підтвердження пошти**, щоб учням не потрібна була справжня скринька:
   - Знайди опцію **Confirm email** (у деяких версіях — **Email Confirm** у розділі Auth → Settings) і **вимкни** її.
   - Тоді учні зможуть реєструватися з простим логіном на кшталт `oleh@spark.class` без реальної пошти.
4. (За бажанням) у **Authentication → URL Configuration** встав адресу свого сайту на GitHub Pages у поле **Site URL** — напр. `https://твій-нік.github.io/spark/`.

> Порада щодо логінів: домовтеся в класі про формат, напр. `прізвище@spark.class`. Так учні легко згадають свій логін.

---

## Крок 4. Підключи ключі до сайту

1. У Supabase: ліве меню → **Project Settings** (шестірня) → **API**.
2. Скопіюй два значення:
   - **Project URL** — напр. `https://abcdefgh.supabase.co`
   - **anon public** ключ — довгий рядок, що починається з `eyJ...`
3. У проєкті сайту відкрий файл **`js/config.js`** і встав їх:

```js
window.SPARK_CONFIG = {
  SUPABASE_URL:      "https://abcdefgh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...твій_ключ...",
  TABLE: "progress"
};
```

4. Збережи файл.

> **Чи безпечно класти ключ у код?** Так. `anon public` ключ призначений саме для браузера. Доступ до даних обмежує RLS: кожен учень бачить лише свій рядок. (А от `service_role` ключ — таємний, його в код **не** клади.)

---

## Крок 5. Виклади на GitHub Pages

1. Завантаж усі файли проєкту в репозиторій GitHub (зберігаючи структуру папок).
2. **Settings → Pages → Build and deployment → Source:** обери `Deploy from a branch`, гілка `main`, папка `/ (root)` (або `/docs`, якщо складеш туди).
3. Зачекай 1–2 хв — GitHub дасть адресу `https://твій-нік.github.io/назва-репозиторію/`.
4. Відкрий сайт → **Увійти** → зареєструй тестового учня → познач урок завершеним.
5. Перевір на іншому пристрої: увійди тим самим логіном — прогрес на місці. 🎉

---

## Як це працює (коротко для вчителя)

- Реєстрація/вхід — це **Supabase Auth** (email + пароль).
- Прогрес кожного учня — окремий рядок у таблиці `progress` (`user_id` + `data` у форматі JSON).
- **RLS** гарантує, що учень читає й змінює лише власні дані.
- Усі результати класу видно в Supabase: **Table Editor → progress**.

## Корисне

- **Скинути пароль учневі:** Authentication → Users → знайти користувача → **Reset password / Send recovery**. (Якщо логіни без справжньої пошти — там само можна видалити користувача й створити заново.)
- **Подивитися прогрес:** Table Editor → `progress` → стовпець `data`.
- **Безкоштовний тариф** Supabase із запасом покриває потреби класу чи школи.

## Якщо база ще не під'єднана

Доки в `js/config.js` стоять заглушки, сайт працює в режимі «лише читання»: уроки, схеми, код, тести й довідник доступні, а на сторінці входу показується повідомлення, що базу ще не під'єднано. Нічого не ламається.

---

## 🛠 Діагностика типових помилок

### «invalid path specified in request url»
Ця помилка означає, що JS-клієнт звертається до таблиці, якої немає або до якої немає доступу.

**Крок 1 — перевір, чи таблиця існує:**
Supabase → SQL Editor → виконай:
```sql
select table_name, row_security
  from information_schema.tables
 where table_schema = 'public' and table_name = 'spark_progress';
```
Якщо результат **порожній** — таблицю не створено. Виконай `supabase_setup.sql` ще раз.

**Крок 2 — перевір RLS-політики:**
```sql
select policyname, cmd from pg_policies
 where tablename = 'spark_progress';
```
Має бути три рядки: `own_select`, `own_insert`, `own_update`.
Якщо їх немає — виконай тільки блок `create policy` зі скрипту.

**Крок 3 — перевір `config.js`:**
- `SUPABASE_URL` — повинен починатися з `https://` і **не** містити `/` в кінці.
- `SUPABASE_ANON_KEY` — довгий рядок, що починається з `eyJ`.
- `TABLE` — має бути рівно `"spark_progress"`.

**Крок 4 — якщо таблиця `progress` вже існує зі старого скрипту:**
```sql
-- перейменуй стару таблицю
alter table public.progress rename to spark_progress;
-- і перестворити політики:
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
```

### «User already registered»
Учень з таким email вже є. Попроси увійти замість реєстрації, або видали користувача в Authentication → Users і зареєструй заново.

### Реєстрація проходить, але прогрес не зберігається
Перевір Console браузера (F12 → Console) — там будуть повідомлення `SPARK loadProgress:` або `SPARK saveProgress:` з детальним описом помилки.
