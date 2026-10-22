/* GLB 0.8 role-aware navigation and phone shell. Back-end controls remain in SQL. */
(() => {
  "use strict";
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Five areas a restaurant manager recognises (Oct 2026). Every page of the suite keeps its own entry; the v1.1 views
  // (ids v11…) are placed here too, so v11/ui.mjs only registers them. Labels are also the page names in the top bar.
  const NAV = [
    {
      title: "ÜBERSICHT",
      links: [
        ["overview", "Übersicht", "▦"],
        ["myday", "Heute zu tun", "⌂"],
        ["v11cockpit", "Monatsabschluss", "◩"],
        ["reports", "Berichte & Export", "▥"],
        ["insights", "Hinweise", "✧"],
      ],
    },
    {
      title: "VERKAUF & PREISE",
      links: [
        ["products", "Artikel & Umsätze", "◫"],
        ["outlets", "Outlets", "▥"],
        ["costs", "Deckungsbeiträge & Zielpreise", "€"],
        ["calculator", "Preiskalkulation", "◩"],
        ["portfolio", "Renner-Penner", "◉"],
        ["v11menu", "Menu Engineering", "◆"],
        ["lifecycle", "Lebenszyklen", "◴"],
        ["v11market", "Wettbewerbspreise", "⌁"],
        ["market", "Mein Markt (20 km)", "◎"],
      ],
    },
    {
      title: "EINKAUF & LAGER",
      links: [
        ["purchasing", "Bestell-Forecast", "◷"],
        ["orders", "Bestellungen", "▣"],
        ["inventory", "Inventur & Lager", "▱"],
        ["stockledger", "Warenbewegungen", "↭"],
        ["v11stock", "Mindestbestände", "▤"],
        ["recipes", "Rezepte & Rohwaren", "▤"],
      ],
    },
    {
      title: "SERVICE & TEAM",
      links: [
        ["v11tasks", "Team & Aufgaben", "☑"],
        ["funnel", "Service Funnel", "↗"],
        ["v11funnel", "Tagesfunnel (Kassenbons)", "◷"],
        ["v11training", "Funnel Quest", "★"],
      ],
    },
    {
      title: "EINRICHTUNG & DATEN",
      links: [
        ["setup", "Erste Schritte", "☑"],
        ["operations", "Datenqualität", "◈"],
        ["menuimport", "Speisekarte importieren", "⇧"],
        ["v11sales", "Monatsverkäufe", "⇪"],
        ["import", "Artikel- & Datenimport", "⇩"],
        ["groups", "Warengruppen", "▧"],
        ["v11legacy", "Strukturcheck", "▧"],
        ["settings", "Einstellungen", "⚙"],
      ],
    },
  ];
  /** Page name shown in the top bar: the navigation label, so route, heading area and menu always agree. */
  const labelOf = (view) => NAV.flatMap((g) => g.links).find((x) => x[0] === view)?.[1];
  // first four the role may open: management starts with the overview, staff with today's tasks
  const mobilePriorities = ["overview", "myday", "v11tasks", "funnel", "inventory", "purchasing", "orders", "reports", "menuimport"];
  let deferredPrompt = null;
  function collapsedGroups() {
    try {
      const v = JSON.parse(localStorage.getItem("glb-nav-collapsed") || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function renderNav() {
    const holder = document.querySelector('.nav[aria-label="Hauptnavigation"]');
    if (!holder) return;
    const closed = collapsedGroups();
    holder.innerHTML = NAV.map((group, i) => {
      const links = group.links.filter((row) => window.GLBAccess?.canView(row[0]) ?? true);
      const open = !closed.includes(group.title);
      // each area folds away on its own; the area of the open page is unfolded again in updateActive()
      return !links.length
        ? ""
        : `<div class="glb08-nav-group" data-group="${esc(group.title)}"><button type="button" class="glb08-nav-title" aria-expanded="${open}" aria-controls="glb08-group-${i}">${esc(group.title)}</button><div class="glb08-nav-items" id="glb08-group-${i}"${open ? "" : " hidden"}>${links.map(([v, title, ico]) => `<button data-view="${v}" class="nav-item glb08-nav-link"><span class="glb08-nav-icon" aria-hidden="true">${ico}</span><span>${esc(title)}</span></button>`).join("")}</div></div>`;
    }).join("");
    holder.querySelectorAll(".glb08-nav-title").forEach((btn) =>
      btn.addEventListener("click", () => {
        const items = document.getElementById(btn.getAttribute("aria-controls"));
        const open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        if (items) items.hidden = !open;
        const title = btn.closest(".glb08-nav-group")?.dataset.group || "";
        const list = collapsedGroups().filter((x) => x !== title);
        if (!open) list.push(title);
        try {
          localStorage.setItem("glb-nav-collapsed", JSON.stringify(list));
        } catch {}
      }),
    );
    document
      .querySelectorAll('.sidebar>.nav-label, .sidebar>.nav:not([aria-label="Hauptnavigation"])')
      .forEach((x) => (x.style.display = "none"));
    document.querySelectorAll(".topbar [data-view]").forEach((el) => {
      el.hidden = !(window.GLBAccess?.canView(el.dataset.view) ?? true);
    });
    const nav = document.querySelector("#glb08-bottomnav");
    if (nav) {
      const choices = mobilePriorities.filter((v) => window.GLBAccess?.canView(v) ?? true).slice(0, 4);
      if (!choices.length) choices.push("myday");
      nav.innerHTML =
        choices
          .map((v) => {
            const link = NAV.flatMap((x) => x.links).find((x) => x[0] === v);
            return `<button data-view="${v}" class="glb08-bottom-button"><span aria-hidden="true">${link?.[2] || "⌂"}</span><small>${esc(link?.[1] || v)}</small></button>`;
          })
          .join("") +
        `<button class="glb08-bottom-button" id="glb08-more" aria-label="Weitere Bereiche"><span>☰</span><small>Mehr</small></button>`;
      document.querySelector("#glb08-more")?.addEventListener("click", () => document.querySelector("#mobile-menu")?.click());
    }
    updateActive();
  }
  function updateActive() {
    // the view the app really shows (it may have fallen back from an unknown or forbidden address)
    const current = window.GLBAppSync?.view?.() || decodeURIComponent(location.hash.slice(1) || "overview");
    document.querySelectorAll(".glb08-nav-link,.glb08-bottom-button[data-view]").forEach((el) => {
      el.classList.toggle("active", el.dataset.view === current);
      const items = el.dataset.view === current ? el.closest(".glb08-nav-items") : null;
      if (items?.hidden) {
        // never hide the page the person is on
        items.hidden = false;
        document.querySelector(`[aria-controls="${items.id}"]`)?.setAttribute("aria-expanded", "true");
      }
      if (el.dataset.view === current) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }
  function activate(role) {
    window.GLBAccess?.setRole(role);
    renderNav();
    window.GLBAppSync?.rerender?.();
    updateActive();
  }
  // Extension modules add their views to an existing group (or a new one before MANAGEMENT); labels must stay unique.
  function addLinks(title, links) {
    let group = NAV.find((g) => g.title === title);
    if (!group) {
      group = { title, links: [] };
      NAV.splice(
        Math.max(
          0,
          NAV.findIndex((g) => g.title === "EINRICHTUNG & DATEN"),
        ),
        0,
        group,
      );
    }
    for (const link of links) {
      const all = NAV.flatMap((g) => g.links);
      if (all.some((x) => x[0] === link[0])) continue;
      if (all.some((x) => x[1] === link[1])) throw new Error("Doppelte Navigationsbeschriftung: " + link[1]);
      group.links.push(link);
    }
    renderNav();
  }
  window.GLB08UI = {
    labelOf,
    activate,
    renderNav,
    updateActive,
    addLinks,
    get nav() {
      return NAV;
    },
  };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-view]")) queueMicrotask(updateActive);
  });
  window.addEventListener("hashchange", () => {
    if (window.GLBAccess?.enabled && !window.GLBAccess.canView(location.hash.slice(1))) {
      location.hash = window.GLBAccess.defaultView();
      window.GLBAppSync?.rerender?.();
    }
    updateActive();
  });
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const b = document.querySelector("#glb08-install");
    if (b) b.hidden = false;
  });
  // iPhone/iPad Safari never fires beforeinstallprompt; there the button explains "Zum Home-Bildschirm".
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  if (ios && !installed) {
    const b = document.querySelector("#glb08-install");
    if (b) b.hidden = false;
  }
  document.querySelector("#glb08-install")?.addEventListener("click", async () => {
    if (!deferredPrompt) {
      alert("Auf iPhone: Safari → Teilen → Zum Home-Bildschirm. Android: Browser-Menü → App installieren.");
      return;
    }
    await deferredPrompt.prompt();
    deferredPrompt = null;
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
