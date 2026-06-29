/* ============================================================
   SPARK — спільний скрипт
   • Хмарна авторизація та прогрес через Supabase (email + пароль)
   • Прогрес кожного учня — окремий рядок у таблиці (захист RLS)
   • Якщо база не під'єднана (config.js із заглушками) — режим
     «лише читання»: уроки доступні, збереження вимкнено
   • Стиль інтерфейсу зберігається локально (це не дані учня)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- конфіг і клієнт ---------- */
  var cfg = window.SPARK_CONFIG || {};
  var TABLE = cfg.TABLE || "spark_progress";
  var hasCfg = !!cfg.SUPABASE_URL && !!cfg.SUPABASE_ANON_KEY &&
               cfg.SUPABASE_URL.indexOf("http") === 0 &&
               cfg.SUPABASE_URL.indexOf("ВСТАВ") === -1 &&
               cfg.SUPABASE_ANON_KEY.indexOf("ВСТАВ") === -1;
  var sb = null, mode = "disabled";
  if (hasCfg && window.supabase && window.supabase.createClient) {
    try { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); mode = "cloud"; }
    catch (e) { mode = "disabled"; }
  }

  var STYLE_KEY = "spark_style";
  var STYLES = ["signal", "arduino"];
  var state = { user: null, store: {} };

  /* ---------- хмарний шар даних ---------- */
  function mapUser(u) {
    if (!u) return null;
    var name = (u.user_metadata && u.user_metadata.name) || (u.email || "").split("@")[0];
    return { id: u.id, name: name, email: u.email || "" };
  }
  function loadSession() {
    if (mode !== "cloud") { state.user = null; state.store = {}; return Promise.resolve(); }
    return sb.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      state.user = session ? mapUser(session.user) : null;
      return state.user ? loadProgress() : (state.store = {});
    }).catch(function () { state.user = null; state.store = {}; });
  }
  function loadProgress() {
    state.store = {};
    if (mode !== "cloud" || !state.user) return Promise.resolve();
    return sb.from(TABLE)
      .select("data")
      .eq("user_id", state.user.id)
      .limit(1)
      .then(function (res) {
        if (res.error) { console.warn("SPARK loadProgress:", res.error.message); return; }
        if (res.data && res.data.length > 0 && res.data[0].data) {
          state.store = res.data[0].data;
        }
      })
      .catch(function (e) { console.warn("SPARK loadProgress catch:", e); });
  }
  function saveProgress() {
    if (mode !== "cloud" || !state.user) return Promise.resolve({ ok: false, error: "Немає входу." });
    return sb.from(TABLE).upsert(
      { user_id: state.user.id, data: state.store, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    ).then(function (res) {
      if (res.error) console.warn("SPARK saveProgress:", res.error.message);
      return { ok: !res.error, error: res.error ? res.error.message : null };
    }).catch(function (e) { console.warn("SPARK saveProgress catch:", e); return { ok: false, error: String(e) }; });
  }
  function translateErr(m) {
    m = (m || "").toLowerCase();
    if (m.indexOf("invalid login") >= 0) return "Невірний логін або пароль.";
    if (m.indexOf("already registered") >= 0 || m.indexOf("already been registered") >= 0) return "Такий логін уже зареєстровано — спробуй увійти.";
    if (m.indexOf("password") >= 0) return "Пароль має бути щонайменше 6 символів.";
    if (m.indexOf("valid email") >= 0 || (m.indexOf("email") >= 0 && m.indexOf("invalid") >= 0)) return "Введи логін у форматі пошти, напр. ivan@spark.class";
    if (m.indexOf("rate limit") >= 0 || m.indexOf("too many") >= 0) return "Забагато спроб. Зачекай хвилину.";
    return m ? ("Помилка: " + m) : "Сталася помилка. Спробуй ще раз.";
  }

  /* ---------- публічний API ---------- */
  var Spark = {
    mode: mode,
    isConfigured: function () { return mode === "cloud"; },
    getCurrentUser: function () { return state.user; },
    getStore: function () { return state.store || {}; },
    setStore: function (data) { state.store = data || {}; return saveProgress(); },
    isDone: function (id) { var s = state.store[id]; return !!(s && s.done); },
    register: function (email, password, name) {
      if (mode !== "cloud") return Promise.resolve({ ok: false, error: "Базу даних ще не під'єднано." });
      name = (name || "").trim();
      if (name.length < 2) return Promise.resolve({ ok: false, error: "Введи ім'я (мінімум 2 символи)." });
      if (!email) return Promise.resolve({ ok: false, error: "Введи логін (у форматі пошти)." });
      if ((password || "").length < 6) return Promise.resolve({ ok: false, error: "Пароль — щонайменше 6 символів." });
      return sb.auth.signUp({ email: email, password: password, options: { data: { name: name } } })
        .then(function (res) {
          if (res.error) return { ok: false, error: translateErr(res.error.message) };
          // needConfirm = email підтвердження увімкнено → session ще немає
          if (!res.data.session) return { ok: true, needConfirm: true };
          // Сесія є — встановлюємо юзера, НЕ читаємо таблицю (рядка ще немає)
          state.user = mapUser(res.data.user);
          state.store = {};
          return { ok: true };
        });
    },
    login: function (email, password) {
      if (mode !== "cloud") return Promise.resolve({ ok: false, error: "Базу даних ще не під'єднано." });
      return sb.auth.signInWithPassword({ email: email, password: password })
        .then(function (res) {
          if (res.error) return { ok: false, error: translateErr(res.error.message) };
          state.user = mapUser(res.data.user);
          return loadProgress().then(function () { return { ok: true }; });
        });
    },
    logout: function () {
      var done = function () { state.user = null; state.store = {}; };
      if (sb) return sb.auth.signOut().then(done, done);
      done(); return Promise.resolve();
    }
  };
  window.Spark = Spark;

  /* ====================================================
     ЛІСТЕНЕРИ, що не залежать від входу — чіпляємо одразу
     ==================================================== */

  /* перемикач стилю (2 варіанти) */
  function applyStyle(s) {
    if (STYLES.indexOf(s) === -1) s = "signal";
    var root = document.documentElement;
    if (s === "signal") root.removeAttribute("data-style"); else root.setAttribute("data-style", s);
    var btns = document.querySelectorAll("[data-style-set]");
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-style-set") === s ? "true" : "false");
  }
  (function initStyle() { var saved; try { saved = localStorage.getItem(STYLE_KEY); } catch (e) { saved = null; } applyStyle(saved || "signal"); })();
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-style-set]"); if (!b) return;
    var s = b.getAttribute("data-style-set"); applyStyle(s);
    try { localStorage.setItem(STYLE_KEY, s); } catch (err) {}
  });

  /* мобільне меню */
  document.addEventListener("click", function (e) {
    var toggle = e.target.closest("[data-menu-toggle]");
    if (toggle) {
      var nav = document.getElementById("nav-links");
      if (nav) { var open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", open ? "true" : "false"); }
      return;
    }
    var nav2 = document.getElementById("nav-links");
    if (nav2 && nav2.classList.contains("open") && !e.target.closest("#nav-links") && !e.target.closest("[data-menu-toggle]")) {
      nav2.classList.remove("open");
      var tg = document.querySelector("[data-menu-toggle]"); if (tg) tg.setAttribute("aria-expanded", "false");
    }
  });

  /* копіювання коду */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-btn"); if (!btn) return;
    var block = btn.closest(".code-block"); var code = block ? block.querySelector("code") : null; if (!code) return;
    var text = code.innerText;
    var done = function () { var old = btn.textContent; btn.textContent = "\u2713 Скопійовано"; setTimeout(function () { btn.textContent = old; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (err) {} document.body.removeChild(ta); }
  });

  /* акордеон */
  document.addEventListener("click", function (e) {
    var trg = e.target.closest(".acc-trigger"); if (!trg) return;
    var expanded = trg.getAttribute("aria-expanded") === "true";
    var panel = document.getElementById(trg.getAttribute("aria-controls"));
    trg.setAttribute("aria-expanded", expanded ? "false" : "true");
    if (panel) panel.classList.toggle("open", !expanded);
  });

  /* тест / квіз */
  document.addEventListener("click", function (e) {
    var opt = e.target.closest(".quiz-opt"); if (!opt || opt.disabled) return;
    var q = opt.closest(".quiz-q"); if (!q) return;
    var correct = opt.getAttribute("data-correct") === "true";
    var opts = q.querySelectorAll(".quiz-opt");
    for (var i = 0; i < opts.length; i++) { opts[i].disabled = true; if (opts[i].getAttribute("data-correct") === "true") opts[i].classList.add("correct"); }
    if (!correct) opt.classList.add("wrong");
    var fb = q.querySelector(".quiz-feedback");
    if (fb) { fb.classList.add("show"); fb.classList.add(correct ? "ok" : "no"); fb.textContent = correct ? (fb.getAttribute("data-ok") || "Правильно!") : (fb.getAttribute("data-no") || "Не зовсім — дивись підказку."); }
  });

  /* поява при прокручуванні */
  (function reveals() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) { for (var i = 0; i < els.length; i++) els[i].classList.add("in"); return; }
    var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* активний пункт меню */
  (function markCurrent() {
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      var base = (a.getAttribute("href") || "").split("#")[0].split("/").pop();
      if (base === here || (here === "" && base === "index.html")) a.setAttribute("aria-current", "page");
    });
  })();

  /* пошук у довіднику */
  (function refSearch() {
    var input = document.getElementById("ref-search"); if (!input) return;
    var items = document.querySelectorAll("[data-ref]");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      items.forEach(function (it) {
        var ok = ((it.getAttribute("data-ref") || "").toLowerCase() + " " + it.textContent.toLowerCase()).indexOf(q) !== -1;
        it.style.display = ok ? "" : "none"; if (ok) shown++;
      });
      var empty = document.getElementById("ref-empty"); if (empty) empty.style.display = shown ? "none" : "block";
    });
  })();

  /* вихід (працює після завантаження сесії) */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-logout]"); if (!b) return;
    e.preventDefault();
    Spark.logout().then(function () { location.reload(); });
  });

  /* ====================================================
     ПІСЛЯ завантаження сесії — UI акаунта і дані сторінок
     ==================================================== */
  function updateAccount() {
    var btn = document.querySelector("[data-account]"); if (!btn) return;
    var loginUrl = btn.getAttribute("data-login-url") || btn.getAttribute("href") || "pupil/login.html";
    var portUrl = loginUrl.replace("login.html", "portfolio.html");
    var label = btn.querySelector(".ac-label");
    var user = state.user;
    if (user) {
      if (label) label.textContent = user.name;
      btn.setAttribute("href", portUrl);
      btn.setAttribute("aria-label", "Мій профіль: " + user.name);
      btn.classList.add("account-logged");
    } else {
      if (label) label.textContent = "Увійти";
      btn.setAttribute("href", loginUrl);
      btn.setAttribute("aria-label", "Увійти або зареєструватися");
      btn.classList.remove("account-logged");
    }
  }

  function showLoginNotes() {
    if (state.user) return;
    var notes = document.querySelectorAll("[data-login-note]");
    for (var i = 0; i < notes.length; i++) notes[i].hidden = false;
  }

  function programProgress() {
    if (!document.getElementById("course-progress")) return;
    var rows = document.querySelectorAll("[data-lesson-id]"), total = rows.length, done = 0;
    rows.forEach(function (r) {
      if (Spark.isDone(r.getAttribute("data-lesson-id"))) {
        done++; r.classList.add("done");
        var st = r.querySelector(".lesson-status");
        if (st && !st.classList.contains("locked")) { st.textContent = "Завершено \u2713"; st.className = "lesson-status done"; }
      }
    });
    var fill = document.querySelector("#course-progress .progress-fill");
    var num = document.querySelector("#course-progress .progress-num");
    if (fill) fill.style.width = (total ? Math.round(done / total * 100) : 0) + "%";
    if (num) num.textContent = done + " / " + total + " уроків";
  }

  function lessonPage() {
    var root = document.getElementById("lesson-root"); if (!root) return;
    var id = root.getAttribute("data-lesson-id");
    var btn = document.querySelector("[data-mark-done]");
    var state2 = document.querySelector("[data-lesson-state]");
    var saveBtn = document.querySelector("[data-save-reflection]");
    var fields = root.querySelectorAll("[data-reflect]");
    var acc = document.querySelector("[data-account]");
    var loginUrl = acc ? acc.getAttribute("href") : "../pupil/login.html";

    if (!state.user) {
      if (state2) state2.textContent = "Статус: увійди, щоб зберігати прогрес";
      if (btn) { btn.textContent = "Увійти, щоб зберегти прогрес"; btn.addEventListener("click", function () { location.href = loginUrl; }); }
      if (saveBtn) saveBtn.addEventListener("click", function () { location.href = loginUrl; });
      return;
    }

    function refresh() {
      var done = Spark.isDone(id);
      if (state2) state2.textContent = done ? "Статус: завершено \u2713" : "Статус: у процесі";
      if (btn) { btn.textContent = done ? "\u2713 Урок завершено" : "Позначити урок завершеним"; btn.classList.toggle("btn-go", done); btn.classList.toggle("btn-primary", !done); }
    }
    if (btn) btn.addEventListener("click", function () {
      var s = Spark.getStore(); s[id] = s[id] || {}; s[id].done = !s[id].done;
      btn.textContent = "Збереження…";
      Spark.setStore(s).then(function (r) { if (!r.ok) { btn.textContent = "Помилка збереження"; } else { refresh(); } });
    });

    var saved = (Spark.getStore()[id] || {}).reflection || {};
    fields.forEach(function (f) { var k = f.getAttribute("data-reflect"); if (saved[k] && saved[k].a) f.value = saved[k].a; });
    if (saveBtn) saveBtn.addEventListener("click", function () {
      var s = Spark.getStore(); s[id] = s[id] || {}; s[id].reflection = {};
      fields.forEach(function (f) { s[id].reflection[f.getAttribute("data-reflect")] = { q: f.getAttribute("data-reflect-q") || "", a: f.value }; });
      saveBtn.textContent = "Збереження…";
      Spark.setStore(s).then(function (r) {
        saveBtn.textContent = r.ok ? "\u2713 Збережено" : "Помилка збереження";
        setTimeout(function () { saveBtn.textContent = "Зберегти рефлексію"; }, 1800);
      });
    });
    refresh();
  }

  function portfolioPage() {
    var root = document.getElementById("portfolio-root"); if (!root) return;
    var gate = document.getElementById("pf-auth-gate");
    var content = document.getElementById("pf-content");
    var hello = document.getElementById("pf-hello");

    if (!state.user) { if (gate) gate.hidden = false; if (content) content.hidden = true; return; }
    if (gate) gate.hidden = true; if (content) content.hidden = false;
    if (hello) hello.textContent = "Привіт, " + state.user.name + "!";

    var LESSONS = [
      { id: "lesson-led", title: "Перший світлодіод. Система «Світлофор»", page: "../lessons/lesson1.html" }
    ];
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
    var store = Spark.getStore();
    var doneList = document.getElementById("pf-done");
    var reflList = document.getElementById("pf-reflections");
    var count = 0, hasReflection = false;

    LESSONS.forEach(function (L) {
      var rec = store[L.id] || {};
      if (rec.done) {
        count++;
        var li = document.createElement("article"); li.className = "card";
        li.innerHTML = '<div class="chips"><span class="chip chip-go">завершено \u2713</span></div><h3 class="mt-1">' + esc(L.title) + '</h3><a class="btn btn-ghost mt-1" href="' + L.page + '">Повторити урок</a>';
        doneList.appendChild(li);
      }
      if (rec.reflection) {
        var html = "";
        Object.keys(rec.reflection).forEach(function (k) {
          var item = rec.reflection[k];
          if (item && item.a && item.a.trim()) { hasReflection = true; html += '<p class="mt-1"><strong>' + esc(item.q) + '</strong><br>' + esc(item.a) + "</p>"; }
        });
        if (html) { var c = document.createElement("article"); c.className = "card"; c.innerHTML = "<h3>" + esc(L.title) + "</h3>" + html; reflList.appendChild(c); }
      }
    });

    var emptyDone = document.getElementById("pf-empty"); if (emptyDone) emptyDone.style.display = count ? "none" : "block";
    var emptyRef = document.getElementById("pf-empty-ref"); if (emptyRef) emptyRef.style.display = hasReflection ? "none" : "block";
    var num = document.getElementById("pf-progress-num"); if (num) num.textContent = count + " із " + LESSONS.length + " завершено";
    var fill = document.querySelector("#pf-progress .progress-fill"); if (fill) fill.style.width = (LESSONS.length ? Math.round(count / LESSONS.length * 100) : 0) + "%";
  }

  function authPage() {
    var root = document.getElementById("auth-root"); if (!root) return;
    if (!Spark.isConfigured()) { var d = document.getElementById("auth-disabled"); if (d) d.hidden = false; }
    var cur = state.user;
    if (cur) { var w = document.getElementById("auth-already"); if (w) { w.hidden = false; var n = document.getElementById("auth-already-name"); if (n) n.textContent = cur.name; } }

    function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
    function msg(id, text, ok) { var el = document.getElementById(id); if (!el) return; el.textContent = text; el.className = "auth-msg " + (ok ? "ok" : "err"); }
    function busy(btn, on, label) { btn.disabled = on; if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Зачекай…"; } else { btn.textContent = btn.dataset.label || label; } }

    var rb = document.querySelector("[data-register]");
    if (rb) rb.addEventListener("click", function () {
      busy(rb, true);
      Spark.register(val("reg-email"), val("reg-pass"), val("reg-name")).then(function (r) {
        busy(rb, false, "Зареєструватися");
        if (!r.ok) { msg("reg-msg", r.error, false); return; }
        if (r.needConfirm) { msg("reg-msg", "Підтвердь реєстрацію за посиланням у пошті, потім увійди.", true); return; }
        location.href = "portfolio.html";
      });
    });

    var lb = document.querySelector("[data-login]");
    if (lb) lb.addEventListener("click", function () {
      busy(lb, true);
      Spark.login(val("login-email"), val("login-pass")).then(function (r) {
        busy(lb, false, "Увійти");
        if (!r.ok) { msg("login-msg", r.error, false); return; }
        location.href = "portfolio.html";
      });
    });
  }

  /* запуск після завантаження сесії */
  loadSession().then(function () {
    updateAccount();
    showLoginNotes();
    programProgress();
    lessonPage();
    portfolioPage();
    authPage();
  });

})();
