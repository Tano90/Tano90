/* Camperteil: Navigation, Zeichnungen und der Anfrage-Ablauf.
   Kein Framework, keine externen Abhängigkeiten. */
(function () {
  "use strict";

  // Versandweg. Solange submitEndpoint null ist, wird nichts übertragen und die Seite sagt das auch.
  // Später z. B. auf eine eigene Serverroute setzen, die multipart/form-data annimmt. Keine Zugangsdaten hier eintragen.
  var CONFIG = Object.assign({ submitEndpoint: null }, window.CAMPERTEIL_CONFIG || {});

  var MAX_PHOTOS = 8;
  var MAX_BYTES = 15 * 1024 * 1024;
  var MIN_YEAR = 1950;
  var THIS_YEAR = new Date().getFullYear();
  var DRAFT_KEY = "camperteil-anfrage-v1";
  var TEXT_FIELDS = ["make", "model", "year", "chassis", "partName", "location", "dimL", "dimB", "dimH", "marking", "color", "qty", "desc", "name", "email", "phone"];
  var CHECK_FIELDS = ["dimsEstimated", "consent"];
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("js");

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function storage() {
    try { var s = window.localStorage; var t = "__ct"; s.setItem(t, t); s.removeItem(t); return s; } catch (e) { return null; }
  }
  function formatBytes(b) {
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + " KB";
    return (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
  }

  /* ---------- Navigation ---------- */
  var toggle = $(".nav-toggle");
  var navList = $("#nav-list");
  function setNav(open) {
    toggle.setAttribute("aria-expanded", String(open));
    navList.classList.toggle("open", open);
  }
  if (toggle && navList) {
    toggle.addEventListener("click", function () { setNav(toggle.getAttribute("aria-expanded") !== "true"); });
    navList.addEventListener("click", function (e) { if (e.target.closest("a")) setNav(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setNav(false); toggle.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (toggle.getAttribute("aria-expanded") === "true" && !e.target.closest(".main-nav")) setNav(false);
    });
  }

  /* ---------- Hero-Zeichnung ---------- */
  var heroSheet = $(".hero-sheet");
  if (heroSheet) requestAnimationFrame(function () { requestAnimationFrame(function () { heroSheet.classList.add("is-drawn"); }); });

  /* ---------- Teile-Tafel: Stückliste und Zeichnung verbinden ---------- */
  var board = $("[data-board]");
  if (board) {
    var setActive = function (pos) {
      board.classList.toggle("has-focus", !!pos);
      $all("[data-pos]", board).forEach(function (n) { n.classList.toggle("is-active", n.getAttribute("data-pos") === pos); });
    };
    $all("tr[data-pos], g.pos", board).forEach(function (n) {
      var pos = n.getAttribute("data-pos");
      n.addEventListener("mouseenter", function () { setActive(pos); });
      n.addEventListener("mouseleave", function () { setActive(null); });
      n.addEventListener("focus", function () { setActive(pos); });
      n.addEventListener("blur", function () { setActive(null); });
    });
  }

  /* ---------- Höhenlinien im Nachtabschnitt ---------- */
  var canvas = $(".contours");
  function drawContours() {
    if (!canvas || !canvas.getContext) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--contour").trim() || "rgba(211,147,23,.16)";
    ctx.lineWidth = 1;

    // Wertrauschen mit festem Startwert, damit das Bild bei jedem Besuch gleich bleibt
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var G = 64, grid = [];
    for (var i = 0; i < G * G; i++) grid.push(rnd());
    function lerp(a, b, t) { return a + (b - a) * t; }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function vnoise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
      function g(a, b) { return grid[((a % G + G) % G) + ((b % G + G) % G) * G]; }
      return lerp(lerp(g(xi, yi), g(xi + 1, yi), xf), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), xf), yf);
    }
    function field(x, y) {
      var s = 1 / 260;
      return vnoise(x * s, y * s) * 0.62 + vnoise(x * s * 2.1 + 5, y * s * 2.1 + 9) * 0.28 + vnoise(x * s * 4.3, y * s * 4.3) * 0.1;
    }
    var step = 9, cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1, vals = new Float32Array(cols * rows);
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) vals[r * cols + c] = field(c * step, r * step);
    ctx.beginPath();
    for (var lvl = 0.22; lvl < 0.8; lvl += 0.045) {
      for (r = 0; r < rows - 1; r++) for (c = 0; c < cols - 1; c++) {
        var a = vals[r * cols + c], b = vals[r * cols + c + 1], d = vals[(r + 1) * cols + c], e = vals[(r + 1) * cols + c + 1];
        var x = c * step, y = r * step, pts = [];
        if ((a < lvl) !== (b < lvl)) pts.push([x + step * (lvl - a) / (b - a), y]);
        if ((b < lvl) !== (e < lvl)) pts.push([x + step, y + step * (lvl - b) / (e - b)]);
        if ((d < lvl) !== (e < lvl)) pts.push([x + step * (lvl - d) / (e - d), y + step]);
        if ((a < lvl) !== (d < lvl)) pts.push([x, y + step * (lvl - a) / (d - a)]);
        for (var p = 0; p + 1 < pts.length; p += 2) { ctx.moveTo(pts[p][0], pts[p][1]); ctx.lineTo(pts[p + 1][0], pts[p + 1][1]); }
      }
    }
    ctx.stroke();
  }
  if (canvas) {
    // Erst zeichnen, wenn der Abschnitt in die Nähe kommt; die Berechnung kostet sonst Zeit beim Seitenstart
    if ("IntersectionObserver" in window) {
      var contourIO = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { contourIO.disconnect(); drawContours(); }
      }, { rootMargin: "400px 0px" });
      contourIO.observe(canvas.parentElement);
    } else drawContours();
    var resizeT;
    window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(drawContours, 200); });
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", drawContours);
    }
  }

  /* ---------- Mobile Schaltfläche ---------- */
  var mobileCta = $("[data-mobile-cta]");
  if (mobileCta && "IntersectionObserver" in window) {
    var seen = { hero: true, form: false };
    var update = function () { mobileCta.classList.toggle("is-visible", !seen.hero && !seen.form); };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { seen[en.target.id === "anfrage" ? "form" : "hero"] = en.isIntersecting; });
      update();
    }, { threshold: 0 });
    var heroActions = $(".hero-actions");
    if (heroActions) { heroActions.id = "hero-actions"; io.observe(heroActions); }
    io.observe($("#anfrage"));
  }

  /* ---------- Anfrage-Ablauf ---------- */
  var form = $("#wizard");
  if (!form) return;

  var state = { step: 1, maxReached: 1, photos: [], nextId: 1 };
  var steps = $all(".step", form);
  var TOTAL = steps.length;
  var prevBtn = $("[data-prev]", form);
  var nextBtn = $("[data-next]", form);
  var errorSummary = $("#error-summary");
  var store = storage();
  var draftState = $("#draft-state");

  var STEP_NAMES = { 1: "Fotos", 2: "Fahrzeug", 3: "Teil & Maße", 4: "Kontakt", 5: "Übersicht" };

  function field(id) { return document.getElementById(id); }
  function val(id) { var f = field(id); return f ? f.value.trim() : ""; }

  /* Entwurf */
  function saveDraft() {
    if (!store) { draftState.textContent = "Entwurf: Dieser Browser erlaubt keine Speicherung. Eingaben bleiben erhalten, solange die Seite offen ist."; return; }
    var data = {};
    TEXT_FIELDS.forEach(function (id) { data[id] = field(id).value; });
    CHECK_FIELDS.forEach(function (id) { data[id] = field(id).checked; });
    try {
      store.setItem(DRAFT_KEY, JSON.stringify({ v: 1, saved: Date.now(), data: data }));
      var t = new Date();
      draftState.textContent = "Entwurf gespeichert um " + String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0") + " Uhr (ohne Fotos).";
    } catch (e) {
      draftState.textContent = "Entwurf konnte nicht gespeichert werden. Eingaben bleiben erhalten, solange die Seite offen ist.";
    }
  }
  function loadDraft() {
    if (!store) return;
    try {
      var raw = store.getItem(DRAFT_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return;
      TEXT_FIELDS.forEach(function (id) { if (typeof parsed.data[id] === "string") field(id).value = parsed.data[id]; });
      CHECK_FIELDS.forEach(function (id) { if (typeof parsed.data[id] === "boolean") field(id).checked = parsed.data[id]; });
      draftState.textContent = "Entwurf vom " + new Date(parsed.saved).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) + " geladen. Fotos bitte neu auswählen.";
    } catch (e) { /* Entwurf unlesbar: ignorieren */ }
  }
  var saveT;
  form.addEventListener("input", function (e) {
    if (e.target.id === "photos") return;
    clearFieldError(e.target);
    clearTimeout(saveT); saveT = setTimeout(saveDraft, 400);
    if (e.target.id === "desc") updateCharCount();
  });
  form.addEventListener("change", function (e) {
    if (e.target.type === "checkbox" || e.target.tagName === "SELECT") { clearFieldError(e.target); saveDraft(); }
  });

  function updateCharCount() {
    var n = field("desc").value.trim().length;
    $("#desc-count").textContent = n + " Zeichen" + (n < 20 ? " (mindestens 20)" : "");
  }

  /* Fehleranzeige */
  var ERROR_TARGETS = { dims: ["dimL", "dimB", "dimH"], photos: [] };
  function showFieldError(key, msg) {
    var box = document.getElementById(key + "-error");
    if (box) { box.textContent = msg; box.hidden = false; }
    var targets = ERROR_TARGETS[key] || [key];
    targets.forEach(function (id) { var f = field(id); if (f) f.setAttribute("aria-invalid", "true"); });
    if (key === "photos") $("#drop").classList.add("is-invalid");
  }
  function clearFieldError(input) {
    if (!input || !input.id) return;
    var key = ERROR_TARGETS.dims.indexOf(input.id) >= 0 ? "dims" : input.id;
    var box = document.getElementById(key + "-error");
    if (box && box.getAttribute("data-kind") !== "files") box.hidden = true;
    (ERROR_TARGETS[key] || [key]).forEach(function (id) { var f = field(id); if (f) f.removeAttribute("aria-invalid"); });
    hideSummaryIfResolved();
  }
  // Die Fehlerübersicht verschwindet, sobald im aktuellen Schritt nichts mehr markiert ist
  function hideSummaryIfResolved() {
    var cur = steps[state.step - 1];
    if (!$("[aria-invalid='true']", cur) && !$("#drop.is-invalid", cur)) errorSummary.hidden = true;
  }
  function clearStepErrors(stepEl) {
    $all(".field-error", stepEl).forEach(function (n) { n.hidden = true; n.removeAttribute("data-kind"); });
    $all("[aria-invalid]", stepEl).forEach(function (n) { n.removeAttribute("aria-invalid"); });
    $("#drop").classList.remove("is-invalid");
    errorSummary.hidden = true;
  }
  function renderSummaryErrors(errors) {
    var ul = $("ul", errorSummary);
    ul.textContent = "";
    errors.forEach(function (er) {
      var li = el("li");
      var a = el("a", { href: "#" + er.focus }, er.msg);
      a.addEventListener("click", function (e) { e.preventDefault(); var f = field(er.focus); if (f) { f.focus(); } });
      li.appendChild(a); ul.appendChild(li);
    });
    errorSummary.hidden = false;
    errorSummary.focus({ preventScroll: true });
    scrollToEl(errorSummary);
  }

  /* Prüfungen je Schritt */
  function parseMm(s) {
    if (!s) return null;
    var t = s.replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return parseFloat(t);
  }
  var validators = {
    1: function () {
      if (state.photos.length === 0) return [{ key: "photos", focus: "photos", msg: "Bitte wählen Sie mindestens ein Foto des Teils aus." }];
      return [];
    },
    2: function () {
      var errs = [];
      if (!val("make")) errs.push({ key: "make", focus: "make", msg: "Bitte geben Sie den Hersteller des Wohnmobils an." });
      if (!val("model")) errs.push({ key: "model", focus: "model", msg: "Bitte geben Sie Modell oder Baureihe an." });
      var y = val("year");
      if (!y) errs.push({ key: "year", focus: "year", msg: "Bitte geben Sie das Baujahr an." });
      else if (!/^\d{4}$/.test(y)) errs.push({ key: "year", focus: "year", msg: "Bitte geben Sie das Baujahr vierstellig an, zum Beispiel 1992." });
      else if (+y < MIN_YEAR || +y > THIS_YEAR) errs.push({ key: "year", focus: "year", msg: "Das Baujahr muss zwischen " + MIN_YEAR + " und " + THIS_YEAR + " liegen." });
      return errs;
    },
    3: function () {
      var errs = [];
      if (val("partName").length < 3) errs.push({ key: "partName", focus: "partName", msg: "Bitte geben Sie eine Bezeichnung für das Teil an (mindestens 3 Zeichen)." });
      if (!val("location")) errs.push({ key: "location", focus: "location", msg: "Bitte wählen Sie den Einbauort." });
      var names = { dimL: "Länge", dimB: "Breite", dimH: "Höhe / Stärke" };
      var valid = 0, bad = null, firstEmpty = null;
      ["dimL", "dimB", "dimH"].forEach(function (id) {
        var n = parseMm(val(id));
        if (n === null) { if (!firstEmpty) firstEmpty = id; return; }
        if (isNaN(n) || n <= 0 || n > 2000) { if (!bad) bad = id; return; }
        valid++;
      });
      if (bad) errs.push({ key: "dims", focus: bad, msg: names[bad] + ": Bitte nur eine Zahl in Millimetern zwischen 0 und 2000 eingeben, zum Beispiel 23,5." });
      else if (valid < 2) errs.push({ key: "dims", focus: firstEmpty || "dimL", msg: "Bitte geben Sie mindestens zwei Maße an. Geschätzte Werte sind in Ordnung, wenn Sie sie kennzeichnen." });
      var q = val("qty");
      if (!/^\d{1,2}$/.test(q) || +q < 1 || +q > 50) errs.push({ key: "qty", focus: "qty", msg: "Bitte geben Sie eine Stückzahl zwischen 1 und 50 an." });
      var dl = val("desc").length;
      if (dl < 20) errs.push({ key: "desc", focus: "desc", msg: "Bitte beschreiben Sie das Teil in mindestens 20 Zeichen. Bisher sind es " + dl + "." });
      return errs;
    },
    4: function () {
      var errs = [];
      if (val("name").length < 2) errs.push({ key: "name", focus: "name", msg: "Bitte geben Sie Ihren Namen an." });
      var em = val("email");
      if (!em) errs.push({ key: "email", focus: "email", msg: "Bitte geben Sie Ihre E-Mail-Adresse an, damit wir antworten können." });
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) errs.push({ key: "email", focus: "email", msg: "Diese E-Mail-Adresse ist unvollständig. Beispiel: name@beispiel.de" });
      var ph = val("phone");
      if (ph && !/^\+?[\d\s\/()-]{6,}$/.test(ph)) errs.push({ key: "phone", focus: "phone", msg: "Bitte nur Ziffern, Leerzeichen und + / ( ) - verwenden." });
      if (!field("consent").checked) errs.push({ key: "consent", focus: "consent", msg: "Bitte bestätigen Sie die Einwilligung. Ohne sie kann die Anfrage nicht geprüft werden." });
      return errs;
    },
    5: function () { return []; }
  };

  function validateStep(n, show) {
    var errs = validators[n]();
    if (show) {
      clearStepErrors(steps[n - 1]);
      errs.forEach(function (er) { showFieldError(er.key, er.msg); });
      if (errs.length) renderSummaryErrors(errs);
    }
    return errs;
  }

  /* Schritte wechseln */
  function scrollToEl(node) {
    var top = node.getBoundingClientRect().top + window.pageYOffset - (document.querySelector(".site-header").offsetHeight + 16);
    if (Math.abs(window.pageYOffset - top) > 4 && (node.getBoundingClientRect().top < 80 || node.getBoundingClientRect().top > window.innerHeight * 0.6)) {
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }
  function goTo(n, opts) {
    opts = opts || {};
    n = Math.max(1, Math.min(TOTAL, n));
    // Browser-Zurück soll im Formular den vorigen Schritt zeigen, statt die Seite zu verlassen.
    // Vorwärts (Weiter, Ändern, Schrittleiste) legt einen Verlaufseintrag an; „Zurück“ im Formular ersetzt ihn nur.
    if (!opts.silent && !opts.fromHistory && n !== state.step && window.history && history.pushState) {
      try {
        if (opts.replace) history.replaceState({ ctStep: n }, "");
        else history.pushState({ ctStep: n }, "");
      } catch (e) { /* Verlauf nicht verfügbar: Formular funktioniert trotzdem */ }
    }
    errorSummary.hidden = true;
    steps.forEach(function (s, i) {
      var on = i === n - 1;
      s.hidden = !on;
      s.classList.toggle("enter", on && n !== state.step);
    });
    state.step = n;
    state.maxReached = Math.max(state.maxReached, n);
    if (n === TOTAL) renderSummary();
    prevBtn.hidden = n === 1;
    nextBtn.hidden = n === TOTAL;
    nextBtn.textContent = n === TOTAL - 1 ? "Zur Übersicht" : "Weiter";
    $all(".progress li", form).forEach(function (li) {
      var k = +li.getAttribute("data-step-link");
      li.classList.toggle("is-current", k === n);
      li.classList.toggle("is-done", k < n || (k <= state.maxReached && k !== n && validators[k]().length === 0));
      var b = $("button", li);
      b.disabled = k > state.maxReached;
      if (k === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    $("[data-progress-text]").textContent = "Schritt " + n + " von " + TOTAL + " · " + STEP_NAMES[n];
    $("[data-progress-bar]").style.width = (n / TOTAL * 100) + "%";
    if (!opts.silent) {
      var legend = $("legend", steps[n - 1]);
      legend.setAttribute("tabindex", "-1");
      legend.focus({ preventScroll: true });
      scrollToEl(form);
    }
  }

  // Vorwärts nur über gültige Schritte; rückwärts immer, ohne Eingaben zu verlieren
  function tryGoTo(target) {
    if (target <= state.step) { goTo(target); return; }
    for (var k = state.step; k < target; k++) {
      if (validateStep(k, false).length) {
        if (k !== state.step) goTo(k, { silent: true });
        validateStep(k, true);
        return;
      }
    }
    goTo(target);
  }
  nextBtn.addEventListener("click", function () { tryGoTo(state.step + 1); });
  prevBtn.addEventListener("click", function () { goTo(state.step - 1, { replace: true }); });
  window.addEventListener("popstate", function (e) {
    var target = e.state && e.state.ctStep ? e.state.ctStep : 1;
    if (target !== state.step) goTo(Math.min(target, state.maxReached), { fromHistory: true });
  });
  $all("[data-goto]", form).forEach(function (b) {
    b.addEventListener("click", function () { tryGoTo(+b.getAttribute("data-goto")); });
  });

  /* Fotos */
  var input = $("#photos");
  var thumbs = $("#thumbs");
  var drop = $("#drop");
  var photoError = $("#photos-error");
  var ACCEPT = /^(image\/(jpeg|png|webp|heic|heif))$/;
  var ACCEPT_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

  function addFiles(list) {
    var problems = [];
    Array.prototype.forEach.call(list, function (file) {
      // HEIC kommt je nach Browser ohne oder mit allgemeinem Dateityp an, dann entscheidet die Endung
      var looseType = !file.type || /^image\//.test(file.type) || file.type === "application/octet-stream";
      var okType = ACCEPT.test(file.type) || (looseType && ACCEPT_EXT.test(file.name));
      if (!okType) { problems.push("„" + file.name + "“ ist kein unterstütztes Bild. Erlaubt sind JPG, PNG, WebP und HEIC."); return; }
      if (file.size > MAX_BYTES) { problems.push("„" + file.name + "“ ist " + formatBytes(file.size) + " groß. Erlaubt sind höchstens 15 MB je Foto."); return; }
      var dup = state.photos.some(function (p) { return p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified; });
      if (dup) { problems.push("„" + file.name + "“ ist bereits ausgewählt."); return; }
      if (state.photos.length >= MAX_PHOTOS) { problems.push("Höchstens " + MAX_PHOTOS + " Fotos. „" + file.name + "“ wurde nicht hinzugefügt."); return; }
      state.photos.push({ id: state.nextId++, file: file, url: URL.createObjectURL(file), previewOk: null });
    });
    input.value = "";
    if (problems.length) {
      photoError.textContent = problems.join(" ");
      photoError.setAttribute("data-kind", "files");
      photoError.hidden = false;
    } else {
      photoError.hidden = true;
      photoError.removeAttribute("data-kind");
    }
    if (state.photos.length) { drop.classList.remove("is-invalid"); hideSummaryIfResolved(); }
    renderThumbs();
  }
  function removePhoto(id) {
    var idx = state.photos.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return;
    URL.revokeObjectURL(state.photos[idx].url);
    var name = state.photos[idx].file.name;
    state.photos.splice(idx, 1);
    renderThumbs();
    $("#photos-count").textContent = "„" + name + "“ entfernt. " + countText();
    var next = $(".thumb-remove", thumbs);
    (next || input).focus();
  }
  function countText() {
    var n = state.photos.length;
    return n === 0 ? "Noch kein Foto ausgewählt." : n + " von " + MAX_PHOTOS + " Fotos ausgewählt.";
  }
  function previewNode(p, small) {
    if (p.previewOk === false) return el("span", { class: small ? "" : "no-preview" }, small ? "HEIC" : "Keine Vorschau in diesem Browser. Das Foto ist trotzdem ausgewählt.");
    var img = el("img", { src: p.url, alt: small ? "" : "Vorschau: " + p.file.name, loading: "lazy", decoding: "async" });
    img.addEventListener("error", function () {
      p.previewOk = false;
      var repl = previewNode(p, small);
      if (img.parentNode) img.parentNode.replaceChild(repl, img);
    });
    img.addEventListener("load", function () { p.previewOk = true; });
    return img;
  }
  function renderThumbs() {
    thumbs.textContent = "";
    state.photos.forEach(function (p, i) {
      var li = el("li", { class: "thumb" });
      var box = el("div", { class: "thumb-img" });
      box.appendChild(previewNode(p, false));
      li.appendChild(box);
      if (i === 0) li.appendChild(el("span", { class: "thumb-badge" }, "Hauptfoto"));
      li.appendChild(el("span", { class: "thumb-meta", title: p.file.name }, p.file.name + " · " + formatBytes(p.file.size)));
      var rm = el("button", { type: "button", class: "thumb-remove", "aria-label": "Foto „" + p.file.name + "“ entfernen" });
      rm.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
      rm.addEventListener("click", function () { removePhoto(p.id); });
      li.appendChild(rm);
      thumbs.appendChild(li);
    });
    $("#photos-count").textContent = countText();
  }
  input.addEventListener("change", function () { if (input.files && input.files.length) addFiles(input.files); });
  ["dragenter", "dragover"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
  });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

  /* Übersicht */
  function sumBlock(title, stepNo, rows, extra) {
    var block = el("section", { class: "sum-block", "aria-label": title });
    block.appendChild(el("h3", null, title));
    var body;
    if (extra) body = extra;
    else {
      body = el("dl");
      rows.forEach(function (r) {
        if (!r[1]) return;
        body.appendChild(el("dt", null, r[0]));
        var dd = el("dd", r[2] ? { class: "mono" } : null, r[1]);
        body.appendChild(dd);
      });
    }
    block.appendChild(body);
    var edit = el("button", { type: "button", class: "link-btn sum-edit", "aria-label": title + " ändern" }, "Ändern");
    edit.addEventListener("click", function () { goTo(stepNo); });
    block.appendChild(edit);
    return block;
  }
  function dimsText() {
    var parts = [["L", val("dimL")], ["B", val("dimB")], ["H", val("dimH")]].filter(function (p) { return p[1]; }).map(function (p) { return p[0] + " " + p[1].replace(".", ",") + " mm"; });
    return parts.join(" × ") + (field("dimsEstimated").checked ? " (geschätzt)" : "");
  }
  function renderSummary() {
    var box = $("#summary");
    box.textContent = "";
    var th = el("div", { class: "sum-thumbs" });
    state.photos.forEach(function (p) { var s = el("span"); s.appendChild(previewNode(p, true)); th.appendChild(s); });
    var wrap = el("div");
    wrap.appendChild(th);
    wrap.appendChild(el("p", { class: "hint" }, state.photos.length + (state.photos.length === 1 ? " Foto" : " Fotos")));
    box.appendChild(sumBlock("Fotos", 1, null, wrap));
    box.appendChild(sumBlock("Fahrzeug", 2, [["Hersteller", val("make")], ["Modell", val("model")], ["Baujahr", val("year"), true], ["Basisfahrzeug", val("chassis")]]));
    box.appendChild(sumBlock("Teil", 3, [["Bezeichnung", val("partName")], ["Einbauort", val("location")], ["Maße", dimsText(), true], ["Prägung", val("marking")], ["Farbe", val("color")], ["Stückzahl", val("qty"), true], ["Beschreibung", val("desc")]]));
    box.appendChild(sumBlock("Kontakt", 4, [["Name", val("name")], ["E-Mail", val("email")], ["Telefon", val("phone")], ["Einwilligung", field("consent").checked ? "erteilt" : ""]]));
    $("#action-status").textContent = "";
    $("#action-status").className = "action-status";
  }
  function plainText() {
    var lines = [
      "ERSATZTEIL-ANFRAGE CAMPERTEIL",
      "Erstellt: " + new Date().toLocaleString("de-DE"),
      "",
      "FAHRZEUG",
      "Hersteller: " + val("make"),
      "Modell: " + val("model"),
      "Baujahr: " + val("year")
    ];
    if (val("chassis")) lines.push("Basisfahrzeug: " + val("chassis"));
    lines.push("", "TEIL", "Bezeichnung: " + val("partName"), "Einbauort: " + val("location"), "Maße: " + dimsText());
    if (val("marking")) lines.push("Teilenummer/Prägung: " + val("marking"));
    if (val("color")) lines.push("Farbe: " + val("color"));
    lines.push("Stückzahl: " + val("qty"), "Beschreibung:", val("desc"), "", "FOTOS (nicht enthalten, bitte separat beifügen)");
    state.photos.forEach(function (p, i) { lines.push((i + 1) + ". " + p.file.name); });
    lines.push("", "KONTAKT", "Name: " + val("name"), "E-Mail: " + val("email"));
    if (val("phone")) lines.push("Telefon: " + val("phone"));
    return lines.join("\n");
  }
  function setStatus(msg, ok) {
    var s = $("#action-status");
    s.textContent = msg;
    s.className = "action-status " + (ok ? "is-ok" : "is-error");
  }
  function showCopyFallback(text) {
    var wrap = $(".copy-fallback"), ta = $("#copy-text");
    ta.value = text; wrap.hidden = false; ta.focus(); ta.select();
  }
  $("#copy-btn").addEventListener("click", function () {
    var text = plainText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setStatus("In die Zwischenablage kopiert. Die Anfrage selbst wurde nicht versendet.", true);
      }, function () {
        showCopyFallback(text);
        setStatus("Kopieren wurde vom Browser blockiert. Der Text ist unten markiert und kann manuell kopiert werden.", false);
      });
    } else {
      showCopyFallback(text);
      setStatus("Der Text ist unten markiert und kann manuell kopiert werden.", false);
    }
  });
  $("#save-btn").addEventListener("click", function () {
    try {
      var blob = new Blob([plainText()], { type: "text/plain;charset=utf-8" });
      var a = el("a", { href: URL.createObjectURL(blob), download: "camperteil-anfrage-" + new Date().toISOString().slice(0, 10) + ".txt" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      setStatus("Download gestartet. Falls keine Datei erscheint, nutzen Sie „Angaben kopieren“.", true);
    } catch (e) {
      showCopyFallback(plainText());
      setStatus("Speichern ist hier nicht möglich. Der Text ist unten markiert und kann manuell kopiert werden.", false);
    }
  });

  /* Versand: nur aktiv, wenn ein Versandweg eingerichtet ist */
  var sendOn = !!CONFIG.submitEndpoint;
  $all("[data-send-on]").forEach(function (n) { n.hidden = !sendOn; });
  $all("[data-send-off]").forEach(function (n) { n.hidden = sendOn; });
  if (sendOn) { $(".limit-note").hidden = true; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!sendOn || state.step !== TOTAL) return;
    for (var k = 1; k < TOTAL; k++) {
      if (validateStep(k, false).length) { goTo(k); validateStep(k, true); return; }
    }
    var fd = new FormData();
    TEXT_FIELDS.forEach(function (id) { fd.append(id, val(id)); });
    CHECK_FIELDS.forEach(function (id) { fd.append(id, field(id).checked ? "ja" : "nein"); });
    state.photos.forEach(function (p) { fd.append("photos", p.file, p.file.name); });
    var btn = $("button[type=submit]", form);
    btn.disabled = true; btn.textContent = "Wird gesendet …";
    fetch(CONFIG.submitEndpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        setStatus("Ihre Anfrage wurde übertragen. Sie erhalten eine Antwort per E-Mail.", true);
        btn.hidden = true;
        if (store) try { store.removeItem(DRAFT_KEY); } catch (er) { /* egal */ }
      })
      .catch(function () {
        setStatus("Die Anfrage konnte nicht übertragen werden. Ihre Angaben sind noch da. Bitte versuchen Sie es später erneut.", false);
        btn.disabled = false; btn.textContent = "Anfrage senden";
      });
  });

  /* Alles löschen */
  var confirmBox = $("#confirm-reset");
  $("#reset-btn").addEventListener("click", function () { confirmBox.hidden = false; $("#reset-no").focus(); });
  $("#reset-no").addEventListener("click", function () { confirmBox.hidden = true; $("#reset-btn").focus(); });
  $("#reset-yes").addEventListener("click", function () {
    state.photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
    state.photos = [];
    TEXT_FIELDS.forEach(function (id) { field(id).value = id === "qty" ? "1" : ""; });
    CHECK_FIELDS.forEach(function (id) { field(id).checked = false; });
    if (store) try { store.removeItem(DRAFT_KEY); } catch (e) { /* egal */ }
    steps.forEach(clearStepErrors);
    $(".copy-fallback").hidden = true;
    photoError.hidden = true;
    renderThumbs();
    updateCharCount();
    state.maxReached = 1;
    confirmBox.hidden = true;
    draftState.textContent = "Alle Eingaben gelöscht.";
    goTo(1, { replace: true });
  });

  loadDraft();
  updateCharCount();
  renderThumbs();
  $("#photos-count").textContent = "";
  goTo(1, { silent: true });
  try { if (window.history && history.replaceState) history.replaceState({ ctStep: 1 }, ""); } catch (e) { /* egal */ }
})();
