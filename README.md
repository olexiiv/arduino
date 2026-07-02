# SPARK — навчальний сайт з Arduino

Багатосторінковий статичний сайт (HTML + CSS + JavaScript, без фреймворків) для курсу Arduino у 5–7 класах НУШ. Слоган — **«Програмуй майбутнє своїми руками»**. Працює з будь-якого хостингу або з локальної папки — відкрий `index.html`.

---

## 📁 Структура файлів

```
spark/
├── index.html              ← головна сторінка
├── program.html            ← карта уроків + прогрес
├── reference.html          ← довідник із пошуком
├── about.html              ← про проєкт + FAQ
├── README.md               ← цей файл
├── SUPABASE_SETUP.md       ← як під'єднати хмарну базу (покроково)
├── supabase_setup.sql      ← SQL для створення таблиці прогресу
├── supabase_teacher.sql    ← SQL для ролі вчителя + класів і кодів
├── pupil/
│   ├── login.html          ← реєстрація (за кодом класу) / вхід
│   └── portfolio.html      ← портфоліо учня + прогрес
├── teacher/
│   └── dashboard.html      ← панель вчителя (класи, коди, прогрес)
├── lessons/
│   └── lesson1.html        ← урок-зразок (Світлодіод / Світлофор)
├── tinkercad/
│   └── practice1.html      ← практика в Tinkercad
├── img/                    ← логотипи та зображення
├── css/
│   └── styles.css          ← єдина дизайн-система (усі стилі тут)
└── js/
    ├── layout.js           ← спільна шапка й підвал (одне джерело)
    ├── lessons.js          ← ЄДИНИЙ реєстр уроків (додавай уроки тут)
    ├── config.js           ← ключі Supabase (встав свої)
    └── scripts.js          ← уся логіка (вхід, прогрес, класи, тести…)
```

**Важливо:** зберігай саме цю структуру папок — посилання між сторінками відносні й залежать від неї.

> 🔑 **Щоб прогрес зберігався у хмарі — виконай інструкцію у `SUPABASE_SETUP.md`.** Доки база не під'єднана, сайт працює в режимі «лише читання».

---

## 🔗 Як працюють відносні шляхи (головне правило)

Сторінки в **корені** (`index`, `program`, `reference`, `about`) підключають ресурси так:
```html
<link rel="stylesheet" href="css/styles.css">
<script src="js/scripts.js"></script>
<a href="lessons/lesson1.html">…</a>
```

Сторінки **в підпапках** (`pupil/`, `lessons/`, `tinkercad/`) виходять на рівень вище через `../`:
```html
<link rel="stylesheet" href="../css/styles.css">
<script src="../js/scripts.js"></script>
<a href="../program.html">…</a>
<a href="../lessons/lesson1.html">…</a>
```

> Якщо посилання «не працює» — найчастіше забули `../` (або, навпаки, додали зайве).

---

## 🧱 Головні правила (щоб нічого не зламати)

1. **Стилі — лише у `css/styles.css`.** Не пиши `style="..."` всередині HTML.
2. **Логіка — лише у `js/scripts.js`.** Не пиши `onclick="..."` всередині HTML.
3. **Шапку й підвал НЕ дублюй.** Вони будуються з одного файлу `js/layout.js`. На сторінці лише два порожні контейнери: `<div id="site-header"></div>` і `<div id="site-footer"></div>`. Щоб змінити навігацію чи логотип — правиться **тільки `js/layout.js`**.
4. **Реєстр уроків — лише у `js/lessons.js`.** Карта програми, портфоліо й панель вчителя будуються з нього.

---

## ➕ Як додати звичайну сторінку

Найпростіше — скопіювати готову сторінку того самого рівня (з кореня — напр. `about.html`; у підпапку — напр. `pupil/portfolio.html`). Кожна сторінка має містити:

```html
<body data-base="">            <!-- "" для кореня, "../" для підпапки -->
  <div id="site-header"></div>  <!-- шапка вставиться сюди -->
  <main id="main"> … твій вміст … </main>
  <div id="site-footer"></div>  <!-- підвал вставиться сюди -->

  <!-- скрипти в такому порядку: -->
  <script src="js/layout.js"></script>
  <script src="js/lessons.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/config.js"></script>
  <script src="js/scripts.js"></script>
</body>
```
(у підпапці до кожного `js/...` додай `../`). Щоб пункт з'явився в меню — додай його у `js/layout.js` (один раз, для всіх сторінок). Активний пункт підсвічується автоматично.

---

## 🎓 Як додати НОВИЙ УРОК (лише 2 кроки)

Уроків може бути скільки завгодно — не 8. Завдяки реєстру `js/lessons.js` додавання уроку — це **два кроки**.

### Крок 1. Створи файл уроку
Скопіюй `lessons/lesson1.html` → `lessons/lesson2.html` і заміни:
- унікальний код уроку: `<article id="lesson-root" data-lesson-id="lesson-led">` → напр. `data-lesson-id="lesson-button"`;
- вміст блоків: мета → що знадобиться (2 шляхи) → теорія → схема (`<svg class="schematic">`) → код → покрокова практика → Tinkercad → тест → виклик → рефлексія.

### Крок 2. Додай ОДИН запис у `js/lessons.js`
```js
window.SPARK_LESSONS = [
  …,
  { id: "lesson-button", num: 3, title: "Кнопка та умови",
    summary: "Зчитуємо натискання й керуємо схемою через if.",
    file: "lessons/lesson2.html" }   // шлях від КОРЕНЯ сайту; null якщо «готується»
];
```
Готово. Карта програми, портфоліо й панель вчителя **оновляться самі**:
- `id` має збігатися з `data-lesson-id` на сторінці уроку;
- `file: "lessons/lesson2.html"` → урок «Доступний» і клікабельний; `file: null` → показується як «Готується»;
- `num` — порядковий номер у карті.

> Більше **не** потрібно редагувати `program.html` чи масиви в `scripts.js` — усе з реєстру.


---

## 🎨 Перемикач стилю (2 варіанти)

У шапці є перемикач із двох кружечків — учень обирає вигляд сайту, і вибір запам'ятовується:

| Стиль | Опис |
|---|---|
| **Сигнал** | темний (за замовчуванням), бурштин + зелений |
| **Arduino** | світлий, бірюзовий — у дусі arduino.cc |

Технічно стиль — це атрибут на `<html>`: `data-style="arduino"` (для «Сигналу» атрибута немає). Кожен стиль — це набір CSS-змінних на початку `css/styles.css` (блоки `:root` та `html[data-style="arduino"]`).

**Щоб додати свій стиль:** додай блок `html[data-style="myname"] { --accent: …; --bg: …; }` у CSS, кружечок-кнопку `data-style-set="myname"` у шапку та назву `"myname"` у масив `STYLES` у `scripts.js`.

---

## 👤 Реєстрація учнів (за кодом класу)

Учні приєднуються до курсу **за кодом класу**, який видає вчитель. Це водночас закриває відкриту реєстрацію: без коду профіль не створюється.

**Потік:** вчитель на своїй панелі створює клас → отримує код (напр. `SPARK-4K2X`) → учні на `pupil/login.html` реєструються, вводячи ім'я, цей код, логін і пароль. Прогрес зберігається в хмарі Supabase й доступний із будь-якого пристрою.

**Налаштування бази:** інструкція — у **`SUPABASE_SETUP.md`**; SQL — у **`supabase_setup.sql`** (прогрес) і **`supabase_teacher.sql`** (ролі, класи, коди). Ключі — у **`js/config.js`**.

**Як це працює технічно:**
- Авторизація — Supabase Auth (email + пароль), ім'я в `user_metadata.name`.
- `spark_classes` — класи з унікальним `code` і `teacher_id`. `spark_profiles` — `name`, `role`, `class_id`. `spark_progress` — `user_id` + `data` (JSON).
- Код перевіряється функцією `class_id_for_code()` (доступна незалогіненим). Профіль створюється лише з валідним `class_id` і роллю `student` — самопризначити роль «вчитель» не можна.
- Вчитель бачить (RLS) лише учнів **своїх** класів.

**Доки база не під'єднана** — сайт у режимі «лише читання» (уроки/довідник працюють). Якщо ключі є, але бібліотека Supabase не завантажилась (немає інтернету) — показується окреме повідомлення «хмара недоступна».

**Роль вчителя.** Вчитель створюється одноразово через адмінку Supabase + SQL (див. `SUPABASE_SETUP.md`, розділ «Роль вчителя»). На панелі `teacher/dashboard.html` він створює класи, бачить коди й прогрес усіх учнів. Пункт меню «Клас» з'являється лише вчителям.

---

## 🧩 Шпаргалка по компонентах

**Блок коду** (підсвічування + кнопка «копіювати»):
```html
<div class="code-block">
  <div class="code-head"><span>назва.ino</span><button class="copy-btn" type="button">Копіювати</button></div>
  <pre><code><span class="tok-key">int</span> ledPin = <span class="tok-num">5</span>; <span class="tok-com">// коментар</span></code></pre>
</div>
```
Класи: `tok-key`, `tok-fn`, `tok-num`, `tok-com`. У коді `<` пиши як `&lt;`.

**Питання тесту:**
```html
<div class="quiz-q">
  <p class="q-text">Питання?</p>
  <div class="quiz-opts">
    <button class="quiz-opt" type="button" data-correct="true"><span class="mark">А</span> Правильна</button>
    <button class="quiz-opt" type="button"><span class="mark">Б</span> Інша</button>
  </div>
  <div class="quiz-feedback" data-ok="Молодець!" data-no="Спробуй ще."></div>
</div>
```

**Поле рефлексії** (зберігається в портфоліо):
```html
<textarea id="r4" data-reflect="r4" data-reflect-q="Текст питання?"></textarea>
```

**Виноски:** `<div class="callout">`, `callout tip` (зелена), `callout safety` (червона).

---

## 🧪 Жива симуляція Tinkercad

1. Відкрий проєкт на **tinkercad.com** → **Share → Embed**, скопіюй посилання `https://www.tinkercad.com/embed/XXXX`.
2. У файлі знайди блок `.embed` із закоментованим `<iframe>` і встав:
```html
<div class="embed">
  <iframe title="Симуляція у Tinkercad" loading="lazy"
          src="https://www.tinkercad.com/embed/XXXX?editbtn=1"></iframe>
</div>
```
3. Видали заглушку `embed-placeholder`.

---

## 🖼️ Зображення

Клади файли в папку `img/` і підключай з урахуванням рівня:
```html
<!-- з кореня -->     <img src="img/foto.png" alt="опис">
<!-- з підпапки -->  <img src="../img/foto.png" alt="опис">
```

---

## ♿ Доступність

Сайт зроблено за WCAG AA: навігація з клавіатури, видимий фокус, ARIA-атрибути, підтримка `prefers-reduced-motion`, контент читається без JavaScript. Додаючи контент — давай зображенням `alt`, кнопкам зрозумілий текст, дотримуйся ієрархії заголовків.

---

© 2026 SPARK · Навчальний проєкт для НУШ · 5–7 класи
