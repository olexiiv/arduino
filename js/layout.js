/* ============================================================
   SPARK — СПІЛЬНА ШАПКА І ПІДВАЛ
   Вставляються з одного джерела в кожну сторінку.
   Сторінка повинна мати:
     <body data-base="">      ← "" для кореня, "../" для підпапки
     <div id="site-header"></div>   (одразу після <body>)
     ... контент ...
     <div id="site-footer"></div>   (перед скриптами)
   Щоб змінити навігацію/логотип — правиться ЛИШЕ цей файл.
   ============================================================ */
(function () {
  "use strict";
  var base = (document.body && document.body.getAttribute("data-base")) || "";
  window.SPARK_BASE = base;

  var brand =
    '<a class="brand" href="' + base + 'index.html">' +
      '<img class="brand-logo brand-logo--dark"  src="' + base + 'img/logo_spark_black.gif" alt="" aria-hidden="true" width="32" height="32">' +
      '<img class="brand-logo brand-logo--light" src="' + base + 'img/logo_spark_white.gif" alt="" aria-hidden="true" width="32" height="32">SPARK</a>';

  var header =
    '<a class="skip" href="#main">Перейти до вмісту</a>' +
    '<header class="site-header">' +
      '<nav class="nav container" aria-label="Головна навігація">' +
        brand +
        '<ul class="nav-links" id="nav-links">' +
          '<li><a href="' + base + 'index.html">Головна</a></li>' +
          '<li><a href="' + base + 'program.html">Програма</a></li>' +
          '<li><a href="' + base + 'reference.html">Довідник</a></li>' +
          '<li><a href="' + base + 'tinkercad/practice1.html">Практика</a></li>' +
          '<li><a href="' + base + 'about.html">Про проєкт</a></li>' +
        '</ul>' +
        '<div class="nav-tools">' +
          '<a class="account-btn" data-account href="' + base + 'pupil/login.html">' +
            '<span class="ac-icon" aria-hidden="true">\uD83D\uDC64</span><span class="ac-label">Увійти</span></a>' +
          '<div class="style-switch" role="group" aria-label="Стиль сайту">' +
            '<button class="swatch swatch-signal" type="button" data-style-set="signal" aria-pressed="true" title="Сигнал (темний)" aria-label="Стиль Сигнал, темний"></button>' +
            '<button class="swatch swatch-arduino" type="button" data-style-set="arduino" aria-pressed="false" title="Arduino" aria-label="Стиль Arduino"></button>' +
          '</div>' +
          '<button class="icon-btn menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="nav-links" aria-label="Відкрити меню">\u2630</button>' +
        '</div>' +
      '</nav>' +
    '</header>';

  var footer =
    '<footer class="site-footer">' +
      '<div class="container">' +
        '<div class="footer-grid">' +
          '<div>' + brand +
            '<p class="mt-1">Майстерня сигналів. Вчимося Arduino з нуля — з реальним набором або онлайн у Tinkercad.</p></div>' +
          '<div><h4>Навчання</h4><ul>' +
            '<li><a href="' + base + 'program.html">Програма курсу</a></li>' +
            '<li><a href="' + base + 'lessons/lesson1.html">Перший урок</a></li>' +
            '<li><a href="' + base + 'tinkercad/practice1.html">Практика в Tinkercad</a></li>' +
            '<li><a href="' + base + 'pupil/portfolio.html">Моє портфоліо</a></li>' +
          '</ul></div>' +
          '<div><h4>Ресурси</h4><ul>' +
            '<li><a href="' + base + 'reference.html">Довідник</a></li>' +
            '<li><a href="' + base + 'about.html">Про проєкт</a></li>' +
            '<li><a href="' + base + 'about.html#faq">Питання та відповіді</a></li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="footer-bottom"><span>© 2026 SPARK · Навчальний проєкт для НУШ</span><span>Для учнів 5–7 класів</span></div>' +
      '</div>' +
    '</footer>';

  var h = document.getElementById("site-header");
  if (h) h.outerHTML = header;
  var f = document.getElementById("site-footer");
  if (f) f.outerHTML = footer;
})();
