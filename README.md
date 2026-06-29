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
├── pupil/
│   ├── login.html          ← реєстрація / вхід учня
│   └── portfolio.html      ← портфоліо учня + прогрес
├── lessons/
│   └── lesson1.html        ← урок-зразок (Світлодіод / Світлофор)
├── tinkercad/
│   └── practice1.html      ← практика в Tinkercad
├── img/                    ← сюди клади зображення
├── css/
│   └── styles.css          ← єдина дизайн-система (усі стилі тут)
└── js/
    ├── config.js           ← ключі Supabase (встав свої)
    └── scripts.js          ← уся логіка (вхід, прогрес, тести…)
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
3. **Шапка й підвал однакові** на всіх сторінках — копіюй їх із готової сторінки (не забудь про `../` у підпапках).
4. У `<head>` — підключення шрифтів Google і `styles.css`; перед `</body>` — `scripts.js`.

---

## ➕ Як додати звичайну сторінку

1. Скопіюй сторінку з потрібного рівня (з кореня — напр. `about.html`; у підпапку — напр. `lessons/lesson1.html`, щоб уже були правильні `../`).
2. Заміни вміст усередині `<main> … </main>`.
3. Додай пункт у меню **на кожній сторінці** (з урахуванням рівня):

```html
<!-- у корені -->
<li><a href="news.html">Новини</a></li>
<!-- у підпапці -->
<li><a href="../news.html">Новини</a></li>
```

> Активний пункт меню підсвічується автоматично — `scripts.js` порівнює назву файлу.

---

## 🎓 Як додати НОВИЙ УРОК (покроково)

### Крок 1. Створи файл
Скопіюй `lessons/lesson1.html` → `lessons/lesson2.html`.

### Крок 2. Унікальний ідентифікатор
Знайди й заміни код уроку:
```html
<article id="lesson-root" data-lesson-id="lesson-led">
```
напр. на `data-lesson-id="lesson-button"`. Він має бути **унікальним** — саме за ним рахується прогрес і портфоліо.

### Крок 3. Заповни 11 блоків
Структура вже готова — заміни текст: мета → що знадобиться (2 шляхи) → теорія → схема (`<svg class="schematic">`) → код → покрокова практика → Tinkercad → тест → виклик → рефлексія → навігація.

### Крок 4. Додай урок у карту (`program.html`)
У блоці `.roadmap` додай рядок. **Доступний** урок — посилання:
```html
<a class="lesson-row active" href="lessons/lesson2.html" data-lesson-id="lesson-button">
  <div class="lesson-num">3</div>
  <div class="lesson-info"><h3>Кнопка та умови</h3><p>Короткий опис.</p></div>
  <span class="lesson-status active">Доступний →</span>
</a>
```
Урок **«готується»** — `<div>` зі статусом `locked`.

### Крок 5. Додай урок у портфоліо (`js/scripts.js`)
Знайди масив `LESSONS` (блок «Сторінка Портфоліо») і додай рядок. Зверни увагу: шлях задається **відносно `pupil/portfolio.html`**, тому з `../`:
```js
var LESSONS = [
  { id: "lesson-led",    title: "Перший світлодіод. Система «Світлофор»", page: "../lessons/lesson1.html" },
  { id: "lesson-button", title: "Кнопка та умови", page: "../lessons/lesson2.html" }
];
```
`id` має точно збігатися з `data-lesson-id` уроку.

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

## 👤 Реєстрація учнів (хмара Supabase)

Кожен учень створює акаунт на сторінці `pupil/login.html` (логін у форматі пошти + пароль). Прогрес, тести й рефлексії зберігаються в **хмарній базі Supabase** і доступні з будь-якого пристрою, де учень увійде.

**Налаштування бази:** покрокова інструкція — у файлі **`SUPABASE_SETUP.md`**, SQL для таблиці — у **`supabase_setup.sql`**. Ключі вставляються у **`js/config.js`**.

**Як це працює технічно:**
- Авторизація — Supabase Auth (email + пароль). Ім'я учня зберігається в `user_metadata.name`.
- Прогрес — таблиця `progress`: один рядок на учня (`user_id` + `data` у форматі JSON `{ "<id-уроку>": { done, reflection } }`).
- **RLS** (захист на рівні рядків) гарантує, що учень читає/змінює лише свій рядок.
- `js/config.js` містить `SUPABASE_URL` і `SUPABASE_ANON_KEY` (anon-ключ безпечно тримати в коді — дані захищає RLS).
- Кнопка акаунта в шапці (`data-account`) показує ім'я того, хто увійшов, і веде до портфоліо; для незалогінених — «Увійти».

**Доки база не під'єднана** (у `config.js` заглушки) — сайт працює в режимі «лише читання»: уроки, схеми, код, тести й довідник доступні; на сторінці входу показано повідомлення про відсутність бази. Нічого не ламається.

**Що вимагає входу:** позначення уроку завершеним, збереження рефлексії, перегляд портфоліо. Решта сайту — без входу.

**Для вчителя:** усі результати — у Supabase → Table Editor → `progress`. Скинути пароль чи видалити учня — Authentication → Users.

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
