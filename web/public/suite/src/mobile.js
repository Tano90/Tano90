/* GLB AI Suite – phone layer for the website integration (see mobile.css). Moves the header actions into a
   bottom sheet, keeps every table inside its own scroll box, starts each module at the top, closes the menu
   after choosing a module. Proxies to the existing v0.8 buttons, so their behaviour stays unchanged. */
(() => {
  "use strict";
  const phone = window.matchMedia("(max-width: 760px)");
  const $ = (s) => document.querySelector(s);
  const right = $(".topbar .top-right");
  if (!right) return;

  const more = document.createElement("button");
  more.id = "glbm-more";
  more.type = "button";
  more.textContent = "⋯";
  more.setAttribute("aria-haspopup", "dialog");
  more.setAttribute("aria-expanded", "false");
  more.setAttribute("aria-label", "Konto, Backup und mehr");
  right.appendChild(more);

  const backdrop = document.createElement("div");
  backdrop.id = "glbm-backdrop";
  const sheet = document.createElement("div");
  sheet.id = "glbm-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", "Weitere Aktionen");
  document.body.append(backdrop, sheet);

  // [icon, label, target in the original header]
  const ACTIONS = [
    ["⌕", "Modul suchen", ".topbar .v5-search-trigger"],
    ["▥", "Reports", '.topbar [data-view="reports"]'],
    ["⤓", "App installieren", "#glb08-install"],
    ["☺", "Mein Konto", "#cloud-account"],
    ["⇩", "Backup herunterladen", '.topbar [data-action="export-json"]'],
  ];
  const statusText = () => ($("#cloud-sync-status")?.textContent || "").trim();

  function open() {
    const items = ACTIONS.filter(([, , sel]) => {
      const el = $(sel);
      return el && !el.hidden && el.style.display !== "none";
    });
    sheet.innerHTML =
      '<div class="glbm-grip" aria-hidden="true"></div>' +
      (statusText() ? '<p class="glbm-status"></p>' : "") +
      items
        .map(([icon, label], i) => `<button type="button" data-i="${i}"><span aria-hidden="true">${icon}</span>${label}</button>`)
        .join("");
    const st = sheet.querySelector(".glbm-status");
    if (st) st.textContent = statusText();
    sheet.querySelectorAll("button[data-i]").forEach((b) =>
      b.addEventListener("click", () => {
        const target = $(items[Number(b.dataset.i)][2]);
        close();
        target?.click();
      }),
    );
    backdrop.classList.add("is-open");
    sheet.classList.add("is-open");
    more.setAttribute("aria-expanded", "true");
    sheet.querySelector("button")?.focus();
  }
  function close() {
    backdrop.classList.remove("is-open");
    sheet.classList.remove("is-open");
    more.setAttribute("aria-expanded", "false");
  }
  more.addEventListener("click", () => (sheet.classList.contains("is-open") ? close() : open()));
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheet.classList.contains("is-open")) {
      close();
      more.focus();
    }
  });
  let startY = null;
  sheet.addEventListener(
    "touchstart",
    (e) => {
      startY = e.touches[0].clientY;
    },
    { passive: true },
  );
  sheet.addEventListener("touchend", (e) => {
    if (startY !== null && e.changedTouches[0].clientY - startY > 60) close();
    startY = null;
  });

  // A dot on the button when the data is not (yet) safely in the cloud.
  const syncState = () => {
    const t = statusText().toLowerCase();
    more.dataset.state = t.startsWith("demo") ? "demo" : /nicht|blockiert|konflikt|fehl/.test(t) ? "warn" : "ok";
  };
  const status = $("#cloud-sync-status");
  if (status) new MutationObserver(syncState).observe(status, { childList: true, characterData: true, subtree: true });
  syncState();

  // Every table scrolls inside its own box instead of widening the page.
  const main = $("#main");
  const wrapTables = () => {
    if (!phone.matches || !main) return;
    main.querySelectorAll("table").forEach((t) => {
      if (t.closest(".table-scroll, .glbm-scroll")) return;
      const box = document.createElement("div");
      box.className = "glbm-scroll";
      t.parentNode.insertBefore(box, t);
      box.appendChild(t);
    });
    // a table wider than the phone scrolls inside its box – say so above it instead of hiding columns silently
    main.querySelectorAll(".table-scroll, .glbm-scroll").forEach((box) => {
      const wide = box.scrollWidth > box.clientWidth + 4;
      const prev = box.previousElementSibling;
      const has = prev?.classList.contains("glbm-scroll-hint");
      if (wide && !has) {
        const hint = document.createElement("p");
        hint.className = "glbm-scroll-hint";
        hint.textContent = "Tabelle seitlich wischen für weitere Spalten →";
        box.parentNode.insertBefore(hint, box);
      } else if (!wide && has) prev.remove();
    });
  };
  if (main) new MutationObserver(wrapTables).observe(main, { childList: true, subtree: true });
  wrapTables();

  // Choosing a module: close the side menu and start at the top.
  document.addEventListener("click", (e) => {
    if (!phone.matches || !e.target.closest("#sidebar [data-view], .glb08-bottomnav [data-view]")) return;
    $("#sidebar")?.classList.remove("is-open");
    $("#mobile-overlay")?.classList.remove("is-open");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
  });
  // Short labels in the bottom navigation, so none is cut off.
  const SHORT = {
    myday: "Heute",
    funnel: "Funnel",
    inventory: "Inventur",
    orders: "Bestellung",
    reports: "Reports",
    menuimport: "Karte",
    overview: "Übersicht",
    operations: "Daten",
    v11tasks: "Aufgaben",
    purchasing: "Bestellen",
  };
  const bottom = $("#glb08-bottomnav");
  const shorten = () =>
    bottom?.querySelectorAll("[data-view] small").forEach((s) => {
      const v = s.parentElement.dataset.view;
      if (SHORT[v] && s.textContent !== SHORT[v]) {
        s.parentElement.setAttribute("aria-label", s.textContent);
        s.textContent = SHORT[v];
      }
    });
  if (bottom) new MutationObserver(shorten).observe(bottom, { childList: true });
  shorten();

  // Opening the side menu shows it from the top (brand, workspace), not where it was last scrolled.
  $("#mobile-menu")?.addEventListener("click", () => {
    const sb = $("#sidebar");
    if (sb) sb.scrollTop = 0;
  });

  // Number fields: number pad on phones, and a tap selects the value so "0" need not be deleted first.
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    // the on-screen keyboard must not cover the field (and the save button right below it)
    if (phone.matches && t.matches?.("input, select, textarea"))
      setTimeout(() => {
        const vv = window.visualViewport;
        const r = t.getBoundingClientRect();
        if (vv && r.bottom > vv.height - 80) t.scrollIntoView({ block: "center" });
      }, 300);
    if (!(t instanceof HTMLInputElement) || t.type !== "number") return;
    if (!t.hasAttribute("inputmode")) t.setAttribute("inputmode", "decimal");
    if (phone.matches)
      requestAnimationFrame(() => {
        try {
          t.select();
        } catch (_) {
          /* some types refuse selection */
        }
      });
  });

  phone.addEventListener("change", () => {
    if (!phone.matches) close();
  });
})();
