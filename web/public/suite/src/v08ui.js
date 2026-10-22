/* GLB 0.8 role-aware navigation and phone shell. Back-end controls remain in SQL. */
(() => {
  "use strict";
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const NAV = [
    {
      title: "DEIN ARBEITSPLATZ",
      links: [
        ["myday", "Mein Arbeitsplatz", "⌂"],
        ["operations", "Mission Control", "◈"],
        ["overview", "Dashboard", "▦"],
      ],
    },
    {
      title: "VERKAUF & ANALYSE",
      links: [
        ["funnel", "Service Funnel", "↗"],
        ["products", "Artikel & Umsätze", "◫"],
        ["outlets", "Outlets", "▥"],
        ["portfolio", "Renner-Penner", "◉"],
        ["lifecycle", "Lebenszyklen", "◴"],
        ["market", "Mein Markt", "◎"],
      ],
    },
    {
      title: "SORTIMENT",
      links: [
        ["menuimport", "Speisekartenimport", "⇧"],
        ["recipes", "Rezepte & Rohwaren", "▤"],
        ["costs", "Deckungsbeiträge", "€"],
        ["calculator", "Preiskalkulation", "◩"],
        ["groups", "Oberkategorien", "▧"],
      ],
    },
    {
      title: "WARENWIRTSCHAFT",
      links: [
        ["inventory", "Inventur & Lager", "▱"],
        ["stockledger", "Warenbewegungen", "↭"],
        ["purchasing", "Bestell-Forecast", "◷"],
        ["orders", "Bestellungen", "▣"],
      ],
    },
    {
      title: "MANAGEMENT",
      links: [
        ["reports", "Report Studio", "▥"],
        ["insights", "GLB Intelligence", "✧"],
        ["import", "Datenimport", "⇩"],
        ["setup", "Einrichtung", "☑"],
        ["settings", "Einstellungen", "⚙"],
      ],
    },
  ];
  const mobilePriorities = ["myday", "funnel", "inventory", "orders", "reports", "menuimport"];
  let deferredPrompt = null;
  function renderNav() {
    const holder = document.querySelector('.nav[aria-label="Hauptnavigation"]');
    if (!holder) return;
    holder.innerHTML = NAV.map((group) => {
      const links = group.links.filter((row) => window.GLBAccess?.canView(row[0]) ?? true);
      return !links.length
        ? ""
        : `<div class="glb08-nav-title">${esc(group.title)}</div>${links.map(([v, title, ico]) => `<button data-view="${v}" class="nav-item glb08-nav-link"><span class="glb08-nav-icon" aria-hidden="true">${ico}</span><span>${esc(title)}</span></button>`).join("")}`;
    }).join("");
    document
      .querySelectorAll('.sidebar>.nav-label, .sidebar>.nav:not([aria-label="Hauptnavigation"])')
      .forEach((x) => (x.style.display = "none"));
    const status = document.querySelector(".side-status strong");
    if (status) status.textContent = "GLB Cloud · v0.8";
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
    const current = decodeURIComponent(location.hash.slice(1) || "myday");
    document.querySelectorAll(".glb08-nav-link,.glb08-bottom-button[data-view]").forEach((el) => {
      el.classList.toggle("active", el.dataset.view === current);
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
  window.GLB08UI = { activate, renderNav, updateActive };
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
