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
  var PROFILES = "spark_profiles";
  var CLASSES = "spark_classes";
  var configured = !!cfg.SUPABASE_URL && !!cfg.SUPABASE_ANON_KEY &&
                   cfg.SUPABASE_URL.indexOf("http") === 0 &&
                   cfg.SUPABASE_URL.indexOf("ВСТАВ") === -1 &&
                   cfg.SUPABASE_ANON_KEY.indexOf("ВСТАВ") === -1;
  var libLoaded = !!(window.supabase && window.supabase.createClient);
  var sb = null, mode = "unconfigured";
  if (!configured) {
    mode = "unconfigured";               // ключі не вставлені
  } else if (!libLoaded) {
    mode = "unavailable";                // ключі є, але бібліотека Supabase не завантажилась (CDN/офлайн)
  } else {
    try { sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); mode = "cloud"; }
    catch (e) { mode = "unavailable"; }
  }
  var BASE = window.SPARK_BASE || "";

  var STYLE_KEY = "spark_style";
  var STYLES = ["signal", "arduino"];
  var state = { user: null, store: {}, role: "student", classId: null };

  /* ---------- хмарний шар даних ---------- */
  function mapUser(u) {
    if (!u) return null;
    var name = (u.user_metadata && u.user_metadata.name) || (u.email || "").split("@")[0];
    return { id: u.id, name: name, email: u.email || "" };
  }
  function loadSession() {
    if (mode !== "cloud") { state.user = null; state.store = {}; state.role = "student"; return Promise.resolve(); }
    return sb.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      state.user = session ? mapUser(session.user) : null;
      if (!state.user) { state.store = {}; state.role = "student"; return; }
      return loadProfile().then(loadProgress);
    }).catch(function () { state.user = null; state.store = {}; state.role = "student"; });
  }
  function loadProfile() {
    state.role = "student"; state.classId = null;
    if (mode !== "cloud" || !state.user) return Promise.resolve();
    return sb.from(PROFILES).select("name,role,class_id").eq("user_id", state.user.id).limit(1)
      .then(function (res) {
        if (res.error) { console.warn("SPARK loadProfile:", res.error.message); return; }
        if (res.data && res.data.length > 0) {
          if (res.data[0].name) state.user.name = res.data[0].name;
          state.role = res.data[0].role || "student";
          state.classId = res.data[0].class_id || null;
        }
      }).catch(function (e) { console.warn("SPARK loadProfile catch:", e); });
  }
  // Створити профіль учня з привʼязкою до класу (лише під час реєстрації)
  function createStudentProfile(name, classId) {
    if (mode !== "cloud" || !state.user) return Promise.resolve({ ok: false });
    return sb.from(PROFILES).insert(
      { user_id: state.user.id, name: name || state.user.name || "", role: "student", class_id: classId }
    ).then(function (res) {
      if (res.error) { console.warn("SPARK createProfile:", res.error.message); return { ok: false, error: res.error.message }; }
      state.role = "student"; state.classId = classId;
      return { ok: true };
    }).catch(function (e) { return { ok: false, error: String(e) }; });
  }
  // Перевірити код класу (для незалогінених) через RPC
  function classIdForCode(code) {
    if (mode !== "cloud") return Promise.resolve(null);
    return sb.rpc("class_id_for_code", { p_code: code }).then(function (res) {
      if (res.error) { console.warn("SPARK classCode:", res.error.message); return null; }
      return res.data || null;
    }).catch(function () { return null; });
  }
  // Створити клас (вчитель)
  function createClass(name) {
    if (mode !== "cloud" || !state.user) return Promise.resolve({ ok: false, error: "Немає входу." });
    var code = genCode();
    return sb.from(CLASSES).insert({ code: code, name: name || "", teacher_id: state.user.id }).select("id,code,name")
      .then(function (res) {
        if (res.error) {
          // можливий збіг коду — одна повторна спроба
          if ((res.error.message || "").toLowerCase().indexOf("duplicate") >= 0) {
            var code2 = genCode();
            return sb.from(CLASSES).insert({ code: code2, name: name || "", teacher_id: state.user.id }).select("id,code,name")
              .then(function (r2) { return r2.error ? { ok: false, error: r2.error.message } : { ok: true, klass: r2.data[0] }; });
          }
          return { ok: false, error: res.error.message };
        }
        return { ok: true, klass: res.data[0] };
      }).catch(function (e) { return { ok: false, error: String(e) }; });
  }
  function genCode() {
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без плутаних 0/O/1/I
    var s = "";
    for (var i = 0; i < 4; i++) s += A.charAt(Math.floor(Math.random() * A.length));
    return "SPARK-" + s;
  }
  // Завантажити класи вчителя разом з учнями та прогресом
  function loadClasses() {
    if (mode !== "cloud" || !state.user) return Promise.resolve({ ok: false, error: "Немає входу." });
    return sb.from(CLASSES).select("id,code,name").eq("teacher_id", state.user.id).then(function (cr) {
      if (cr.error) return { ok: false, error: cr.error.message };
      var classes = cr.data || [];
      if (!classes.length) return { ok: true, classes: [] };
      var ids = classes.map(function (c) { return c.id; });
      return sb.from(PROFILES).select("user_id,name,class_id").in("class_id", ids).then(function (pr) {
        if (pr.error) return { ok: false, error: pr.error.message };
        var profs = pr.data || [];
        var uids = profs.map(function (p) { return p.user_id; });
        var progQuery = uids.length ? sb.from(TABLE).select("user_id,data,updated_at").in("user_id", uids)
                                    : Promise.resolve({ data: [] });
        return Promise.resolve(progQuery).then(function (gr) {
          if (gr && gr.error) return { ok: false, error: gr.error.message };
          var pmap = {};
          ((gr && gr.data) || []).forEach(function (row) { pmap[row.user_id] = row; });
          classes.forEach(function (c) {
            c.students = profs.filter(function (p) { return p.class_id === c.id; }).map(function (p) {
              var row = pmap[p.user_id] || {};
              return { id: p.user_id, name: p.name || "(без імені)", data: row.data || {}, updated_at: row.updated_at || null };
            });
            c.students.sort(function (a, b) { return a.name.localeCompare(b.name, "uk"); });
          });
          return { ok: true, classes: classes };
        });
      });
    }).catch(function (e) { return { ok: false, error: String(e) }; });
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
  function notReadyMsg() {
    return mode === "unavailable"
      ? "Хмара тимчасово недоступна (немає інтернету або заблоковано). Спробуй пізніше."
      : "Базу даних ще не під'єднано.";
  }
  var Spark = {
    mode: mode,
    getMode: function () { return mode; },
    isConfigured: function () { return mode === "cloud"; },
    getCurrentUser: function () { return state.user; },
    getStore: function () { return state.store || {}; },
    setStore: function (data) { state.store = data || {}; return saveProgress(); },
    isDone: function (id) { var s = state.store[id]; return !!(s && s.done); },
    isTeacher: function () { return state.role === "teacher"; },
    getRole: function () { return state.role; },
    loadClasses: loadClasses,
    createClass: createClass,
    register: function (email, password, name, code) {
      if (mode !== "cloud") return Promise.resolve({ ok: false, error: notReadyMsg() });
      name = (name || "").trim();
      code = (code || "").trim();
      if (name.length < 2) return Promise.resolve({ ok: false, error: "Введи ім'я (мінімум 2 символи)." });
      if (!code) return Promise.resolve({ ok: false, error: "Введи код класу (його дає вчитель)." });
      if (!email) return Promise.resolve({ ok: false, error: "Введи логін (у форматі пошти)." });
      if ((password || "").length < 6) return Promise.resolve({ ok: false, error: "Пароль — щонайменше 6 символів." });
      return classIdForCode(code).then(function (classId) {
        if (!classId) return { ok: false, error: "Такого коду класу немає. Перевір у вчителя." };
        return sb.auth.signUp({ email: email, password: password, options: { data: { name: name } } })
          .then(function (res) {
            if (res.error) return { ok: false, error: translateErr(res.error.message) };
            if (!res.data.session) return { ok: true, needConfirm: true };
            state.user = mapUser(res.data.user);
            state.store = {};
            return createStudentProfile(name, classId).then(function (pr) {
              if (!pr.ok) return { ok: false, error: "Акаунт створено, але не вдалося приєднати до класу: " + (pr.error || "") };
              return { ok: true };
            });
          });
      });
    },
    login: function (email, password) {
      if (mode !== "cloud") return Promise.resolve({ ok: false, error: notReadyMsg() });
      return sb.auth.signInWithPassword({ email: email, password: password })
        .then(function (res) {
          if (res.error) return { ok: false, error: translateErr(res.error.message) };
          state.user = mapUser(res.data.user);
          return loadProfile().then(loadProgress).then(function () { return { ok: true }; });
        });
    },
    logout: function () {
      var done = function () { state.user = null; state.store = {}; state.role = "student"; state.classId = null; };
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

  function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function lessonsList() { return window.SPARK_LESSONS || []; }

  function programProgress() {
    var roadmap = document.getElementById("roadmap");
    if (!roadmap) return;
    var lessons = lessonsList();
    var done = 0, total = lessons.length;
    var html = "";
    lessons.forEach(function (L) {
      var isDone = Spark.isDone(L.id);
      if (isDone) done++;
      var available = !!L.file;
      var cls = "lesson-row" + (isDone ? " done" : (available ? " active" : ""));
      var status = isDone ? '<span class="lesson-status done">Завершено \u2713</span>'
                 : available ? '<span class="lesson-status active">Доступний →</span>'
                 : '<span class="lesson-status locked">Готується</span>';
      var inner =
        '<div class="lesson-num">' + L.num + '</div>' +
        '<div class="lesson-info"><h3>' + escHtml(L.title) + '</h3><p>' + escHtml(L.summary) + '</p></div>' +
        status;
      if (available) html += '<a class="' + cls + '" href="' + BASE + L.file + '" data-lesson-id="' + L.id + '">' + inner + '</a>';
      else html += '<div class="' + cls + '" data-lesson-id="' + L.id + '">' + inner + '</div>';
    });
    roadmap.innerHTML = html;

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

    var LESSONS = lessonsList().map(function (L) { return { id: L.id, title: L.title, page: BASE + (L.file || "program.html") }; });
    function esc(s) { return escHtml(s); }
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
    var d = document.getElementById("auth-disabled");
    if (Spark.getMode() !== "cloud" && d) {
      d.hidden = false;
      var h4 = d.querySelector("h4"), p = d.querySelector("p");
      if (Spark.getMode() === "unavailable") {
        if (h4) h4.textContent = "⚠️ Хмара тимчасово недоступна";
        if (p) p.textContent = "Немає з'єднання із сервером (інтернет або блокування). Уроки й довідник працюють; вхід відновиться, коли зʼявиться зв'язок.";
      }
    }
    var cur = state.user;
    if (cur) { var w = document.getElementById("auth-already"); if (w) { w.hidden = false; var n = document.getElementById("auth-already-name"); if (n) n.textContent = cur.name; } }

    function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
    function msg(id, text, ok) { var el = document.getElementById(id); if (!el) return; el.textContent = text; el.className = "auth-msg " + (ok ? "ok" : "err"); }
    function busy(btn, on, label) { btn.disabled = on; if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Зачекай…"; } else { btn.textContent = btn.dataset.label || label; } }

    var rb = document.querySelector("[data-register]");
    if (rb) rb.addEventListener("click", function () {
      busy(rb, true);
      Spark.register(val("reg-email"), val("reg-pass"), val("reg-name"), val("reg-code")).then(function (r) {
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

  /* показати пункт меню «Клас» лише вчителю */
  function injectTeacherNav() {
    if (!Spark.isTeacher()) return;
    var nav = document.getElementById("nav-links"); if (!nav) return;
    if (nav.querySelector("[data-teacher-link]")) return;
    var acc = document.querySelector("[data-account]");
    var href = acc ? (acc.getAttribute("href") || "") : "";
    var prefix = href.indexOf("pupil/") >= 0 ? href.slice(0, href.indexOf("pupil/")) : "";
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.setAttribute("href", prefix + "teacher/dashboard.html");
    a.setAttribute("data-teacher-link", "");
    a.textContent = "Клас";
    li.appendChild(a); nav.appendChild(li);
  }

  /* сторінка «Панель вчителя» */
  function teacherPage() {
    var root = document.getElementById("teacher-root"); if (!root) return;
    var gate = document.getElementById("teacher-gate");
    var denied = document.getElementById("teacher-denied");
    var content = document.getElementById("teacher-content");

    if (!state.user) { if (gate) gate.hidden = false; return; }
    if (!Spark.isTeacher()) { if (denied) denied.hidden = false; return; }
    if (content) content.hidden = false;

    var TITLES = {};
    lessonsList().forEach(function (L) { TITLES[L.id] = L.title; });
    function esc(s) { return escHtml(s); }
    function fmtDate(s) { if (!s) return "—"; try { return new Date(s).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return "—"; } }

    var classesEl = document.getElementById("teacher-classes");
    var statEl = document.getElementById("teacher-stats");
    var hello = document.getElementById("teacher-hello");
    if (hello) hello.textContent = "Вчитель: " + state.user.name;

    function studentCard(s) {
      var doneIds = Object.keys(s.data).filter(function (k) { return s.data[k] && s.data[k].done; });
      var reflBlocks = "";
      Object.keys(s.data).forEach(function (lid) {
        var refl = s.data[lid] && s.data[lid].reflection; if (!refl) return;
        Object.keys(refl).forEach(function (rk) {
          var it = refl[rk];
          if (it && it.a && it.a.trim()) reflBlocks += '<p class="mt-1"><strong>' + esc(it.q) + '</strong><br>' + esc(it.a) + "</p>";
        });
      });
      var label = doneIds.length ? doneIds.map(function (id) { return esc(TITLES[id] || id); }).join(", ")
                                 : '<span class="muted">ще не завершив жодного</span>';
      return '<article class="card">'
        + '<div class="progress-wrap"><h3>' + esc(s.name) + '</h3>'
        + '<span class="chip ' + (doneIds.length ? "chip-go" : "") + '">' + doneIds.length + ' ур.</span></div>'
        + '<p class="small mt-1"><strong>Завершено:</strong> ' + label + '</p>'
        + (reflBlocks ? '<details class="mt-1"><summary class="small">Роздуми учня</summary>' + reflBlocks + '</details>' : '<p class="small muted mt-1">Роздумів ще немає.</p>')
        + '<p class="small muted mt-1">Оновлено: ' + fmtDate(s.updated_at) + '</p>'
        + '</article>';
    }

    function render() {
      Spark.loadClasses().then(function (res) {
        if (!res.ok) { if (classesEl) classesEl.innerHTML = '<p class="callout small">Не вдалося завантажити класи: ' + esc(res.error || "") + '. Перевір, що виконано <code>supabase_teacher.sql</code>.</p>'; return; }
        var classes = res.classes;
        var totalStudents = 0, totalDone = 0;
        classes.forEach(function (c) {
          totalStudents += c.students.length;
          c.students.forEach(function (s) { Object.keys(s.data).forEach(function (k) { if (s.data[k] && s.data[k].done) totalDone++; }); });
        });
        if (statEl) statEl.textContent = classes.length + " класів · " + totalStudents + " учнів · " + totalDone + " завершених уроків";

        if (!classes.length) { if (classesEl) classesEl.innerHTML = '<p class="muted mt-2">Ще немає класів. Створи перший вище й дай код учням.</p>'; return; }

        var html = "";
        classes.forEach(function (c) {
          html += '<section class="card mt-2">'
            + '<div class="progress-wrap"><h3>' + esc(c.name || "Клас") + '</h3>'
            + '<span class="chip chip-accent chip-lg">Код: ' + esc(c.code) + '</span></div>'
            + '<p class="muted small mt-1">' + c.students.length + ' учнів. Дай цей код учням — вони введуть його під час реєстрації.</p>';
          if (c.students.length) {
            html += '<div class="card-grid cols-2 mt-1">';
            c.students.forEach(function (s) { html += studentCard(s); });
            html += '</div>';
          } else {
            html += '<p class="muted small mt-1">Поки що ніхто не приєднався.</p>';
          }
          html += '</section>';
        });
        if (classesEl) classesEl.innerHTML = html;
      });
    }

    var createBtn = document.querySelector("[data-create-class]");
    if (createBtn) createBtn.addEventListener("click", function () {
      var nameEl = document.getElementById("class-name");
      var msgEl = document.getElementById("class-msg");
      var name = nameEl ? nameEl.value.trim() : "";
      if (name.length < 2) { if (msgEl) { msgEl.textContent = "Введи назву класу."; msgEl.className = "auth-msg err"; } return; }
      createBtn.disabled = true; createBtn.textContent = "Створення…";
      Spark.createClass(name).then(function (r) {
        createBtn.disabled = false; createBtn.textContent = "Створити клас";
        if (!r.ok) { if (msgEl) { msgEl.textContent = "Не вдалося: " + (r.error || ""); msgEl.className = "auth-msg err"; } return; }
        if (msgEl) { msgEl.textContent = "Клас створено! Код: " + r.klass.code; msgEl.className = "auth-msg ok"; }
        if (nameEl) nameEl.value = "";
        render();
      });
    });

    render();
  }

  /* запуск після завантаження сесії */
  loadSession().then(function () {
    updateAccount();
    injectTeacherNav();
    showLoginNotes();
    programProgress();
    lessonPage();
    portfolioPage();
    authPage();
    teacherPage();
  });

})();
