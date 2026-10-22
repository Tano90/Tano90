/* GLB AI Suite 0.2 – browser-local MVP. Real AI and customer accounts are NOT connected. */
(function () {
  "use strict";
  const C = window.GLBCore;
  const KEY = "glb-ai-suite-v01";
  const DEMO = [
    { id: "d1", name: "Classic Cheeseburger", category: "Burger", quantity: 247, grossPrice: 17.9, costNet: 4.55, vat: 7 },
    { id: "d2", name: "Rumpsteak 250 g", category: "Grill", quantity: 156, grossPrice: 29.5, costNet: 11.65, vat: 7 },
    { id: "d3", name: "Chicken Bowl", category: "Bowl & Salat", quantity: 189, grossPrice: 18.5, costNet: 5.85, vat: 7 },
    { id: "d4", name: "Veggie Burger", category: "Burger", quantity: 81, grossPrice: 16.8, costNet: 5.1, vat: 7 },
    { id: "d5", name: "Dry Aged Steak", category: "Grill", quantity: 47, grossPrice: 46.8, costNet: 19.5, vat: 7 },
    { id: "d6", name: "Caesar Salad", category: "Bowl & Salat", quantity: 128, grossPrice: 15.9, costNet: 4.2, vat: 7 },
    { id: "d7", name: "Trüffel Fries", category: "Sides", quantity: 214, grossPrice: 8.9, costNet: 2.35, vat: 7 },
    { id: "d8", name: "Apfelstrudel", category: "Dessert", quantity: 92, grossPrice: 10.2, costNet: 2.1, vat: 7 },
    { id: "d9", name: "Hausgemachte Limonade", category: "Getränke", quantity: 182, grossPrice: 5.9, costNet: 1.25, vat: 19 },
    { id: "d10", name: "Signature Cocktail", category: "Getränke", quantity: 136, grossPrice: 9.5, costNet: 2.45, vat: 19 },
    { id: "d11", name: "Surf & Turf Upgrade", category: "Upgrades", quantity: 39, grossPrice: 12.5, costNet: 4.1, vat: 7 },
    { id: "d12", name: "Dessertvariation", category: "Dessert", quantity: 61, grossPrice: 12.9, costNet: 5.6, vat: 7 },
  ];
  const DEFAULT_RECIPE = {
    name: "Neues Gericht",
    category: "Hauptgericht",
    vat: 7,
    targetPct: 30,
    currentPrice: 19.9,
    ingredients: [
      { name: "Hauptkomponente", cost: 4.6 },
      { name: "Beilage", cost: 1.2 },
      { name: "Sauce & Garnitur", cost: 0.6 },
    ],
  };
  const INITIAL_OUTLETS = [
    { id: "restaurant", name: "Restaurant" },
    { id: "bar", name: "Bar" },
    { id: "events", name: "Bankett & Events" },
    { id: "unassigned", name: "Ohne Outlet-Zuordnung" },
  ];
  function legacySales(items) {
    return items
      .filter((p) => Number(p.quantity) > 0)
      .map((p, i) => ({
        id: "legacy-" + i + "-" + p.id,
        productId: p.id,
        outletId: "unassigned",
        month: "undated",
        quantity: p.quantity,
        grossPrice: p.grossPrice,
      }));
  }
  function demoSales() {
    const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
    const types = ["growth", "mature", "decline"];
    const patterns = {
      growth: [0.6, 0.75, 0.8, 1, 1.3, 1.5],
      mature: [1, 1.04, 0.94, 1.06, 1.02, 1],
      decline: [1.55, 1.35, 1.1, 0.95, 0.75, 0.55],
    };
    const out = [];
    for (const [ix, p] of DEMO.entries()) {
      const weights = patterns[types[ix % 3]],
        sum = weights.reduce((a, b) => a + b, 0);
      let used = 0;
      for (let j = 0; j < 6; j++) {
        const quantity = j === 5 ? p.quantity - used : Math.floor((p.quantity * weights[j]) / sum);
        used += quantity;
        const outletId = p.category === "Getränke" ? "bar" : p.category === "Dessert" ? "events" : "restaurant";
        out.push({ id: `demo-${p.id}-${j}`, productId: p.id, outletId, month: months[j], quantity, grossPrice: p.grossPrice });
      }
    }
    return out;
  }
  function defaults() {
    return {
      version: 3,
      mode: "demo",
      business: "Demo-Betrieb",
      targetPct: 30,
      items: DEMO.map((i) => ({ ...i, unit: "Portion" })),
      recipe: JSON.parse(JSON.stringify(DEFAULT_RECIPE)),
      outlets: INITIAL_OUTLETS.map((x) => ({ ...x })),
      sales: demoSales(),
      market: [],
    };
  }
  function validItem(x) {
    return (
      x &&
      typeof x === "object" &&
      typeof x.id === "string" &&
      typeof x.name === "string" &&
      x.name.trim().length > 0 &&
      [x.quantity, x.grossPrice, x.costNet].every((v) => Number.isFinite(Number(v)) && Number(v) >= 0) &&
      [0, 7, 19].includes(Number(x.vat))
    );
  }
  function validSales(x) {
    return (
      x &&
      typeof x.id === "string" &&
      typeof x.productId === "string" &&
      typeof x.outletId === "string" &&
      (x.month === "undated" || /^\d{4}-(0[1-9]|1[0-2])$/.test(x.month)) &&
      Number.isInteger(Number(x.quantity)) &&
      Number(x.quantity) >= 0 &&
      Number.isFinite(Number(x.grossPrice)) &&
      Number(x.grossPrice) >= 0
    );
  }
  function migrate(d) {
    if (!d || !Array.isArray(d.items) || d.items.length > 20000 || !d.items.every(validItem)) throw Error("Ungültige Produktdaten");
    if (d.version === 1) {
      d = { ...d, version: 2, outlets: INITIAL_OUTLETS.map((x) => ({ ...x })), sales: legacySales(d.items), market: [] };
    }
    if (
      ![2, 3, 4, 5, 6].includes(d.version) ||
      !Array.isArray(d.sales) ||
      d.sales.length > 100000 ||
      !d.sales.every(validSales) ||
      !Array.isArray(d.outlets) ||
      !d.outlets.every((o) => o && typeof o.id === "string" && typeof o.name === "string") ||
      !Array.isArray(d.market) ||
      d.market.length > 10000
    )
      throw Error("Ungültiges V2 Backup");
    if (d.sales.some((x) => !d.items.some((p) => p.id === x.productId) || !d.outlets.some((o) => o.id === x.outletId)))
      throw Error("Datenverknüpfung unvollständig");
    return { ...d, version: 4 };
  }
  function load() {
    if (window.GLB_CLOUD_ENABLED) return defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const d = migrate(JSON.parse(raw));
      return {
        ...defaults(),
        ...d,
        recipe: d.recipe && Array.isArray(d.recipe.ingredients) ? d.recipe : JSON.parse(JSON.stringify(DEFAULT_RECIPE)),
      };
    } catch (e) {
      console.warn("Storage fallback:", e);
      return defaults();
    }
  }

  let S = load(),
    VIEW = (location.hash || "#overview").slice(1),
    FILTER = "",
    CAT = "all",
    QFILTER = "all",
    OFILTER = "all",
    MFILTER = "all",
    LPRODUCT = "";
  const euro = (n) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number.isFinite(Number(n)) ? Number(n) : 0);
  const number = (n) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Number(n) || 0);
  const pct = (n) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Number(n) || 0) + " %";
  const esc = (x) =>
    String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => C.round(n, 2).toString().replace(".", ",");
  const uid = () => "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const persist = () => {
    if (window.GLB_CLOUD_ENABLED) {
      document.querySelector("#workspace-name").textContent = S.business;
      window.GLBCloudBridge?.changed?.(S);
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      document.querySelector("#workspace-name").textContent = S.business;
    } catch (e) {
      toast("Speicher voll oder nicht verfügbar. Bitte Backup herunterladen.", "error");
    }
  };
  const iconPaths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2m4 0h2M8 14h2m4 0h2M8 18h2m4 0h2"/>',
    scatter: '<path d="M3 3v18h18"/><circle cx="7" cy="15" r="1.5"/><circle cx="12" cy="10" r="1.5"/><circle cx="18" cy="6" r="1.5"/>',
    sparkles:
      '<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3ZM19 18l.8 1.2L21 20l-1.2.8L19 22l-.8-1.2L17 20l1.2-.8L19 18Z"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    settings:
      '<path d="M9.6 4.1 12 2l2.4 2.1 3-.3.7 3 2.7 1.4-1.3 2.8 1.3 2.8-2.7 1.4-.7 3-3-.3L12 20l-2.4-2.1-3 .3-.7-3-2.7-1.4 1.3-2.8-1.3-2.8 2.7-1.4.7-3 3 .3Z"/><circle cx="12" cy="11" r="3"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 4a3 3 0 0 1 0 6m1 10v-2a6 6 0 0 0-2-4"/>',
    trending: '<path d="m3 17 6-6 4 4 8-9M15 6h6v6"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 4h3l2.3 11H20l2-8H6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 4h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
    edit: '<path d="M13 6 18 11M4 20l4-.8 11.5-11.5a2 2 0 0 0-3-3L5 16l-1 4Z"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
    chart: '<path d="M3 21V3M3 21h18M8 18v-6h3v6M14 18V7h3v11"/>',
    file: '<path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM14 2v6h6M8 13h9M8 17h9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    shield: '<path d="m12 2 8 4v5c0 5-3 8-8 11-5-3-8-6-8-11V6l8-4Z"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7V2Z"/>',
    refresh: '<path d="M20 7V3h-4M4 17v4h4M19 7a8 8 0 0 0-14-1M5 17a8 8 0 0 0 14 1"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
    clipboard: '<rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="6" rx="1"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
  };
  const I = (id) =>
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (iconPaths[id] || iconPaths.info) +
    "</svg>";
  document.querySelectorAll("[data-icon]").forEach((x) => (x.innerHTML = I(x.dataset.icon)));
  function reportItems(opts = {}) {
    const rows = C.reportSales(S.sales, S.items, opts).list;
    const sums = new Map();
    for (const r of rows) {
      const d = sums.get(r.productId) || { quantity: 0, grossTotal: 0 };
      d.quantity += r.quantity;
      d.grossTotal += r.grossPrice * r.quantity;
      sums.set(r.productId, d);
    }
    return S.items.map((p) => {
      const v = sums.get(p.id);
      return { ...p, quantity: v?.quantity || 0, grossPrice: v && v.quantity > 0 ? v.grossTotal / v.quantity : p.grossPrice };
    });
  }
  function outletName(id) {
    return S.outlets.find((x) => x.id === id)?.name || "Unbekannt";
  }
  function periodName(m) {
    return m === "undated"
      ? "Ohne Zeitraum"
      : /^\d{4}-\d{2}$/.test(m)
        ? new Date(m + "-01T12:00:00Z").toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })
        : m;
  }
  function periods() {
    return [...new Set(S.sales.map((x) => x.month))].sort().reverse();
  }
  function stockOf(id) {
    return S.items.find((p) => p.id === id);
  }
  function monthSelect(value, all = true) {
    return selectOptions([...(all ? [["all", "Alle Zeiträume"]] : []), ...periods().map((x) => [x, periodName(x)])], value);
  }
  function outletSelect(value, all = true) {
    return selectOptions([...(all ? [["all", "Alle Outlets"]] : []), ...S.outlets.map((x) => [x.id, x.name])], value);
  }
  function deltaLabel(n) {
    return n === null || n === undefined ? "Keine belastbare Veränderung" : (n > 0 ? "+" : "") + pct(n);
  }
  function pills(list) {
    return list.map((x) => `<span class="tag tag-neutral">${esc(x)}</span>`).join(" ");
  }
  const pageHeader = (eye, title, desc, actions = "") =>
    `<div class="page-hero"><div><span class="eyebrow">${esc(eye)}</span><h1 class="page-title">${esc(title)}</h1><p class="page-desc">${desc}</p></div><div class="actions">${actions}</div></div>`;
  const demoNotice = () =>
    S.mode === "own"
      ? ""
      : `<div class="notice">${I("info")}<span><strong>Beispieldaten${S.mode === "edited-demo" ? " (bearbeitet)" : ""}.</strong> Diese Umsätze und Artikel sind frei erfunden und dienen ausschließlich zum Testen.</span><button class="notice-action" data-action="start-blank">Eigene Daten starten ${I("arrow")}</button></div>`;
  const panelHeader = (title, sub = "", action = "") =>
    `<div class="panel-head"><div><h2 class="panel-title">${esc(title)}</h2>${sub ? `<p class="panel-sub">${esc(sub)}</p>` : ""}</div>${action}</div>`;
  const selectOptions = (list, value) =>
    list.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`).join("");
  function kpi(title, value, icon, foot) {
    return `<article class="kpi-card"><div class="kpi-head"><span>${esc(title)}</span><div class="kpi-icon">${I(icon)}</div></div><div class="kpi-value">${esc(value)}</div><div class="kpi-foot">${foot}</div></article>`;
  }
  function categories(items) {
    const map = {};
    items.map(C.metrics).forEach((x) => {
      map[x.category] = (map[x.category] || 0) + x.revenueNet;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }
  function categoryBars(items) {
    const cat = categories(items),
      max = Math.max(...cat.map((x) => x[1]), 1);
    if (!cat.length) return empty("Noch keine Umsätze", "Füge Produkte hinzu, um die Kategorien zu sehen.");
    return `<div class="category-bars">${cat
      .slice(0, 5)
      .map(
        ([name, sum], idx) =>
          `<div><div class="bar-label"><span>${esc(name)}</span><strong>${euro(sum)}</strong></div><div class="bar-track"><div class="bar-fill alt-${idx}" style="width:${Math.max(0, (sum / max) * 100)}%"></div></div></div>`,
      )
      .join(
        "",
      )}</div><p class="chart-note">Netto-Umsatz nach Kategorie, basierend auf hinterlegten Absatzmengen. Kein zeitlicher Verlauf.</p>`;
  }
  function empty(title, detail) {
    return `<div class="empty-state">${I("layers")}<strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;
  }
  function tagClass(q) {
    return q === "star" ? "" : q === "runner" ? "tag-orange" : q === "sleeper" ? "tag-blue" : "tag-red";
  }
  function tagName(q) {
    return { star: "Star", runner: "Renner", sleeper: "Schläfer", loser: "Penner" }[q] || "—";
  }
  function tableRows(items, limited = false) {
    const cl = C.classify(reportItems()),
      lookup = Object.fromEntries(cl.list.map((x) => [x.id, x]));
    return items
      .map((x) => lookup[x.id] || C.metrics(x))
      .sort((a, b) => b.revenueNet - a.revenueNet)
      .slice(0, limited ? 5 : undefined)
      .map(
        (x) =>
          `<tr><td><div class="item-name-cell"><div class="item-initial">${esc(x.name.slice(0, 2).toUpperCase())}</div><div><strong>${esc(x.name)}</strong><div class="micro">${esc(x.category)}</div></div></div></td><td class="align-right">${number(x.quantity)}</td><td class="align-right">${euro(x.grossPrice)}</td><td class="align-right">${euro(x.contributionUnit)}</td><td class="align-right">${euro(x.revenueNet)}</td><td><span class="tag ${tagClass(x.quadrant)}">${tagName(x.quadrant)}</span></td>${limited ? "" : `<td class="align-right"><div class="table-actions"><button class="btn btn-small btn-quiet" data-edit="${esc(x.id)}" title="Bearbeiten" aria-label="${esc(x.name)} bearbeiten">${I("edit")}</button><button class="btn btn-small btn-quiet" data-delete="${esc(x.id)}" title="Entfernen" aria-label="${esc(x.name)} entfernen">${I("trash")}</button></div></td>`}</tr>`,
      )
      .join("");
  }
  function dataTable(items, limited = false) {
    if (!items.length) return empty("Keine Produkte vorhanden", "Lege ein Produkt an oder importiere Verkaufszahlen.");
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Produkt</th><th class="align-right">Menge</th><th class="align-right">VK brutto</th><th class="align-right">DB / Stück</th><th class="align-right">Umsatz netto</th><th>Gruppe</th>${limited ? "" : '<th class="align-right">Aktion</th>'}</tr></thead><tbody>${tableRows(items, limited)}</tbody></table></div>`;
  }
  function miniInsights(items) {
    return C.insights(items, S.targetPct)
      .slice(0, 3)
      .map(
        (x) =>
          `<div class="insight-mini"><div class="insight-mini-icon ${esc(x.level)}">${I(x.level === "critical" ? "alert" : x.level === "opportunity" ? "bolt" : "target")}</div><div class="insight-mini-body"><strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p></div></div>`,
      )
      .join("");
  }
  function overview() {
    const t = C.reportSales(S.sales, S.items);
    const list = reportItems();
    const goodsPct = t.revenueNet > 0 ? (t.goodsNet / t.revenueNet) * 100 : 0;
    return (
      pageHeader(
        "Performance Cockpit",
        "Guten Tag. Hier ist dein Überblick.",
        "Netto-Umsatz und DB aus erfassten Verkäufen, einschließlich Outlet- und Zeitraumzuordnung.",
        `<button class="btn" data-view="outlets">${I("chart")} Outlets auswerten</button><button class="btn btn-primary" data-action="new-sale">${I("plus")} Verkauf erfassen</button>`,
      ) +
      demoNotice() +
      `<section class="kpi-grid">${kpi("Netto-Umsatz", euro(t.revenueNet), "chart", "Aus erfassten Verkaufszeilen")}${kpi("DB I · nach Warenkosten", euro(t.db1), "trending", "Ohne weitere variable Kosten")}${kpi("DB II · variable Kosten", euro(t.db2), "target", "Ohne Fixkosten und Gemeinkosten")}${kpi("Wareneinsatzquote", pct(goodsPct), "layers", `Zielwert: ${pct(S.targetPct)}`)}</section><section class="content-grid"><div class="panel">${panelHeader("Umsatz nach Outlet", "Tatsächlich zugeordnete Verkaufszeilen", `<button class="panel-link" data-view="outlets">Outlet-Controlling ${I("arrow")}</button>`)}${outletBars()}</div><div class="panel">${panelHeader("Management Insights", "Regelbasiert, keine Live-KI", `<button class="panel-link" data-view="insights">Alle Hinweise ${I("arrow")}</button>`)}${miniInsights(list)}</div></section><section class="bottom-grid"><div class="panel">${panelHeader("Top-Produkte nach Umsatz", "Sortiment nach Netto-Umsatz", `<button class="panel-link" data-view="products">Produkte ${I("arrow")}</button>`)}${dataTable(list, true)}</div><div class="panel">${panelHeader("Direkteinstieg", "Vom Produkt zum Absatz und Vergleich")}<div class="quick-actions"><button data-view="costs" class="quick-action">${I("calculator")}<span>DB-Masken</span><small>Alle Kosten je Produkt</small></button><button data-view="outlets" class="quick-action">${I("chart")}<span>Outlets</span><small>Umsatz / Monat</small></button><button data-view="market" class="quick-action">${I("target")}<span>Mein Markt</span><small>Wettbewerber</small></button><button data-view="lifecycle" class="quick-action">${I("trending")}<span>Lebenszyklen</span><small>Absatztrends</small></button></div><p class="chart-note">Offline-MVP v0.2 · kein Kassensystem, kein Web-Crawling, keine echte KI-Anbindung.</p></div></section>`
    );
  }

  function productsViewLegacy() {
    const cats = [...new Set(S.items.map((x) => x.category))].sort();
    const items = reportItems().filter((x) => (CAT === "all" || x.category === CAT) && x.name.toLowerCase().includes(FILTER.toLowerCase()));
    return (
      pageHeader(
        "Artikelverwaltung",
        "Artikel & Umsätze",
        "Produktstamm, Verkaufspreise und Kosten zentral pflegen. Absatz wird separat nach Outlet und Monat erfasst.",
        `<button class="btn" data-view="costs">${I("calculator")} DB-Masken</button><button class="btn" data-action="new-sale">${I("plus")} Verkauf erfassen</button><button class="btn btn-primary" data-action="new-product">${I("plus")} Produkt hinzufügen</button>`,
      ) +
      demoNotice() +
      `<div class="toolbar"><div class="toolbar-left"><input class="search-input" id="product-search" placeholder="Produkt suchen ..." value="${esc(FILTER)}" aria-label="Produkte suchen"><select class="select" id="product-category" aria-label="Kategorie filtern">${selectOptions([["all", "Alle Kategorien"], ...cats.map((x) => [x, x])], CAT)}</select></div><span class="micro">${items.length} von ${S.items.length} Artikeln</span></div><div class="panel table-shell">${dataTable(items)}<div class="table-footer"><span>DB je Stück = DB II nach direkten variablen Kosten · Umsatz aus Verkaufszeilen.</span><span>Speicherung: nur dieser Browser</span></div></div>`
    );
  }
  function getRecipe() {
    return { ...S.recipe, ingredients: S.recipe.ingredients.map((x) => ({ ...x })) };
  }
  function recipeTotals(r) {
    const cost = r.ingredients.reduce((a, b) => a + Math.max(0, Number(b.cost) || 0), 0);
    const proposed = C.suggestedPrice(cost, Number(r.targetPct), Number(r.vat));
    const price = Math.max(0, Number(r.currentPrice) || 0);
    const net = price / (1 + Number(r.vat) / 100);
    const foodPct = net > 0 ? (cost / net) * 100 : 0;
    return { cost, proposed, price, net, foodPct, db: net - cost };
  }
  function recipeResults(r) {
    const x = recipeTotals(r);
    return `<div class="calc-result"><div class="calc-caption">EMPFOHLENER VERKAUFSPREIS · BRUTTO</div><div class="calc-hero" id="calc-suggested">${x.proposed === null ? "—" : euro(x.proposed)}</div><div class="calc-sub">Bei ${pct(r.targetPct)} Ziel-Wareneinsatz und ${r.vat} % Umsatzsteuer.</div><div class="calc-stat-list"><div><span>Warenkosten pro Portion, netto</span><strong id="calc-cost">${euro(x.cost)}</strong></div><div><span>Aktueller Verkaufspreis, brutto</span><strong id="calc-current">${euro(x.price)}</strong></div><div><span>Aktueller Wareneinsatz</span><strong id="calc-we">${pct(x.foodPct)}</strong></div><div><span>Stück-Deckungsbeitrag, netto</span><strong class="highlight" id="calc-db">${euro(x.db)}</strong></div></div></div><p class="calc-note">Deckungsbeitrag hier = Nettoerlös minus direkt zugeordnete Netto-Warenkosten. Personal, Gemeinkosten, Schwund und Zahlungsgebühren sind nicht enthalten. Eingaben bitte pro verkaufsfähiger Portion vornehmen.</p>`;
  }
  function calculatorView() {
    const r = getRecipe();
    return (
      pageHeader(
        "Profit Engineering",
        "Preiskalkulation",
        "Kalkuliere Gerichte auf Basis deiner Netto-Warenkosten und einer Ziel-Wareneinsatzquote.",
        `<button class="btn" data-view="products">${I("layers")} Sortiment ansehen</button>`,
      ) +
      demoNotice() +
      `<section class="calc-layout"><div class="panel">${panelHeader("Rezept & Kosten", "Alle Werte je verkaufsfähiger Portion.")}<div class="field-grid"><div class="field"><label for="calc-name">Produktname</label><input id="calc-name" value="${esc(r.name)}"></div><div class="field"><label for="calc-category">Kategorie</label><input id="calc-category" value="${esc(r.category)}"></div></div><div class="panel-head" style="margin-top:17px;margin-bottom:7px"><div><h2 class="panel-title">Kostenbestandteile</h2><p class="panel-sub">Direkte Warenkosten netto, pro Portion.</p></div></div><div class="table-scroll"><table class="ingredient-table"><thead><tr><th>Bestandteil</th><th>Kosten netto (€)</th><th></th></tr></thead><tbody>${r.ingredients.map((ing, idx) => `<tr><td><input class="ing-name" data-idx="${idx}" aria-label="Bestandteil ${idx + 1}" value="${esc(ing.name)}"></td><td><input class="ing-cost" type="text" inputmode="decimal" data-idx="${idx}" aria-label="Netto-Kosten für Bestandteil ${idx + 1}" value="${esc(fmt(ing.cost))}"></td><td><button class="btn btn-quiet btn-small" data-action="delete-ingredient" data-idx="${idx}" aria-label="Bestandteil entfernen">${I("trash")}</button></td></tr>`).join("")}</tbody></table></div><button class="btn btn-secondary btn-small" style="margin-top:13px" data-action="add-ingredient">${I("plus")} Bestandteil hinzufügen</button><hr class="split-divider"><div class="field-grid"><div class="field"><label for="calc-target">Ziel-Wareneinsatz (%)</label><input id="calc-target" type="text" inputmode="decimal" value="${esc(fmt(r.targetPct))}"><small>Beispiel: 30 = 30 % vom Nettoerlös.</small></div><div class="field"><label for="calc-vat">Umsatzsteuer</label><select id="calc-vat">${selectOptions(
        [
          [7, "7 % – Speisen"],
          [19, "19 % – Getränke"],
          [0, "0 % – Sonderfall"],
        ],
        r.vat,
      )}</select><small>Steuersatz für diesen konkreten Verkauf prüfen.</small></div><div class="field"><label for="calc-price">Aktueller VK-Preis brutto (€)</label><input id="calc-price" type="text" inputmode="decimal" value="${esc(fmt(r.currentPrice))}"></div></div></div><div><div class="panel" style="margin-bottom:15px">${panelHeader("Kalkulationsergebnis", "Berechnet live bei jeder Änderung")}<div id="calculator-output">${recipeResults(r)}</div><button style="margin-top:15px;width:100%" class="btn btn-primary" data-action="save-recipe">${I("plus")} Als Produkt speichern</button></div><div class="panel">${panelHeader("So rechnet die Suite")}<div class="format-guide">Empfohlener Bruttopreis = <strong>Warenkosten netto ÷ Ziel-Wareneinsatzquote × (1 + Umsatzsteuersatz)</strong>.<br>Beispiel: 6 € Warenkosten / 0,30 × 1,07 = <strong>21,40 € brutto</strong>.</div></div></div></section>`
    );
  }
  function scatter(items) {
    const cl = C.classify(items),
      list = cl.list;
    if (!list.length) return empty("Keine Daten", "Füge Produkte hinzu.");
    const W = 710,
      H = 398,
      l = 58,
      t = 26,
      r = 18,
      b = 58;
    const iw = W - l - r,
      ih = H - t - b;
    const xmin = 0,
      xmax = Math.max(...list.map((x) => x.quantity), 1) * 1.1;
    const ymin = Math.min(0, ...list.map((x) => x.contributionUnit)) - 1,
      ymax = Math.max(1, ...list.map((x) => x.contributionUnit)) * 1.15;
    const xp = (x) => l + ((x - xmin) / (xmax - xmin)) * iw,
      yp = (y) => t + ((ymax - y) / (ymax - ymin)) * ih;
    const midX = xp(cl.medianQuantity),
      midY = yp(cl.medianContribution);
    const colors = { star: "#1c9983", runner: "#d7ae54", sleeper: "#648aaf", loser: "#bd6b63" };
    return `<div class="scatter-wrap"><svg role="img" aria-label="Portfolio Matrix: X ist Absatzmenge, Y ist Deckungsbeitrag je Artikel; Median teilt die Quadranten" viewBox="0 0 ${W} ${H}"><rect x="${l}" y="${t}" width="${iw}" height="${ih}" rx="8" fill="#fcfdfd" stroke="#e5eaec"/><rect x="${midX}" y="${t}" width="${Math.max(0, W - r - midX)}" height="${Math.max(0, midY - t)}" fill="#eaf7f3" opacity=".9"/><rect x="${l}" y="${midY}" width="${Math.max(0, midX - l)}" height="${Math.max(0, H - b - midY)}" fill="#fff2f0" opacity=".8"/><path d="M ${midX} ${t} V ${H - b} M ${l} ${midY} H ${W - r}" fill="none" stroke="#b4c6c7" stroke-dasharray="5 5" stroke-width="1.5"/><path d="M${l} ${t}V${H - b}H${W - r}" fill="none" stroke="#bcc8cc" stroke-width="1.3"/><text x="${l + 10}" y="${t + 18}" font-size="10" fill="#8499ad">SCHLÄFER</text><text x="${W - r - 82}" y="${t + 18}" font-size="10" fill="#4e9788">STARS</text><text x="${l + 10}" y="${H - b - 12}" font-size="10" fill="#bc8d85">PENNER</text><text x="${W - r - 87}" y="${H - b - 12}" font-size="10" fill="#ba9c62">RENNER</text><text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#778994">Verkaufte Menge →</text><text x="14" y="${H / 2}" transform="rotate(-90 14 ${H / 2})" text-anchor="middle" font-size="11" fill="#778994">Deckungsbeitrag je Stück (€) →</text>${list.map((x) => `<g data-edit="${esc(x.id)}" style="cursor:pointer"><circle cx="${xp(x.quantity)}" cy="${yp(x.contributionUnit)}" r="7.5" fill="${colors[x.quadrant]}" stroke="#fff" stroke-width="2"><title>${esc(x.name)} · ${number(x.quantity)} Verkäufe · ${euro(x.contributionUnit)} Stück-DB</title></circle></g>`).join("")}</svg></div>`;
  }
  function portfolioViewLegacy() {
    const cl = C.classify(reportItems()),
      counts = { star: 0, runner: 0, sleeper: 0, loser: 0 };
    cl.list.forEach((x) => counts[x.quadrant]++);
    const filtered = cl.list.filter((x) => QFILTER === "all" || x.quadrant === QFILTER);
    return (
      pageHeader(
        "Portfolio Intelligence",
        "Renner-Penner-Analyse",
        "Welche Produkte bringen Menge – und welche bringen Deckungsbeitrag?",
        `<button class="btn" data-view="products">${I("layers")} Produkte pflegen</button>`,
      ) +
      demoNotice() +
      `<div class="panel">${panelHeader("Portfolio-Matrix", "X = Absatzmenge · Y = Deckungsbeitrag je Stück (netto)", `<span class="tag tag-neutral">Median-Split</span>`)}<div class="quadrant-legend"><span class="legend-label"><i class="legend-dot" style="background:#1c9983"></i> Stars</span><span class="legend-label"><i class="legend-dot" style="background:#d7ae54"></i> Renner</span><span class="legend-label"><i class="legend-dot" style="background:#648aaf"></i> Schläfer</span><span class="legend-label"><i class="legend-dot" style="background:#bd6b63"></i> Penner</span></div>${scatter(reportItems())}<p class="chart-note">Schwellen: Median Menge ${number(cl.medianQuantity)}, Median Stück-DB ${euro(cl.medianContribution)}. Klick auf einen Punkt: Produkt bearbeiten. Gleichstand zählt zur hohen Gruppe.</p><div class="quadrant-grid">${[
        ["star", "Stars", "Hoher Absatz & hoher DB"],
        ["runner", "Renner", "Hoher Absatz & niedriger DB"],
        ["sleeper", "Schläfer", "Niedriger Absatz & hoher DB"],
        ["loser", "Penner", "Niedriger Absatz & niedriger DB"],
      ]
        .map(
          ([id, title, sub]) =>
            `<div class="quadrant-card q-${id}"><strong>${title}</strong><div class="q-number">${counts[id]}</div><small>${sub}</small></div>`,
        )
        .join(
          "",
        )}</div></div><div class="panel" style="margin-top:18px">${panelHeader("Artikelauswertung", "Berechnung auf Basis deiner eingetragenen Mengen und Kosten")}<div class="toolbar"><select class="select" id="quadrant-filter">${selectOptions(
        [
          ["all", "Alle Gruppen"],
          ["star", "Stars"],
          ["runner", "Renner"],
          ["sleeper", "Schläfer"],
          ["loser", "Penner"],
        ],
        QFILTER,
      )}</select></div>${dataTable(filtered)}</div>`
    );
  }
  function insightsView() {
    const list = C.insights(reportItems(), S.targetPct);
    return (
      pageHeader(
        "GLB Intelligence",
        "Klarheit statt Bauchgefühl.",
        "Konkrete Hinweise aus deinen Produktdaten – nachvollziehbar und priorisiert.",
        `<button class="btn" data-view="settings">${I("target")} Zielwert einstellen</button>`,
      ) +
      demoNotice() +
      `<div class="ai-banner">${I("sparkles")}<div><h2>Dein digitaler Analyse-Assistent</h2><p>Diese Version nutzt transparente Geschäftsregeln – noch kein Sprachmodell und keine echte KI-API. Die Ergebnisse sind direkt aus deinen Zahlen berechnet. Eine sichere KI-Anbindung kommt in einer späteren Version.</p></div><span class="tag">Regelbasiert</span></div><div class="content-grid"><div class="panel">${panelHeader("Handlungsempfehlungen", `${list.length} automatisch erkannte Hinweise`)}<div class="insights-list">${list.map((x, idx) => `<div class="insight-card"><div class="insight-symbol ${esc(x.level)}">${I(x.level === "critical" ? "alert" : x.level === "opportunity" ? "bolt" : x.level === "good" ? "check" : "target")}</div><div class="insight-content"><span class="micro">HINWEIS 0${idx + 1}</span><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p><div class="insight-explain">Warum? ${esc(x.why)}</div></div></div>`).join("")}</div></div><div><div class="panel" style="margin-bottom:18px">${panelHeader("Analysegrundlage", "Nur deine hinterlegten Produktdaten")}<div class="format-guide">${I("database")} &nbsp; ${S.items.length} Artikel im Datensatz<br>${I("target")} &nbsp; Ziel-Wareneinsatz: ${pct(S.targetPct)}<br>${I("scatter")} &nbsp; Medianvergleich von Menge und Stück-DB<br>${I("shield")} &nbsp; Keine Datenübertragung an externe Dienste</div></div><div class="panel">${panelHeader("Was als Nächstes folgt")}<div class="steps"><div class="step"><span class="step-number">1</span><div><strong>KI mit Serveranbindung</strong><p>Fragen zu Zahlen stellen, ohne API-Schlüssel im Browser.</p></div></div><div class="step"><span class="step-number">2</span><div><strong>Zeitraum-Vergleiche</strong><p>Wochentrends, Monate und echtes Reporting nach Datum.</p></div></div><div class="step"><span class="step-number">3</span><div><strong>Automatisierte Empfehlungen</strong><p>Auf Wunsch mit Freigabe und Protokollierung.</p></div></div></div></div></div></div>`
    );
  }
  function importView() {
    return (
      pageHeader(
        "Data Hub",
        "Datenimport",
        "Lade deine Artikeldaten als CSV-Datei hoch. Excel kann eine Tabelle als CSV speichern.",
        `<button class="btn" data-action="csv-template">${I("download")} CSV-Vorlage</button>`,
      ) +
      demoNotice() +
      `<section class="content-grid"><div class="panel">${panelHeader("CSV-Datei importieren", "Bestand kann ersetzt oder ergänzt werden.")}<div class="drop-zone" id="csv-dropzone" tabindex="0" role="button" aria-label="CSV-Datei auswählen">${I("upload")}<h3>CSV-Datei hier ablegen</h3><p>oder Datei auswählen. Unterstützt Semikolon und Komma, deutsche Dezimalzahlen und UTF-8.</p><button class="btn btn-primary" data-action="pick-csv">${I("file")} CSV auswählen</button><input type="file" id="csv-file" hidden accept=".csv,text/csv,text/plain"></div><div class="field" style="margin-top:17px;max-width:320px"><label for="import-mode">Importmethode</label><select id="import-mode"><option value="replace">Bestehende Artikel ersetzen</option><option value="append">Artikel zusätzlich anlegen</option></select></div><div id="import-results"></div><p class="calc-note">Wichtig: Jeder CSV-Datensatz ist ein Artikel mit einer aggregierten Absatzmenge. Dieser Artikelimport erzeugt Verkäufe ohne Monats- und Outlet-Zuordnung. Für präzise Reports nutze zusätzlich den Verkaufsimport unten.</p></div><div class="panel">${panelHeader("Benötigte CSV-Spalten", "Pflichtfelder und optionale Felder")}<div class="format-guide"><code>Produkt</code> Name des Artikels<br><code>Kategorie</code> Warengruppe (optional)<br><code>Menge</code> Verkaufte Einheiten<br><code>Bruttopreis</code> Verkaufspreis pro Einheit<br><code>Wareneinsatz netto</code> Direkte Warenkosten pro Einheit<br><code>USt</code> 7 oder 19 (optional; Standard 7)</div><p class="chart-note">Beispiel: <code>Cheeseburger;Burger;120;17,90;4,50;7</code></p><hr class="split-divider"><div class="steps"><div class="step"><span class="step-number">1</span><div><strong>Vorlage herunterladen</strong><p>Öffne die CSV in Excel und ergänze deine Produkte.</p></div></div><div class="step"><span class="step-number">2</span><div><strong>Als CSV speichern</strong><p>UTF-8 und Semikolon werden unterstützt.</p></div></div><div class="step"><span class="step-number">3</span><div><strong>Importieren & prüfen</strong><p>Ungültige Zeilen werden angezeigt und nicht übernommen.</p></div></div></div></div></section><div class="panel" style="margin-top:18px">${panelHeader("NEU · Verkaufsdaten nach Outlet und Monat importieren", "Bereits angelegte Produkte und Outlets per Namen zuordnen.")}<div class="actions"><button class="btn" data-action="sales-template">${I("download")} Verkaufs-CSV-Vorlage</button><button class="btn btn-primary" data-action="pick-sales-csv">${I("upload")} Verkaufs-CSV einlesen</button><input type="file" id="sales-csv-file" accept=".csv,text/csv" hidden></div><p class="chart-note">Spalten: Produkt;Outlet;Monat;Menge;Bruttopreis. Produktnamen und Outlets müssen bereits vorhanden und eindeutig sein. Zeilen werden zum Bestand hinzugefügt, niemals ungefragt überschrieben.</p></div>`
    );
  }
  function settingsView() {
    return (
      pageHeader("System", "Einstellungen", "Verwalte deinen lokalen Arbeitsbereich und sichere die Daten.") +
      demoNotice() +
      `<div class="panel form-card">${panelHeader("Betrieb & Kennzahlen")}<div class="settings-row"><strong>Bezeichnung deines Betriebs</strong><p>Wird in der Navigation angezeigt und in deinem lokalen Backup gespeichert.</p><div class="field"><input id="settings-business" maxlength="80" value="${esc(S.business)}"></div></div><div class="settings-row"><strong>Ziel-Wareneinsatz (%)</strong><p>Dieser Richtwert steuert die Warnungen in GLB Intelligence. Er ist keine automatische Branchenvorgabe.</p><div class="field"><input id="settings-target" type="text" inputmode="decimal" value="${fmt(S.targetPct)}"></div></div><button class="btn btn-primary" data-action="save-settings">${I("check")} Einstellungen speichern</button><hr class="split-divider"><div class="settings-row"><strong>Datensicherung</strong><p>Alle Artikeldaten befinden sich nur in deinem Browserprofil. Löschen von Browserdaten kann deine Änderungen vernichten. Nutze regelmäßig Backups.</p><div class="actions"><button class="btn" data-action="export-json">${I("download")} JSON-Backup herunterladen</button><button class="btn" data-action="pick-json">${I("upload")} Backup wiederherstellen</button><input type="file" id="json-file" hidden accept=".json,application/json"></div></div><div class="settings-row"><strong>Lokale Daten zurücksetzen</strong><p>Alle Änderungen werden verworfen. Anschließend kannst du mit einem leeren Betrieb oder den Beispieldaten neu starten.</p><div class="actions"><button class="btn btn-danger" data-action="start-blank">${I("trash")} Mit leerem Betrieb starten</button><button class="btn" data-action="reset-demo">${I("refresh")} Beispieldaten laden</button></div></div></div>`
    );
  }
  function roadmapView() {
    return (
      pageHeader("Modular Platform", "Die Suite wächst mit.", "Diese Module sind geplant, in Version 0.1 aber noch nicht enthalten.") +
      `<div class="roadmap-grid"><div class="roadmap-card">${I("users")}<h3>GLB Workforce</h3><p>Dienstplanung, Personalstunden, Personalkosten und Plan-Ist-Vergleich.</p></div><div class="roadmap-card">${I("trending")}<h3>GLB Forecast</h3><p>Umsatz- und Kapazitätsprognosen mit zeitbezogenen Daten.</p></div><div class="roadmap-card">${I("cart")}<h3>GLB Purchasing</h3><p>Bestellwesen, Lieferantenpreise und Lagerlogik.</p></div><div class="roadmap-card">${I("shield")}<h3>Kundenkonten</h3><p>Geschützte Anmeldung, Mandantentrennung und zentrale Datenspeicherung.</p></div><div class="roadmap-card">${I("bolt")}<h3>Echte KI</h3><p>Serverseitige KI-Auswertungen mit Kostenbegrenzung und Datenschutzprüfung.</p></div><div class="roadmap-card">${I("cart")}<h3>Shopify-Anbindung</h3><p>Abo-Prüfung, Zugriffsrechte und Freischaltungen nach Zahlung.</p></div></div>`
    );
  }
  // ---------------- v0.2 product costing, outlet reporting, lifecycle and market ----------------
  function outletBars() {
    const rows = S.outlets
      .map((o) => ({ name: o.name, id: o.id, value: C.reportSales(S.sales, S.items, { outletId: o.id }).revenueNet }))
      .sort((a, b) => b.value - a.value);
    const max = Math.max(1, ...rows.map((x) => x.value));
    return `<div class="category-bars">${rows.map((r, i) => `<div><div class="bar-label"><span>${esc(r.name)}</span><strong>${euro(r.value)}</strong></div><div class="bar-track"><div class="bar-fill alt-${i % 5}" style="width:${Math.max(0, (r.value / max) * 100)}%"></div></div></div>`).join("")}</div><p class="chart-note">Keine Umsatzschätzung: nur zugeordnete Verkaufszeilen. Alte Daten ohne Outlet erscheinen separat.</p>`;
  }
  function costingViewLegacy() {
    const rows = reportItems()
      .map(C.metrics)
      .sort((a, b) => b.revenueNet - a.revenueNet);
    return (
      pageHeader(
        "Profit Engineering",
        "Deckungsbeiträge je Produkt",
        "DB I = Netto-Verkaufspreis − Wareneinsatz inkl. Schwund. DB II = DB I − zusätzliche variable Stückkosten.",
        `<button class="btn btn-primary" data-action="new-product">${I("plus")} Produkt anlegen</button>`,
      ) +
      demoNotice() +
      `<div class="notice">${I("info")}<span><strong>Saubere Abgrenzung:</strong> Erfassung pro verkaufter Einheit, netto. Gemeinkosten und fixe Mitarbeitergehälter bleiben außerhalb der DB-Rechnung. Für alle Artikel kannst du die Kostenmaske öffnen.</span></div><div class="panel">${panelHeader("DB-Kalkulation im Sortiment", `${rows.length} Produkte · Wareneinsatz, Verpackung, variable Personalkosten, Gebühren und Sonstiges`)}${
        rows.length
          ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Produkt</th><th class="align-right">VK netto</th><th class="align-right">Wareneinsatz</th><th class="align-right">DB I/Stück</th><th class="align-right">Weitere var. Kosten</th><th class="align-right">DB II/Stück</th><th class="align-right">DB II gesamt</th><th>Bearbeiten</th></tr></thead><tbody>${rows
              .map((p) => {
                const co = C.costBreakdown(p);
                return `<tr><td><strong>${esc(p.name)}</strong><div class="micro">${esc(p.category)} · ${number(p.quantity)} verkauft</div></td><td class="align-right">${euro(p.netUnitPrice)}</td><td class="align-right">${euro(co.goodsNet)}</td><td class="align-right">${euro(p.db1Unit)}</td><td class="align-right">${euro(co.variableNet - co.goodsNet)}</td><td class="align-right"><strong class="${p.contributionUnit < 0 ? "negative" : ""}">${euro(p.contributionUnit)}</strong></td><td class="align-right">${euro(p.contribution)}</td><td><button class="btn btn-small" data-edit="${esc(p.id)}">${I("edit")} Kostenmaske</button></td></tr>`;
              })
              .join("")}</tbody></table></div>`
          : empty("Noch keine Produkte", "Lege zunächst einen Artikel an.")
      }<p class="chart-note">DB II = Produkt-Deckungsbeitrag nach direkt variablen Kosten; kein Betriebsgewinn. Werte des Produktstamms gelten im MVP auch rückwirkend für historische Verkäufe.</p></div>`
    );
  }
  function outletDetail() {
    const opts = {};
    if (OFILTER !== "all") opts.outletId = OFILTER;
    if (MFILTER !== "all") opts.month = MFILTER;
    const report = C.reportSales(S.sales, S.items, opts);
    const pids = reportItems(opts)
      .filter((x) => x.quantity > 0)
      .sort((a, b) => C.metrics(b).revenueNet - C.metrics(a).revenueNet);
    const grouped = new Map();
    for (const row of report.list) {
      const prod = stockOf(row.productId);
      const key = prod?.category || "Sonstiges";
      const o = grouped.get(key) || { quantity: 0, revenue: 0, db2: 0 };
      o.quantity += row.quantity;
      o.revenue += row.revenueNet;
      o.db2 += row.db2;
      grouped.set(key, o);
    }
    const months = [...new Set(report.list.map((x) => x.month))].sort();
    const max = Math.max(1, ...months.map((m) => report.list.filter((x) => x.month === m).reduce((a, x) => a + x.revenueNet, 0)));
    return `<section class="kpi-grid">${kpi("Netto-Umsatz", euro(report.revenueNet), "chart", "Gefilterte Verkäufe")}${kpi("DB I", euro(report.db1), "trending", "Netto-Umsatz minus Warenkosten")}${kpi("DB II", euro(report.db2), "target", "Nach direkt variablen Kosten")}${kpi("Einheiten", number(report.quantity), "layers", "Absatz im gewählten Outlet / Zeitraum")}</section><section class="content-grid"><div class="panel">${panelHeader("Umsatzentwicklung", "Pro erfasstem Zeitraum · ohne fehlende Monate als Nullwerte zu erfinden")}${
      months.length
        ? `<div class="month-bars">${months
            .map((month) => {
              const amount = report.list.filter((x) => x.month === month).reduce((a, x) => a + x.revenueNet, 0);
              return `<div class="month-bar-line"><span>${esc(periodName(month))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, (amount / max) * 100)}%"></div></div><strong>${euro(amount)}</strong></div>`;
            })
            .join("")}</div>`
        : empty("Noch kein Verlauf", "Erfasse Verkäufe mit Monatsangabe.")
    }</div><div class="panel">${panelHeader("Warengruppen", "Netto-Umsatz und DB II nach Kategorie")}${
      grouped.size
        ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Warengruppe</th><th class="align-right">Einheiten</th><th class="align-right">Umsatz</th><th class="align-right">DB II</th></tr></thead><tbody>${[
            ...grouped.entries(),
          ]
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(
              ([name, v]) =>
                `<tr><td>${esc(name)}</td><td class="align-right">${number(v.quantity)}</td><td class="align-right">${euro(v.revenue)}</td><td class="align-right">${euro(v.db2)}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : empty("Keine Verkäufe", "Wähle einen anderen Zeitraum.")
    }</div></section><div class="panel">${panelHeader("Produkt-Drilldown", "Absatz, Umsatz und DB II nach gefilterten Produkten")}${
      pids.length
        ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Produkt</th><th class="align-right">Einheiten</th><th class="align-right">Netto-Umsatz</th><th class="align-right">DB II</th><th>Analyse</th></tr></thead><tbody>${pids
            .map((x) => {
              const m = C.metrics(x);
              return `<tr><td><strong>${esc(x.name)}</strong><div class="micro">${esc(x.category)}</div></td><td class="align-right">${number(x.quantity)}</td><td class="align-right">${euro(m.revenueNet)}</td><td class="align-right">${euro(m.contribution)}</td><td><button class="btn btn-small" data-lifecycle="${esc(x.id)}">${I("trending")} Lebenszyklus</button></td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : empty("Keine Verkäufe", "Anderes Outlet oder Monat wählen.")
    }</div>`;
  }
  function outletsView() {
    return (
      pageHeader(
        "Revenue Intelligence",
        "Outlets & Umsätze",
        "Restaurant, Bar, Bankett und beliebige eigene Outlets – bis auf die Produktebene und nach Monaten.",
        `<button class="btn" data-action="new-outlet">${I("plus")} Outlet</button><button class="btn" data-view="import">${I("upload")} CSV</button><button class="btn btn-primary" data-action="new-sale">${I("plus")} Verkaufszeile</button>`,
      ) +
      demoNotice() +
      `<div class="toolbar"><div class="toolbar-left"><select id="outlet-filter" class="select" aria-label="Outlet wählen">${outletSelect(OFILTER)}</select><select id="month-filter" class="select" aria-label="Zeitraum wählen">${monthSelect(MFILTER)}</select></div><span class="micro">${S.sales.length} Verkaufszeilen vorhanden</span></div>${outletDetail()}<div class="panel" style="margin-top:18px">${panelHeader("Einzelne Verkaufszeilen", "Jede Zeile kann bearbeitet und gelöscht werden")}${
        S.sales.length
          ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Monat</th><th>Outlet</th><th>Produkt</th><th class="align-right">Menge</th><th class="align-right">VK brutto</th><th class="align-right">Umsatz netto</th><th>Aktion</th></tr></thead><tbody>${S.sales
              .filter((x) => (OFILTER === "all" || x.outletId === OFILTER) && (MFILTER === "all" || x.month === MFILTER))
              .slice()
              .sort((a, b) => b.month.localeCompare(a.month))
              .slice(0, 150)
              .map(
                (s) =>
                  `<tr><td>${esc(periodName(s.month))}</td><td>${esc(outletName(s.outletId))}</td><td>${esc(stockOf(s.productId)?.name || "Unbekannt")}</td><td class="align-right">${number(s.quantity)}</td><td class="align-right">${euro(s.grossPrice)}</td><td class="align-right">${euro(C.saleMetrics(s, stockOf(s.productId)).revenueNet)}</td><td><button class="btn btn-small btn-quiet" data-sale-edit="${esc(s.id)}">${I("edit")}</button><button class="btn btn-small btn-quiet" data-sale-delete="${esc(s.id)}">${I("trash")}</button></td></tr>`,
              )
              .join(
                "",
              )}</tbody></table></div><p class="chart-note">Maximal 150 Zeilen in der Ansicht. Filter wirken auch auf Tabelle, Diagramme und KPIs.</p>`
          : empty("Noch keine Verkäufe", "Erfasse einen ersten Monatsumsatz.")
      }</div>`
    );
  }
  function lifecycleLabel(phase) {
    return (
      {
        introduction: "Einführung",
        growth: "Wachstum",
        decline: "Rückgang",
        maturity: "Reife / stabil",
        incomplete: "Datenlücke",
        insufficient: "Nicht belastbar",
      }[phase] || phase
    );
  }
  function lifecycleView() {
    const selected = LPRODUCT || S.items[0]?.id || "";
    const product = stockOf(selected);
    const life = product ? C.lifecycle(S.sales, product.id, product.launchMonth) : null;
    const results = S.items.map((p) => ({ p, life: C.lifecycle(S.sales, p.id, p.launchMonth) }));
    const valid = results.filter((x) => ["introduction", "growth", "decline", "maturity"].includes(x.life.phase)).length;
    return (
      pageHeader(
        "Product Intelligence",
        "Produktlebenszyklus",
        "Absatztrend je Produkt aus echten Monatswerten: Wachstum, Reife oder Rückgang.",
        `<button class="btn btn-primary" data-action="new-sale">${I("plus")} Monatsabsatz erfassen</button>`,
      ) +
      demoNotice() +
      `<div class="notice">${I("info")}<span><strong>Indikator, keine Prognose:</strong> Vergleich der letzten zwei Monate mit den beiden vorherigen. Ab +20 % Wachstum, bis −20 % Rückgang, sonst stabil. Vier zusammenhängende Monatswerte für Trends nötig. Einführung nur mit hinterlegtem Startmonat; fehlende Monate gelten nicht automatisch als Null. Lebenszyklus ist damit eine operative Näherung, keine beweissichere Marktphase.</span></div><section class="kpi-grid">${kpi("Produkte", String(results.length), "layers", "Im Sortiment")}${kpi("Auswertbar", String(valid), "chart", "Mit vier zusammenhängenden Monaten")}${kpi("Wachstum", String(results.filter((x) => x.life.phase === "growth").length), "trending", "Absatz-Trendindikator")}${kpi("Rückgang", String(results.filter((x) => x.life.phase === "decline").length), "alert", "Absatz-Trendindikator")}</section><section class="content-grid"><div class="panel">${panelHeader("Einzelanalyse", "Produkt auswählen und Absatzkurve ansehen")}<div class="field"><label for="life-product">Produkt</label><select id="life-product">${selectOptions(
        S.items.map((p) => [p.id, p.name]),
        selected,
      )}</select></div>${product ? `<div class="lifecycle-callout"><span class="tag ${life.phase === "decline" ? "tag-red" : life.phase === "growth" ? "" : "tag-neutral"}">${esc(lifecycleLabel(life.phase))}</span><strong>${esc(product.name)}</strong><div class="kpi-value">${deltaLabel(life.changePct)}</div><small>${esc(life.description)}</small></div>${life.points.length ? `<div class="month-bars">${life.points.map((x) => `<div class="month-bar-line"><span>${esc(periodName(x.month))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, (x.quantity / Math.max(1, ...life.points.map((y) => y.quantity))) * 100)}%"></div></div><strong>${number(x.quantity)} Stk.</strong></div>`).join("")}</div>` : empty("Keine Monatsdaten", "Erfasse monatliche Verkäufe für dieses Produkt.")}` : empty("Keine Produkte", "Lege einen Artikel an.")}</div><div class="panel">${panelHeader("Phasen & Handlung", "Interpretation und sinnvolle Reaktion")}${life ? `<div class="insights-list"><div class="insight-card"><div class="insight-content"><h3>${esc(lifecycleLabel(life.phase))}</h3><p>${esc(life.phase === "introduction" ? "Einführung: Absatz aufbauen und zunächst echte Monatswerte sammeln; der Startmonat ist manuell hinterlegt." : life.phase === "growth" ? "Wachstum: Verfügbarkeit und Kapazität sichern; Preis- und DB-Entwicklung beobachten." : life.phase === "decline" ? "Absatzrückgang: Verfügbarkeit, Preis, Qualität, Menüpositionierung und Saisoneffekte prüfen." : life.phase === "maturity" ? "Stabiler Absatz: Marge, Upgrades und operative Effizienz optimieren." : "Noch keine tragfähige Trendklassifizierung. Monatswerte nachtragen; Datenlücken nicht als Null interpretieren.")}</p></div></div></div>` : ""}<p class="chart-note">Einführung wird nur angezeigt, wenn ein Startmonat im Produkt hinterlegt ist und der neueste Verkaufsmonat maximal zwei Monate nach dem Start liegt. Die Phase wird nicht aus einem einzelnen Absatzwert geraten.</p></div></section><div class="panel">${panelHeader("Lebenszyklus des gesamten Sortiments", "Einordnung für jedes Produkt")}${results.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Produkt</th><th>Phase</th><th class="align-right">Trend</th><th class="align-right">Monate</th><th>Details</th></tr></thead><tbody>${results.map(({ p, life }) => `<tr><td><strong>${esc(p.name)}</strong><div class="micro">${esc(p.category)}</div></td><td><span class="tag ${life.phase === "decline" ? "tag-red" : life.phase === "growth" ? "" : "tag-neutral"}">${esc(lifecycleLabel(life.phase))}</span></td><td class="align-right">${deltaLabel(life.changePct)}</td><td class="align-right">${life.months}</td><td><button class="btn btn-small" data-lifecycle="${esc(p.id)}">Details</button></td></tr>`).join("")}</tbody></table></div>` : empty("Keine Produkte", "Erst Artikel und Monatsverkäufe anlegen.")}</div>`
    );
  }
  function marketViewLegacy() {
    const rows = S.market.map((m) => {
      const product = stockOf(m.productId);
      const comp = product ? C.marketComparison(product.grossPrice, m.grossPrice, product.unit || "Portion", m.unit) : null;
      return { ...m, product, comp };
    });
    return (
      pageHeader(
        "GLB Market Intelligence",
        "Mein Markt",
        "Eigene Produkte mit konkreten Konkurrenzangeboten vergleichen – inklusive Preisquelle, Portion und Erhebungsdatum.",
        `<button class="btn btn-primary" data-action="new-competitor">${I("plus")} Konkurrenzprodukt erfassen</button>`,
      ) +
      demoNotice() +
      `<div class="notice">${I("info")}<span><strong>Keine erfundenen Live-Marktpreise:</strong> Wettbewerber und Preise werden manuell erfasst. Vergleiche sind nur belastbar, wenn Produktmenge, Leistung und Erhebungsdatum vergleichbar sind. Noch keine automatische Internetrecherche.</span></div><section class="kpi-grid">${kpi("Vergleichsangebote", String(rows.length), "target", "Manuell erfasst")}${kpi("Wettbewerber", String(new Set(rows.map((x) => x.competitor)).size), "users", "Verschiedene Unternehmen")}${kpi("Vergleichbar", String(rows.filter((x) => x.comp?.comparable).length), "check", "Gleiche Mengen-/Einheitenangabe")}${kpi("Zu prüfen", String(rows.filter((x) => !x.comp?.comparable).length), "alert", "Portionsgröße oder Preis fehlt")}</section><div class="panel">${panelHeader("Wettbewerbermatrix", "Bruttopreise, inklusive ausgewiesener Datengrundlage")}${rows.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Mein Produkt</th><th>Wettbewerber / Produkt</th><th>Größe / Einheit</th><th class="align-right">Mein VK</th><th class="align-right">Konkurrenz-VK</th><th class="align-right">Abweichung</th><th>Quelle / Datum</th><th>Aktion</th></tr></thead><tbody>${rows.map((x) => `<tr><td><strong>${esc(x.product?.name || "Gelöscht")}</strong></td><td><strong>${esc(x.competitor)}</strong><div class="micro">${esc(x.competitorProduct)}</div></td><td>${esc(x.product?.unit || "Portion")} / ${esc(x.unit || "—")}${!x.comp?.comparable ? '<div class="micro negative">Nicht direkt vergleichbar</div>' : ""}</td><td class="align-right">${euro(x.product?.grossPrice)}</td><td class="align-right">${euro(x.grossPrice)}</td><td class="align-right">${x.comp?.comparable ? deltaLabel(x.comp.differencePct) : "—"}</td><td>${x.sourceUrl ? `<a href="${esc(safeHttpUrl(x.sourceUrl))}" target="_blank" rel="noopener noreferrer">Quelle ↗</a>` : esc(x.source || "Ohne Link")}<div class="micro">${esc(x.observedAt || "Datum fehlt")}</div></td><td><button class="btn btn-small btn-quiet" data-market-edit="${esc(x.id)}">${I("edit")}</button><button class="btn btn-small btn-quiet" data-market-delete="${esc(x.id)}">${I("trash")}</button></td></tr>`).join("")}</tbody></table></div>` : empty("Noch keine Konkurrenten erfasst", "Über den Button kannst du Konkurrenzprodukte samt Quellen hinzufügen.")}<p class="chart-note">Prozentabweichung = (eigener Brutto-VK / Konkurrenz-Brutto-VK − 1) × 100. Größere Leistungsunterschiede können einen Vergleich entwerten.</p></div>`
    );
  }
  function safeHttpUrl(url) {
    try {
      const u = new URL(url);
      return ["https:", "http:"].includes(u.protocol) ? u.toString() : "#";
    } catch {
      return "#";
    }
  }
  function formModal(title, inner, form) {
    document.querySelector("#modal-layer").innerHTML =
      `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><h2>${esc(title)}</h2><button class="close-btn" data-action="close-modal" aria-label="Schließen">×</button></div><form id="${esc(form)}">${inner}<div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Abbrechen</button><button class="btn btn-primary" type="submit">${I("check")} Speichern</button></div></form></div>`;
    const node = document.querySelector("#" + form);
    if (node)
      node.addEventListener("submit", (e) => {
        e.preventDefault();
        if (form === "product-form") saveProduct(node);
        else if (form === "sale-form") saveSale(node);
        else if (form === "market-form") saveMarket(node);
        else if (form === "outlet-form") saveOutlet(node);
        else if (form === "funnel-form") saveFunnel(node);
        else if (form === "parent-group-form") saveParentGroup(node);
      });
  }
  function saleModal(id) {
    if (!S.items.length) return toast("Bitte zuerst ein Produkt anlegen.", "error");
    const old = S.sales.find((x) => x.id === id),
      v = old || {
        id: "",
        productId: S.items[0].id,
        outletId: "restaurant",
        month: new Date().toISOString().slice(0, 7),
        quantity: 0,
        grossPrice: S.items[0].grossPrice,
      };
    formModal(
      old ? "Verkauf bearbeiten" : "Verkaufszeile erfassen",
      `<input type="hidden" name="id" value="${esc(v.id)}"><div class="field-grid"><div class="field"><label>Produkt *</label><select name="productId">${selectOptions(
        S.items.map((p) => [p.id, p.name]),
        v.productId,
      )}</select></div><div class="field"><label>Outlet *</label><select name="outletId">${outletSelect(v.outletId, false)}</select></div><div class="field"><label>Monat (JJJJ-MM) *</label><input name="month" placeholder="2026-10 oder undated" required value="${esc(v.month)}"><small>Für Altdaten ohne Zeitraum: undated</small></div><div class="field"><label>Absatzmenge *</label><input name="quantity" type="number" min="0" step="1" required value="${esc(v.quantity)}"></div><div class="field"><label>Brutto-VK im Zeitraum (€) *</label><input name="grossPrice" inputmode="decimal" required value="${fmt(v.grossPrice)}"></div></div><p class="calc-note">USt und direkte Stückkosten werden aus dem Produktstamm übernommen. Historische Kosten und Steuersätze sind in diesem MVP noch nicht versioniert.</p>`,
      "sale-form",
    );
  }
  function competitorModal(id) {
    if (!S.items.length) return toast("Bitte zuerst ein eigenes Produkt erfassen.", "error");
    const old = S.market.find((x) => x.id === id),
      v = old || {
        id: "",
        productId: S.items[0].id,
        competitor: "",
        competitorProduct: "",
        unit: "Portion",
        grossPrice: 0,
        observedAt: new Date().toISOString().slice(0, 10),
        sourceUrl: "",
        source: "",
      };
    formModal(
      old ? "Vergleich bearbeiten" : "Konkurrenzprodukt erfassen",
      `<input type="hidden" name="id" value="${esc(v.id)}"><div class="field-grid"><div class="field"><label>Mein Produkt *</label><select name="productId">${selectOptions(
        S.items.map((p) => [p.id, p.name]),
        v.productId,
      )}</select></div><div class="field"><label>Wettbewerber *</label><input name="competitor" maxlength="100" required value="${esc(v.competitor)}"></div><div class="field"><label>Konkurrenzprodukt *</label><input name="competitorProduct" maxlength="120" required value="${esc(v.competitorProduct)}"></div><div class="field"><label>Portion / Einheit *</label><input name="unit" maxlength="80" required value="${esc(v.unit)}" placeholder="z. B. 250 g oder Portion"></div><div class="field"><label>Bruttopreis (€) *</label><input name="grossPrice" inputmode="decimal" required value="${fmt(v.grossPrice)}"></div><div class="field"><label>Erhoben am *</label><input name="observedAt" type="date" required value="${esc(v.observedAt)}"></div><div class="field"><label>Quellenlink (optional)</label><input name="sourceUrl" type="url" placeholder="https://..." value="${esc(v.sourceUrl)}"></div><div class="field"><label>Quelle / Hinweis</label><input name="source" maxlength="300" value="${esc(v.source)}" placeholder="Speisekarte, Datum, Besonderheiten"></div></div>`,
      "market-form",
    );
  }
  function saveSale(form) {
    const f = new FormData(form),
      productId = String(f.get("productId")),
      outletId = String(f.get("outletId")),
      month = String(f.get("month")).trim(),
      qty = C.parseNumberDE(f.get("quantity")),
      price = C.parseNumberDE(f.get("grossPrice")),
      id = String(f.get("id") || "");
    if (
      !stockOf(productId) ||
      !S.outlets.some((x) => x.id === outletId) ||
      !(month === "undated" || /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) ||
      !Number.isInteger(qty) ||
      qty < 0 ||
      !Number.isFinite(price) ||
      price < 0
    )
      return toast("Verkauf: Angaben prüfen. Monat JJJJ-MM oder undated.", "error");
    const v = { id: id || uid(), productId, outletId, month, quantity: qty, grossPrice: price };
    const ix = S.sales.findIndex((x) => x.id === id);
    if (ix >= 0) S.sales[ix] = v;
    else S.sales.push(v);
    markEdited();
    persist();
    closeModal();
    render();
    toast("Verkauf gespeichert.");
  }
  function saveMarket(form) {
    const f = new FormData(form),
      id = String(f.get("id") || ""),
      productId = String(f.get("productId")),
      competitor = String(f.get("competitor")).trim(),
      competitorProduct = String(f.get("competitorProduct")).trim(),
      unit = String(f.get("unit")).trim(),
      grossPrice = C.parseNumberDE(f.get("grossPrice")),
      observedAt = String(f.get("observedAt")),
      sourceUrl = String(f.get("sourceUrl")).trim(),
      source = String(f.get("source")).trim();
    if (
      !stockOf(productId) ||
      !competitor ||
      !competitorProduct ||
      !unit ||
      !Number.isFinite(grossPrice) ||
      grossPrice <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(observedAt) ||
      (sourceUrl && !/^https?:\/\//i.test(sourceUrl))
    )
      return toast("Vergleichsdaten prüfen, Preis > 0 und Datum setzen.", "error");
    const row = { id: id || uid(), productId, competitor, competitorProduct, unit, grossPrice, observedAt, sourceUrl, source };
    const ix = S.market.findIndex((x) => x.id === id);
    if (ix >= 0) S.market[ix] = row;
    else S.market.push(row);
    markEdited();
    persist();
    closeModal();
    render();
    toast("Konkurrenzprodukt gespeichert.");
  }
  function outletModal() {
    formModal(
      "Neues Outlet",
      `<div class="field"><label>Outletname *</label><input name="name" required maxlength="80" placeholder="z. B. Terrasse, Catering, Tagung"></div>`,
      "outlet-form",
    );
  }
  function saveOutlet(form) {
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name || name.length > 80 || S.outlets.some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return toast("Outletname fehlt oder ist bereits vorhanden.", "error");
    S.outlets.push({ id: uid(), name });
    markEdited();
    persist();
    closeModal();
    render();
    toast("Outlet hinzugefügt.");
  }
  const SALES_TEMPLATE = "Produkt;Outlet;Monat;Menge;Bruttopreis\nClassic Cheeseburger;Restaurant;2026-09;15;17,90\n";
  function parseSalesCSV(content) {
    const lines = C.parseDelimited(String(content).replace(/^\uFEFF/, ""), String(content).split(/\r?\n/)[0].includes(";") ? ";" : ",");
    if (lines.length < 2) throw Error("Kopfzeile und Verkaufsdaten fehlen.");
    const norm = (s) =>
      String(s)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    const heads = lines[0].map(norm);
    const find = (...aliases) => heads.findIndex((x) => aliases.includes(x));
    const ix = {
      name: find("produkt", "artikel", "produktname"),
      outlet: find("outlet", "bereich"),
      month: find("monat", "zeitraum", "periode"),
      quantity: find("menge", "anzahl", "absatz", "verkauft"),
      price: find("bruttopreis", "vkbrutto", "verkaufspreis"),
    };
    if (Object.values(ix).some((v) => v < 0)) throw Error("Erwartete Spalten: Produkt, Outlet, Monat, Menge, Bruttopreis.");
    const rows = [],
      errors = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i],
        name = String(row[ix.name] || "").trim(),
        outlet = String(row[ix.outlet] || "").trim(),
        month = String(row[ix.month] || "").trim(),
        qty = C.parseNumberDE(row[ix.quantity]),
        price = C.parseNumberDE(row[ix.price]);
      const matches = S.items.filter((p) => p.name.toLowerCase() === name.toLowerCase()),
        o = S.outlets.find((x) => x.name.toLowerCase() === outlet.toLowerCase());
      if (
        matches.length !== 1 ||
        !o ||
        !(/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month === "undated") ||
        !Number.isInteger(qty) ||
        qty < 0 ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        errors.push("Zeile " + (i + 1) + ": Artikel (eindeutiger Name), Outlet, Monat, Menge oder Preis ungültig");
        continue;
      }
      rows.push({ id: uid(), productId: matches[0].id, outletId: o.id, month, quantity: qty, grossPrice: price });
    }
    return { rows, errors };
  }
  async function handleSalesCSV(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("Maximal 5 MB CSV.", "error");
    try {
      const d = parseSalesCSV(await file.text());
      if (!d.rows.length) throw Error("Keine gültigen Verkaufsdaten gefunden.");
      if (
        !confirm(
          `${d.rows.length} Verkaufszeilen hinzufügen? ${d.errors.length} Zeilen mit Fehlern (werden übersprungen).${d.errors.length ? "\n" + d.errors.slice(0, 3).join("\n") : ""}`,
        )
      )
        return;
      S.sales.push(...d.rows);
      markEdited();
      persist();
      render();
      toast(`${d.rows.length} Verkaufszeilen importiert.`);
    } catch (e) {
      toast("Verkaufs-CSV: " + e.message, "error");
    }
  }
  // ===== GLB AI SUITE 0.3: cost control, portfolio actions, catalog, funnel, discovery =====
  let COST_MONTH = "2026-09",
    GROUPFILTER = "all",
    PRODUCT_SORT = "revenue",
    PRODUCT_OUTLET = "all",
    PRODUCT_MONTH = "all";
  let FOUTLET = "all",
    FSTART = "",
    FEND = "";
  const funKey = (id) => C.FUNNEL_STEPS.find((x) => x.id === id)?.label || id;
  const funnelDefaults = () => ({
    aperitif: { priceGross: 8.9, vat: 19, variableNet: 2.2 },
    water: { priceGross: 6.5, vat: 19, variableNet: 1.1 },
    upgrades: { priceGross: 5.5, vat: 7, variableNet: 1.4 },
    sides: { priceGross: 5.5, vat: 7, variableNet: 1.5 },
    desserts: { priceGross: 10.2, vat: 7, variableNet: 2.8 },
    coffee: { priceGross: 3.9, vat: 19, variableNet: 0.75 },
  });
  const demoFunnel = () => [
    {
      id: "f1",
      date: "2026-09-21",
      outletId: "restaurant",
      covers: 68,
      aperitif: 8,
      water: 17,
      upgrades: 12,
      sides: 18,
      desserts: 10,
      coffee: 16,
    },
    {
      id: "f2",
      date: "2026-09-22",
      outletId: "restaurant",
      covers: 47,
      aperitif: 3,
      water: 9,
      upgrades: 8,
      sides: 10,
      desserts: 5,
      coffee: 12,
    },
    {
      id: "f3",
      date: "2026-09-23",
      outletId: "restaurant",
      covers: 83,
      aperitif: 10,
      water: 24,
      upgrades: 16,
      sides: 19,
      desserts: 12,
      coffee: 21,
    },
    {
      id: "f4",
      date: "2026-09-24",
      outletId: "restaurant",
      covers: 59,
      aperitif: 4,
      water: 13,
      upgrades: 9,
      sides: 16,
      desserts: 7,
      coffee: 18,
    },
    {
      id: "f5",
      date: "2026-09-25",
      outletId: "restaurant",
      covers: 78,
      aperitif: 6,
      water: 23,
      upgrades: 19,
      sides: 14,
      desserts: 13,
      coffee: 20,
    },
    {
      id: "f6",
      date: "2026-09-26",
      outletId: "restaurant",
      covers: 95,
      aperitif: 12,
      water: 31,
      upgrades: 26,
      sides: 29,
      desserts: 21,
      coffee: 28,
    },
    {
      id: "f7",
      date: "2026-09-27",
      outletId: "restaurant",
      covers: 64,
      aperitif: 4,
      water: 16,
      upgrades: 13,
      sides: 14,
      desserts: 9,
      coffee: 15,
    },
  ];
  function ensureV03() {
    S.monthlyCosts ||= {};
    S.parentGroups ||= ["Küche", "Getränke", "Zusatzverkauf"];
    S.categoryGroups ||= {};
    S.funnel ||= S.mode === "demo" ? demoFunnel() : [];
    S.funnelAssumptions ||= funnelDefaults();
    S.funnelGoals ||= { aperitif: 25, water: 40, upgrades: 35, sides: 40, desserts: 28, coffee: 45 };
    S.funnelTrafficLift ??= 0;
    S.funnelProjectedDays ??= 26;
    S.marketLocation ||= { label: "Düren (Beispiel-Standort)", lat: 50.804, lon: 6.485 };
    S.marketDiscovered ||= [];
    S.marketLastScan ||= "";
    S.profitTarget ??= 10;
    if (S.mode === "demo" && !Object.keys(S.categoryGroups).length) {
      Object.assign(S.categoryGroups, {
        Burger: "Küche",
        Grill: "Küche",
        "Bowl & Salat": "Küche",
        Sides: "Küche",
        Dessert: "Küche",
        Getränke: "Getränke",
        Upgrades: "Zusatzverkauf",
      });
    }
  }
  ensureV03();
  function monthlyReport(month) {
    return C.reportSales(S.sales, S.items, { month });
  }
  function activeMonthlyCosts() {
    const model = C.monthlyCostModel(S.monthlyCosts[COST_MONTH] || {}, monthlyReport(COST_MONTH).revenueNet);
    if (!Object.prototype.hasOwnProperty.call(S.monthlyCosts, COST_MONTH)) model.fixedRate = null;
    return model;
  }
  function groupOf(p) {
    return S.categoryGroups[p.category] || "Nicht zugeordnet";
  }
  function monthlyBarChart(monthRows, title = "Monatsentwicklung") {
    if (!monthRows.length) return empty("Keine Zeitreihe", "Erfasse monatliche Verkaufszahlen.");
    const max = Math.max(1, ...monthRows.map((x) => x.value));
    return `<div class="glb-bars" aria-label="${esc(title)}">${monthRows.map((x) => `<div class="glb-bar-row"><span>${esc(x.label)}</span><div class="glb-bar-track"><div style="width:${Math.max(0, (x.value / max) * 100)}%" class="glb-bar-fill"></div></div><strong>${euro(x.value)}</strong></div>`).join("")}</div>`;
  }
  function chartForSales(sales) {
    const data = C.reportSales(sales, S.items).list,
      sums = new Map();
    for (const r of data) {
      const m = r.month || "undated";
      sums.set(m, (sums.get(m) || 0) + r.revenueNet);
    }
    return monthlyBarChart(
      [...sums]
        .filter(([x]) => x !== "undated")
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([m, value]) => ({ label: m, value })),
      "Netto-Umsatz je Monat",
    );
  }
  function productRowsFiltered() {
    const opts = {};
    if (PRODUCT_OUTLET !== "all") opts.outletId = PRODUCT_OUTLET;
    if (PRODUCT_MONTH !== "all") opts.month = PRODUCT_MONTH;
    const agg = C.reportSales(S.sales, S.items, opts).list,
      map = new Map();
    for (const r of agg) {
      const o = map.get(r.productId) || { quantity: 0, revenueNet: 0, db2: 0 };
      o.quantity += r.quantity;
      o.revenueNet += r.revenueNet;
      o.db2 += r.db2;
      map.set(r.productId, o);
    }
    const rows = S.items
      .map((p) => {
        const a = map.get(p.id) || { quantity: 0, revenueNet: 0, db2: 0 };
        return { ...p, ...a, category: p.category, group: groupOf(p), dbPerUnit: C.metrics(p).contributionUnit };
      })
      .filter(
        (p) =>
          (GROUPFILTER === "all" || p.group === GROUPFILTER) &&
          (CAT === "all" || p.category === CAT) &&
          p.name.toLowerCase().includes(FILTER.toLowerCase()),
      );
    const sorting = {
      revenue: (a, b) => b.revenueNet - a.revenueNet,
      quantity: (a, b) => b.quantity - a.quantity,
      db: (a, b) => b.db2 - a.db2,
      margin: (a, b) => b.dbPerUnit - a.dbPerUnit,
      name: (a, b) => a.name.localeCompare(b.name, "de"),
    };
    return rows.sort(sorting[PRODUCT_SORT] || sorting.revenue);
  }
  function productDetailedRows(items) {
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Artikel / Gruppe</th><th class="align-right">Absatz</th><th class="align-right">VK brutto</th><th class="align-right">DB II / Stk.</th><th class="align-right">Umsatz netto</th><th class="align-right">DB II gesamt</th><th></th></tr></thead><tbody>${items
      .slice(0, 1000)
      .map(
        (p) =>
          `<tr><td><strong>${esc(p.name)}</strong><div class="micro">${esc(p.group)} / ${esc(p.category)}</div></td><td class="align-right">${number(p.quantity)}</td><td class="align-right">${euro(p.grossPrice)}</td><td class="align-right">${euro(p.dbPerUnit)}</td><td class="align-right">${euro(p.revenueNet)}</td><td class="align-right">${euro(p.db2)}</td><td><button class="btn btn-small btn-quiet" data-edit="${esc(p.id)}">${I("edit")}</button></td></tr>`,
      )
      .join("")}</tbody></table></div>`;
  }
  function productsView() {
    const rows = productRowsFiltered(),
      cats = [...new Set(S.items.map((p) => p.category))].sort(),
      groups = ["Nicht zugeordnet", ...S.parentGroups];
    const allowedIds = new Set(rows.map((p) => p.id));
    const selectedSales = S.sales.filter(
      (s) =>
        allowedIds.has(s.productId) &&
        (PRODUCT_OUTLET === "all" || s.outletId === PRODUCT_OUTLET) &&
        (PRODUCT_MONTH === "all" || s.month === PRODUCT_MONTH),
    );
    const rev = rows.reduce((a, p) => a + p.revenueNet, 0),
      qty = rows.reduce((a, p) => a + p.quantity, 0);
    const best = rows
      .slice()
      .sort((a, b) => b.revenueNet - a.revenueNet)
      .slice(0, 8);
    return (
      pageHeader(
        "Revenue Intelligence",
        "Artikel & Umsätze",
        "Sortierbare Produktauswertung mit Umsatz-/Absatzdiagrammen und einer Oberkategorien-Struktur.",
        `<button class="btn" data-view="groups">${I("layers")} Oberkategorien</button><button class="btn btn-primary" data-action="new-product">${I("plus")} Artikel</button>`,
      ) +
      demoNotice() +
      `<div class="toolbar"><div class="toolbar-left"><input class="search-input" id="product-search" placeholder="Artikel suchen" value="${esc(FILTER)}"><select id="product-group-filter" class="select">${selectOptions([["all", "Alle Oberkategorien"], ...groups.map((g) => [g, g])], GROUPFILTER)}</select><select id="product-category" class="select">${selectOptions([["all", "Alle Warengruppen"], ...cats.map((c) => [c, c])], CAT)}</select><select id="product-outlet-filter" class="select">${outletSelect(PRODUCT_OUTLET)}</select><select id="product-month-filter" class="select">${monthSelect(PRODUCT_MONTH)}</select><select id="product-sort" class="select">${selectOptions(
        [
          ["revenue", "Umsatz absteigend"],
          ["quantity", "Absatz absteigend"],
          ["db", "Gesamt-DB absteigend"],
          ["margin", "DB je Stück"],
          ["name", "Artikel A–Z"],
        ],
        PRODUCT_SORT,
      )}</select></div></div><section class="kpi-grid">${kpi("Netto-Umsatz", euro(rev), "chart", "Artikel- und Outletfilter")}${kpi("Absatz", number(qty), "layers", "Verkaufte Einheiten")}${kpi("Deckungsbeitrag II", euro(rows.reduce((a, p) => a + p.db2, 0)), "trending", "Ohne Monatsfixkosten")}${kpi("Produkte", number(rows.length), "layers", "Gefiltertes Sortiment")}</section><section class="content-grid"><div class="panel">${panelHeader("Top-Artikel nach Nettoumsatz", "Mit aktueller Filterauswahl")}${monthlyBarChart(best.map((p) => ({ label: p.name.slice(0, 22), value: p.revenueNet })))}</div><div class="panel">${panelHeader("Monatstrend", "Umsätze aller aktuell ausgewählten Outlets")}${chartForSales(selectedSales)}</div></section><div class="panel table-shell" style="margin-top:20px">${panelHeader("Detaillierte Artikelliste", `Sortierung: ${PRODUCT_SORT === "quantity" ? "Verkäufe" : "Wert"} · ${rows.length} Artikel`)}${rows.length ? productDetailedRows(rows) : empty("Keine Artikel", "Filter zurücksetzen oder Verkäufe erfassen.")}</div><p class="chart-note">Historische Verkäufe verwenden derzeit die aktuellen Produktkosten, nicht historisierte Rezeptpreise. Summen nach Warengruppe sind daher kalkulatorisch.</p>`
    );
  }
  function groupsView() {
    const cats = [...new Set(S.items.map((x) => x.category))].sort(),
      all = [...S.parentGroups];
    return (
      pageHeader(
        "Sortimentstruktur",
        "Oberkategorien",
        "Beliebig viele Warengruppen zu übergeordneten Bereichen zusammenfassen.",
        `<button class="btn btn-primary" data-action="add-parent-group">${I("plus")} Oberkategorie hinzufügen</button>`,
      ) +
      demoNotice() +
      `<div class="panel">${panelHeader("Warengruppen zuordnen", "Eine Änderung gilt sofort für sämtliche Produkte dieser Warengruppe.")}${cats.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Warengruppe</th><th class="align-right">Artikel</th><th>Oberkategorie</th></tr></thead><tbody>${cats.map((cat) => `<tr><td><strong>${esc(cat)}</strong></td><td class="align-right">${number(S.items.filter((p) => p.category === cat).length)}</td><td><select class="select" data-group-category="${esc(cat)}">${selectOptions([["", "Nicht zugeordnet"], ...all.map((x) => [x, x])], S.categoryGroups[cat] || "")}</select></td></tr>`).join("")}</tbody></table></div>` : empty("Keine Kategorien", "Lege Produkte an.")}</div><div class="panel" style="margin-top:20px">${panelHeader("Oberkategorien", "Das Reporting übernimmt diese Zuordnung automatisch.")}${all.map((g) => `<span class="tag tag-neutral" style="margin-right:8px">${esc(g)} · ${S.items.filter((p) => groupOf(p) === g).length} Artikel</span>`).join(" ")}</div>`
    );
  }
  function costingView() {
    const months = [...new Set([...Object.keys(S.monthlyCosts), ...periods().filter((x) => x !== "undated")])].sort().reverse();
    if (!months.includes(COST_MONTH)) months.unshift(COST_MONTH);
    const d = S.monthlyCosts[COST_MONTH] || { energy: 0, payroll: 0, overhead: 0, goods: 0, revenueOverrideNet: 0 };
    const m = activeMonthlyCosts();
    const list = S.items.map((p) => ({ p, ...C.targetPriceModel(p, m, S.profitTarget) }));
    const netMonthly = monthlyReport(COST_MONTH),
      actualGoodsPct = netMonthly.revenueNet ? (netMonthly.goodsNet / netMonthly.revenueNet) * 100 : null;
    return (
      pageHeader(
        "Profit Engineering",
        "Deckungsbeiträge & Zielpreise",
        "Monatskosten einmal erfassen. Die Kalkulation zeigt für sämtliche Artikel aktuellen und erforderlichen VK nebeneinander.",
        `<button class="btn" data-view="calculator">${I("calculator")} Einzelrezept</button><button class="btn btn-primary" data-action="save-month-costs">${I("check")} Monatskosten speichern</button>`,
      ) +
      demoNotice() +
      `<div class="notice">${I("info")}<span><strong>Methodik:</strong> DB I/II berücksichtigen nur variable Produktkosten. Monatliche Energie, festes Payroll und Sachkosten werden für eine <strong>kalkulatorische Zielpreisquote</strong> ins Verhältnis zum Netto-Umsatz gesetzt. Der separat eingegebene Monats-Wareneinsatz wird nicht noch einmal von den Artikel-DBs abgezogen.</span></div><div class="panel"><div class="toolbar"><div class="toolbar-left"><label for="cost-month">Abrechnungsmonat</label><select class="select" id="cost-month">${selectOptions(
        months.map((x) => [x, periodName(x)]),
        COST_MONTH,
      )}</select></div><span class="micro">Netto-Basis aus erfassten Verkäufen; ggf. manuell überschreiben.</span></div><div class="field-grid glb-cost-grid">${[
        ["energy", "Energie € / Monat"],
        ["payroll", "Payroll fix € / Monat"],
        ["overhead", "Sach- und übrige Fixkosten € / Monat"],
        ["goods", "Monatlicher Wareneinsatz € (Abgleich)"],
        ["revenueOverrideNet", "Netto-Gesamtumsatz € (optional)"],
        ["profit", "Ziel-Betriebsergebnis in %"],
      ]
        .map(
          ([key, label]) =>
            `<div class="field"><label>${esc(label)}</label><input class="cost-month-input" data-key="${key}" inputmode="decimal" value="${esc(fmt(key === "profit" ? S.profitTarget : d[key] || 0))}"></div>`,
        )
        .join(
          "",
        )}</div><p class="chart-note">Achtung: Payroll hier nur, soweit nicht bereits als direkte variable Arbeitszeit pro Portion eingerechnet. Gesamtkosten aus eigener Buchhaltung und Netto-Umsatz müssen denselben Monat und dieselben Outlets abdecken. Preise gelten modellhaft für einen konstanten Umsatzmix.</p></div><section class="kpi-grid">${kpi("Netto-Umsatzbasis", euro(m.turnover), "chart", d.revenueOverrideNet > 0 ? "Manuell hinterlegt" : "Aus Verkaufszeilen")}${kpi("Fixkosten gesamt", euro(m.fixed), "calculator", "Energie + Payroll + Sachkosten")}${kpi("Fixkostenquote", m.fixedRate === null ? "—" : pct(100 * m.fixedRate), "trending", "Fixkosten / Netto-Umsatz")}${kpi("Betrieblicher Zielgewinn", pct(S.profitTarget), "target", "Netto-Umsatz-Basis")}</section><div class="panel" style="margin-bottom:18px">${panelHeader("Kostenstruktur des Monats", "Kosten je Kostenblock als Anteil am Netto-Umsatz")}${
        S.monthlyCosts[COST_MONTH] && m.turnover > 0
          ? `<div class="glb-bars">${[
              ["Energie", m.energy],
              ["Payroll fix", m.payroll],
              ["Sachkosten", m.overhead],
              ["Wareneinsatz Buchhaltung", m.goods],
            ]
              .map(
                ([label, value]) =>
                  `<div class="glb-bar-row"><span>${esc(label)}</span><div class="glb-bar-track"><div class="glb-bar-fill" style="width:${Math.min(100, (value / m.turnover) * 100)}%"></div></div><strong>${pct((value / m.turnover) * 100)}</strong></div>`,
              )
              .join(
                "",
              )}</div><p class="chart-note">Summe der erfassten Kostenblöcke: ${pct(m.totalRate * 100)} des Netto-Umsatzes. Der Wareneinsatz ist für den Abgleich, nicht für einen zweiten Abzug in der Artikel-Zielpreiskalkulation.</p>`
          : empty("Kostenquoten noch nicht berechenbar", "Monatskosten und dazugehörigen Umsatz hinterlegen.")
      }</div>${m.fixedRate === null ? `<div class="notice">Für diesen Monat sind noch keine Fixkosten gespeichert oder der Umsatz fehlt. Bitte die Monatskosten hinterlegen und speichern, damit valide Zielpreise berechnet werden.</div>` : m.fixedRate + S.profitTarget / 100 >= 1 ? `<div class="notice">Zielpreiskalkulation derzeit nicht möglich: Fixkostenquote und Zielergebnis erreichen zusammen mindestens 100 %. Prüfe Kostenbasis, Umsatzabdeckung oder Zielmarge.</div>` : ""}<div class="panel">${panelHeader("Alle Produkte: aktueller Preis vs. Zielpreis", "Zielpreis = variable Netto-Stückkosten / (1 − Fixkostenquote − Zielgewinnquote) × (1 + USt)")}${list.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Artikel</th><th>Oberkategorie</th><th class="align-right">Warenkosten / Stk.</th><th class="align-right">DB I / Stk.</th><th class="align-right">DB II / Stk.</th><th class="align-right">Aktueller VK brutto</th><th class="align-right">Ziel-VK brutto</th><th class="align-right">Differenz brutto</th><th>Aktion</th></tr></thead><tbody>${list.map((x) => `<tr><td><strong>${esc(x.p.name)}</strong><div class="micro">${esc(x.p.category)}</div></td><td>${esc(groupOf(x.p))}</td><td class="align-right">${euro(C.costBreakdown(x.p).goodsNet)}</td><td class="align-right">${euro(x.db1Net)}</td><td class="align-right">${euro(x.db2Net)}</td><td class="align-right">${euro(x.gross)}</td><td class="align-right"><strong>${x.targetGross === null ? "—" : euro(x.targetGross)}</strong></td><td class="align-right ${x.deltaGross > 0 ? "negative" : ""}">${x.deltaGross === null ? "—" : (x.deltaGross > 0 ? "+" : "") + euro(x.deltaGross)}</td><td><button class="btn btn-small" data-edit="${esc(x.p.id)}">Produkt</button></td></tr>`).join("")}</tbody></table></div>` : empty("Keine Produkte", "Lege Produkte an, um alle Zielpreise zu sehen.")}<p class="chart-note">Die Übersicht ändert keine aktuellen Verkaufspreise automatisch. Eine 1:1-Zuordnung von Gemeinkosten zu Artikeln wäre Scheingenauigkeit; der Zuschlag dient zur Szenariokalkulation und nicht als tatsächlicher Stück-DB.</p></div><div class="panel" style="margin-top:18px">${panelHeader("Wareneinsatzprüfung", "Buchhaltungswert gegen kalkulierte Verkaufskosten")}${kpi("Wareneinsatz aus Produktkalkulation", euro(netMonthly.goodsNet), "calculator", "Aktuelle Rezeptkosten × verkaufte Mengen")}${kpi("Buchhalterischer Wareneinsatz", S.monthlyCosts[COST_MONTH] ? euro(m.goods) : "—", "calculator", "Manueller Monatswert")}${kpi("Abweichung", S.monthlyCosts[COST_MONTH] ? euro(m.goods - netMonthly.goodsNet) : "—", "alert", "Manuell minus kalkuliert")}${kpi("WE-Quote aus Verkäufen", actualGoodsPct === null ? "—" : pct(actualGoodsPct), "chart", "Produktspezifisch, netto")}</div>`
    );
  }
  function portfolioView() {
    const list = C.productActions(reportItems()),
      q = QFILTER === "all" ? list : list.filter((p) => p.quadrant === QFILTER);
    return (
      pageHeader(
        "Menu Engineering",
        "Renner & Penner – Aktionsplan",
        "Konkrete Maßnahmen pro Artikel, priorisiert nach Absatz und Deckungsbeitrag.",
        `<button class="btn" data-view="costs">${I("calculator")} Zielpreise prüfen</button>`,
      ) +
      demoNotice() +
      `<div class="notice">${I("info")}<span>Die Quadranten sind relativ zum aktuellen Sortiment, auf Basis des Medians von Absatz und DB II je Stück. Empfehlungen sind Hypothesen für Praxistests, keine garantierte Umsatzsteigerung.</span></div><div class="toolbar"><div class="toolbar-left"><select id="quadrant-filter" class="select">${selectOptions(
        [
          ["all", "Alle"],
          ["star", "Stars"],
          ["runner", "Renner"],
          ["sleeper", "Schläfer"],
          ["loser", "Penner"],
        ],
        QFILTER,
      )}</select></div><span class="micro">${q.length} Artikel</span></div><section class="content-grid"><div class="panel">${panelHeader("Renner-Penner-Matrix", "Ein Produkt anklicken, um dessen Kosten zu bearbeiten.")}${scatter(reportItems())}</div><div class="panel">${panelHeader("Priorisierte Schritte", "Was genau im operativen Betrieb zu testen ist")}${q
        .slice(0, 7)
        .map(
          (p) =>
            `<div class="glb-action"><span class="tag ${tagClass(p.quadrant)}">${tagName(p.quadrant)}</span><strong>${esc(p.name)}</strong><p>${esc(p.action)}</p><small>Absatz ${number(p.quantity)} · DB II/Stk. ${euro(p.contributionUnit)}</small></div>`,
        )
        .join(
          "",
        )}</div></section><div class="panel" style="margin-top:18px">${panelHeader("Alle konkreten Handlungsempfehlungen", "Nach einer Testperiode Verkauf und DB II erneut vergleichen.")}${q.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Artikel</th><th>Typ</th><th class="align-right">Absatz</th><th class="align-right">DB II / Stück</th><th>Empfohlene Änderung</th><th>Erfolgskontrolle</th><th></th></tr></thead><tbody>${q.map((p) => `<tr><td><strong>${esc(p.name)}</strong></td><td><span class="tag ${tagClass(p.quadrant)}">${tagName(p.quadrant)}</span></td><td class="align-right">${number(p.quantity)}</td><td class="align-right">${euro(p.contributionUnit)}</td><td>${esc(p.action)}${p.quadrant === "runner" ? `<div class="micro">Preis-Test +5 %: ${euro(p.grossPrice * 1.05)} brutto · bei unverändertem Absatz rechnerisch +${euro((p.quantity * (p.grossPrice * 0.05)) / (1 + p.vat / 100))} DB II.</div>` : ""}</td><td>${esc(p.test)}</td><td><button class="btn btn-small" data-edit="${esc(p.id)}">Bearbeiten</button></td></tr>`).join("")}</tbody></table></div>` : empty("Keine Artikel", "Passe den Filter an.")}</div>`
    );
  }
  function filteredFunnelRows() {
    return S.funnel
      .filter((x) => (FOUTLET === "all" || x.outletId === FOUTLET) && (!FSTART || x.date >= FSTART) && (!FEND || x.date <= FEND))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  function funnelCalcFromDOM() {
    const goals = { ...S.funnelGoals },
      traffic = Number(document.querySelector("#funnel-traffic")?.value ?? S.funnelTrafficLift);
    for (const step of C.FUNNEL_STEPS) {
      const e = document.querySelector(`[data-funnel-goal="${step.id}"]`);
      if (e) goals[step.id] = Number(e.value);
    }
    return { goals, traffic };
  }
  function funnelResults() {
    const { goals, traffic } = funnelCalcFromDOM(),
      r = C.funnelSummary(filteredFunnelRows(), S.funnelAssumptions, goals, traffic);
    const fmtDelta = (x) => (x >= 0 ? "+" : "") + euro(x);
    const serviceDays = filteredFunnelRows().length;
    const monthlyFactor = serviceDays ? S.funnelProjectedDays / serviceDays : 0;
    return `<section class="kpi-grid">${kpi("Erfasste Gäste / Covers", number(r.covers), "users", "Gewählter Zeitraum")}${kpi("Szenario Umsatzveränderung", fmtDelta(r.incrementalRevenueNet), "chart", "Netto, Szenario")}${kpi("Szenario DB-II-Veränderung", fmtDelta(r.incrementalDB2), "trending", "Vor Fixkosten")}${kpi("Monatlicher Zusatz-DB II", fmtDelta(r.incrementalDB2 * monthlyFactor), "target", S.funnelProjectedDays + " Betriebstage (modellhaft)")}</section><div class="panel" style="margin-bottom:18px">${panelHeader("Monatliche Hochrechnung", "Aus Durchschnitt pro beobachtetem Outlet-Tag × geplante Outlet-Tage")}${kpi("Monatliches Zusatz-Netto", fmtDelta(r.incrementalRevenueNet * monthlyFactor), "chart", S.funnelProjectedDays + " Outlet-Tage")}${kpi("Ergebnisverbesserung vor zusätzlichen Fixkosten", fmtDelta(r.incrementalDB2 * monthlyFactor), "trending", "Nur Veränderung des DB II")}${kpi("Gästeentwicklung", pct(traffic), "users", "Annahme")}${kpi("Beobachtete Outlet-Tage", number(serviceDays), "layers", "Basis der Hochrechnung")}</div><div class="panel">${panelHeader("Conversion je Service-Schritt", "Verkäufe / Covers. Einzelne Gäste können mehrere Artikel kaufen.")}${
      r.covers
        ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Stufe</th><th class="align-right">Verkäufe Ist</th><th class="align-right">Ist / Gast</th><th class="align-right">Ziel / Gast</th><th class="align-right">Zusatzmenge</th><th class="align-right">Δ Netto-Umsatz</th><th class="align-right">Δ DB II</th></tr></thead><tbody>${C.FUNNEL_STEPS.map(
            (s) => {
              const x = r.byStep[s.id];
              return `<tr><td><strong>${esc(s.label)}</strong></td><td class="align-right">${number(x.sold)}</td><td class="align-right">${pct(x.currentPct)}</td><td class="align-right">${pct(x.targetPct)}</td><td class="align-right">${x.deltaUnits >= 0 ? "+" : ""}${fmt(x.deltaUnits)}</td><td class="align-right">${fmtDelta(x.revenueDelta)}</td><td class="align-right">${fmtDelta(x.dbDelta)}</td></tr>`;
            },
          ).join("")}</tbody></table></div>`
        : empty("Keine Gästezahlen", "Zuerst Tageserfassungen mit Covers eintragen.")
    }<p class="chart-note">Die Projektion verändert Absatz je Funnel-Schritt und die Gästezahl, hält Stückpreise und variable Kosten konstant. Negative Differenzen sind möglich. Es handelt sich um eine Szenario-Rechnung, nicht um einen nachgewiesenen Forecast. Funnel-Umsätze werden nicht zusätzlich in das Produktreporting gebucht (sonst Doppelzählung).</p></div>`;
  }
  function funnelView() {
    const rows = filteredFunnelRows();
    return (
      pageHeader(
        "Service Performance",
        "Service Funnel & Sales Forecast",
        "Taggenaue Upsell-Erfassung und Szenarien für Umsatz und Deckungsbeitrag.",
        `<button class="btn" data-action="funnel-template">${I("download")} CSV-Vorlage</button><button class="btn" data-action="pick-funnel-csv">${I("upload")} CSV importieren</button><button class="btn" data-action="save-funnel-assumptions">${I("calculator")} Werte speichern</button><button class="btn btn-primary" data-action="new-funnel">${I("plus")} Tageserfassung</button>`,
      ) +
      demoNotice() +
      `<input type="file" id="funnel-csv-file" accept=".csv,text/csv" hidden><div class="toolbar"><div class="toolbar-left"><select class="select" id="funnel-outlet">${outletSelect(FOUTLET)}</select><label>Von <input id="funnel-start" type="date" value="${esc(FSTART)}"></label><label>Bis <input id="funnel-end" type="date" value="${esc(FEND)}"></label></div><span class="micro">${rows.length} Tage / Outlet-Tage</span></div><div class="panel">${panelHeader("Was passiert bei höherer Conversion?", "Schieberegler verändern die Prognose unmittelbar. Änderungen per „Werte speichern“ übernehmen.")}<div class="field" style="max-width:240px;margin-bottom:16px"><label>Geplante Outlet-Tage / Monat</label><input id="funnel-projected-days" type="number" min="1" max="31" value="${S.funnelProjectedDays}"><small>Für Monatshochrechnung, nicht Ist-Umsatz</small></div><div class="funnel-sliders"><div class="field"><label>Gästeentwicklung in %</label><input id="funnel-traffic" class="funnel-range" type="range" min="-50" max="100" step="1" value="${S.funnelTrafficLift}"><span id="funnel-traffic-label" class="micro">${pct(S.funnelTrafficLift)}</span></div>${C.FUNNEL_STEPS.map((s) => `<div class="field"><label>${esc(s.label)} – Ziel je 100 Gäste</label><input class="funnel-range" data-funnel-goal="${s.id}" type="range" min="0" max="150" step="1" value="${S.funnelGoals[s.id]}"><span class="micro" data-funnel-value="${s.id}">${pct(S.funnelGoals[s.id])}</span></div>`).join("")}</div></div><div id="funnel-results" style="margin-top:18px">${funnelResults()}</div><div class="panel" style="margin-top:20px">${panelHeader("Wirtschaftliche Annahmen je Verkauf", "Brutto-VK, Umsatzsteuer, direkt variable Netto-Kosten je verkauftem Artikel. Keine Fixkosten enthalten.")}<div class="table-scroll"><table class="data-table"><thead><tr><th>Funnel-Stufe</th><th>Durchschnittlicher VK brutto €</th><th>USt %</th><th>Variable Kosten netto €</th></tr></thead><tbody>${C.FUNNEL_STEPS.map(
        (s) => {
          const a = S.funnelAssumptions[s.id];
          return `<tr><td>${esc(s.label)}</td><td><input class="funnel-assumption" data-assumption="${s.id}" data-field="priceGross" inputmode="decimal" value="${fmt(a.priceGross)}"></td><td><select class="funnel-assumption" data-assumption="${s.id}" data-field="vat">${selectOptions(
            [
              [7, "7 %"],
              [19, "19 %"],
              [0, "0 %"],
            ],
            a.vat,
          )}</select></td><td><input class="funnel-assumption" data-assumption="${s.id}" data-field="variableNet" inputmode="decimal" value="${fmt(a.variableNet)}"></td></tr>`;
        },
      ).join(
        "",
      )}</tbody></table></div><p class="chart-note">Werte hier sind bei Demo-Daten fiktiv. Für deinen Betrieb Durchschnittspreise und direkt variable Kosten hinterlegen; ansonsten bleibt die Ergebnisprognose illustrativ.</p></div><div class="panel" style="margin-top:20px">${panelHeader("Taggenaue Verkaufserfassung", "Gästezahl + Anzahl je Service-Schritt")}${rows.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Datum</th><th>Outlet</th><th class="align-right">Covers</th>${C.FUNNEL_STEPS.map((s) => `<th class="align-right">${esc(s.short)}</th>`).join("")}<th>Aktion</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(outletName(r.outletId))}</td><td class="align-right">${number(r.covers)}</td>${C.FUNNEL_STEPS.map((s) => `<td class="align-right">${number(r[s.id])}</td>`).join("")}<td><button class="btn btn-small btn-quiet" data-funnel-edit="${esc(r.id)}">${I("edit")}</button><button class="btn btn-small btn-quiet" data-funnel-delete="${esc(r.id)}">${I("trash")}</button></td></tr>`).join("")}</tbody></table></div>` : empty("Keine Funnel-Daten", "Neue Tageserfassung anlegen.")}</div>`
    );
  }
  function funnelModal(id) {
    const old = S.funnel.find((x) => x.id === id),
      v =
        old ||
        Object.fromEntries([
          ...C.FUNNEL_STEPS.map((s) => [s.id, 0]),
          ["id", ""],
          ["outletId", "restaurant"],
          ["date", new Date().toISOString().slice(0, 10)],
          ["covers", 0],
        ]);
    formModal(
      old ? "Funnel-Tag bearbeiten" : "Service-Funnel erfassen",
      `<input type="hidden" name="id" value="${esc(v.id)}"><div class="field-grid"><div class="field"><label>Datum</label><input type="date" name="date" required value="${esc(v.date)}"></div><div class="field"><label>Outlet</label><select name="outletId">${outletSelect(v.outletId, false)}</select></div><div class="field"><label>Gäste / Covers</label><input name="covers" inputmode="numeric" required value="${v.covers}"></div>${C.FUNNEL_STEPS.map((s) => `<div class="field"><label>${esc(s.label)} – Verkäufe</label><input name="${s.id}" inputmode="numeric" required value="${v[s.id] || 0}"></div>`).join("")}</div><p class="calc-note">Pro Tag und Outlet eine Zeile; mehrfach gekaufte Artikel pro Gast können zu Quoten über 100 % führen.</p>`,
      "funnel-form",
    );
  }
  function saveFunnel(form) {
    const f = new FormData(form),
      val = {
        id: String(f.get("id") || "") || uid(),
        date: String(f.get("date")),
        outletId: String(f.get("outletId")),
        covers: Number(f.get("covers")),
      };
    for (const s of C.FUNNEL_STEPS) val[s.id] = Number(f.get(s.id));
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(val.date) ||
      new Date(val.date + "T12:00:00Z").toISOString().slice(0, 10) !== val.date ||
      !S.outlets.some((o) => o.id === val.outletId) ||
      !Object.keys(val)
        .filter((k) => k === "covers" || C.FUNNEL_STEPS.some((s) => s.id === k))
        .every((k) => Number.isInteger(val[k]) && val[k] >= 0)
    )
      return toast("Ungültige Gäste- oder Verkaufszahlen.", "error");
    const ix = S.funnel.findIndex((r) => r.id === val.id),
      dup = S.funnel.some((r) => r.date === val.date && r.outletId === val.outletId && r.id !== val.id);
    if (dup) return toast("Für dieses Datum und Outlet gibt es bereits eine Zeile.", "error");
    if (ix >= 0) S.funnel[ix] = val;
    else S.funnel.push(val);
    markEdited();
    persist();
    closeModal();
    render();
    toast("Funnel-Tag gespeichert.");
  }
  function saveFunnelAssumptions() {
    const v = {};
    for (const s of C.FUNNEL_STEPS) {
      const a = {};
      for (const k of ["priceGross", "vat", "variableNet"]) {
        const e = document.querySelector(`[data-assumption="${s.id}"][data-field="${k}"]`);
        a[k] = C.parseNumberDE(e?.value);
      }
      if (
        !Number.isFinite(a.priceGross) ||
        a.priceGross < 0 ||
        !Number.isFinite(a.variableNet) ||
        a.variableNet < 0 ||
        ![0, 7, 19].includes(a.vat)
      )
        return toast("Werte prüfen: Preise/Kosten ≥ 0, USt 0/7/19 %.", "error");
      v[s.id] = a;
    }
    const { goals, traffic } = funnelCalcFromDOM();
    S.funnelGoals = goals;
    S.funnelTrafficLift = traffic;
    S.funnelProjectedDays = Math.max(1, Math.min(31, Number(document.querySelector("#funnel-projected-days")?.value) || 26));
    S.funnelAssumptions = v;
    markEdited();
    persist();
    render();
    toast("Funnel-Szenario gespeichert.");
  }
  function marketView() {
    const loc = S.marketLocation;
    return (
      pageHeader(
        "GLB Market Intelligence",
        "Mein Markt · 20-km-Radar",
        "Wettbewerber in der Umgebung entdecken und beobachtete Menüpreise mit den eigenen Preisen vergleichen.",
        `<button class="btn" data-action="scan-market">${I("target")} 20 km durchsuchen</button><button class="btn btn-primary" data-action="new-competitor">${I("plus")} Preisvergleich hinzufügen</button>`,
      ) +
      demoNotice() +
      `<div class="notice">${I("info")}<span><strong>Beta, online erforderlich:</strong> Die Umkreissuche kann über OpenStreetMap/Overpass reale Gastronomiebetriebe entdecken. Sie liest <strong>keine Speisekarten und keine Preise automatisch</strong>. Für KI-basierte Menü- und Preisvergleiche benötigen wir später einen eigenen Server und eine zulässige Recherchequelle. Kein Preis wird erfunden.</span></div><div class="panel"><div class="field-grid"><div class="field"><label>Standort-Bezeichnung</label><input id="market-label" value="${esc(loc.label)}" placeholder="Mein Betrieb"></div><div class="field"><label>Breitengrad</label><input id="market-lat" value="${esc(loc.lat)}" inputmode="decimal"></div><div class="field"><label>Längengrad</label><input id="market-lon" value="${esc(loc.lon)}" inputmode="decimal"></div></div><p class="chart-note">Voreinstellung Düren ist nur ein beispielhafter Stadtmittelpunkt, <strong>nicht</strong> automatisch dein Standort. Mit den Koordinaten deines Betriebs wird der 20-km-Radius korrekt. © OpenStreetMap-Mitwirkende, Daten unter ODbL.</p><div id="market-scan-status" aria-live="polite"></div></div><div class="panel" style="margin-top:20px">${panelHeader("Entdeckte Betriebe · Radius 20 km", S.marketLastScan ? `Letzte manuelle Suche ${S.marketLastScan} · ${S.marketDiscovered.length} Treffer` : "Noch kein Umkreisscan durchgeführt")}${
        S.marketDiscovered.length
          ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Wettbewerber</th><th>Typ</th><th class="align-right">Entfernung</th><th>Öffentliche Quelle</th><th>Vergleichen</th></tr></thead><tbody>${S.marketDiscovered
              .slice(0, 80)
              .map(
                (c, i) =>
                  `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.type || "Gastronomie")}</td><td class="align-right">${fmt(c.km)} km</td><td><a href="${esc(safeHttpUrl(c.url))}" rel="noopener noreferrer" target="_blank">OSM ↗</a>${c.website ? ` · <a href="${esc(safeHttpUrl(c.website))}" rel="noopener noreferrer" target="_blank">Webseite ↗</a>` : ""}</td><td><button class="btn btn-small" data-discovered="${i}">Preis erfassen</button></td></tr>`,
              )
              .join("")}</tbody></table></div>`
          : empty("Noch keine Daten", "Standort setzen und Suche aktiv starten.")
      }<p class="chart-note">OSM ist nicht vollständig; Entfernung Luftlinie. Ergebnisse können fehlen oder veraltet sein. Keine Speisekartenpreise aus dieser Quelle.</p></div><div class="panel" style="margin-top:20px">${panelHeader("Manuelle Preisbeobachtungen", "Nur dokumentierte Konkurrenzpreise als Vergleichsdaten erfassen.")}${
        S.market.length
          ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Mein Artikel</th><th>Wettbewerber / Artikel</th><th class="align-right">Mein VK</th><th class="align-right">Fremd-VK</th><th class="align-right">Δ zum Markt</th><th>Preisquelle & Datum</th><th>Aktion</th></tr></thead><tbody>${S.market
              .map((x) => {
                const p = stockOf(x.productId),
                  c = p ? C.marketComparison(p.grossPrice, x.grossPrice, p.unit || "Portion", x.unit) : null;
                return `<tr><td>${esc(p?.name || "Unbekannt")}</td><td>${esc(x.competitor)}<div class="micro">${esc(x.competitorProduct)}</div></td><td class="align-right">${euro(p?.grossPrice)}</td><td class="align-right">${euro(x.grossPrice)}</td><td class="align-right">${c?.comparable ? deltaLabel(c.differencePct) : "Nicht vergleichbar"}</td><td>${x.sourceUrl ? `<a href="${esc(safeHttpUrl(x.sourceUrl))}" target="_blank" rel="noopener noreferrer">Preisquelle ↗</a>` : esc(x.source || "—")}<div class="micro">${esc(x.observedAt || "Kein Datum")}</div></td><td><button class="btn btn-small btn-quiet" data-market-edit="${esc(x.id)}">${I("edit")}</button><button class="btn btn-small btn-quiet" data-market-delete="${esc(x.id)}">${I("trash")}</button></td></tr>`;
              })
              .join("")}</tbody></table></div>`
          : empty("Noch keine Preisbeobachtungen", "Preis auf einer konkreten Speisekarte prüfen und mit Quellenangabe ergänzen.")
      }</div>`
    );
  }
  async function scanMarket() {
    const label = document.querySelector("#market-label")?.value.trim() || "Mein Betrieb",
      lat = Number(String(document.querySelector("#market-lat")?.value || "").replace(",", ".")),
      lon = Number(String(document.querySelector("#market-lon")?.value || "").replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
      return toast("Gültige Standortkoordinaten erforderlich.", "error");
    S.marketLocation = { label: label.slice(0, 100), lat, lon };
    persist();
    const status = document.querySelector("#market-scan-status");
    status.textContent = "Lade öffentlich erfasste Restaurants, Cafés und Bars im Umkreis …";
    const query = `[out:json][timeout:25];(node["amenity"~"^(restaurant|cafe|bar|fast_food)$"](around:20000,${lat},${lon});way["amenity"~"^(restaurant|cafe|bar|fast_food)$"](around:20000,${lat},${lon}););out center;`;
    try {
      const r = await fetch("https://overpass.private.coffee/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(40000),
      });
      if (!r.ok) throw Error("HTTP " + r.status);
      const data = await r.json();
      const sorted = (data.elements || [])
        .filter((e) => e.tags?.name)
        .map((e) => ({
          id: e.type + "/" + e.id,
          name: e.tags.name,
          type: e.tags.amenity || "Gastronomie",
          lat: e.lat ?? e.center?.lat,
          lon: e.lon ?? e.center?.lon,
          website: e.tags.website || e.tags["contact:website"] || "",
          url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
        }))
        .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
        .map((e) => ({ ...e, km: C.distanceKm(lat, lon, e.lat, e.lon) }))
        .filter((e) => e.km <= 20)
        .sort((a, b) => a.km - b.km);
      const seen = new Set();
      S.marketDiscovered = sorted
        .filter((e) => {
          const key = e.name.toLowerCase() + "-" + Math.round(e.lat * 1000) + "-" + Math.round(e.lon * 1000);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 80);
      S.marketLastScan = new Date().toLocaleString("de-DE");
      persist();
      render();
      toast(`${S.marketDiscovered.length} Betriebe entdeckt – keine Preisangaben.`);
    } catch (e) {
      status.textContent =
        "Live-Abfrage nicht verfügbar (" +
        e.message +
        "). Bitte Internetverbindung prüfen oder später erneut versuchen. Die manuelle Preisverwaltung bleibt nutzbar.";
      toast("Umkreissuche aktuell nicht verfügbar.", "error");
    }
  }
  function prefillCompetitor(idx) {
    const c = S.marketDiscovered[idx];
    if (!c) return;
    competitorModal();
    const field = document.querySelector('#market-form [name="competitor"]');
    if (field) field.value = c.name;
  }

  function saveMonthCosts() {
    const d = {};
    for (const key of ["energy", "payroll", "overhead", "goods", "revenueOverrideNet", "profit"]) {
      const v = C.parseNumberDE(document.querySelector(`[data-key="${key}"]`)?.value);
      if (!Number.isFinite(v) || v < 0) return toast("Bitte gültige, nichtnegative Monatskosten eintragen.", "error");
      d[key] = v;
    }
    if (d.profit >= 100) return toast("Zielgewinn muss unter 100 % liegen.", "error");
    S.profitTarget = d.profit;
    delete d.profit;
    S.monthlyCosts[COST_MONTH] = d;
    markEdited();
    persist();
    render();
    toast("Monatskosten für " + COST_MONTH + " gespeichert.");
  }
  function saveParentGroup(form) {
    const name = String(new FormData(form).get("groupname") || "").trim();
    if (!name || name.length > 80 || S.parentGroups.includes(name)) return toast("Oberkategorie ungültig oder schon vorhanden.", "error");
    S.parentGroups.push(name);
    markEdited();
    persist();
    closeModal();
    render();
    toast("Oberkategorie hinzugefügt.");
  }

  const FUNNEL_TEMPLATE =
    "Datum;Outlet;Covers;Aperitifs;Wasserflaschen;Upgrades;Beilagen;Desserts;Kaffees\n2026-10-20;Restaurant;80;12;25;19;20;14;18\n";
  async function importFunnelCSV(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("Datei zu groß (max. 5 MB).", "error");
    try {
      const text = await file.text();
      const delim = text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
      const lines = C.parseDelimited(text.replace(/^\uFEFF/, ""), delim);
      if (lines.length < 2) throw Error("CSV enthält keine Daten.");
      const norm = (x) =>
        String(x || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "");
      const h = lines[0].map(norm);
      const col = (aliases) => h.findIndex((x) => aliases.includes(x));
      const idx = {
        date: col(["datum", "date"]),
        outlet: col(["outlet", "bereich"]),
        covers: col(["covers", "gaste", "gaeste", "gasteanzahl"]),
        aperitif: col(["aperitifs", "aperitif"]),
        water: col(["wasserflaschen", "wasser"]),
        upgrades: col(["upgrades", "upgrade"]),
        sides: col(["beilagen", "sides"]),
        desserts: col(["desserts", "dessert"]),
        coffee: col(["kaffees", "kaffee"]),
      };
      if (Object.values(idx).some((i) => i < 0)) throw Error("Fehlende Spalten. Bitte die Funnel-CSV-Vorlage verwenden.");
      const rows = [];
      const seen = new Set();
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const date = String(line[idx.date] || "").trim(),
          outlet = String(line[idx.outlet] || "").trim();
        if (!date && !outlet) continue;
        const oid = S.outlets.find((x) => x.name.toLowerCase() === outlet.toLowerCase() || x.id === outlet)?.id;
        const val = { id: uid(), date, outletId: oid };
        for (const k of ["covers", ...C.FUNNEL_STEPS.map((x) => x.id)]) val[k] = C.parseNumberDE(line[idx[k]]);
        if (
          !oid ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Object.keys(val)
            .filter((k) => k === "covers" || C.FUNNEL_STEPS.some((x) => x.id === k))
            .every((k) => Number.isInteger(val[k]) && val[k] >= 0)
        )
          throw Error(`Ungültige Daten in Zeile ${i + 1}. Prüfe Outletname, Datum und Mengen.`);
        const key = date + "|" + oid;
        if (seen.has(key)) throw Error("Doppelte Datum-/Outlet-Kombination in Zeile " + (i + 1));
        seen.add(key);
        rows.push(val);
      }
      if (!rows.length) throw Error("Keine gültigen Zeilen.");
      const conflicts = rows.filter((r) => S.funnel.some((o) => o.date === r.date && o.outletId === r.outletId));
      if (conflicts.length && !confirm(`${conflicts.length} Tageszeilen bestehen bereits. Durch die neuen Daten ersetzen?`)) return;
      S.funnel = S.funnel.filter((o) => !rows.some((r) => r.date === o.date && r.outletId === o.outletId));
      S.funnel.push(...rows);
      markEdited();
      persist();
      render();
      toast(`${rows.length} Tageswerte importiert.`);
    } catch (e) {
      toast("Funnel-Import: " + e.message, "error");
    }
  }

  // ===== End v0.3 extension =====

  const handlers = {
    funnel: funnelView,
    groups: groupsView,
    overview,
    products: productsView,
    costs: costingView,
    outlets: outletsView,
    market: marketView,
    lifecycle: lifecycleView,
    calculator: calculatorView,
    portfolio: portfolioView,
    insights: insightsView,
    import: importView,
    settings: settingsView,
    roadmap: roadmapView,
  };
  const labels = {
    funnel: "Service Funnel",
    groups: "Oberkategorien",
    overview: "Übersicht",
    products: "Artikel & Umsätze",
    costs: "Deckungsbeiträge",
    outlets: "Outlet-Controlling",
    market: "Mein Markt",
    lifecycle: "Produktlebenszyklus",
    calculator: "Preiskalkulation",
    portfolio: "Renner-Penner",
    insights: "GLB Intelligence",
    import: "Datenimport",
    settings: "Einstellungen",
    roadmap: "Roadmap",
  };
  function render() {
    if (!handlers[VIEW] || (window.GLBAccess?.enabled && !window.GLBAccess.canView(VIEW)))
      VIEW = window.GLBAccess?.defaultView() || "overview";
    document.querySelector("#main").innerHTML = handlers[VIEW]();
    document.querySelector("#breadcrumb-current").textContent = labels[VIEW];
    document
      .querySelectorAll(".nav-item")
      .forEach((x) => x.classList.toggle("active", x.dataset.view === VIEW && (VIEW !== "roadmap" || x.textContent.includes("Workforce"))));
    document.querySelector("#workspace-name").textContent = S.business;
  }
  function navigate(view) {
    if (window.GLBAccess?.enabled && !window.GLBAccess.canView(view)) {
      toast("Für deine Mitarbeiterrolle ist dieser Bereich nicht freigegeben.", "error");
      return;
    }
    VIEW = view;
    location.hash = view;
    FILTER = "";
    CAT = "all";
    QFILTER = "all";
    render();
    window.scrollTo(0, 0);
    closeMobile();
  }
  function toast(message, type = "success") {
    const area = document.querySelector("#toast-layer"),
      div = document.createElement("div");
    div.className = "toast" + (type === "error" ? " error" : "");
    div.textContent = message;
    area.appendChild(div);
    setTimeout(() => div.remove(), 3900);
  }
  function closeModal() {
    document.querySelector("#modal-layer").innerHTML = "";
  }
  function closeMobile() {
    document.querySelector("#sidebar").classList.remove("is-open");
    document.querySelector("#mobile-overlay").classList.remove("is-open");
  }
  function showProductModal(id) {
    const old = S.items.find((x) => x.id === id);
    const p = old || { id: "", name: "", category: "Hauptgericht", unit: "Portion", quantity: 0, grossPrice: 0, costNet: 0, vat: 7 };
    const d = p.costDetail || { ingredientsNet: p.costNet || 0, wastePct: 0, packagingNet: 0, laborNet: 0, feesNet: 0, otherNet: 0 };
    formModal(
      old ? "Produkt & Kosten bearbeiten" : "Neues Produkt",
      `<input type="hidden" name="id" value="${esc(p.id)}"><div class="field-grid"><div class="field"><label>Produktname *</label><input id="prod-name" name="name" required maxlength="120" value="${esc(p.name)}"></div><div class="field"><label>Warengruppe</label><input name="category" maxlength="80" value="${esc(p.category)}"></div><div class="field"><label>Portion / Einheit *</label><input name="unit" maxlength="80" required value="${esc(p.unit || "Portion")}" placeholder="z. B. 250 g"></div><div class="field"><label>Produktstart (JJJJ-MM, optional)</label><input name="launchMonth" maxlength="7" placeholder="2026-10" value="${esc(p.launchMonth || "")}"></div><div class="field"><label>Regulärer Brutto-VK (€) *</label><input name="grossPrice" inputmode="decimal" required value="${esc(fmt(p.grossPrice))}"></div><div class="field"><label>USt</label><select name="vat">${selectOptions(
        [
          [7, "7 %"],
          [19, "19 %"],
          [0, "0 %"],
        ],
        p.vat,
      )}</select></div></div><hr class="split-divider"><h3 class="section-heading">Kosten pro verkaufsfähiger Einheit · netto</h3><div class="field-grid">${[
        ["ingredientsNet", "Rohstoffe / Zutaten (€)"],
        ["wastePct", "Rezeptschwund (%)"],
        ["packagingNet", "Verpackung (€)"],
        ["laborNet", "Zusätzlich variable Arbeit (€)"],
        ["feesNet", "Provisions- / Zahlungsgebühren (€)"],
        ["otherNet", "Sonstige variable Kosten (€)"],
      ]
        .map(
          ([key, label]) =>
            `<div class="field"><label>${label}</label><input name="${key}" inputmode="decimal" required value="${fmt(d[key] || 0)}"></div>`,
        )
        .join(
          "",
        )}</div><p class="calc-note">DB I = Netto-VK − Zutaten − prozentualer Schwund; DB II = DB I − Verpackung − direkt variable Arbeit − Gebühren − Sonstiges. Reguläre Festgehälter gehören nicht in die variable Stückkosteneingabe. Absätze werden im Outlet-Modul gepflegt.</p>`,
      "product-form",
    );
    setTimeout(() => document.querySelector("#prod-name")?.focus(), 0);
  }

  function markEdited() {
    if (S.mode === "demo") S.mode = "edited-demo";
  }
  function saveProduct(form) {
    const f = new FormData(form),
      id = String(f.get("id") || ""),
      name = String(f.get("name") || "").trim(),
      category = String(f.get("category") || "").trim() || "Sonstiges",
      unit = String(f.get("unit") || "").trim();
    const grossPrice = C.parseNumberDE(f.get("grossPrice")),
      vat = C.parseNumberDE(f.get("vat")),
      launchMonth = String(f.get("launchMonth") || "").trim();
    const keys = ["ingredientsNet", "wastePct", "packagingNet", "laborNet", "feesNet", "otherNet"];
    const d = {};
    for (const key of keys) d[key] = C.parseNumberDE(f.get(key));
    if (
      !name ||
      name.length > 120 ||
      !unit ||
      unit.length > 80 ||
      (launchMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(launchMonth)) ||
      !Number.isFinite(grossPrice) ||
      grossPrice < 0 ||
      ![0, 7, 19].includes(vat) ||
      !keys.every((key) => Number.isFinite(d[key]) && d[key] >= 0) ||
      d.wastePct > 100
    )
      return toast("Produktdaten prüfen: Kosten ≥ 0, Schwund 0–100 %.", "error");
    const prev = stockOf(id);
    const p = {
      ...(prev || { quantity: 0 }),
      id: id || uid(),
      name,
      category,
      unit,
      launchMonth,
      grossPrice,
      costDetail: d,
      costNet: C.costBreakdown({ costDetail: d }).goodsNet,
      vat,
    };
    if (prev) {
      S.items[S.items.findIndex((x) => x.id === id)] = p;
    } else S.items.push(p);
    markEdited();
    persist();
    closeModal();
    render();
    toast("Produkt inkl. DB-Kosten gespeichert.");
  }

  function recipeFromDom() {
    const r = {
      name: (document.querySelector("#calc-name")?.value || "").trim() || "Neues Gericht",
      category: (document.querySelector("#calc-category")?.value || "").trim() || "Hauptgericht",
      targetPct: C.parseNumberDE(document.querySelector("#calc-target")?.value),
      vat: Number(document.querySelector("#calc-vat")?.value),
      currentPrice: C.parseNumberDE(document.querySelector("#calc-price")?.value),
      ingredients: [],
    };
    document.querySelectorAll("input.ing-name").forEach((x) => {
      const idx = Number(x.dataset.idx),
        costEl = document.querySelector(`input.ing-cost[data-idx="${idx}"]`);
      const cost = C.parseNumberDE(costEl?.value);
      r.ingredients.push({ name: x.value || "Bestandteil", cost: Number.isFinite(cost) ? cost : 0 });
    });
    return r;
  }
  function recipeValid(r) {
    return (
      r.targetPct > 0 &&
      r.targetPct <= 100 &&
      r.currentPrice >= 0 &&
      Number.isFinite(r.currentPrice) &&
      [0, 7, 19].includes(r.vat) &&
      r.ingredients.every((x) => x.cost >= 0 && Number.isFinite(x.cost))
    );
  }
  function updateCalc() {
    if (VIEW !== "calculator") return;
    const r = recipeFromDom();
    if (recipeValid(r)) {
      S.recipe = r;
      persist();
      document.querySelector("#calculator-output").innerHTML = recipeResults(r);
    } else
      document.querySelector("#calculator-output").innerHTML =
        '<div class="notice">Bitte Ziel-Wareneinsatz zwischen 0 und 100 %, aktuelle Preise und Kosten ab 0 € eingeben.</div>';
  }
  function downloadFile(contents, name, mime) {
    const blob = new Blob([contents], { type: mime }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const TEMPLATE =
    "Produkt;Kategorie;Menge;Bruttopreis;Wareneinsatz netto;USt\nCheeseburger;Burger;120;17,90;4,50;7\nSignature Cocktail;Getränke;85;9,50;2,50;19\n";
  async function handleCSV(file) {
    if (!file) return;
    if (!/\.csv$|\.txt$/i.test(file.name)) return toast("Bitte eine CSV-Datei auswählen.", "error");
    if (file.size > 5 * 1024 * 1024) return toast("CSV ist zu groß (max. 5 MB).", "error");
    try {
      const parsed = C.parseCSV(await file.text());
      if (!parsed.items.length) return toast("Keine gültigen Artikel gefunden.", "error");
      const how = document.querySelector("#import-mode")?.value || "replace";
      if (parsed.errors.length) {
        const preview = parsed.errors.slice(0, 5).join("\n");
        if (
          !confirm(
            `${parsed.items.length} gültige Artikel und ${parsed.errors.length} fehlerhafte Zeilen. Fehler: \n${preview}\n\nNur die gültigen Artikel importieren?`,
          )
        )
          return;
      }
      if (how === "replace" && !confirm(`${parsed.items.length} Artikel importieren und den bisherigen Bestand ersetzen?`)) return;
      S.items =
        how === "append"
          ? [...S.items, ...parsed.items.map((x) => ({ ...x, unit: "Portion" }))]
          : parsed.items.map((x) => ({ ...x, unit: "Portion" }));
      S.sales = how === "append" ? [...S.sales, ...legacySales(parsed.items)] : legacySales(parsed.items);
      if (how === "replace") {
        S.market = [];
        S.recipes = [];
        S.dailySales = [];
      }
      S.mode = how === "append" && S.mode !== "own" ? "edited-demo" : "own";
      persist();
      render();
      toast(`${parsed.items.length} Artikel importiert. ${parsed.errors.length} Zeilen übersprungen.`);
    } catch (e) {
      toast("CSV-Import fehlgeschlagen: " + e.message, "error");
    }
  }
  async function handleJSON(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast("Backup zu groß (max. 10 MB).", "error");
    try {
      const d = migrate(JSON.parse(await file.text()));
      if (!Number.isFinite(Number(d.targetPct)) || Number(d.targetPct) <= 0 || Number(d.targetPct) > 100) throw Error("Zielwert ungültig");
      if (!confirm("Aktuelle Daten durch dieses Backup ersetzen?")) return;
      S = { ...defaults(), ...d };
      ensureV03();
      ensureV04();
      ensureV05();
      ensureV06();
      persist();
      render();
      toast("Backup wiederhergestellt.");
    } catch (e) {
      toast("Backup konnte nicht geladen werden: " + e.message, "error");
    }
  }

  function act(name, el) {
    switch (name) {
      case "new-funnel":
        funnelModal();
        break;
      case "funnel-template":
        downloadFile("\uFEFF" + FUNNEL_TEMPLATE, "GLB_Service_Funnel_Import.csv", "text/csv;charset=utf-8");
        break;
      case "pick-funnel-csv":
        document.querySelector("#funnel-csv-file")?.click();
        break;
      case "save-funnel-assumptions":
        saveFunnelAssumptions();
        break;
      case "scan-market":
        scanMarket();
        break;
      case "add-parent-group": {
        formModal(
          "Oberkategorie anlegen",
          '<div class="field"><label>Name</label><input name="groupname" maxlength="80" required></div>',
          "parent-group-form",
        );
        break;
      }
      case "save-month-costs":
        saveMonthCosts();
        break;
      case "new-sale":
        saleModal();
        break;
      case "new-competitor":
        competitorModal();
        break;
      case "new-outlet":
        outletModal();
        break;
      case "sales-template":
        downloadFile("\uFEFF" + SALES_TEMPLATE, "GLB_Verkaufsimport.csv", "text/csv;charset=utf-8");
        break;
      case "pick-sales-csv":
        document.querySelector("#sales-csv-file")?.click();
        break;
      case "new-product":
        showProductModal();
        break;
      case "close-modal":
        closeModal();
        break;
      case "add-ingredient": {
        updateCalc();
        S.recipe.ingredients.push({ name: "Neuer Bestandteil", cost: 0 });
        persist();
        render();
        break;
      }
      case "delete-ingredient": {
        updateCalc();
        S.recipe.ingredients.splice(Number(el.dataset.idx), 1);
        persist();
        render();
        break;
      }
      case "save-recipe": {
        const candidate = recipeFromDom();
        if (!recipeValid(candidate) || !candidate.ingredients.length)
          return toast("Bitte gültige Rezeptkosten und einen Ziel-Wareneinsatz eingeben.", "error");
        S.recipe = candidate;
        const r = candidate;
        const calc = recipeTotals(r);
        S.items.push({
          id: uid(),
          name: r.name,
          category: r.category,
          unit: "Portion",
          quantity: 0,
          grossPrice: r.currentPrice > 0 ? r.currentPrice : C.round(calc.proposed || 0),
          costNet: C.round(calc.cost, 4),
          vat: r.vat,
        });
        markEdited();
        persist();
        navigate("products");
        toast("Rezept als Produkt mit Menge 0 gespeichert.");
        break;
      }
      case "pick-csv":
        document.querySelector("#csv-file")?.click();
        break;
      case "pick-json":
        document.querySelector("#json-file")?.click();
        break;
      case "csv-template":
        downloadFile("\uFEFF" + TEMPLATE, "GLB_AI_Suite_Importvorlage.csv", "text/csv;charset=utf-8");
        toast("CSV-Vorlage heruntergeladen.");
        break;
      case "export-json":
        downloadFile(
          JSON.stringify({ ...S, exportedAt: new Date().toISOString() }, null, 2),
          "GLB_AI_Suite_Backup_" + new Date().toISOString().slice(0, 10) + ".json",
          "application/json;charset=utf-8",
        );
        toast("Backup heruntergeladen.");
        break;
      case "save-settings": {
        const business = document.querySelector("#settings-business")?.value.trim(),
          target = C.parseNumberDE(document.querySelector("#settings-target")?.value);
        if (!business || business.length > 80 || !(target > 0 && target <= 100))
          return toast("Bitte Betriebsname und gültigen Zielwert (0–100 %) eingeben.", "error");
        S.business = business;
        S.targetPct = target;
        persist();
        render();
        toast("Einstellungen gespeichert.");
        break;
      }
      case "start-blank":
        if (
          !confirm(
            "Mit einem leeren Betrieb starten? Alle aktuellen lokalen Artikeldaten werden ersetzt. Bitte vorher ggf. Backup herunterladen.",
          )
        )
          return;
        S.items = [];
        S.sales = [];
        S.market = [];
        S.outlets = INITIAL_OUTLETS.map((x) => ({ ...x }));
        S.mode = "own";
        S.business = "Mein Gastronomiebetrieb";
        S.monthlyCosts = {};
        S.funnel = [];
        S.marketDiscovered = [];
        S.marketLastScan = "";
        S.categoryGroups = {};
        S.ingredients = [];
        S.recipes = [];
        S.warehouses = [{ id: "wh-main", name: "Hauptlager", note: "" }];
        S.inventoryCounts = [];
        S.dailySales = [];
        S.stockMovements = [];
        S.purchaseOrders = [];
        S.ingredientWarehouses = {};
        S.v05SalesUsage = true;
        S.v04DemoSeeded = true;
        S.v06Pinned = [];
        ensureV06();
        persist();
        navigate("products");
        toast("Leerer Betrieb angelegt.");
        break;
      case "reset-demo":
        if (!confirm("Alle lokalen Änderungen verwerfen und Beispieldaten laden?")) return;
        S = defaults();
        ensureV03();
        ensureV04();
        ensureV05();
        ensureV06();
        persist();
        navigate("overview");
        toast("Beispieldaten wiederhergestellt.");
        break;
    }
  }
  document.addEventListener("click", (e) => {
    const fe = e.target.closest("[data-funnel-edit]");
    if (fe) {
      funnelModal(fe.dataset.funnelEdit);
      return;
    }
    const fd = e.target.closest("[data-funnel-delete]");
    if (fd) {
      if (!confirm("Tageserfassung löschen?")) return;
      S.funnel = S.funnel.filter((r) => r.id !== fd.dataset.funnelDelete);
      persist();
      render();
      return;
    }
    const comp = e.target.closest("[data-discovered]");
    if (comp) {
      prefillCompetitor(Number(comp.dataset.discovered));
      return;
    }
  });
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-view]");
    if (nav) {
      e.preventDefault();
      navigate(nav.dataset.view);
      return;
    }
    const lc = e.target.closest("[data-lifecycle]");
    if (lc) {
      LPRODUCT = lc.dataset.lifecycle;
      navigate("lifecycle");
      LPRODUCT = lc.dataset.lifecycle;
      render();
      return;
    }
    const se = e.target.closest("[data-sale-edit]");
    if (se) {
      saleModal(se.dataset.saleEdit);
      return;
    }
    const sd = e.target.closest("[data-sale-delete]");
    if (sd) {
      if (!confirm("Diese Verkaufszeile löschen?")) return;
      S.sales = S.sales.filter((x) => x.id !== sd.dataset.saleDelete);
      markEdited();
      persist();
      render();
      return;
    }
    const me = e.target.closest("[data-market-edit]");
    if (me) {
      competitorModal(me.dataset.marketEdit);
      return;
    }
    const md = e.target.closest("[data-market-delete]");
    if (md) {
      if (!confirm("Diesen Preisvergleich löschen?")) return;
      S.market = S.market.filter((x) => x.id !== md.dataset.marketDelete);
      markEdited();
      persist();
      render();
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      showProductModal(edit.dataset.edit);
      return;
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      const it = S.items.find((x) => x.id === del.dataset.delete);
      if (!it || !confirm(`"${it.name}" wirklich löschen?`)) return;
      S.items = S.items.filter((x) => x.id !== it.id);
      S.sales = S.sales.filter((x) => x.productId !== it.id);
      S.market = S.market.filter((x) => x.productId !== it.id);
      S.recipes = S.recipes.filter((x) => x.productId !== it.id);
      S.dailySales = S.dailySales.filter((x) => x.productId !== it.id);
      markEdited();
      persist();
      render();
      toast("Produkt gelöscht.");
      return;
    }
    const action = e.target.closest("[data-action]");
    if (action) {
      e.preventDefault();
      act(action.dataset.action, action);
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "product-search") {
      FILTER = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const input = document.querySelector("#product-search");
      input?.focus();
      input?.setSelectionRange(pos, pos);
      return;
    }
    if (e.target.id === "funnel-projected-days") {
      const v = Number(e.target.value);
      if (Number.isInteger(v) && v >= 1 && v <= 31) {
        S.funnelProjectedDays = v;
        const out = document.querySelector("#funnel-results");
        if (out) out.innerHTML = funnelResults();
      }
      return;
    }
    if (e.target.classList.contains("funnel-range")) {
      document.querySelectorAll("[data-funnel-value]").forEach((el) => {
        const slider = document.querySelector(`[data-funnel-goal=\"${el.dataset.funnelValue}\"]`);
        if (slider) el.textContent = pct(slider.value);
      });
      const l = document.querySelector("#funnel-traffic-label");
      if (l) l.textContent = pct(document.querySelector("#funnel-traffic")?.value);
      const out = document.querySelector("#funnel-results");
      if (out) out.innerHTML = funnelResults();
      return;
    }
    if (e.target.closest(".calc-layout")) updateCalc();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "product-category") {
      CAT = e.target.value;
      render();
    }
    if (e.target.id === "product-group-filter") {
      GROUPFILTER = e.target.value;
      render();
    }
    if (e.target.id === "product-sort") {
      PRODUCT_SORT = e.target.value;
      render();
    }
    if (e.target.id === "product-outlet-filter") {
      PRODUCT_OUTLET = e.target.value;
      render();
    }
    if (e.target.id === "product-month-filter") {
      PRODUCT_MONTH = e.target.value;
      render();
    }
    if (e.target.id === "cost-month") {
      COST_MONTH = e.target.value;
      render();
    }
    if (e.target.hasAttribute("data-group-category")) {
      S.categoryGroups[e.target.dataset.groupCategory] = e.target.value;
      markEdited();
      persist();
      render();
    }
    if (e.target.id === "funnel-outlet") {
      FOUTLET = e.target.value;
      render();
    }
    if (e.target.id === "funnel-start") {
      FSTART = e.target.value;
      render();
    }
    if (e.target.id === "funnel-end") {
      FEND = e.target.value;
      render();
    }
    if (e.target.id === "quadrant-filter") {
      QFILTER = e.target.value;
      render();
    }
    if (e.target.id === "outlet-filter") {
      OFILTER = e.target.value;
      render();
    }
    if (e.target.id === "month-filter") {
      MFILTER = e.target.value;
      render();
    }
    if (e.target.id === "life-product") {
      LPRODUCT = e.target.value;
      render();
    }
    if (e.target.closest("#sale-form") && e.target.name === "productId") {
      const p = stockOf(e.target.value),
        field = e.target.closest("form")?.querySelector('[name="grossPrice"]');
      if (p && field) field.value = fmt(p.grossPrice);
    }
    if (e.target.id === "sales-csv-file") {
      handleSalesCSV(e.target.files?.[0]);
    }
    if (e.target.id === "funnel-csv-file") {
      importFunnelCSV(e.target.files?.[0]);
    }
    if (e.target.id === "csv-file") {
      handleCSV(e.target.files?.[0]);
    }
    if (e.target.id === "json-file") {
      handleJSON(e.target.files?.[0]);
    }
  });
  document.addEventListener("dragover", (e) => {
    if (e.target.closest("#csv-dropzone")) {
      e.preventDefault();
      e.target.closest("#csv-dropzone").classList.add("dragover");
    }
  });
  document.addEventListener("dragleave", (e) => {
    if (e.target.closest("#csv-dropzone")) e.target.closest("#csv-dropzone").classList.remove("dragover");
  });
  document.addEventListener("drop", (e) => {
    if (e.target.closest("#csv-dropzone")) {
      e.preventDefault();
      e.target.closest("#csv-dropzone").classList.remove("dragover");
      handleCSV(e.dataTransfer.files?.[0]);
    }
  });
  document.querySelector("#mobile-menu").addEventListener("click", () => {
    document.querySelector("#sidebar").classList.add("is-open");
    document.querySelector("#mobile-overlay").classList.add("is-open");
  });
  document.querySelector("#mobile-overlay").addEventListener("click", closeMobile);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeMobile();
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.id === "csv-dropzone") {
      e.preventDefault();
      document.querySelector("#csv-file")?.click();
    }
  });
  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (next !== VIEW) {
      VIEW = next;
      render();
    }
  });
  /* This file is injected inside the v0.3 app closure so previous local data stays usable. */
  const V4 = window.GLBV04;
  const V4_TODAY = () => {
    const d = new Date(),
      p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const V4_7AGO = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  let V4_WAREHOUSE = "all",
    V4_SEARCH = "",
    V4_PRODUCT = "all",
    V4_HORIZON = 7,
    V4_LEAD = 2,
    V4_SAFETY = 10,
    V4_CAPTURE_IMG = "",
    V4_VISION = [],
    V4_IMPORT_ROWS = [],
    V4_MENU_CATEGORY = "all";
  const V4_UNITS = [
    ["g", "Gramm"],
    ["kg", "Kilogramm"],
    ["ml", "Milliliter"],
    ["l", "Liter"],
    ["stk", "Stück"],
  ];
  const v4Num = (n) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n) || 0);
  const v4SafeImage = (s) => (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s || "") ? s : "");
  const v4Ing = (id) => S.ingredients.find((x) => x.id === id);
  const v4Rec = (id) => S.recipes.find((x) => x.productId === id);
  const v4Qty = (n, unit) => `${v4Num(n)} ${unit}`;
  function v4Demo() {
    const I = [
      {
        id: "ing-bun",
        name: "Burger Bun",
        category: "Backwaren",
        packQty: 24,
        packUnit: "stk",
        packCostNet: 19.2,
        wastePct: 2,
        minimumBase: 12,
      },
      {
        id: "ing-beef",
        name: "Rindfleisch Burger Patty",
        category: "Fleisch",
        packQty: 20,
        packUnit: "stk",
        packCostNet: 58,
        wastePct: 3,
        minimumBase: 8,
      },
      {
        id: "ing-cheese",
        name: "Cheddar",
        category: "Molkerei",
        packQty: 1,
        packUnit: "kg",
        packCostNet: 11.8,
        wastePct: 4,
        minimumBase: 400,
      },
      {
        id: "ing-potato",
        name: "Kartoffeln",
        category: "Gemüse",
        packQty: 5,
        packUnit: "kg",
        packCostNet: 9,
        wastePct: 13,
        minimumBase: 2500,
      },
      {
        id: "ing-steak",
        name: "Rumpsteak",
        category: "Fleisch",
        packQty: 5,
        packUnit: "kg",
        packCostNet: 120,
        wastePct: 12,
        minimumBase: 1250,
      },
      {
        id: "ing-coffee",
        name: "Kaffeebohnen",
        category: "Getränke",
        packQty: 1,
        packUnit: "kg",
        packCostNet: 19,
        wastePct: 3,
        minimumBase: 350,
      },
      {
        id: "ing-icecream",
        name: "Vanilleeis",
        category: "Dessert",
        packQty: 5,
        packUnit: "l",
        packCostNet: 25,
        wastePct: 5,
        minimumBase: 2000,
      },
    ];
    const recipes = [
      {
        productId: "d1",
        yieldPortions: 1,
        lines: [
          { ingredientId: "ing-bun", amount: 1, unit: "stk" },
          { ingredientId: "ing-beef", amount: 1, unit: "stk" },
          { ingredientId: "ing-cheese", amount: 40, unit: "g" },
        ],
      },
      {
        productId: "d2",
        yieldPortions: 1,
        lines: [
          { ingredientId: "ing-steak", amount: 250, unit: "g" },
          { ingredientId: "ing-potato", amount: 220, unit: "g" },
        ],
      },
      { productId: "d7", yieldPortions: 1, lines: [{ ingredientId: "ing-potato", amount: 250, unit: "g" }] },
      { productId: "d8", yieldPortions: 1, lines: [{ ingredientId: "ing-icecream", amount: 150, unit: "ml" }] },
    ];
    const wh = [
      { id: "wh-kitchen", name: "Küchenlager", note: "Trockenlager und Kühlhaus" },
      { id: "wh-bar", name: "Barlager", note: "Bar- und Getränkebestand" },
    ];
    const counts = I.map((x, i) => ({
      id: "demo-count-" + i,
      ingredientId: x.id,
      warehouseId: i === 5 ? "wh-bar" : "wh-kitchen",
      date: V4_TODAY(),
      savedAt: new Date().toISOString(),
      baseQty: [30, 22, 1400, 11000, 3800, 600, 3800][i],
      photo: "",
    }));
    const daily = [];
    for (let n = 27; n >= 0; n--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - n - 1);
      const date = d.toISOString().slice(0, 10);
      for (const [ix, id] of ["d1", "d2", "d7", "d8"].entries())
        daily.push({
          id: "demo-daily-" + id + "-" + n,
          productId: id,
          outletId: "restaurant",
          date,
          quantity: [8, 4, 11, 3][ix] + (n % 6 === 0 ? 4 : n % 4 === 0 ? 2 : 0),
        });
    }
    return { ingredients: I, recipes, warehouses: wh, inventoryCounts: counts, dailySales: daily };
  }
  function ensureV04() {
    S.ingredients ||= [];
    S.recipes ||= [];
    S.warehouses ||= [];
    S.inventoryCounts ||= [];
    S.dailySales ||= [];
    S.inventoryPhotos ||= [];
    S.v04Forecast ||= { days: 7, leadDays: 2, safetyPct: 10 };
    if (S.mode === "demo" && !S.v04DemoSeeded && !S.ingredients.length) {
      const demo = v4Demo();
      Object.assign(S, demo);
      S.v04DemoSeeded = true;
    }
    if (!S.warehouses.length) S.warehouses = [{ id: "wh-main", name: "Hauptlager", note: "" }];
    S.version = 4;
  }
  ensureV04();
  const v4Pick = (selector) => document.querySelector(selector)?.click();
  function v4TopCard(title, value, desc, icon = "layers") {
    return `<div class="v4-kpi"><div class="v4-kpi-icon">${I(icon)}</div><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(desc)}</small></div>`;
  }
  function v4NavPills(active) {
    return `<div class="v4-pills"><button class="${active === "menu" ? "active" : ""}" data-view="menuimport">Speisekarten</button><button class="${active === "recipes" ? "active" : ""}" data-view="recipes">Rezepturen</button><button class="${active === "inventory" ? "active" : ""}" data-view="inventory">Inventur</button><button class="${active === "forecast" ? "active" : ""}" data-view="purchasing">Bestell-Forecast</button></div>`;
  }
  function v4TableEmpty(title, desc) {
    return `<div class="v4-empty">${I("info")}<strong>${esc(title)}</strong><span>${esc(desc)}</span></div>`;
  }
  function v4MenuView() {
    const list = V4_IMPORT_ROWS;
    return (
      pageHeader(
        "FOOD DATA HUB",
        "Speisekarten importieren",
        "Artikel und Verkaufspreise aus CSV, TXT, kopiertem Text oder PDF mit eingebettetem Text übernehmen.",
        `<button class="btn" data-v4="menu-template">${I("download")} CSV-Vorlage</button>`,
      ) +
      demoNotice() +
      v4NavPills("menu") +
      `<div class="v4-feature-head"><div><span class="v4-overline">01 / MENÜVERWALTUNG</span><h2>Speisekarte → Artikelstamm</h2><p>Erkannte Artikel werden erst nach deiner Kontrolle gespeichert. Vorhandene Artikel überschreiben wir nur nach ausdrücklicher Freigabe.</p></div><span class="v4-step">Import & prüfen</span></div><div class="v4-two"><section class="panel"><div class="v4-file-drop" data-v4="pick-menu"><div class="v4-file-icon">${I("upload")}</div><h3>Speisekarte hochladen</h3><p>CSV, TXT oder PDF (PDF-Textauslesung braucht Internet). Scans ohne Text brauchen später eine OCR-/KI-Anbindung.</p><button class="btn btn-primary" data-v4="pick-menu">Datei auswählen</button><input type="file" id="v4-menu-file" accept=".csv,.txt,.pdf" hidden></div><div class="field" style="margin-top:19px"><label>Alternativ Text aus Speisekarte einfügen</label><textarea id="v4-menu-text" class="v4-textarea" placeholder="BURGER&#10;Classic Burger ........ 17,90 €&#10;Veggie Burger ........ 16,80 €"></textarea><button class="btn" data-v4="parse-menu-text">Text erkennen</button></div><p class="calc-note">Die Texterkennung nutzt Regeln und kann Beschreibungen, Kombipreise oder Rubriken falsch zuordnen. Steuerstandard aus Text: 19 % als zu prüfender Platzhalter.</p></section><section class="panel">${panelHeader("Vorschau · kontrollieren")}${
        list.length
          ? `<div class="v4-review-actions"><span class="tag tag-neutral">${list.length} Positionen erkannt</span><label class="v4-check"><input type="checkbox" id="v4-update-existing"> Bestehende Produkte aktualisieren</label></div><div class="v4-review-list">${list
              .slice(0, 120)
              .map(
                (x, i) =>
                  `<label class="v4-review-row"><input type="checkbox" data-v4-menu-index="${i}" checked><span><strong>${esc(x.name)}</strong><small>${esc(x.category)} · USt vor Import prüfen</small></span><select class="v4-vat-select" data-v4-menu-vat="${i}" aria-label="Umsatzsteuersatz für ${esc(x.name)}">${selectOptions(
                    [
                      [7, "7 %"],
                      [19, "19 %"],
                      [0, "0 %"],
                    ],
                    x.vat,
                  )}</select><b>${euro(x.grossPrice)}</b></label>`,
              )
              .join("")}</div><button class="btn btn-primary" data-v4="commit-menu">Ausgewählte Artikel übernehmen</button>`
          : v4TableEmpty("Noch kein Import", "Lade eine Datei hoch oder füge Speisekartentext ein.")
      }<div class="v4-footnote">Für CSV: Produkt;Kategorie;Bruttopreis;USt;Einheit. Je nach Ausgabe-/Lieferart kann die tatsächlich geltende Umsatzsteuer abweichen. Bitte vor Übernahme kontrollieren.</div></section></div>`
    );
  }
  function v4RecipeView() {
    const products = S.items;
    const maps = S.recipes.map((r) => ({ p: stockOf(r.productId), r, calc: V4.recipeCalculation(r, S.ingredients) })).filter((x) => x.p);
    const complete = maps.filter((x) => x.calc.valid).length;
    return (
      pageHeader(
        "RECIPE ENGINE",
        "Rezepturen & Rohwaren",
        "Mehrstufige Rezeptzuordnung: Artikel → Rezept → Rohwaren und Einkaufseinheiten.",
        `<button class="btn" data-v4="recipe-template">${I("download")} Rezept-CSV</button><button class="btn" data-v4="ingredient-template">${I("download")} Rohwaren-CSV</button><button class="btn" data-v4="pick-ingredients">${I("upload")} Rohwarenimport</button><input type="file" id="v4-ingredients-file" accept=".csv,.txt" hidden><button class="btn" data-v4="new-ingredient">${I("plus")} Rohware</button><button class="btn btn-primary" data-v4="new-recipe">${I("plus")} Rezept</button>`,
      ) +
      demoNotice() +
      v4NavPills("recipes") +
      `<div class="v4-grid3">${v4TopCard("Rohwaren", number(S.ingredients.length), "Packungen und Einkaufspreise", "layers")}${v4TopCard("Hinterlegte Rezepturen", number(S.recipes.length), "Mit Zutatenverknüpfung", "calculator")}${v4TopCard("Kalkulierbare Rezepte", `${complete}/${maps.length}`, "Vollständige Eingaben", "check")}</div><div class="v4-two"><section class="panel">${panelHeader("Rezepturen", "Je Portion kalkuliert · netter Rohwareneinsatz", `<button class="btn btn-small" data-v4="sync-recipe-costs">Kosten in Produktstamm übernehmen</button>`)}${maps.length ? `<div class="v4-list">${maps.map(({ p, r, calc }) => `<button class="v4-list-row" data-v4="edit-recipe" data-id="${esc(p.id)}"><span><strong>${esc(p.name)}</strong><small>${(r.lines || []).length} Komponenten · Rezept für ${v4Num(r.yieldPortions)} Portion(en)</small></span><span class="v4-amount">${calc.valid ? euro(calc.costPerPortionNet) : "Prüfen"} <span class="v4-link">Bearbeiten →</span></span></button>`).join("")}</div>` : v4TableEmpty("Keine Rezepte", "Lege eine Rezeptur zu einem bereits erfassten Artikel an.")}<div class="v4-import-strip"><span>${I("upload")} Rezeptdaten aus CSV übernehmen</span><button class="btn btn-small" data-v4="pick-recipes">Import</button><input type="file" id="v4-recipes-file" accept=".csv,.txt" hidden></div></section><section class="panel">${panelHeader("Rohwarenstamm", "Einkaufsgebinde und Netto-EK")}${S.ingredients.length ? `<div class="v4-list v4-scroll">${S.ingredients.map((x) => `<button class="v4-list-row" data-v4="edit-ingredient" data-id="${esc(x.id)}"><span><strong>${esc(x.name)}</strong><small>${esc(x.category || "Sonstige")} · ${v4Qty(x.packQty, x.packUnit)} je Gebinde · Schwund ${v4Num(x.wastePct || 0)} %</small></span><span class="v4-amount">${euro(x.packCostNet)} <span class="v4-link">Bearbeiten →</span></span></button>`).join("")}</div>` : v4TableEmpty("Keine Rohwaren", "Rohwaren zuerst erfassen, dann Rezepte zuordnen.")}</section></div><div class="notice">${I("info")} <span><strong>Kalkulation:</strong> Rezeptmengen werden in Basiseinheiten umgerechnet. Gebindekosten und Schwund ergeben den Nettoeinsatz je Portion. Kosten werden erst nach manueller Freigabe in bestehende DB-Kalkulationen übernommen.</span></div>`
    );
  }
  function v4InventoryView() {
    const wh = S.warehouses.find((x) => x.id === V4_WAREHOUSE);
    const latest = V4.latestInventory(S.inventoryCounts);
    const groups = [...latest.values()]
      .filter((x) => V4_WAREHOUSE === "all" || x.warehouseId === V4_WAREHOUSE)
      .filter((x) => {
        const ing = v4Ing(x.ingredientId);
        return ing?.name.toLowerCase().includes(V4_SEARCH.toLowerCase());
      });
    let val = 0;
    for (const c of groups) {
      const ing = v4Ing(c.ingredientId),
        cost = ing ? V4.ingredientBaseCost(ing) : null;
      if (cost !== null) val += Number(c.baseQty) * cost;
    }
    const whOpts = selectOptions([["all", "Alle Lager"], ...S.warehouses.map((x) => [x.id, x.name])], V4_WAREHOUSE);
    return (
      pageHeader(
        "STOCK INTELLIGENCE",
        "Inventur & Lagerverwaltung",
        "Mobile Zählmaske, Fotodokumentation, Lagerübersicht und optional lokale Bilderkennung.",
        `<button class="btn" data-v4="new-warehouse">${I("plus")} Lager</button><button class="btn btn-primary" data-v4="inventory-count">${I("plus")} Inventur erfassen</button>`,
      ) +
      demoNotice() +
      v4NavPills("inventory") +
      `<div class="v4-grid3">${v4TopCard("Lagerbereiche", number(S.warehouses.length), "Voneinander getrennte Bestände", "layers")}${v4TopCard("Gezählte Positionen", number(groups.length), "Letzter Zählwert pro Lager / Artikel", "check")}${v4TopCard("Inventurwert netto", euro(val), "Nur zuletzt erfasste und bepreiste Positionen", "calculator")}</div><div class="panel"><div class="v4-toolbar"><div><h3>Lagerbestände</h3><p>Aktuellster Zählwert je Lager und Rohware; ungezählte Kombinationen sind nicht gleich Null.</p></div><div class="v4-toolbar-controls"><select id="v4-wh-filter" class="select">${whOpts}</select><input id="v4-inv-search" class="search-input" placeholder="Rohware suchen…" value="${esc(V4_SEARCH)}"></div></div>${
        groups.length
          ? `<div class="v4-stock-grid">${groups
              .sort((a, b) => {
                return (v4Ing(a.ingredientId)?.name || "").localeCompare(v4Ing(b.ingredientId)?.name || "");
              })
              .map((x) => {
                const ing = v4Ing(x.ingredientId),
                  unit = ing ? V4.baseUnit(ing.packUnit) : "",
                  warehouse = S.warehouses.find((y) => y.id === x.warehouseId);
                return `<button class="v4-stock-card" data-v4="count-from-stock" data-id="${esc(x.ingredientId)}" data-wh="${esc(x.warehouseId)}"><div class="v4-stock-head"><span class="v4-stock-icon">${I("layers")}</span><span class="v4-date">${esc(x.date)}</span></div><strong>${esc(ing?.name || "Unbekannt")}</strong><small>${esc(warehouse?.name || "Unbekanntes Lager")}</small><div class="v4-stock-value">${v4Qty(x.baseQty, unit)}</div><span class="v4-link">Neu zählen →</span></button>`;
              })
              .join("")}</div>`
          : v4TableEmpty("Keine Inventurwerte", "Starte eine Zählung. Die Menge wird je Rohware und Lager separat gespeichert.")
      }</div><div class="v4-two"><section class="panel">${panelHeader("Schnellerfassung · Smartphone", "Kamera oder Bestand per Hand")}${v4QuickCountForm()}</section><section class="panel">${panelHeader("Foto & KI-Erkennung", "Lokale Vision-Anbindung als Zusatzfunktion")}<p class="v4-p">Foto machen oder hochladen. Die Suite kann eine lokale Ollama-KI ansprechen, wenn du den mitgelieferten lokalen Server startest und ein Vision-Modell installiert hast. Ohne diese Einrichtung bleibt die manuelle Erfassung voll nutzbar.</p><div class="v4-vision-stage" id="v4-image-stage">${V4_CAPTURE_IMG ? `<img src="${v4SafeImage(V4_CAPTURE_IMG)}" alt="Inventurfoto">` : `${I("upload")}<span>Foto der Ware oder des Lagerregals hinzufügen</span>`}</div><input type="file" accept="image/*" capture="environment" id="v4-photo-file" hidden><div class="v4-vision-controls"><button class="btn" data-v4="pick-photo">${I("upload")} Foto aufnehmen</button><button class="btn btn-primary" data-v4="recognize-photo">${I("sparkles")} Mit lokaler KI prüfen</button></div><div id="v4-vision-results">${v4VisionResults()}</div><p class="calc-note">Wichtig: KI kann Etiketten, Verpackungen und Mengen falsch erkennen. Nichts wird automatisch gebucht. Jede Übernahme benötigt eine manuelle Kontrolle. Fotos werden nur beim Speichern der Inventurzeile lokal verkleinert abgelegt.</p></section></div><div class="panel"><h3>Inventurprotokoll</h3>${
        S.inventoryCounts.length
          ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Datum</th><th>Lager</th><th>Rohware</th><th>Gezählte Menge</th><th>Foto</th><th></th></tr></thead><tbody>${[
              ...S.inventoryCounts,
            ]
              .sort((a, b) => b.date.localeCompare(a.date) || String(b.savedAt || "").localeCompare(String(a.savedAt || "")))
              .slice(0, 35)
              .map(
                (c) =>
                  `<tr><td>${esc(c.date)}</td><td>${esc(S.warehouses.find((x) => x.id === c.warehouseId)?.name || "—")}</td><td>${esc(v4Ing(c.ingredientId)?.name || "—")}</td><td><strong>${v4Qty(c.baseQty, V4.baseUnit(v4Ing(c.ingredientId)?.packUnit))}</strong></td><td>${c.photo ? '<span class="tag tag-good">Foto</span>' : "—"}</td><td><button class="btn btn-small" data-v4="delete-count" data-id="${esc(c.id)}">Löschen</button></td></tr>`,
              )
              .join("")}</tbody></table></div>`
          : v4TableEmpty("Keine Zählungen", "Erste Inventur erfassen.")
      }</div>`
    );
  }
  function v4QuickCountForm(prefIng = "", prefWh = "") {
    const ing = V4_PRODUCT !== "all" ? V4_PRODUCT : prefIng || S.ingredients[0]?.id || "";
    const wh = prefWh || (V4_WAREHOUSE !== "all" ? V4_WAREHOUSE : S.warehouses[0]?.id) || "";
    return `<form id="v4-count-form" class="v4-count-form"><div class="field"><label>Welches Lager?</label><select name="warehouseId" required>${selectOptions(
      S.warehouses.map((x) => [x.id, x.name]),
      wh,
    )}</select></div><div class="field"><label>Welche Rohware?</label><select name="ingredientId" required>${selectOptions(
      S.ingredients.map((x) => [x.id, x.name]),
      ing,
    )}</select></div><div class="field"><label>Zähldatum</label><input type="date" name="date" value="${V4_TODAY()}" max="${V4_TODAY()}" required></div><div class="v4-quantity-fields"><div class="field"><label>Volle Gebinde</label><input type="number" name="packs" value="0" min="0" step="0.01" required></div><div class="field"><label>Lose Menge (Gebinde-Einheit)</label><input type="number" name="loose" value="0" min="0" step="0.01" required></div></div><p class="v4-hint">Beispiel: 2 Packungen à 1 kg + 250 g lose → 2 volle Gebinde und 250 g lose. Lose Menge bitte in der Grund-Einheit (g/ml/Stück) eingeben.</p><button type="submit" class="btn btn-primary v4-wide">Bestand buchen · Zählwert ersetzen</button><p class="calc-note">Pro Lager und Rohware wird der neueste vollständige Zählwert genutzt. Eine Zählung addiert nicht auf den alten Bestand.</p></form>`;
  }
  function v4Forecast() {
    const days = Number(S.v04Forecast?.days) || 7,
      leadDays = Number(S.v04Forecast?.leadDays) || 2,
      safetyPct = Number(S.v04Forecast?.safetyPct) || 0;
    return V4.demandForecast({
      dailySales: S.dailySales,
      recipes: S.recipes,
      ingredients: S.ingredients,
      inventoryCounts: S.inventoryCounts,
      periodDays: days,
      leadDays,
      wasteSafetyPct: safetyPct,
      referenceDate: V4_TODAY(),
    });
  }
  function v4ForecastView() {
    const f = v4Forecast();
    const rows = f.rows.filter((r) => r.requiredBase > 0 || r.stockBase !== null),
      real = rows.filter((r) => r.packs !== null),
      total = real.reduce((s, x) => s + x.estimatedNet, 0);
    const unknown = rows.filter((x) => x.stockBase === null).length;
    return (
      pageHeader(
        "PURCHASING INTELLIGENCE",
        "Bestell-Forecast",
        "Absatz der letzten 7/28 Tage → Rezepte → Rohwarenbedarf → Lagerbestände → Bestellgebinde.",
        `<button class="btn" data-v4="daily-template">${I("download")} Tagesabsatz-Vorlage</button><button class="btn btn-primary" data-v4="pick-daily">${I("upload")} Tagesverkäufe importieren</button><input id="v4-daily-file" type="file" accept=".csv,.txt" hidden>`,
      ) +
      demoNotice() +
      v4NavPills("forecast") +
      `<div class="v4-grid3">${v4TopCard("Geprüfte Tage", `${f.uniqueObservedDates}/28`, f.quality === "gut" ? "Gute Datenabdeckung" : "Unvollständige Daten – Prognose unsicher", "chart")}${v4TopCard("Bestellwert netto", euro(total), "Nur Rohwaren mit erfasstem Bestand", "calculator")}${v4TopCard("Bestand unbekannt", String(unknown), "Bestellmenge noch nicht berechenbar", "info")}</div><section class="panel"><div class="v4-toolbar"><div><h3>Szenario einstellen</h3><p>Gewichteter Absatz: 65 % aus dem Durchschnitt der letzten 7 Tage + 35 % aus 28 Tagen.</p></div><span class="tag tag-neutral">${esc(f.quality)}</span></div><form id="v4-forecast-form" class="v4-assumptions"><div class="field"><label>Bedarfszeitraum (Tage)</label><input name="days" type="number" min="1" max="90" value="${esc(S.v04Forecast.days)}"></div><div class="field"><label>Vorlauf / Lieferzeit (Tage)</label><input name="leadDays" type="number" min="0" max="30" value="${esc(S.v04Forecast.leadDays)}"></div><div class="field"><label>Sicherheitszuschlag (%)</label><input name="safetyPct" type="number" min="0" max="100" value="${esc(S.v04Forecast.safetyPct)}"></div><button class="btn btn-primary" type="submit">Forecast berechnen</button></form><div class="v4-forecast-note"><strong>Basis:</strong> ${f.demandProducts} Produkte mit Tagesabsatz, ${S.recipes.length} Rezepturen, ${S.ingredients.length} Rohwaren. ${f.missingRecipes.length ? `${f.missingRecipes.length} verkaufte Produkte ohne Rezept – deren Bedarf fehlt.` : "Alle erfassten Tagesverkäufe mit zugeordneten Rezepten."}</div></section><section class="panel"><div class="v4-toolbar"><h3>Bestellvorschlag je Rohware</h3><button class="btn" data-v4="export-order">${I("download")} CSV exportieren</button></div>${
        rows.length
          ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Rohware</th><th class="align-right">Prognosebedarf inkl. Sicherheit</th><th class="align-right">Bestand</th><th class="align-right">Bestellgebinde</th><th class="align-right">Einkaufswert netto</th><th>Hinweis</th></tr></thead><tbody>${rows
              .sort((a, b) => (b.estimatedNet || 0) - (a.estimatedNet || 0))
              .map(
                (x) =>
                  `<tr><td><strong>${esc(x.name)}</strong><small style="display:block;color:var(--muted)">Gebinde ${esc(String(v4Ing(x.id)?.packQty || ""))} ${esc(v4Ing(x.id)?.packUnit || "")}</small></td><td class="align-right">${v4Qty(x.requiredWithSafety, x.unit)}</td><td class="align-right">${x.stockBase === null ? "Unbekannt" : v4Qty(x.stockBase, x.unit)}</td><td class="align-right"><strong>${x.packs === null ? "—" : x.packs}</strong></td><td class="align-right">${x.estimatedNet === null ? "—" : euro(x.estimatedNet)}</td><td>${x.packs === null ? '<span class="tag tag-warn">Inventur fehlt</span>' : x.packs === 0 ? '<span class="tag tag-good">Bedarf gedeckt</span>' : '<span class="tag tag-neutral">Prüfen</span>'}</td></tr>`,
              )
              .join("")}</tbody></table></div>`
          : v4TableEmpty("Noch kein Rohwarenbedarf", "Importiere Tagesumsätze und erfasse Rezepturen.")
      }<div class="v4-footnote">Der Vorschlag berücksichtigt keine Wareneingänge, Reservierungen, Verderb-/MHD-Verläufe, Mindestbestellwerte, Saisonalität oder Bestellungen in Transit. Unvollständige Daten können zu falschen Mengen führen; vor einer Bestellung immer manuell prüfen.</div></section><section class="panel">${panelHeader("Tagesabsatz ergänzen", "Für belastbarere 7-/28-Tage-Verläufe")}<div class="v4-two"><div><button class="btn btn-primary" data-v4="daily-modal">${I("plus")} Tagesverkauf erfassen</button><p class="v4-p">Bestehende Monatsumsätze reichen für Tagesprognosen nicht aus. Tagesverkauf getrennt importieren, idealerweise aus der Kasse mit Produkt und Datum.</p></div><div class="v4-list v4-scroll">${
        [...S.dailySales]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 12)
          .map(
            (r) =>
              `<div class="v4-list-row"><span><strong>${esc(stockOf(r.productId)?.name || "Unbekannt")}</strong><small>${esc(r.date)}</small></span><b>${v4Num(r.quantity)} Stk.</b></div>`,
          )
          .join("") || "Keine Tagesumsätze"
      }</div></div></section>`
    );
  }
  function v4VisionResults() {
    if (!V4_VISION.length)
      return '<p class="v4-hint">Die KI erkennt mögliche Bezeichnungen und sichtbare Verpackungen; den tatsächlichen Bestand zählst und bestätigst du selbst.</p>';
    return `<div class="v4-ai-hint"><strong>KI-Vorschläge · ungeprüft</strong>${V4_VISION.slice(0, 8)
      .map(
        (x, i) =>
          `<div class="v4-ai-row"><span><b>${esc(String(x.label || "Unbekannt"))}</b><small>${esc(String(x.note || x.notes || "Menge nicht garantiert"))}</small></span><button class="btn btn-small" data-v4="adopt-vision" data-vi="${i}">Zuordnen</button></div>`,
      )
      .join("")}</div>`;
  }
  function v4Modal(title, inner, onSubmit, wide = false) {
    document.querySelector("#modal-layer").innerHTML =
      `<div class="modal ${wide ? "v4-modal-large" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><h2>${esc(title)}</h2><button class="close-btn" data-v4="close">×</button></div><form id="v4-modal-form">${inner}<div class="modal-footer"><button type="button" class="btn" data-v4="close">Abbrechen</button><button class="btn btn-primary" type="submit">${I("check")} Speichern</button></div></form></div>`;
    document.querySelector("#v4-modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await onSubmit(new FormData(e.currentTarget));
      } catch (err) {
        toast(err.message, "error");
      }
    });
  }
  function v4IngredientModal(id) {
    const x = v4Ing(id) || {
      id: "",
      name: "",
      category: "Rohwaren",
      packQty: 1,
      packUnit: "kg",
      packCostNet: 0,
      wastePct: 0,
      minimumBase: 0,
    };
    v4Modal(
      x.id ? "Rohware bearbeiten" : "Rohware anlegen",
      `<div class="field-grid"><div class="field"><label>Name *</label><input name="name" maxlength="120" required value="${esc(x.name)}"></div><div class="field"><label>Kategorie</label><input name="category" maxlength="80" value="${esc(x.category)}"></div><div class="field"><label>Einkaufsgebinde · Menge *</label><input name="packQty" type="number" min="0.001" step="any" required value="${esc(x.packQty)}"></div><div class="field"><label>Gebinde-Einheit *</label><select name="packUnit">${selectOptions(V4_UNITS, x.packUnit)}</select></div><div class="field"><label>Netto-EK je Gebinde (€) *</label><input name="packCostNet" type="number" step="any" min="0" required value="${esc(x.packCostNet)}"></div><div class="field"><label>Standard-Schwund (%)</label><input name="wastePct" type="number" step="any" min="0" max="99" value="${esc(x.wastePct || 0)}"></div></div>`,
      (f) => {
        const name = String(f.get("name")).trim(),
          packQty = V4.N(f.get("packQty")),
          packUnit = String(f.get("packUnit")),
          packCostNet = V4.N(f.get("packCostNet")),
          wastePct = V4.N(f.get("wastePct"));
        if (!name || !(packQty > 0) || packCostNet < 0 || wastePct < 0 || wastePct >= 100 || !V4.baseUnit(packUnit))
          throw Error("Rohwarenwerte prüfen.");
        const row = { ...x, id: x.id || uid(), name, category: String(f.get("category")).trim(), packQty, packUnit, packCostNet, wastePct };
        if (x.id) S.ingredients[S.ingredients.findIndex((i) => i.id === x.id)] = row;
        else S.ingredients.push(row);
        markEdited();
        persist();
        closeModal();
        render();
        toast("Rohware gespeichert.");
      },
    );
  }
  function v4RecipeLine(l = {}, index = 0) {
    return `<div class="v4-ingredient-row"><select name="ing-${index}">${selectOptions(
      S.ingredients.map((x) => [x.id, x.name]),
      l.ingredientId,
    )}</select><input name="amount-${index}" type="number" step="any" min="0.001" required value="${esc(l.amount ?? 100)}"><select name="unit-${index}">${selectOptions(V4_UNITS, l.unit || "g")}</select><button class="btn btn-small" type="button" data-v4="remove-recipe-line">×</button></div>`;
  }
  function v4RecipeModal(id) {
    if (!S.items.length) return toast("Erst ein Produkt anlegen.", "error");
    if (!S.ingredients.length) return toast("Erst Rohwaren anlegen.", "error");
    const rec = v4Rec(id) || {
      productId: id || S.items[0].id,
      yieldPortions: 1,
      lines: [{ ingredientId: S.ingredients[0].id, amount: 100, unit: V4.baseUnit(S.ingredients[0].packUnit) }],
    };
    v4Modal(
      "Rezeptur bearbeiten",
      `<div class="field-grid"><div class="field"><label>Verkaufsartikel</label><select name="productId" required>${selectOptions(
        S.items.map((x) => [x.id, x.name]),
        rec.productId,
      )}</select></div><div class="field"><label>Ausbeute in Portionen</label><input name="yieldPortions" min="0.001" step="any" type="number" value="${esc(rec.yieldPortions)}" required></div></div><h3 class="section-heading">Zutaten · Einsatzmengen</h3><div id="v4-recipe-lines">${rec.lines.map(v4RecipeLine).join("")}</div><button class="btn" type="button" data-v4="add-recipe-line">${I("plus")} Zutat hinzufügen</button><p class="calc-note">Die Mengen sind je Rezeptausbeute gemeint. Gramm und Kilogramm sowie ml und Liter werden passend umgerechnet. Schwund wird aus dem Rohwarenstamm übernommen.</p>`,
      (f) => {
        const productId = String(f.get("productId")),
          yieldPortions = V4.N(f.get("yieldPortions"));
        if (!(yieldPortions > 0) || !stockOf(productId)) throw Error("Ungültige Rezeptausbeute");
        const lines = [];
        document.querySelectorAll("#v4-recipe-lines .v4-ingredient-row").forEach((row, i) => {
          const ingredientId = row.querySelector("select")?.value,
            amount = V4.N(row.querySelector("input")?.value),
            unit = row.querySelectorAll("select")[1]?.value;
          if (!v4Ing(ingredientId) || !(amount > 0) || V4.convert(amount, unit, V4.baseUnit(v4Ing(ingredientId).packUnit)) === null)
            throw Error("Zutat, Menge und Einheit prüfen (g/kg, ml/l, Stück).");
          lines.push({ ingredientId, amount, unit });
        });
        if (!lines.length) throw Error("Mindestens eine Zutat erfassen");
        const next = { productId, yieldPortions, lines },
          old = S.recipes.findIndex((x) => x.productId === productId);
        if (old >= 0) S.recipes[old] = next;
        else S.recipes.push(next);
        markEdited();
        persist();
        closeModal();
        render();
        toast("Rezeptur gespeichert.");
      },
      true,
    );
  }
  function v4WarehouseModal() {
    v4Modal(
      "Lager anlegen",
      `<div class="field"><label>Lagerbezeichnung</label><input name="name" required maxlength="80" placeholder="z. B. Kühlhaus 1"></div><div class="field"><label>Beschreibung</label><input name="note" maxlength="140" placeholder="optional"></div>`,
      (f) => {
        const name = String(f.get("name")).trim();
        if (!name || S.warehouses.some((w) => V4.norm(w.name) === V4.norm(name))) throw Error("Lagername fehlt oder existiert schon");
        S.warehouses.push({ id: uid(), name, note: String(f.get("note")).trim() });
        markEdited();
        persist();
        closeModal();
        render();
        toast("Lager angelegt.");
      },
    );
  }
  function v4DailyModal() {
    if (!S.items.length) return toast("Erst Produkt anlegen", "error");
    v4Modal(
      "Tagesverkauf erfassen",
      `<div class="field-grid"><div class="field"><label>Datum</label><input type="date" name="date" required value="${V4_TODAY()}" max="${V4_TODAY()}"></div><div class="field"><label>Produkt</label><select name="productId">${selectOptions(
        S.items.map((x) => [x.id, x.name]),
        S.items[0].id,
      )}</select></div><div class="field"><label>Outlet</label><select name="outletId">${outletSelect("restaurant", false)}</select></div><div class="field"><label>Absatz (Stück)</label><input type="number" step="1" min="0" name="quantity" required value="0"></div></div>`,
      (f) => {
        const date = String(f.get("date")),
          productId = String(f.get("productId")),
          outletId = String(f.get("outletId")),
          quantity = V4.N(f.get("quantity"));
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          date > V4_TODAY() ||
          !stockOf(productId) ||
          !S.outlets.some((x) => x.id === outletId) ||
          !Number.isInteger(quantity) ||
          quantity < 0
        )
          throw Error("Tagesverkauf ungültig");
        S.dailySales.push({ id: uid(), date, productId, outletId, quantity });
        markEdited();
        persist();
        closeModal();
        render();
        toast("Tagesumsatz erfasst.");
      },
    );
  }
  async function v4LoadMenu(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast("Datei maximal 8 MB", "error");
    try {
      let text = "";
      if (/\.pdf$/i.test(file.name)) {
        toast("PDF-Text wird gelesen …");
        text = await v4ExtractPDF(file);
      } else text = await file.text();
      const parsed = /\.csv$/i.test(file.name) ? V4.parseMenuCSV(text) : V4.parseMenuText(text);
      V4_IMPORT_ROWS = parsed.rows;
      if (!parsed.rows.length) throw Error("Keine verlässlich erkennbaren Artikelpreise gefunden. Bitte CSV-Import verwenden.");
      render();
      toast(
        `${parsed.rows.length} Speisekartenpositionen als Vorschau erkannt.${parsed.errors.length ? " Einige Zeilen nicht erkannt." : ""}`,
      );
    } catch (e) {
      toast("Speisekartenimport: " + e.message, "error");
    }
  }
  async function v4ExtractPDF(file) {
    if (!window.pdfjsLib) {
      const version = "3.11.174";
      const src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.min.js`;
      await new Promise((ok, bad) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = ok;
        s.onerror = () => bad(new Error("PDF-Modul kann nicht geladen werden. Internet nötig; alternativ PDF-Text kopieren."));
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
    }
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (pdf.numPages > 35) throw Error("PDF hat zu viele Seiten (maximal 35).");
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p),
        content = await page.getTextContent(),
        byY = new Map();
      for (const item of content.items) {
        const y = Math.round((item.transform?.[5] || 0) / 4) * 4;
        const list = byY.get(y) || [];
        list.push({ x: item.transform?.[4] || 0, str: item.str });
        byY.set(y, list);
      }
      for (const [y, parts] of [...byY].sort((a, b) => b[0] - a[0]))
        lines.push(
          parts
            .sort((a, b) => a.x - b.x)
            .map((x) => x.str)
            .join("    "),
        );
    }
    await pdf.destroy();
    return lines.join("\n");
  }
  async function v4LoadIngredients(file) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast("Datei zu groß", "error");
    try {
      const rows = V4.parseTable(await file.text()),
        heads = rows.shift().map(V4.norm),
        idx = (...aliases) => heads.findIndex((x) => aliases.some((a) => V4.norm(a) === x));
      const [ni, ci, qi, ui, pi, wi] = [
        idx("Rohware", "Zutat", "Name"),
        idx("Kategorie"),
        idx("Gebindemenge", "Packmenge"),
        idx("Einheit"),
        idx("NettoEK", "Netto Einkaufspreis", "Gebindepreis"),
        idx("Schwund"),
      ];
      if ([ni, qi, ui, pi].some((x) => x < 0)) throw Error("Spalten Rohware, Gebindemenge, Einheit, NettoEK fehlen.");
      const valid = [],
        errors = [];
      for (const [i, r] of rows.entries()) {
        const name = String(r[ni] || "").trim(),
          packQty = V4.N(r[qi]),
          packUnit = String(r[ui] || "")
            .trim()
            .toLowerCase(),
          packCostNet = V4.N(r[pi]),
          wastePct = wi >= 0 && r[wi] ? V4.N(r[wi]) : 0;
        if (!name || !(packQty > 0) || packCostNet < 0 || !(wastePct >= 0 && wastePct < 100) || !V4.baseUnit(packUnit)) {
          errors.push(i + 2);
          continue;
        }
        valid.push({ name, category: ci >= 0 ? String(r[ci] || "Rohwaren") : "Rohwaren", packQty, packUnit, packCostNet, wastePct });
      }
      if (!valid.length) throw Error("Keine gültigen Rohwaren.");
      if (
        !confirm(
          `${valid.length} Rohwaren importieren und vorhandene Rohwaren gleichen Namens preislich aktualisieren? ${errors.length} Zeilen überspringen.`,
        )
      )
        return;
      let created = 0,
        updated = 0;
      for (const x of valid) {
        const match = S.ingredients.find((y) => V4.norm(y.name) === V4.norm(x.name));
        if (match) {
          Object.assign(match, x);
          updated++;
        } else {
          S.ingredients.push({ id: uid(), ...x });
          created++;
        }
      }
      markEdited();
      persist();
      render();
      toast(`${created} Rohwaren angelegt, ${updated} aktualisiert.`);
    } catch (e) {
      toast("Rohwarenimport: " + e.message, "error");
    }
  }
  async function v4LoadRecipes(file) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast("Datei zu groß", "error");
    try {
      const r = V4.parseRecipesCSV(await file.text(), S.items, S.ingredients);
      if (!r.rows.length) throw Error("Keine gültigen Rezeptzuordnungen. Produktnamen und Rohwaren müssen bereits existieren.");
      if (
        !confirm(
          `${r.rows.length} Rezepturen importieren? ${r.errors.length} Zeilen fehlerhaft.${r.errors.length ? "\n" + r.errors.slice(0, 5).join("\n") : ""}`,
        )
      )
        return;
      for (const x of r.rows) {
        const i = S.recipes.findIndex((y) => y.productId === x.productId);
        if (i >= 0) S.recipes[i] = x;
        else S.recipes.push(x);
      }
      markEdited();
      persist();
      render();
      toast(`${r.rows.length} Rezepturen importiert.`);
    } catch (e) {
      toast("Rezeptimport: " + e.message, "error");
    }
  }
  async function v4LoadDaily(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("Datei zu groß", "error");
    try {
      const table = V4.parseTable(await file.text()),
        head = table.shift().map(V4.norm),
        ix = (...names) => head.findIndex((x) => names.some((n) => V4.norm(n) === x)),
        p = ix("Produkt"),
        q = ix("Menge", "Absatz"),
        d = ix("Datum"),
        o = ix("Outlet");
      if ([p, q, d, o].some((x) => x < 0)) throw Error("CSV-Spalten benötigt: Datum, Produkt, Outlet, Menge.");
      const rows = [],
        errors = [];
      for (const [i, r] of table.entries()) {
        const product = S.items.filter((x) => V4.norm(x.name) === V4.norm(r[p])),
          outlet = S.outlets.filter((x) => V4.norm(x.name) === V4.norm(r[o])),
          quantity = V4.N(r[q]),
          date = String(r[d] || "").trim();
        if (
          product.length !== 1 ||
          outlet.length !== 1 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          date > V4_TODAY() ||
          !Number.isInteger(quantity) ||
          quantity < 0
        ) {
          errors.push(i + 2);
          continue;
        }
        rows.push({ id: uid(), date, productId: product[0].id, outletId: outlet[0].id, quantity });
      }
      if (!rows.length) throw Error("Keine gültigen Tagesverkaufszeilen.");
      if (
        !confirm(
          `${rows.length} Tagesverkaufszeilen hinzufügen, ${errors.length} überspringen? Achtung: identische Zeilen werden sonst doppelt gezählt.`,
        )
      )
        return;
      S.dailySales.push(...rows);
      markEdited();
      persist();
      render();
      toast(`${rows.length} Tagesverkäufe importiert.`);
    } catch (e) {
      toast("Tagesimport: " + e.message, "error");
    }
  }
  function v4CommitMenu() {
    const selected = [...document.querySelectorAll("[data-v4-menu-index]:checked")].map((e) => {
        const i = Number(e.dataset.v4MenuIndex),
          v = V4_IMPORT_ROWS[i],
          vat = Number(document.querySelector(`[data-v4-menu-vat="${i}"]`)?.value || v.vat);
        return { ...v, vat };
      }),
      update = document.querySelector("#v4-update-existing")?.checked;
    if (!selected.length) return toast("Keine Position markiert", "error");
    let added = 0,
      updated = 0,
      skipped = 0;
    for (const x of selected) {
      const matches = S.items.filter((y) => V4.norm(y.name) === V4.norm(x.name));
      if (matches.length) {
        if (update && matches.length === 1) {
          Object.assign(matches[0], { grossPrice: x.grossPrice, category: x.category, vat: x.vat });
          updated++;
        } else skipped++;
        continue;
      }
      S.items.push({
        id: uid(),
        name: x.name,
        category: x.category,
        quantity: 0,
        costNet: 0,
        grossPrice: x.grossPrice,
        vat: x.vat,
        unit: x.unit,
      });
      added++;
    }
    if (!added && !updated) return toast("Keine Änderungen. Dubletten wurden übersprungen.", "error");
    markEdited();
    persist();
    V4_IMPORT_ROWS = [];
    render();
    toast(`${added} Artikel neu, ${updated} aktualisiert, ${skipped} Dubletten übersprungen.`);
  }
  function v4SyncCosts() {
    const updates = [];
    for (const r of S.recipes) {
      const p = stockOf(r.productId),
        x = V4.recipeCalculation(r, S.ingredients);
      if (!p || !x.valid) continue;
      const d = p.costDetail || { ingredientsNet: p.costNet || 0, wastePct: 0, packagingNet: 0, laborNet: 0, feesNet: 0, otherNet: 0 };
      updates.push({ p, d, cost: x.costPerPortionNet });
    }
    if (!updates.length) return toast("Keine kalkulierbaren Rezepte", "error");
    if (
      !confirm(
        `Kosten von ${updates.length} Rezepten in den Produktstamm übernehmen? Bestehende Zutatenkosten werden ersetzt; sonstige variable Kosten bleiben erhalten. Bestehender Produktschwund wird auf 0 gesetzt, da der Rezeptschwund bereits eingerechnet ist.`,
      )
    )
      return;
    for (const row of updates) {
      row.p.costDetail = { ...row.d, ingredientsNet: row.cost, wastePct: 0 };
      row.p.costNet = row.cost;
    }
    markEdited();
    persist();
    render();
    toast(`${updates.length} Rezeptkosten übernommen.`);
  }
  async function v4ProcessPhoto(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast("Foto maximal 10 MB", "error");
    if (!file.type.startsWith("image/")) return toast("Bilddatei erforderlich", "error");
    try {
      const img = await createImageBitmap(file),
        w = Math.min(760, img.width),
        h = Math.round((img.height * w) / img.width),
        canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      V4_CAPTURE_IMG = canvas.toDataURL("image/jpeg", 0.55);
      V4_VISION = [];
      render();
      toast("Foto bereit. Jetzt Inventur zählen oder KI-Vorschlag anfordern.");
    } catch (e) {
      toast("Foto konnte nicht gelesen werden", "error");
    }
  }
  async function v4AnalyzePhoto() {
    if (!V4_CAPTURE_IMG) return toast("Bitte zuerst ein Foto aufnehmen.", "error");
    if (location.protocol === "file:") return toast("Lokale KI braucht den mitgelieferten Server. START_HIER lesen.", "error");
    try {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 90000);
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: V4_CAPTURE_IMG, ingredients: S.ingredients.map((x) => x.name) }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "KI nicht erreichbar");
      V4_VISION = Array.isArray(data.suggestions) ? data.suggestions : [];
      render();
      toast(V4_VISION.length ? "Ungeprüfte KI-Vorschläge verfügbar." : "Kein sicherer Vorschlag erkannt.");
    } catch (e) {
      toast("KI-Analyse nicht verfügbar: " + e.message, "error");
    }
  }
  function v4AdoptVision(index) {
    const suggestion = V4_VISION[index];
    if (!suggestion) return;
    const label = String(suggestion.suggestedIngredient || suggestion.label || "");
    const ing =
      S.ingredients.find((x) => V4.norm(x.name) === V4.norm(label)) || S.ingredients.find((x) => V4.norm(x.name).includes(V4.norm(label)));
    if (!ing) return toast(`Kein eindeutiger Rohwaren-Match für „${label}“. Bitte selbst wählen.`, "error");
    document.querySelector('#v4-count-form select[name="ingredientId"]').value = ing.id;
    document.querySelector("#v4-count-form").scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Rohware zugeordnet. Menge bitte selbst zählen.");
  }
  function v4SaveCount(form) {
    const f = new FormData(form),
      warehouseId = String(f.get("warehouseId")),
      ingredientId = String(f.get("ingredientId")),
      date = String(f.get("date")),
      packs = V4.N(f.get("packs")),
      loose = V4.N(f.get("loose")),
      ing = v4Ing(ingredientId);
    if (
      !ing ||
      !S.warehouses.some((x) => x.id === warehouseId) ||
      !(date <= V4_TODAY()) ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) ||
      ![packs, loose].every((x) => Number.isFinite(x) && x >= 0)
    )
      return toast("Inventurfelder überprüfen.", "error");
    const packBase = V4.baseQuantity(ing.packQty, ing.packUnit),
      baseQty = packs * packBase + loose;
    if (!Number.isFinite(baseQty) || baseQty > 1e9) return toast("Ungültige Mengenangabe", "error");
    S.inventoryCounts.push({
      id: uid(),
      warehouseId,
      ingredientId,
      date,
      baseQty: V4.R(baseQty),
      savedAt: new Date().toISOString(),
      photo: V4_CAPTURE_IMG.length <= 170000 ? V4_CAPTURE_IMG : "",
    });
    V4_CAPTURE_IMG = "";
    V4_VISION = [];
    markEdited();
    persist();
    render();
    toast(`${ing.name}: ${v4Qty(baseQty, V4.baseUnit(ing.packUnit))} gezählt.`);
  }
  const v4Csv = (v) => String(v ?? "").replace(/"/g, '""');
  function v4ExportOrder() {
    const f = v4Forecast(),
      head = ["Rohware", "Einheit", "Bedarf mit Sicherheit", "Bestand", "Bestellgebinde", "Einkaufswert Netto", "Status"];
    const lines = [
      head.join(";"),
      ...f.rows.map((r) =>
        [
          r.name,
          r.unit,
          r.requiredWithSafety,
          r.stockBase === null ? "unbekannt" : r.stockBase,
          r.packs === null ? "nicht berechenbar" : r.packs,
          r.estimatedNet === null ? "" : r.estimatedNet,
          r.stockBase === null ? "Bestand fehlt" : "Prüfen",
        ]
          .map((x) => '"' + v4Csv(x) + '"')
          .join(";"),
      ),
    ];
    downloadFile("\uFEFF" + lines.join("\n"), "GLB_Bestellforecast_" + V4_TODAY() + ".csv", "text/csv;charset=utf-8");
  }
  function v4DemoPanel() {
    return `<section class="v4-module-banner"><div><span class="v4-overline">NEU · OPERATIONS SUITE</span><h2>Vom Verkauf bis zur Bestellung.</h2><p>Speisekarten und Rezepturen verknüpfen, Inventur pro Lager erfassen, Rohwarenbedarf aus 7-/28-Tage-Verkäufen kalkulieren.</p><div class="v4-banner-actions"><button class="btn btn-primary" data-view="purchasing">Bestell-Forecast ansehen →</button><button class="btn" data-view="inventory">Inventur starten</button></div></div><div class="v4-banner-stats"><span>REZEPTE</span><b>${S.recipes.length}</b><span>LAGER</span><b>${S.warehouses.length}</b><span>ROHWAREN</span><b>${S.ingredients.length}</b></div></section>`;
  }
  Object.assign(handlers, { menuimport: v4MenuView, recipes: v4RecipeView, inventory: v4InventoryView, purchasing: v4ForecastView });
  Object.assign(labels, {
    menuimport: "Speisekarten",
    recipes: "Rezepturen",
    inventory: "Inventur & Lager",
    purchasing: "Bestell-Forecast",
  });
  const v4OriginalOverview = handlers.overview;
  handlers.overview = () => v4OriginalOverview() + v4DemoPanel();
  const v4OriginalImport = handlers.import;
  handlers.import = () =>
    v4OriginalImport() +
    `<section class="panel"><h3>Weitere Importmöglichkeiten</h3><p>Zusätzlich zum bisherigen Artikel- und Verkaufsimport stehen eigene Importmasken für Speisekarten, Rezepturen und Tagesverkäufe zur Verfügung.</p><div class="v4-banner-actions"><button class="btn" data-view="menuimport">Speisekarten-Import</button><button class="btn" data-view="recipes">Rezept-Import</button><button class="btn" data-view="purchasing">Tagesabsatz-Import</button></div></section>`;
  document.addEventListener("submit", (e) => {
    if (e.target.id === "v4-count-form") {
      e.preventDefault();
      v4SaveCount(e.target);
    } else if (e.target.id === "v4-forecast-form") {
      e.preventDefault();
      const f = new FormData(e.target),
        days = Number(f.get("days")),
        leadDays = Number(f.get("leadDays")),
        safetyPct = Number(f.get("safetyPct"));
      if (!(days >= 1 && days <= 90 && leadDays >= 0 && leadDays <= 30 && safetyPct >= 0 && safetyPct <= 100))
        return toast("Bitte gültige Forecast-Werte eingeben.", "error");
      S.v04Forecast = { days, leadDays, safetyPct };
      persist();
      render();
      toast("Bestellszenario aktualisiert.");
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "v4-inv-search") {
      V4_SEARCH = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const inp = document.querySelector("#v4-inv-search");
      inp?.focus();
      inp?.setSelectionRange(pos, pos);
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "v4-wh-filter") {
      V4_WAREHOUSE = e.target.value;
      render();
    }
    if (e.target.id === "v4-menu-file") v4LoadMenu(e.target.files?.[0]);
    if (e.target.id === "v4-recipes-file") v4LoadRecipes(e.target.files?.[0]);
    if (e.target.id === "v4-ingredients-file") v4LoadIngredients(e.target.files?.[0]);
    if (e.target.id === "v4-daily-file") v4LoadDaily(e.target.files?.[0]);
    if (e.target.id === "v4-photo-file") v4ProcessPhoto(e.target.files?.[0]);
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-v4]");
    if (!a) return;
    e.preventDefault();
    const name = a.dataset.v4;
    switch (name) {
      case "close":
        closeModal();
        break;
      case "menu-template":
        downloadFile(
          "\uFEFFProdukt;Kategorie;Bruttopreis;USt;Einheit\nCheeseburger;Burger;18,90;19;Portion\nEspresso;Kaffee;3,20;19;Stück\n",
          "GLB_Speisekarte_Vorlage.csv",
          "text/csv;charset=utf-8",
        );
        break;
      case "pick-menu":
        v4Pick("#v4-menu-file");
        break;
      case "parse-menu-text": {
        const t = document.querySelector("#v4-menu-text")?.value || "";
        V4_IMPORT_ROWS = V4.parseMenuText(t).rows;
        render();
        toast(`${V4_IMPORT_ROWS.length} Artikel als Vorschau erkannt.`);
        break;
      }
      case "commit-menu":
        v4CommitMenu();
        break;
      case "ingredient-template":
        downloadFile(
          "\uFEFFRohware;Kategorie;Gebindemenge;Einheit;NettoEK;Schwund\nBurger Bun;Backwaren;24;stk;19,20;2\nCheddar;Molkerei;1;kg;11,80;4\n",
          "GLB_Rohwaren_Vorlage.csv",
          "text/csv;charset=utf-8",
        );
        break;
      case "pick-ingredients":
        v4Pick("#v4-ingredients-file");
        break;
      case "new-ingredient":
        v4IngredientModal();
        break;
      case "edit-ingredient":
        v4IngredientModal(a.dataset.id);
        break;
      case "recipe-template":
        downloadFile(
          "\uFEFFProdukt;Zutat;Menge;Einheit;Portionen\nClassic Cheeseburger;Burger Bun;1;stk;1\nClassic Cheeseburger;Cheddar;40;g;1\n",
          "GLB_Rezeptimport_Vorlage.csv",
          "text/csv;charset=utf-8",
        );
        break;
      case "pick-recipes":
        v4Pick("#v4-recipes-file");
        break;
      case "new-recipe":
        v4RecipeModal();
        break;
      case "edit-recipe":
        v4RecipeModal(a.dataset.id);
        break;
      case "add-recipe-line": {
        const box = document.querySelector("#v4-recipe-lines");
        if (box) {
          const holder = document.createElement("div");
          holder.innerHTML = v4RecipeLine(
            { ingredientId: S.ingredients[0].id, amount: 100, unit: V4.baseUnit(S.ingredients[0].packUnit) },
            box.children.length,
          );
          box.appendChild(holder.firstElementChild);
        }
        break;
      }
      case "remove-recipe-line":
        a.closest(".v4-ingredient-row")?.remove();
        break;
      case "sync-recipe-costs":
        v4SyncCosts();
        break;
      case "new-warehouse":
        v4WarehouseModal();
        break;
      case "inventory-count":
        document.querySelector("#v4-count-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      case "count-from-stock": {
        V4_PRODUCT = a.dataset.id;
        V4_WAREHOUSE = a.dataset.wh;
        render();
        document.querySelector("#v4-count-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
      case "pick-photo":
        v4Pick("#v4-photo-file");
        break;
      case "recognize-photo":
        v4AnalyzePhoto();
        break;
      case "adopt-vision":
        v4AdoptVision(Number(a.dataset.vi));
        break;
      case "delete-count": {
        if (!confirm("Diese Inventur-Zählung wirklich löschen?")) break;
        S.inventoryCounts = S.inventoryCounts.filter((x) => x.id !== a.dataset.id);
        persist();
        render();
        break;
      }
      case "daily-template":
        downloadFile(
          "\uFEFFDatum;Produkt;Outlet;Menge\n2026-10-19;Classic Cheeseburger;Restaurant;12\n",
          "GLB_Tagesabsatz_Vorlage.csv",
          "text/csv;charset=utf-8",
        );
        break;
      case "pick-daily":
        v4Pick("#v4-daily-file");
        break;
      case "daily-modal":
        v4DailyModal();
        break;
      case "export-order":
        v4ExportOrder();
        break;
    }
  });

  /* v0.5 injected into the existing GLB app closure to preserve v0.1-v0.4 features and local backups. */
  const V5 = window.GLBV05;
  function ensureV05() {
    S.purchaseOrders ||= [];
    S.stockMovements ||= [];
    S.ingredientWarehouses ||= {};
    S.v05SalesUsage ??= true;
    S.version = 5;
  }
  ensureV05();
  const v5Today = () => V4_TODAY();
  const v5Price = (n) => euro(n),
    v5Qty = (n, i) => v4Qty(n, V4.baseUnit(i.packUnit));
  let V5_STOCK_SEARCH = "",
    V5_STOCK_WAREHOUSE = "all",
    V5_SHOW_ONLY = "all";
  function v5State() {
    return V5.inventoryState({
      ingredients: S.ingredients,
      warehouses: S.warehouses,
      inventoryCounts: S.inventoryCounts,
      stockMovements: S.stockMovements,
      dailySales: S.dailySales,
      recipes: S.recipes,
      assignments: S.ingredientWarehouses,
      asOf: v5Today(),
      includeSalesUsage: S.v05SalesUsage,
    });
  }
  const v5OriginalForecast = v4Forecast;
  v4Forecast = () => {
    const opt = S.v04Forecast || { days: 7, leadDays: 2, safetyPct: 10 };
    const snapshots = v5State().virtualCounts;
    const f = V4.demandForecast({
      dailySales: S.dailySales,
      recipes: S.recipes,
      ingredients: S.ingredients,
      inventoryCounts: snapshots,
      periodDays: opt.days || 7,
      leadDays: opt.leadDays ?? 2,
      wasteSafetyPct: opt.safetyPct ?? 10,
      referenceDate: v5Today(),
    });
    const committed = new Map();
    for (const order of S.purchaseOrders.filter((o) => o.status === "ordered"))
      for (const l of order.lines || []) committed.set(l.ingredientId, (committed.get(l.ingredientId) || 0) + Number(l.packs));
    for (const r of f.rows) {
      r.reservedPacks = committed.get(r.id) || 0;
      if (r.packs !== null) {
        r.packs = Math.max(0, r.packs - r.reservedPacks);
        const ing = v4Ing(r.id);
        r.estimatedNet = V4.R(r.packs * Number(ing?.packCostNet || 0));
        r.orderBase = V4.R(r.packs * V4.baseQuantity(ing.packQty, ing.packUnit));
      }
    }
    return f;
  };
  const v5Tag = (str, cls = "") => `<span class="v5-tag ${cls}">${esc(str)}</span>`;
  function v5Nav() {
    const nav = document.querySelector('.nav[aria-label="Hauptnavigation"]');
    if (!nav || !nav.dataset || !nav.querySelectorAll || nav.dataset.v5 === "1") return;
    nav.dataset.v5 = "1";
    const buttons = [...nav.querySelectorAll("[data-view]")];
    const buttonMap = new Map(buttons.map((b) => [b.dataset.view, b]));
    const addButton = (view, label, ico) => {
      const b = document.createElement("button");
      b.className = "nav-item";
      b.dataset.view = view;
      b.innerHTML = `<span class="nav-ico">${I(ico)}</span>${esc(label)}`;
      buttonMap.set(view, b);
    };
    addButton("operations", "Mission Control", "bolt");
    addButton("orders", "Bestellungen", "cart");
    addButton("stockledger", "Warenbewegungen", "refresh");
    addButton("setup", "Einrichtung", "check");
    nav.innerHTML = "";
    const groups = [
      ["ÜBERSICHT", ["overview", "operations"]],
      ["SORTIMENT", ["products", "menuimport", "recipes", "costs", "calculator", "portfolio", "lifecycle"]],
      ["TAGESGESCHÄFT", ["inventory", "stockledger", "purchasing", "orders", "outlets", "funnel"]],
      ["INTELLIGENCE", ["insights", "market"]],
    ];
    for (const [title, ids] of groups) {
      const label = document.createElement("div");
      label.className = "v5-navgroup-label";
      label.textContent = title;
      nav.append(label);
      for (const id of ids) {
        const b = buttonMap.get(id);
        if (b) {
          b.querySelector(".soon")?.remove();
          nav.append(b);
        }
      }
    }
    const sysNav = document.querySelector('.nav[aria-label="Daten und System"]');
    sysNav?.prepend(buttonMap.get("setup"));
    const topRight = document.querySelector(".top-right");
    if (topRight) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = "v5-open-command";
      button.className = "v5-search-trigger";
      button.innerHTML = `${I("search")} <span>Aktion suchen</span><kbd>Ctrl K</kbd>`;
      topRight.prepend(button);
    }
    const current = document.querySelector(".sidebar-bottom .side-status strong");
    if (current) current.textContent = "Lokaler Arbeitsbereich · v0.5";
  }
  iconPaths.search = '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.4-4.4"/>';
  Object.assign(labels, { operations: "Mission Control", orders: "Bestellungen", stockledger: "Warenbewegungen", setup: "Einrichtung" });
  v5Nav();
  function v5Toolbar() {
    return `<div class="v5-ribbon"><span class="v5-dot"></span> ${S.mode === "own" ? "MEIN BETRIEB" : "DEMO-MODUS"} <span class="v5-ribbon-sep">/</span> ${esc(S.business)} <span class="v5-ribbon-sep">/</span> Daten nur lokal <button class="v5-plain" data-action="export-json">Backup sichern ↗</button></div>`;
  }
  function v5Readiness() {
    const ready = V5.readiness(S);
    return `<section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">SETUP-CHECKLISTE</div><h2>In 6 Schritten zu nutzbaren Auswertungen</h2><p>Die Prognosen werden erst mit deinen eigenen, vollständigen Daten belastbar.</p></div>${v5Tag(`${ready.filter((x) => x.ready).length} / 6 erledigt`, "blue")}</div><div class="v5-checkgrid">${ready.map((x) => `<button data-view="${x.view}" class="v5-checkrow"><span class="v5-check-icon ${x.ready ? "done" : ""}">${x.ready ? I("check") : I("chevron")}</span><span><b>${esc(x.title)}</b><small>${esc(x.hint)}</small></span><span class="v5-arr">↗</span></button>`).join("")}</div></section>`;
  }
  function v5Snapshot() {
    const st = v5State(),
      f = v4Forecast(),
      orders = V5.orderStats(S.purchaseOrders),
      danger = st.rows.filter((r) => {
        const ing = v4Ing(r.ingredientId);
        return ing && r.estimatedBase < Number(ing.minimumBase || 0);
      }),
      notCounted = st.unknown.length;
    return { st, f, orders, danger, notCounted };
  }
  function v5CommandLinks() {
    return [
      ["Inventur zählen", "inventory", "layers"],
      ["Wareneingang erfassen", "stockledger", "plus"],
      ["Bestellung vorbereiten", "purchasing", "cart"],
      ["Rezept anlegen", "recipes", "calculator"],
      ["Service Funnel", "funnel", "trending"],
      ["Renner-Penner", "portfolio", "scatter"],
    ]
      .map(([title, id, ico]) => `<button class="v5-command" data-view="${id}">${I(ico)}<span>${title}</span>${I("chevron")}</button>`)
      .join("");
  }
  function v5Hero() {
    return `<section class="v5-hero"><div><span class="v5-hero-label">GLB / OPERATIONS INTELLIGENCE</span><h2>Alles im Griff.<br><em>Jeden Tag.</em></h2><p>Vom Artikel über den Wareneinsatz bis zur Bestellung. Ein Arbeitsbereich für dein Gastro-Controlling.</p><div class="v5-hero-actions"><button class="v5-button-primary" data-view="operations">Mission Control öffnen →</button><button class="v5-button-ghost" data-view="setup">Einrichtung prüfen</button></div></div><div class="v5-hero-art" aria-hidden="true"><div class="v5-glow"></div><div class="v5-dashboard-tile"><span>OPERATIVE DATEN</span><div class="v5-mini-bars"><i style="height:42%"></i><i style="height:64%"></i><i style="height:55%"></i><i style="height:80%"></i><i style="height:72%"></i><i style="height:100%"></i><i style="height:86%"></i></div><b>One connected suite.</b></div></div></section>`;
  }
  const v5OldOverview = handlers.overview;
  handlers.overview = () => v5Hero() + v5Toolbar() + v5OldOverview();
  function v5Ops() {
    const { st, f, orders, danger, notCounted } = v5Snapshot(),
      ready = V5.readiness(S),
      good = ready.filter((x) => x.ready).length,
      errors = st.errors.length;
    return (
      pageHeader(
        "CONTROL CENTER",
        "Mission Control",
        "Dein operativer Startpunkt: Datenqualität, Lager, offene Bestellungen und nächste Schritte.",
        `<button class="btn" data-action="export-json">${I("download")} Backup</button><button class="btn btn-primary" data-view="purchasing">${I("cart")} Bestell-Forecast</button>`,
      ) +
      demoNotice() +
      v5Toolbar() +
      `<div class="v5-metrics"><div><small>SETUP-FORTSCHRITT</small><b>${good}/6</b><span>Arbeitsschritte erledigt</span></div><div><small>BESTELLUNGEN OFFEN</small><b>${orders.draft + orders.ordered}</b><span>${v5Price(orders.openTotal)} geplantes Volumen</span></div><div><small>MINDESTBESTAND</small><b>${danger.length}</b><span>Unterschreitungen nach Schätzung</span></div><div><small>BESTAND UNBEKANNT</small><b>${notCounted}</b><span>Rohwaren ohne Inventur</span></div></div><div class="v5-ops-columns"><div>${v5Readiness()}<section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">ARBEITSABLÄUFE</div><h2>Was steht heute an?</h2></div></div><div class="v5-actions-grid">${v5CommandLinks()}</div></section></div><div><section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">INTELLIGENCE / HINWEISE</div><h2>Handlungsbedarf</h2></div></div><div class="v5-alerts">${notCounted ? `<button data-view="inventory" class="v5-alert">${I("alert")} <span><b>${notCounted} Rohwaren ohne Zählung</b><small>Vor der Bestellung Bestand prüfen.</small></span>→</button>` : ""}${danger.length ? `<button data-view="stockledger" class="v5-alert">${I("alert")}<span><b>${danger.length} Bestände unter Minimum</b><small>Prognose und Buchungen abgleichen.</small></span>→</button>` : ""}${errors ? `<button data-view="stockledger" class="v5-alert">${I("alert")}<span><b>${errors} Verbrauchszuordnungen offen</b><small>Lagerzuordnung für Rohwaren prüfen.</small></span>→</button>` : ""}${f.quality !== "gut" ? `<button data-view="purchasing" class="v5-alert">${I("info")}<span><b>Absatzhistorie: ${esc(f.quality)}</b><small>28 Tage vollständig importieren.</small></span>→</button>` : ""}${!danger.length && !notCounted && !errors && f.quality === "gut" ? '<p class="v5-empty-line">Keine automatischen Hinweise aus den vorhandenen Daten.</p>' : ""}</div></section><section class="v5-panel v5-note"><div class="v5-eyebrow">DATENSICHERHEIT</div><h2>Lokal ist nicht automatisch synchron.</h2><p>Regelmäßig JSON-Backups sichern. Auf einem anderen PC oder in einer anderen Browseradresse liegen die Daten nicht automatisch vor.</p><button class="btn" data-action="export-json">JSON-Backup herunterladen</button></section></div></div>`
    );
  }
  function v5StockOverview() {
    const st = v5State();
    const filtered = st.rows
      .filter(
        (r) =>
          (V5_STOCK_WAREHOUSE === "all" || r.warehouseId === V5_STOCK_WAREHOUSE) &&
          (v4Ing(r.ingredientId)?.name || "").toLowerCase().includes(V5_STOCK_SEARCH.toLowerCase()),
      )
      .filter(
        (r) =>
          V5_SHOW_ONLY === "all" ||
          (V5_SHOW_ONLY === "risk" && (r.negative || r.estimatedBase < Number(v4Ing(r.ingredientId)?.minimumBase || 0))),
      );
    const unknown = st.unknown.length;
    return `<section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">WARENBEWEGUNG / BERECHNETER BESTAND</div><h2>Bestand seit der letzten Inventur</h2><p>Inventur ± Wareneingang, Transfers, Schwund und optional rechnerischer Rezeptverbrauch.</p></div><button class="btn btn-primary" data-v5="movement-new">${I("plus")} Bewegung buchen</button></div><div class="v5-stats-strip"><span>${st.rows.length} gezählte Lagerpositionen</span><span>${unknown} Rohwaren ohne Inventur</span><span>${S.stockMovements.length} manuelle Buchungen</span></div><div class="v5-filter-line"><label class="v5-switch"><input type="checkbox" id="v5-sales-mode" ${S.v05SalesUsage ? "checked" : ""}> Rezeptverbrauch aus Tagesabsatz schätzen</label><select id="v5-warehouse-filter" class="select">${selectOptions([["all", "Alle Lager"], ...S.warehouses.map((w) => [w.id, w.name])], V5_STOCK_WAREHOUSE)}</select><select id="v5-risk-filter" class="select">${selectOptions(
      [
        ["all", "Alle Produkte"],
        ["risk", "Unter Mindestbestand"],
      ],
      V5_SHOW_ONLY,
    )}</select><input id="v5-stock-search" class="search-input" value="${esc(V5_STOCK_SEARCH)}" placeholder="Rohware suchen…"></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Rohware / Lager</th><th class="align-right">Inventur</th><th class="align-right">Buchungen</th><th class="align-right">Absatzverbrauch*</th><th class="align-right">Soll-Bestand*</th><th>Status</th></tr></thead><tbody>${
      filtered
        .map((r) => {
          const ing = v4Ing(r.ingredientId),
            w = S.warehouses.find((x) => x.id === r.warehouseId);
          const minimum = Number(ing?.minimumBase || 0);
          return `<tr><td><strong>${esc(ing?.name || "?")}</strong><small style="display:block">${esc(w?.name || "?")} · gezählt am ${esc(r.date)}</small></td><td class="align-right">${v5Qty(r.countBase, ing)}</td><td class="align-right">${v5Qty(r.movementBase, ing)}</td><td class="align-right">${v5Qty(r.modelledSalesBase, ing)}</td><td class="align-right"><b>${v5Qty(r.estimatedBase, ing)}</b></td><td>${r.negative ? v5Tag("Negativ – prüfen", "red") : minimum > 0 && r.estimatedBase < minimum ? v5Tag("Unter Minimum", "amber") : v5Tag("Kalkuliert", "green")}</td></tr>`;
        })
        .join("") || `<tr><td colspan="6">Keine Lagerpositionen gefunden. Inventur starten.</td></tr>`
    }</tbody></table></div><div class="v5-disclaimer">* Sollbestand ist eine <b>Schätzung</b>. Verkäufe am Zähltag werden nicht automatisch abgezogen. Fehlende Lagerzuordnungen und Inventuren können den Wert verfälschen. Mindestbestände in Basiseinheiten pflegen.</div></section>`;
  }
  function v5StockRules() {
    const rows = S.ingredients
      .map((ing) => {
        const chosen = S.ingredientWarehouses[ing.id] || "";
        const inferred = [...V4.latestInventory(S.inventoryCounts).values()].filter((r) => r.ingredientId === ing.id);
        const inferredWh = inferred.length === 1 ? inferred[0].warehouseId : "";
        return `<tr><td><b>${esc(ing.name)}</b><small style="display:block;color:var(--muted)">Mindestmenge in ${esc(V4.baseUnit(ing.packUnit))}</small></td><td><input class="v5-rules-number" data-v5-min="${esc(ing.id)}" type="number" min="0" step="any" value="${esc(ing.minimumBase ?? 0)}"></td><td><select class="select" data-v5-wh="${esc(ing.id)}">${selectOptions([["", "Automatisch / offen"], ...S.warehouses.map((w) => [w.id, w.name])], chosen)}</select>${inferredWh && !chosen ? `<small style="display:block;color:var(--muted)">Aktuell: ${esc(S.warehouses.find((w) => w.id === inferredWh)?.name || "")}</small>` : ""}</td></tr>`;
      })
      .join("");
    return `<section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">INVENTURPARAMETER</div><h2>Mindestbestände & Standardlager</h2><p>Einmal je Rohware pflegen, damit Warnungen und Bestellungen zum richtigen Lager passen.</p></div><button class="btn btn-primary" data-v5="save-rules">Einstellungen speichern</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Rohware</th><th>Warnschwelle</th><th>Standardlager für Bestellungen / Rezeptverbrauch</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Noch keine Rohwaren hinterlegt.</td></tr>'}</tbody></table></div><div class="v5-disclaimer">Bei mehreren Lagerbeständen einer Rohware unbedingt das Standardlager auswählen. Der automatisch geschätzte Rezeptverbrauch wird nur dort abgezogen; andernfalls kann keine eindeutige Zuordnung erfolgen.</div></section>`;
  }
  function v5SaveRules() {
    const updates = [];
    for (const ing of S.ingredients) {
      const el = [...document.querySelectorAll("[data-v5-min]")].find((x) => x.dataset.v5Min === ing.id),
        sel = [...document.querySelectorAll("[data-v5-wh]")].find((x) => x.dataset.v5Wh === ing.id);
      if (!el || !sel) return toast("Eingabefelder fehlen.", "error");
      const minimum = V4.N(el.value),
        wh = sel.value;
      if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1e9 || (wh && !S.warehouses.some((w) => w.id === wh)))
        return toast(`Ungültiger Mindestbestand bei ${ing.name}.`, "error");
      updates.push({ ing, minimum, wh });
    }
    for (const u of updates) {
      u.ing.minimumBase = u.minimum;
      if (u.wh) S.ingredientWarehouses[u.ing.id] = u.wh;
      else delete S.ingredientWarehouses[u.ing.id];
    }
    markEdited();
    persist();
    render();
    toast("Mindestbestände und Lagerzuordnungen gespeichert.");
  }

  function v5Ledger() {
    const rows = [...S.stockMovements].sort(
      (a, b) => b.date.localeCompare(a.date) || String(b.recordedAt).localeCompare(String(a.recordedAt)),
    );
    return `<section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">BUCHUNGSHISTORIE</div><h2>Wareneingänge, Transfers & Schwund</h2><p>Manuelle Warenbewegungen nach der letzten Zählung wirken sich auf den kalkulierten Lagerbestand aus.</p></div><button class="btn btn-primary" data-v5="movement-new">${I("plus")} Buchen</button></div><div class="v5-log">${
      rows
        .slice(0, 150)
        .map((r) => {
          const ing = v4Ing(r.ingredientId),
            label = r.type === "receipt" ? "Wareneingang" : r.type === "transfer" ? "Lagertransfer" : "Schwund";
          const from = S.warehouses.find((w) => w.id === r.fromWarehouseId)?.name || "Extern";
          const to = S.warehouses.find((w) => w.id === r.toWarehouseId)?.name || "Entnahme";
          return `<div class="v5-logitem"><span class="v5-logico">${I(r.type === "receipt" ? "plus" : r.type === "transfer" ? "refresh" : "alert")}</span><div><b>${esc(ing?.name || "?")}</b><small>${esc(label)} · ${esc(from)} → ${esc(to)} · ${esc(r.date)}</small><small>${esc(r.note || "")}</small></div><strong>${v5Qty(r.qtyBase, ing)}</strong></div>`;
        })
        .join("") || '<p class="v5-empty-line">Noch keine Warenbewegungen gebucht.</p>'
    }</div></section>`;
  }
  const v5OldInventory = handlers.inventory;
  handlers.inventory = () =>
    v5StockOverview() +
    v5OldInventory() +
    `<div class="v5-disclaimer">Die ältere Inventurübersicht darunter zeigt bewusst die letzten <b>physischen Zählungen</b>; oben stehen die <b>fortgeschriebenen Sollbestände</b>.</div>`;
  handlers.stockledger = () =>
    pageHeader(
      "STOCK FLOW",
      "Warenbewegungen",
      "Jeder Zugang, jede Umbuchung und jeder Schwund als nachvollziehbarer Vorgang.",
      `<button class="btn btn-primary" data-v5="movement-new">${I("plus")} Buchung erfassen</button>`,
    ) +
    demoNotice() +
    v5Toolbar() +
    v5StockOverview() +
    v5Ledger() +
    v5StockRules();
  function v5MoveModal() {
    if (!S.ingredients.length || !S.warehouses.length) return toast("Rohwaren und Lager zuerst anlegen.", "error");
    v4Modal(
      "Warenbewegung buchen",
      `<div class="field-grid"><div class="field"><label>Vorgang</label><select name="type" id="v5-move-type"><option value="receipt">Wareneingang (manuell)</option><option value="transfer">Lagertransfer</option><option value="waste">Schwund / Bruch</option></select></div><div class="field"><label>Datum</label><input name="date" type="date" max="${v5Today()}" value="${v5Today()}" required></div><div class="field"><label>Rohware</label><select name="ingredientId">${selectOptions(
        S.ingredients.map((i) => [i.id, i.name]),
        S.ingredients[0].id,
      )}</select></div><div class="field"><label>Menge (Basiseinheit, g/ml/Stück)</label><input name="qtyBase" type="number" min="0.0001" step="any" required></div><div class="field"><label>Von Lager (bei Schwund/Transfer)</label><select name="fromWarehouseId">${selectOptions(
        S.warehouses.map((w) => [w.id, w.name]),
        S.warehouses[0].id,
      )}</select></div><div class="field"><label>In Lager (bei Zugang/Transfer)</label><select name="toWarehouseId">${selectOptions(
        S.warehouses.map((w) => [w.id, w.name]),
        S.warehouses[0].id,
      )}</select></div></div><div class="field"><label>Bemerkung / Beleg</label><input name="note" maxlength="120" placeholder="Optional: Lieferschein, Schwundgrund …"></div><p class="calc-note">Eine Buchung korrigiert die letzte vollständige Inventur. Vor erstmaligem Buchen die Rohware im Lager zählen. Ein gebuchter Wareneingang ist nicht automatisch ein Einkauf aus der Bestellliste.</p>`,
      (f) => {
        const type = String(f.get("type")),
          ingId = String(f.get("ingredientId")),
          date = String(f.get("date")),
          qtyBase = V4.N(f.get("qtyBase")),
          from = String(f.get("fromWarehouseId")),
          to = String(f.get("toWarehouseId"));
        if (
          !["receipt", "waste", "transfer"].includes(type) ||
          !v4Ing(ingId) ||
          !V5.validDate(date) ||
          date > v5Today() ||
          !(qtyBase > 0 && qtyBase <= 1e9)
        )
          throw Error("Buchungsdaten prüfen");
        const src = type === "receipt" ? "" : from,
          dest = type === "waste" ? "" : to;
        if (type === "transfer" && src === dest) throw Error("Abgangs- und Zugangslager müssen verschieden sein");
        if ((src && !S.warehouses.some((w) => w.id === src)) || (dest && !S.warehouses.some((w) => w.id === dest)))
          throw Error("Ungültiges Lager");
        const current = v5State().rows.find((r) => r.warehouseId === src && r.ingredientId === ingId);
        if (src && date === v5Today() && (!current || current.estimatedBase < qtyBase))
          throw Error("Sollbestand unbekannt oder unzureichend. Erst inventarisieren.");
        S.stockMovements.push({
          id: uid(),
          type,
          ingredientId: ingId,
          date,
          recordedAt: new Date().toISOString(),
          fromWarehouseId: src,
          toWarehouseId: dest,
          qtyBase,
          note: String(f.get("note") || "").trim(),
        });
        markEdited();
        persist();
        closeModal();
        render();
        toast("Warenbewegung gebucht.");
      },
      true,
    );
  }
  function v5AssignedWarehouse(id) {
    const explicit = S.ingredientWarehouses[id];
    if (S.warehouses.some((w) => w.id === explicit)) return explicit;
    const counts = [...V4.latestInventory(S.inventoryCounts).values()].filter((x) => x.ingredientId === id);
    if (counts.length === 1) return counts[0].warehouseId;
    return "";
  }
  function v5ExportOrders() {
    const cols = [
      "Bestellnummer",
      "Status",
      "Erstellt",
      "Lieferant",
      "Rohware",
      "Gebinde",
      "Einheit",
      "Anzahl",
      "EK Netto je Gebinde",
      "Ziellager",
    ];
    const csv = (arr) => arr.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(";");
    const lines = [
      cols,
      ...S.purchaseOrders.flatMap((o) =>
        o.lines.map((l) => [
          o.code,
          o.status,
          o.createdAt?.slice(0, 10),
          o.supplier,
          v4Ing(l.ingredientId)?.name,
          l.packQty,
          l.packUnit,
          l.packs,
          l.packCostNet,
          S.warehouses.find((w) => w.id === l.warehouseId)?.name,
        ]),
      ),
    ];
    downloadFile("\uFEFF" + lines.map(csv).join("\n"), "GLB_Bestellungen_" + v5Today() + ".csv", "text/csv;charset=utf-8");
    toast("Bestellübersicht exportiert.");
  }
  function v5Orders() {
    const stats = V5.orderStats(S.purchaseOrders);
    return (
      pageHeader(
        "PURCHASING / WORKFLOW",
        "Bestellungen",
        "Bestellvorschläge prüfen, Entwürfe erstellen, Bestellungen markieren und Wareneingang erfassen.",
        `<button class="btn" data-v5="export-orders">${I("download")} CSV</button><button class="btn" data-v5="manual-order">${I("plus")} Einzelbestellung</button><button class="btn btn-primary" data-v5="order-from-forecast">${I("cart")} Aus Forecast übernehmen</button>`,
      ) +
      demoNotice() +
      v5Toolbar() +
      `<div class="v5-metrics v5-metrics3"><div><small>ENTWÜRFE</small><b>${stats.draft}</b><span>Noch nicht bestellt</span></div><div><small>BESTELLT / OFFEN</small><b>${stats.ordered}</b><span>Wareneingang ausstehend</span></div><div><small>OFFENES NETTOVOLUMEN</small><b>${v5Price(stats.openTotal)}</b><span>Entwürfe und Bestellungen</span></div></div><section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">ORDER BOARD</div><h2>Alle Bestellungen</h2><p>„Bestellt“ wird hier nur dokumentiert; es wird keine Bestellung an den Lieferanten gesendet.</p></div></div><div class="v5-order-list">${
        [...S.purchaseOrders]
          .reverse()
          .map((order) => {
            const total = order.lines.reduce((s, l) => s + Number(l.packs) * Number(l.packCostNet || 0), 0);
            const c =
              order.status === "received" ? "green" : order.status === "ordered" ? "blue" : order.status === "cancelled" ? "red" : "amber";
            return `<article class="v5-order"><div class="v5-order-head"><div><small>${esc(order.code)} · ${esc(order.createdAt?.slice(0, 10) || "")}</small><h3>${esc(order.supplier || "Lieferant offen")}</h3><span>${order.lines.length} Rohwaren · ${v5Price(total)} netto</span></div>${v5Tag({ draft: "Entwurf", ordered: "Bestellt", received: "Eingebucht", cancelled: "Storniert" }[order.status] || order.status, c)}</div><div class="v5-order-actions"><button class="btn btn-small" data-v5="order-detail" data-id="${esc(order.id)}">Details</button>${order.status === "draft" ? `<button class="btn btn-small" data-v5="order-edit" data-id="${esc(order.id)}">Mengen ändern</button><button class="btn btn-small btn-primary" data-v5="order-placed" data-id="${esc(order.id)}">Als bestellt markieren</button><button class="btn btn-small" data-v5="order-cancel" data-id="${esc(order.id)}">Verwerfen</button>` : ""}${order.status === "ordered" ? `<button class="btn btn-small btn-primary" data-v5="order-receive" data-id="${esc(order.id)}">Wareneingang buchen</button>` : ""}</div></article>`;
          })
          .join("") ||
        '<p class="v5-empty-line">Noch keine Bestellungen. Erstelle einen Entwurf aus dem Forecast oder als Einzelbestellung.</p>'
      }</div></section><div class="v5-disclaimer">Bestellungen sind interne Entwürfe. Kein Versand, keine Lieferantenschnittstelle, keine Teilanlieferung und keine Rechnungsprüfung. Erst bei bestätigtem Wareneingang wird Lagerbestand hinzugebucht.</div>`
    );
  }
  function v5MakeOrder(lines, supplier = "") {
    if (!lines.length) throw Error("Keine Bestellpositionen");
    const code =
      "GLB-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + String(S.purchaseOrders.length + 1).padStart(3, "0");
    const order = { id: uid(), code, createdAt: new Date().toISOString(), status: "draft", supplier, lines };
    S.purchaseOrders.push(order);
    markEdited();
    persist();
    navigate("orders");
    toast("Bestellentwurf angelegt.");
  }
  function v5FromForecast() {
    const f = v4Forecast(),
      rows = f.rows.filter((x) => x.packs > 0);
    if (!rows.length) return toast("Kein berechenbarer Bestellbedarf. Inventuren und Rezeptabsatz prüfen.", "error");
    const lines = rows.map((r) => {
      const ing = v4Ing(r.id);
      return {
        ingredientId: ing.id,
        warehouseId: v5AssignedWarehouse(ing.id),
        packs: r.packs,
        packQty: ing.packQty,
        packUnit: ing.packUnit,
        packCostNet: ing.packCostNet,
      };
    });
    if (lines.some((l) => !l.warehouseId))
      return toast("Mindestens eine Rohware hat mehrere Lager. Bitte bei Warenbewegungen das Standardlager festlegen.", "error");
    v5MakeOrder(lines);
  }
  function v5ManualOrder() {
    if (!S.ingredients.length) return toast("Rohwaren zuerst anlegen.", "error");
    v4Modal(
      "Manuelle Bestellposition",
      `<div class="field-grid"><div class="field"><label>Rohware</label><select name="ingredientId">${selectOptions(
        S.ingredients.map((x) => [x.id, x.name]),
        S.ingredients[0].id,
      )}</select></div><div class="field"><label>Lieferant (optional)</label><input name="supplier" maxlength="90" placeholder="Lieferant"></div><div class="field"><label>Lager für Wareneingang</label><select name="warehouseId">${selectOptions(
        S.warehouses.map((w) => [w.id, w.name]),
        S.warehouses[0]?.id,
      )}</select></div><div class="field"><label>Volle Bestellgebinde</label><input name="packs" type="number" step="1" min="1" value="1" required></div></div>`,
      (f) => {
        const ing = v4Ing(String(f.get("ingredientId"))),
          wh = String(f.get("warehouseId")),
          packs = Number(f.get("packs"));
        if (!ing || !S.warehouses.some((w) => w.id === wh) || !Number.isInteger(packs) || packs < 1 || packs > 100000)
          throw Error("Bestellposition prüfen");
        closeModal();
        v5MakeOrder(
          [{ ingredientId: ing.id, warehouseId: wh, packs, packQty: ing.packQty, packUnit: ing.packUnit, packCostNet: ing.packCostNet }],
          String(f.get("supplier") || "").trim(),
        );
      },
    );
  }
  function v5OrderDetail(id, edit = false) {
    const o = S.purchaseOrders.find((o) => o.id === id);
    if (!o) return;
    const view = o.lines
      .map((l, i) => {
        const ing = v4Ing(l.ingredientId);
        return `<div class="v5-orderline"><div><b>${esc(ing?.name || "?")}</b><small>${v4Num(l.packQty)} ${esc(l.packUnit)} · ${v5Price(l.packCostNet)} je Gebinde</small></div>${
          edit
            ? `<div class="v5-orderline-edit"><input type="number" name="packs-${i}" min="0" max="100000" step="1" value="${l.packs}" aria-label="Bestellgebinde für ${esc(ing?.name || "")}"><select name="warehouse-${i}" class="select" aria-label="Ziellager">${selectOptions(
                S.warehouses.map((w) => [w.id, w.name]),
                l.warehouseId,
              )}</select></div>`
            : `<strong>${l.packs} Gebinde</strong>`
        }</div>`;
      })
      .join("");
    v4Modal(
      edit ? "Entwurf bearbeiten" : `Bestellung ${o.code}`,
      `${view}<div class="field"><label>Lieferant</label><input name="supplier" maxlength="90" value="${esc(o.supplier || "")}" ${edit ? "" : "readonly"}></div><p class="calc-note">Preis und Gebindegrößen werden beim Anlegen gespeichert. Änderungen am Rohwarenstamm ändern bestehende Bestellungen nicht rückwirkend.</p>`,
      (f) => {
        if (edit) {
          const lines = o.lines
            .map((l, i) => ({ ...l, packs: Number(f.get("packs-" + i)), warehouseId: String(f.get("warehouse-" + i)) }))
            .filter((x) => x.packs > 0);
          if (
            !lines.length ||
            lines.some(
              (x) => !Number.isInteger(x.packs) || x.packs < 1 || x.packs > 100000 || !S.warehouses.some((w) => w.id === x.warehouseId),
            )
          )
            throw Error("Mindestens ein gültiges Bestellgebinde erforderlich");
          o.lines = lines;
          o.supplier = String(f.get("supplier") || "").trim();
          markEdited();
          persist();
        }
        closeModal();
        render();
        toast(edit ? "Bestellmengen aktualisiert." : "Bestellung geschlossen.");
      },
      true,
    );
  }
  function v5Receive(id) {
    const order = S.purchaseOrders.find((o) => o.id === id);
    if (!order || order.status !== "ordered") return toast("Bestellung nicht offen.", "error");
    const items = order.lines.map((l) => `${v4Ing(l.ingredientId)?.name || "?"}: ${l.packs} Gebinde`).join("\n");
    if (
      !confirm(
        `Vollständigen Wareneingang für ${order.code} buchen?\n${items}\n\nBitte Lieferschein und tatsächliche Mengen vorher abgleichen. Teilanlieferungen sind noch nicht unterstützt.`,
      )
    )
      return;
    let movements;
    try {
      movements = V5.receiveOrder(order, S.warehouses, S.ingredients, v5Today(), new Date().toISOString());
    } catch (err) {
      return toast(err.message, "error");
    }
    S.stockMovements.push(...movements);
    order.status = "received";
    order.receivedAt = new Date().toISOString();
    markEdited();
    persist();
    render();
    toast("Wareneingang eingebucht. Bitte Soll-/Ist-Bestand prüfen.");
  }
  function v5OrderAction(name, id) {
    const o = S.purchaseOrders.find((x) => x.id === id);
    if (!o) return;
    if (name === "order-detail") return v5OrderDetail(id);
    if (name === "order-edit" && o.status === "draft") return v5OrderDetail(id, true);
    if (name === "order-placed" && o.status === "draft") {
      if (!confirm("Bestellung wurde extern ausgelöst? Die Software versendet nichts.")) return;
      o.status = "ordered";
      o.orderedAt = new Date().toISOString();
      persist();
      render();
      return toast("Als bestellt markiert.");
    }
    if (name === "order-cancel" && o.status === "draft") {
      if (!confirm("Entwurf verwerfen?")) return;
      o.status = "cancelled";
      persist();
      render();
      return;
    }
    if (name === "order-receive") v5Receive(id);
  }
  const v5OldPurchasing = handlers.purchasing;
  handlers.purchasing = () =>
    `<section class="v5-inline-cta"><div><b>Forecast → Bestellung</b><span>Prüfe die geplanten Gebinde und übernimm den Bedarf mit einem Klick als internen Bestellentwurf.</span></div><div><button class="btn" data-view="orders">Bestellübersicht</button><button class="btn btn-primary" data-v5="order-from-forecast">${I("plus")} Entwurf aus Forecast</button></div></section>` +
    v5OldPurchasing();
  handlers.orders = v5Orders;
  handlers.operations = v5Ops;
  handlers.setup = () =>
    pageHeader(
      "GET STARTED",
      "Suite einrichten",
      "Ein verlässlicher Betrieb beginnt mit vollständigen Stammdaten und einer ersten Inventur.",
      `<button class="btn" data-action="export-json">${I("download")} Backup</button>`,
    ) +
    demoNotice() +
    v5Toolbar() +
    v5Readiness() +
    `<section class="v5-panel"><div class="v5-panel-title"><div><div class="v5-eyebrow">WEITERENTWICKLUNG</div><h2>Was die lokale Suite kann – und was nicht</h2></div></div><div class="v5-info-grid"><div><b>Bereits funktional</b><p>Produkt-, Rezept-, Rohwaren- und Lagerverwaltung; CSV-Import; DB-Rechnung; Forecast; interne Bestellentwürfe; Wareneingang; manuelle Buchungen; Backup.</p></div><div><b>Noch nicht produktionsreif</b><p>Mehrbenutzer-Synchronisierung, revisionssichere Buchungen, echte Bestellung an Lieferanten, OCR auf Scans, automatische KI-Preise und abgesicherte Online-Anmeldung.</p></div></div></section>`;
  function v5CommandMenu() {
    const links = [
      ["Übersicht", "overview"],
      ["Mission Control", "operations"],
      ["Produkte", "products"],
      ["Speisekartenimport", "menuimport"],
      ["Rezepte & Rohwaren", "recipes"],
      ["Inventur zählen", "inventory"],
      ["Warenbewegungen buchen", "stockledger"],
      ["Bestellforecast", "purchasing"],
      ["Bestellungen", "orders"],
      ["Service Funnel", "funnel"],
      ["Outlet-Controlling", "outlets"],
      ["Deckungsbeiträge", "costs"],
      ["Renner-Penner", "portfolio"],
      ["Mein Markt", "market"],
      ["GLB Intelligence", "insights"],
      ["Datenimport", "import"],
      ["Einrichtung", "setup"],
    ];
    document.querySelector("#modal-layer").innerHTML =
      `<div class="v5-command-overlay" role="dialog" aria-modal="true" aria-label="Schnellnavigation"><div class="v5-command-header">${I("search")}<input id="v5-command-input" autofocus placeholder="Modul oder Aktion suchen…"><button data-v5="command-close" aria-label="Schließen">ESC</button></div><div id="v5-command-results">${links.map(([l, id]) => `<button data-view="${id}">${esc(l)} <span>↗</span></button>`).join("")}</div><div class="v5-command-foot">GLB AI Suite · schneller arbeiten mit Strg + K</div></div>`;
    const search = document.querySelector("#v5-command-input");
    search.focus();
    search.addEventListener("input", () => {
      const q = V4.norm(search.value);
      document.querySelector("#v5-command-results").innerHTML =
        links
          .filter((x) => V4.norm(x[0]).includes(q))
          .map(([l, id]) => `<button data-view="${id}">${esc(l)} <span>↗</span></button>`)
          .join("") || '<p class="v5-empty-line">Kein Treffer</p>';
    });
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-v5]");
    if (el) {
      e.preventDefault();
      const action = el.dataset.v5;
      switch (action) {
        case "movement-new":
          v5MoveModal();
          break;
        case "order-from-forecast":
          v5FromForecast();
          break;
        case "manual-order":
          v5ManualOrder();
          break;
        case "command-close":
          closeModal();
          break;
        case "save-rules":
          v5SaveRules();
          break;
        case "export-orders":
          v5ExportOrders();
          break;
        default:
          if (action.startsWith("order-")) v5OrderAction(action, el.dataset.id);
      }
    }
    if (e.target.closest("#v5-open-command")) v5CommandMenu();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      v5CommandMenu();
    }
    if (e.key === "Escape" && document.querySelector(".v5-command-overlay")) closeModal();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "v5-sales-mode") {
      S.v05SalesUsage = e.target.checked;
      persist();
      render();
    }
    if (e.target.id === "v5-warehouse-filter") {
      V5_STOCK_WAREHOUSE = e.target.value;
      render();
    }
    if (e.target.id === "v5-risk-filter") {
      V5_SHOW_ONLY = e.target.value;
      render();
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "v5-stock-search") {
      V5_STOCK_SEARCH = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const inp = document.querySelector("#v5-stock-search");
      inp?.focus();
      inp?.setSelectionRange(pos, pos);
    }
  });

  /* v0.6 – reporting workbench injected before render() in the original closure. */
  const V6 = window.GLBV06;
  function ensureV06() {
    S.v06Pinned = Array.isArray(S.v06Pinned) ? S.v06Pinned.slice(0, 12) : [];
    S.version = 6;
  }
  ensureV06();
  let V6_MONTH = "all",
    V6_OUTLET = "all",
    V6_CATEGORY = "all",
    V6_TAB = "performance",
    V6_METRIC = "revenue",
    V6_SEARCH = "",
    V6_LIFT = 3,
    V6_REPORT_SCOPE = "all";
  const v6Money = euro,
    v6Percent = (x) => (x === null || !Number.isFinite(x) ? "—" : pct(x));
  const v6Metric = { revenue: "Netto-Umsatz", db2: "DB II", quantity: "Absatz", goods: "Wareneinsatz" };
  const v6Colors = ["#19a78b", "#173f49", "#d3a761", "#76a4b5", "#82c4b1", "#bc7f70", "#93a0ab", "#3f797d"];
  function v6Report() {
    return V6.performance(S, { month: V6_MONTH, outlet: V6_OUTLET, category: V6_CATEGORY });
  }
  function v6Empty(title = "Noch keine Datengrundlage", detail = "Daten erfassen oder andere Filter wählen.") {
    return `<div class="v6-empty">${I("chart")}<b>${esc(title)}</b><span>${esc(detail)}</span></div>`;
  }
  function v6Panel(eyebrow, title, desc, body, actions = "") {
    return `<section class="v6-report-panel"><div class="v6-panel-head"><div><div class="v6-overline">${esc(eyebrow)}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>${actions}</div>${body}</section>`;
  }
  function v6Kpi(label, value, foot, accent = "") {
    return `<article class="v6-stat ${accent}"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(foot)}</span></article>`;
  }
  function v6Tips(title, lines) {
    return `<aside class="v6-insight-panel"><div class="v6-overline">GLB / HANDLUNGSEMPFEHLUNGEN</div><h3>${esc(title)}</h3><div class="v6-advice">${lines.map(({ title: t, detail, view }) => `<${view ? "button" : "div"} ${view ? `data-view="${esc(view)}"` : ""} class="v6-advice-item"><span class="v6-tip-mark">${I("arrow")}</span><span><b>${esc(t)}</b><small>${esc(detail)}</small></span>${view ? "<span>↗</span>" : ""}</${view ? "button" : "div"}>`).join("")}</div></aside>`;
  }
  const v6Safe = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  function v6BarChart(data, metric = "revenue", { click = "", money = true, limit = 9 } = {}) {
    const valid = data.slice(0, limit),
      max = Math.max(...valid.map((x) => Math.abs(v6Safe(x[metric]))), 1);
    if (!valid.length) return v6Empty();
    return `<div class="v6-hbars">${valid
      .map((r, i) => {
        const val = v6Safe(r[metric]);
        const size = Math.min(100, (Math.abs(val) / max) * 100),
          attr = click ? `data-v6-drill="${click}" data-id="${esc(r.id)}"` : "";
        return `<${click ? "button" : "div"} class="v6-hbar" ${attr} title="${esc(r.name || r.id)}: ${esc(money ? euro(val) : number(val))}"><span class="v6-hlabel" title="${esc(r.name || r.id)}">${esc(r.name || r.id)}</span><span class="v6-hrail"><i style="width:${Math.max(val === 0 ? 0 : 2, size)}%;background:${v6Colors[i % v6Colors.length]}"></i></span><strong>${money ? euro(val) : number(val)}</strong></${click ? "button" : "div"}>`;
      })
      .join("")}</div>`;
  }
  function v6LineChart(data, metric = "revenue", money = true) {
    const rows = data.filter((x) => Number.isFinite(v6Safe(x[metric]))),
      w = 770,
      h = 225,
      pad = 40;
    if (rows.length === 0) return v6Empty("Keine Zeitreihe", "Monatliche Verkaufszeilen importieren.");
    const n = rows.length,
      min = Math.min(0, ...rows.map((x) => v6Safe(x[metric]))),
      max = Math.max(1, ...rows.map((x) => v6Safe(x[metric]))),
      range = max - min || 1;
    const X = (i) => pad + (w - pad * 2) * (n === 1 ? 0.5 : i / (n - 1)),
      Y = (v) => h - pad - ((v - min) / range) * (h - 2 * pad);
    const points = rows.map((r, i) => `${X(i)},${Y(v6Safe(r[metric]))}`);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
    return `<div class="v6-chart-surface"><svg class="v6-line" viewBox="0 0 ${w} ${h}" role="img" aria-label="Monatlicher Verlauf ${esc(v6Metric[metric] || metric)}"><defs><linearGradient id="v6-fill-${metric}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#25b99d" stop-opacity=".22"/><stop offset="1" stop-color="#25b99d" stop-opacity="0"/></linearGradient></defs>${ticks.map((v) => `<line x1="${pad}" x2="${w - pad}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e8efee" stroke-dasharray="4 6"/><text x="${pad - 7}" y="${Y(v) + 4}" font-size="9" fill="#83989b" text-anchor="end">${Math.round(v)}</text>`).join("")}${n >= 2 ? `<polygon points="${X(0)},${h - pad} ${points.join(" ")} ${X(n - 1)},${h - pad}" fill="url(#v6-fill-${metric})"/>` : ""}${n >= 2 ? `<polyline points="${points.join(" ")}" fill="none" stroke="#13a186" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>` : ""}${rows.map((r, i) => `<circle cx="${X(i)}" cy="${Y(v6Safe(r[metric]))}" r="5" fill="#13a186" stroke="white" stroke-width="2"><title>${esc(r.name || r.id)}: ${esc(money ? euro(r[metric]) : number(r[metric]))}</title></circle><text x="${X(i)}" y="${h - 9}" text-anchor="middle" font-size="${Math.max(9, 12 - n / 3)}" fill="#647d81">${esc(String(r.id).slice(-5))}</text>`).join("")}</svg></div>`;
  }
  function v6Donut(data, metric = "revenue") {
    const top = data.filter((x) => v6Safe(x[metric]) > 0).slice(0, 6),
      total = data.reduce((s, r) => s + Math.max(0, v6Safe(r[metric])), 0);
    if (!total) return v6Empty();
    let pos = 0;
    const arcs = top
      .map((r, i) => {
        const share = (100 * v6Safe(r[metric])) / total,
          start = pos;
        pos += share;
        return `<circle cx="80" cy="80" r="58" fill="none" stroke="${v6Colors[i % v6Colors.length]}" stroke-width="18" stroke-dasharray="${share * 3.644} ${364.4 - share * 3.644}" stroke-dashoffset="${-start * 3.644}" transform="rotate(-90 80 80)"><title>${esc(r.name)} ${share.toFixed(1)}%</title></circle>`;
      })
      .join("");
    return `<div class="v6-donut-wrap"><svg class="v6-donut" viewBox="0 0 160 160" role="img" aria-label="Anteile nach Umsatz">${arcs}<text x="80" y="77" text-anchor="middle" font-size="11" fill="#70858a">Gesamt</text><text x="80" y="96" text-anchor="middle" font-weight="750" font-size="16" fill="#15333b">${Math.round(total).toLocaleString("de-DE")}</text></svg><div class="v6-legend">${top.map((r, i) => `<div><i style="background:${v6Colors[i % v6Colors.length]}"></i><span>${esc(r.name)}</span><b>${((100 * v6Safe(r[metric])) / total).toFixed(1).replace(".", ",")} %</b></div>`).join("")}</div></div>`;
  }
  function v6ReportFilters() {
    const months = [...new Set((S.sales || []).map((x) => x.month).filter((x) => /^\d{4}-\d{2}$/.test(x)))].sort().reverse();
    const cats = [...new Set(S.items.map((p) => p.category))].sort();
    return `<div class="v6-filter-ribbon"><div class="v6-filter-info">${I("settings")} <span>Berichtsfilter</span></div><label>Zeitraum<select id="v6-filter-month" class="select">${selectOptions([["all", "Alle Monate"], ...months.map((x) => [x, periodName(x)])], V6_MONTH)}</select></label><label>Outlet<select id="v6-filter-outlet" class="select">${selectOptions([["all", "Alle Outlets"], ...S.outlets.map((o) => [o.id, o.name])], V6_OUTLET)}</select></label><label>Warengruppe<select id="v6-filter-category" class="select">${selectOptions([["all", "Alle Warengruppen"], ...cats.map((x) => [x, x])], V6_CATEGORY)}</select></label><button class="v6-text-button" data-v6="reset">Zurücksetzen</button></div>`;
  }
  function v6ReportHeader(title, desc) {
    return `<div class="v6-heading"><div><div class="v6-overline">GLB INSIGHTS / REPORTING</div><h2>${esc(title)}</h2><p>${esc(desc)}</p></div><div class="v6-report-actions"><button class="btn" data-v6="save-view">${I("plus")} Ansicht speichern</button><button class="btn" data-v6="csv">${I("download")} CSV-Report</button><button class="btn btn-primary" data-v6="print">${I("file")} Drucken / PDF</button></div></div>`;
  }
  function v6Exec() {
    const t = v6Report();
    const latest = V6.monthlyChange(t.months),
      top = t.products[0],
      rev = t.totals.revenue;
    return `<section class="v6-executive"><div class="v6-executive-copy"><span class="v6-overline">OPERATIVE STEUERUNG / PERFORMANCE</span><h2>Dein Betrieb.<br><em>Alle Zahlen im Blick.</em></h2><p>Umsatz, Rohwaren, Deckungsbeitrag und Verkaufstrends – aus deinen erfassten Verkaufszeilen.</p><div class="v6-hero-links"><button class="v6-hero-btn" data-view="reports">Reporting öffnen →</button><button class="v6-hero-ghost" data-view="funnel">Service-Funnel analysieren</button></div></div><div class="v6-hero-card"><span>NETTO-UMSATZ / AKTUELLE AUSWAHL</span><strong>${euro(rev)}</strong><div class="v6-hero-mini">${v6MiniBars(t.months)}</div><small>${latest === null ? "Kein belastbarer Vormonatsvergleich" : `${latest >= 0 ? "+" : ""}${pct(latest)} gegenüber dem unmittelbar vorherigen Monat`}</small></div></section>`;
  }
  function v6MiniBars(months) {
    const rows = months.slice(-8),
      max = Math.max(...rows.map((x) => x.revenue), 1);
    return rows
      .map((x) => `<i style="height:${Math.max(8, (x.revenue / max) * 100)}%" title="${esc(x.id)}: ${esc(euro(x.revenue))}"></i>`)
      .join("");
  }
  function v6MainOverview() {
    const r = v6Report(),
      t = r.totals,
      change = V6.monthlyChange(r.months);
    return `<div class="v6-page-top">${v6Exec()}${v6ReportFilters()}</div><div class="v6-kpis">${v6Kpi("Netto-Umsatz", euro(t.revenue), change === null ? "Keine lückenlose Monatsveränderung" : `${change >= 0 ? "+" : ""}${pct(change)} zum Vormonat`)}${v6Kpi("DB II", euro(t.db2), "Vor Fixkosten", "mint")}${v6Kpi("Wareneinsatzquote", v6Percent(t.goodsPct), "Warenkosten / Netto-Umsatz")}${v6Kpi("Verkaufte Einheiten", number(t.quantity), "Aus erfassten Verkaufszeilen")}</div><div class="v6-split"><div>${v6Panel("PERFORMANCE", "Umsatz und DB im Zeitverlauf", "Monatlicher Netto-Umsatz. Alle Filter wirken auf die Grafik.", v6LineChart(r.months, "revenue"))}</div><div>${v6Panel("SORTIMENT", "Umsatz nach Warengruppe", "Anteil der Produktkategorien am Netto-Umsatz.", v6Donut(r.categories))}</div></div><div class="v6-split"><div>${v6Panel("OUTLETS", "Umsatz nach Outlet", "Klick auf ein Outlet filtert alle Reports.", v6BarChart(r.outlets, "revenue", { click: "outlet" }))}</div><div>${v6Tips(
      "Was du als Nächstes prüfen solltest",
      [
        {
          title: "Wareneinsatz und Rezeptkosten",
          detail: "Artikel mit hoher Warenquote auf Preis, Portionierung und Rezept prüfen.",
          view: "costs",
        },
        { title: "Verkaufspotenziale im Service", detail: "Aperitif, Dessert und Upgrades getrennt nach Tagen auswerten.", view: "funnel" },
        {
          title: "Bestellungen gegen Forecast prüfen",
          detail: "Offene Bestellungen, Lagerwarnungen und Bedarfsprognose ansehen.",
          view: "purchasing",
        },
      ],
    )}</div></div>`;
  }
  function v6ABC(r) {
    const a = r.abc.filter((x) => x.abc === "A"),
      b = r.abc.filter((x) => x.abc === "B"),
      c = r.abc.filter((x) => x.abc === "C");
    const count = r.abc.length;
    return `<div class="v6-abc-grid">${[
      ["A", a, "Hohe Umsatzkonzentration"],
      ["B", b, "Mittlere Umsatzbedeutung"],
      ["C", c, "Geringe Umsatzbedeutung"],
    ]
      .map(
        ([k, rows, label]) =>
          `<div><small>KLASSE ${k}</small><b>${rows.length} <span>/ ${count}</span></b><p>${label}</p><strong>${euro(rows.reduce((s, x) => s + x.revenue, 0))}</strong></div>`,
      )
      .join(
        "",
      )}</div><p class="v6-smallnote">ABC auf kumuliertem Nettoumsatz. Eine Klassengrenze kann durch einen einzelnen Artikel übersprungen werden. Nicht als Rentabilitätsbewertung verstehen.</p>`;
  }
  function v6Products() {
    const r = v6Report(),
      sort = r.products.slice().sort((a, b) => b.quantity - a.quantity);
    return `<div class="v6-modular-head"><span>ARTIKEL-REPORTING</span><button class="btn btn-small" data-view="reports">Alle Reports ↗</button></div><div class="v6-kpis">${v6Kpi("Aktive Verkaufsartikel", number(r.products.length), "Mit Umsatz in der Auswahl")}${v6Kpi("Top-Seller", r.products[0]?.name || "—", "Nach Nettoumsatz")}${v6Kpi("DB-II-Marge", v6Percent(r.totals.marginPct), "Auf die Verkaufsauswahl bezogen")}${v6Kpi("Verkäufe", number(r.totals.quantity), "Verkaufte Einheiten")}</div><div class="v6-split">${v6Panel("ARTIKELMIX", "Umsatzstärkste Artikel", "Netto-Umsatz nach Produkt.", v6BarChart(r.products, "revenue", { limit: 8 }))}${v6Panel("POPULARITÄT", "Meistverkaufte Artikel", "Verkaufte Stück, unabhängig vom Preis.", v6BarChart(sort, "quantity", { money: false, limit: 8 }))}</div>${v6Panel("ABC-ANALYSE", "Welche Artikel tragen den Umsatz?", "A/B/C-Klassifizierung des Nettoumsatzes.", v6ABC(r))}`;
  }
  function v6Outlet() {
    const r = v6Report();
    return `<div class="v6-modular-head"><span>OUTLET PERFORMANCE</span><button class="btn btn-small" data-view="reports">Detailreport ↗</button></div><div class="v6-kpis">${v6Kpi("Netto-Umsatz", euro(r.totals.revenue), "Aktuelle Berichtsfilter")}${v6Kpi("Deckungsbeitrag II", euro(r.totals.db2), "Kalkulatorisch vor Fixkosten")}${v6Kpi("Ø Netto pro Artikel", r.totals.quantity ? euro(r.totals.revenue / r.totals.quantity) : "—", "Kein Umsatz pro Gast")}${v6Kpi("Aktive Outlets", String(r.outlets.length), "Mit Verkaufszeilen")}</div><div class="v6-split">${v6Panel("UMSATZVERTEILUNG", "Umsatz nach Outlet", "Für ein Outlet anklicken.", v6BarChart(r.outlets, "revenue", { click: "outlet" }))}${v6Panel("DECKUNGSBEITRAG", "DB II nach Outlet", "Keine fixe Personalkostenverteilung.", v6BarChart(r.outlets, "db2"))}</div>`;
  }
  function v6Cost() {
    const r = v6Report(),
      existing = Object.entries(S.monthlyCosts || {}).filter(([month]) => /^\d{4}-\d{2}$/.test(month));
    const rows = existing
      .map(([id, x]) => ({
        id,
        name: id,
        energy: v6Safe(x.energy),
        payroll: v6Safe(x.payroll),
        overhead: v6Safe(x.overhead),
        goods: v6Safe(x.goods),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const selected = (S.monthlyCosts || {})[COST_MONTH];
    const fixed = selected ? v6Safe(selected.energy) + v6Safe(selected.payroll) + v6Safe(selected.overhead) : null;
    return `<div class="v6-modular-head"><span>ERTRAGSREPORT</span><button class="btn btn-small" data-view="reports">Detailreport ↗</button></div><div class="v6-kpis">${v6Kpi("DB I", euro(r.totals.db1), "Vor sonstigen variablen Kosten")}${v6Kpi("DB II", euro(r.totals.db2), "Vor Monatsfixkosten")}${v6Kpi("Kostenquote Waren", v6Percent(r.totals.goodsPct), "Kalkulatorisch aus Produktkosten")}${v6Kpi("Fixkosten · " + COST_MONTH, fixed === null ? "Nicht erfasst" : euro(fixed), "Nicht mit DB doppelt verrechnen")}</div><div class="v6-split">${v6Panel(
      "KOSTENSTRUKTUR",
      "Erfasste Fixkosten nach Monat",
      "Energie, fixer Payroll und Sachkosten. Kein gebuchter Ist-Aufwand.",
      rows.length
        ? v6BarChart(
            rows.map((x) => ({ ...x, revenue: x.energy + x.payroll + x.overhead })),
            "revenue",
            { limit: 12 },
          )
        : v6Empty("Keine Monatskosten", "Im Deckungsbeitragsreiter Monatswerte hinterlegen."),
    )}${v6Panel("WARENEINSATZ", "Warenkosten nach Warengruppe", "Variable Produktkosten aus Verkaufszeilen.", v6BarChart(r.categories, "goods"))}</div>`;
  }
  function v6Funnel() {
    const f = V6.funnel(S),
      names = { aperitif: "Aperitifs", water: "Wasser", upgrades: "Upgrades", sides: "Beilagen", desserts: "Desserts", coffee: "Kaffee" };
    return `<div class="v6-modular-head"><span>SERVICE FUNNEL / ZUSATZVERKAUF</span><button class="btn btn-small" data-view="reports">Funnel-Report ↗</button></div><div class="v6-kpis">${v6Kpi("Erfasste Gäste", number(f.covers), `${f.days} Tage mit Angaben`)}${v6Kpi("Zusatzartikel", number(f.extras), "Summe aller Service-Schritte")}${v6Kpi("Kalk. Zusatzumsatz netto", euro(f.revenue), "Auf Basis hinterlegter Artikelpreise")}${v6Kpi("Kalk. Zusatz-DB", euro(f.db), "Ohne Fixkosten")}</div><div class="v6-split">${v6Panel("TAGESVERLAUF", "Zusatzumsatz pro Erfassungstag", "Netto, nur Service-Funnel-Artikel – nicht zum regulären Umsatz addieren.", v6LineChart(f.daily, "revenue"))}${v6Panel(
      "CONVERSION",
      "Quote je Service-Schritt",
      "Absatz / Covers; Quoten über 100 % bei Mehrfachkäufen möglich.",
      f.covers
        ? v6BarChart(
            f.steps.map((x) => ({ ...x, name: names[x.id], revenue: x.rate })),
            "revenue",
            { money: false },
          )
        : v6Empty("Keine Covers vorhanden"),
    )}</div>${v6Panel("ZIELLÜCKEN", "Potenzial gegenüber hinterlegten Zielen", "Rechnerischer zusätzlicher DB bei unveränderter Gästezahl und Artikelmarge.", `<div class="table-wrap"><table class="data-table"><thead><tr><th>Schritt</th><th class="align-right">Ist / Covers</th><th class="align-right">Ziel</th><th class="align-right">Δ</th><th class="align-right">Zusatz-DB bei Ziel*</th></tr></thead><tbody>${f.steps.map((x) => `<tr><td>${esc(names[x.id])}</td><td class="align-right">${v6Percent(x.rate)}</td><td class="align-right">${pct(x.goal)}</td><td class="align-right">${x.gap === null ? "—" : `${x.gap > 0 ? "+" : ""}${pct(x.gap)}`}</td><td class="align-right">${x.potentialDB === null ? "—" : euro(x.potentialDB)}</td></tr>`).join("")}</tbody></table></div><p class="v6-smallnote">* Modell, keine Umsatzprognose und kein Gewinnversprechen. Funnel-Umsätze können bereits im POS-Umsatz enthalten sein.</p>`)}`;
  }
  function v6Inventory() {
    const st = v5State(),
      val = V6.inventorySummary(S, st);
    return `<div class="v6-modular-head"><span>LAGERREPORT / SOLL-BESTAND</span><button class="btn btn-small" data-view="reports">Lagerreport ↗</button></div><div class="v6-kpis">${v6Kpi("Geschätzter Lagerwert", euro(val.knownValue), "Nur bekannte bewertbare Bestände")}${v6Kpi("Unbekannte Rohwaren", number(val.uncounted), "Ohne körperliche Inventur")}${v6Kpi("Unter Mindestbestand", number(val.belowMinimum), "Lagerpositionen")}${v6Kpi("Negative Sollbestände", number(val.negative), "Dringend prüfen")}</div><div class="v6-split">${v6Panel(
      "BESTANDSWERTE",
      "Wert nach Lager",
      "Rechnerische Bestände × aktuelle Netto-EK, keine Bilanzinventur.",
      v6BarChart(
        val.warehouses.map((x) => ({ ...x, revenue: x.value })),
        "revenue",
      ),
    )}${v6Panel(
      "RISIKOSTEUERUNG",
      "Warnungen je Lager",
      "Bestände unter Mindestmenge oder fehlerhafte Rohwarendaten.",
      val.warehouses.length
        ? v6BarChart(
            val.warehouses.map((x) => ({ ...x, quantity: x.risk })),
            "quantity",
            { money: false },
          )
        : v6Empty(),
    )}</div>`;
  }
  function v6Recipes() {
    const calc = V6.recipeSummary(S),
      rows = calc.rows.filter((x) => x.foodPct !== null).sort((a, b) => b.foodPct - a.foodPct);
    return `<div class="v6-modular-head"><span>REZEPTUR-REPORTING</span><button class="btn btn-small" data-view="costs">Zielpreiskalkulation ↗</button></div><div class="v6-kpis">${v6Kpi("Kalkulierte Rezepte", number(calc.valid), "Mit gültiger Rohwarenbasis")}${v6Kpi("Unvollständige Rezepte", number(calc.invalid), "Zutaten/Mengen prüfen")}${v6Kpi("Artikel ohne Rezept", number(calc.unlinked), "Aus dem Produktstamm")}${v6Kpi("Teuerstes Rezept", rows[0]?.name || "—", "Nach Wareneinsatzquote")}</div>${v6Panel(
      "REZEPTUREN",
      "Wareneinsatzquoten pro Gericht",
      "Netto-Rezeptkosten pro Portion / aktuellen Netto-Verkaufspreis.",
      rows.length
        ? v6BarChart(
            rows.slice(0, 10).map((x) => ({ ...x, revenue: x.foodPct })),
            "revenue",
            { money: false, limit: 10 },
          )
        : v6Empty(),
    )}`;
  }
  function v6Purchasing() {
    const f = v4Forecast(),
      items = (f.rows || []).filter((x) => x.packs !== null);
    const pending = V5.orderStats(S.purchaseOrders);
    return `<div class="v6-modular-head"><span>BESTELL-REPORTING</span><button class="btn btn-small" data-view="orders">Bestellungen öffnen ↗</button></div><div class="v6-kpis">${v6Kpi("Prognosequalität", String(f.quality || "—"), "Abhängig von erfassten Tagesverkäufen")}${v6Kpi("Bestellwert netto", euro(items.reduce((a, b) => a + v6Safe(b.estimatedNet), 0)), "Vorläufig, aktuelle EK")}${v6Kpi("Rohwaren ohne Bestand", number(f.rows.filter((x) => x.packs === null).length), "Nicht als 0 kalkuliert")}${v6Kpi("Offenes Bestellvolumen", euro(pending.openTotal), "Entwurf + als bestellt markiert")}</div>${v6Panel(
      "BEDARFSRANKING",
      "Höchster prognostizierter Einkaufswert",
      "Voraussetzung: Rezepte, Tagesabsätze und Inventur.",
      v6BarChart(
        items.map((x) => ({ ...x, name: x.name, revenue: x.estimatedNet })).sort((a, b) => b.revenue - a.revenue),
        "revenue",
      ),
    )}`;
  }
  function v6Orders() {
    const rows = (S.purchaseOrders || []).map((o) => ({
      name: o.code,
      id: o.id,
      revenue: (o.lines || []).reduce((s, l) => s + v6Safe(l.packs) * v6Safe(l.packCostNet), 0),
      status: o.status,
    }));
    const groups = ["draft", "ordered", "received", "cancelled"].map((s) => ({
      name: { draft: "Entwurf", ordered: "Bestellt", received: "Eingebucht", cancelled: "Verworfen" }[s],
      revenue: rows.filter((x) => x.status === s).reduce((a, x) => a + x.revenue, 0),
    }));
    return `<div class="v6-modular-head"><span>BESTELLAUSWERTUNG</span><button class="btn btn-small" data-view="purchasing">Bestell-Forecast ↗</button></div>${v6Panel("BESTELLSTATUS", "Volumen je Bestellstatus", "Nur interne dokumentierte Bestellungen.", v6BarChart(groups, "revenue"))}`;
  }
  function v6Portfolio() {
    const r = v6Report();
    const sorted = C.classify(
      r.products.map((x) => {
        const p = S.items.find((p) => p.id === x.id);
        return {
          ...p,
          quantity: x.quantity,
          grossPrice: x.quantity ? (x.revenue / x.quantity) * (1 + v6Safe(p?.vat) / 100) : p?.grossPrice,
        };
      }),
    );
    const flagged = sorted.list
      .filter((x) => x.quadrant === "runner" || x.quadrant === "loser")
      .sort((a, b) => b.revenueNet - a.revenueNet)
      .slice(0, 5);
    return `<div class="v6-modular-head"><span>MENÜ-ENGINEERING</span><button class="btn btn-small" data-view="reports">ABC und Produktreport ↗</button></div>${v6Panel("VERKAUFSPOTENZIAL", "Preis-Szenario für ausgewählte Artikel", "Prozentuale Preisänderung bei unveränderter Stückzahl. Keine Nachfrageprognose.", `<div class="v6-sim"><label>Preisveränderung <strong id="v6-lift-label">${V6_LIFT} %</strong><input id="v6-lift" type="range" min="-10" max="15" step="1" value="${V6_LIFT}"></label><div><small>Rechnerische DB-II-Veränderung</small><b id="v6-lift-result">${euro((r.totals.revenue * V6_LIFT) / 100)}</b><span>Bei unverändertem Absatz und unveränderten variablen Stückkosten.</span></div></div>`)}${v6Panel("PRIORITÄTEN", "Artikel zur Überprüfung", "Renner = hohe Menge bei niedrigem Stück-DB; Penner = niedrig bei beidem.", flagged.length ? `<div class="v6-priority-list">${flagged.map((x) => `<button data-edit="${esc(x.id)}"><span class="v6-priority-dot"></span><span><b>${esc(x.name)}</b><small>${x.quadrant === "runner" ? "Rezept- und Preishebel testen" : "Sortimentsplatz, Präsentation und Absatz überprüfen"}</small></span><strong>${euro(x.contributionUnit)} / Stück</strong> ↗</button>`).join("")}</div>` : v6Empty("Keine relevanten Artikel"))}`;
  }
  function v6Lifecycle() {
    const p = S.items.find((x) => x.id === LPRODUCT) || S.items[0];
    const x = p ? C.lifecycle(S.sales, p.id, p.launchMonth) : null;
    return `<div class="v6-modular-head"><span>PRODUKTLEBENSZYKLUS</span><button class="btn btn-small" data-view="products">Alle Produkte ↗</button></div>${v6Panel(
      "ABSATZTREND",
      p ? p.name : "Produkt auswählen",
      "Nur echte, vorhandene Monatsverkäufe und keine aufgefüllten Nullwerte.",
      x && x.points.length
        ? v6LineChart(
            x.points.map((y) => ({ id: y.month, name: y.month, quantity: y.quantity })),
            "quantity",
            false,
          )
        : v6Empty(),
    )}`;
  }
  function v6Market() {
    const rows = S.market || [],
      comparable = rows
        .map((m) => {
          const p = stockOf(m.productId);
          const c = p ? C.marketComparison(p.grossPrice, m.grossPrice, p.unit || "Portion", m.unit) : null;
          return { p, c, m };
        })
        .filter((x) => x.c?.comparable);
    const avg = comparable.length ? comparable.reduce((s, x) => s + x.c.differencePct, 0) / comparable.length : null;
    return `<div class="v6-modular-head"><span>MARKT-REPORT</span><button class="btn btn-small" data-view="market">Preisvergleich hinzufügen ↗</button></div><div class="v6-kpis">${v6Kpi("Dokumentierte Preise", String(rows.length), "Manuell mit Quelle erfasst")}${v6Kpi("Vergleichbare Preise", String(comparable.length), "Ähnliche Einheiten")}${v6Kpi("Ø Abweichung", v6Percent(avg), "Nur dokumentierte Beobachtungen")}${v6Kpi("Entdeckte Betriebe", String(S.marketDiscovered?.length || 0), "Ohne automatische Menüpreise")}</div>${v6Panel(
      "MANUELLE MARKTBEOBACHTUNG",
      "Eigenpreis und Konkurrenzpreis",
      "Keine KI-Schätzung. Nur dokumentierte und vergleichbare Preise.",
      comparable.length
        ? v6BarChart(
            comparable.slice(0, 8).map((x) => ({ name: x.p?.name + " / " + x.m.competitor, revenue: Math.abs(x.c.differencePct) })),
            "revenue",
            { money: false },
          )
        : v6Empty("Keine vergleichbaren Marktpreise", "Marktbeobachtungen mit Quelle erfassen."),
    )}`;
  }
  function v6PrintSummary() {
    const o = V6_OUTLET === "all" ? "Alle Outlets" : outletName(V6_OUTLET);
    const m = V6_MONTH === "all" ? "Alle Monate" : periodName(V6_MONTH);
    const c = V6_CATEGORY === "all" ? "Alle Kategorien" : V6_CATEGORY;
    return `<div class="v6-print-banner"><strong>GLB AI Suite · Managementreport</strong><span>${esc(S.business)} · ${esc(m)} · ${esc(o)} · ${esc(c)} · Export ${new Date().toLocaleDateString("de-DE")}</span></div>`;
  }
  function v6ReportTable(r) {
    const q = V6_SEARCH.toLocaleLowerCase("de");
    const arr = r.products.filter((x) => x.name.toLocaleLowerCase("de").includes(q));
    return `<div class="v6-data-toolbar"><label>Artikel suchen<input id="v6-report-search" placeholder="z. B. Burger" value="${esc(V6_SEARCH)}"></label><label>Sortieren<select class="select" id="v6-table-sort">${selectOptions(
      [
        ["revenue", "Umsatz"],
        ["db2", "DB II"],
        ["quantity", "Absatz"],
        ["goods", "Wareneinsatz"],
      ],
      V6_METRIC,
    )}</select></label><span>${arr.length} Produkte</span></div><div class="table-wrap"><table class="data-table v6-table"><thead><tr><th>Artikel</th><th class="align-right">Absatz</th><th class="align-right">Umsatz netto</th><th class="align-right">Warenkosten</th><th class="align-right">DB II</th><th class="align-right">DB-II-Quote</th></tr></thead><tbody>${arr
      .sort((a, b) => b[V6_METRIC] - a[V6_METRIC])
      .slice(0, 150)
      .map(
        (x) =>
          `<tr><td><strong>${esc(x.name)}</strong><small>${esc(S.items.find((p) => p.id === x.id)?.category || "")}</small></td><td class="align-right">${number(x.quantity)}</td><td class="align-right">${euro(x.revenue)}</td><td class="align-right">${euro(x.goods)}</td><td class="align-right">${euro(x.db2)}</td><td class="align-right">${v6Percent(x.marginPct)}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><p class="v6-smallnote">Bis zu 150 Artikel sichtbar. Export enthält alle gefilterten Daten. Produktkosten sind aktuell, nicht historisiert.</p>`;
  }
  function v6ReportContent() {
    const r = v6Report(),
      metric = V6_METRIC,
      ff = V6.funnel(S, { outlet: V6_OUTLET });
    if (V6_TAB === "service") return v6Funnel();
    if (V6_TAB === "inventory") return v6Inventory() + v6Purchasing();
    if (V6_TAB === "sortiment") return v6Products() + v6Recipes();
    return `<div class="v6-kpis">${v6Kpi("Netto-Umsatz", euro(r.totals.revenue), "Aktuelle Filter")}${v6Kpi("DB II", euro(r.totals.db2), "Kalkulatorisch vor Fixkosten")}${v6Kpi("Wareneinsatzquote", v6Percent(r.totals.goodsPct), "Aktuelle Produktkosten")}${v6Kpi("Absatz", number(r.totals.quantity), "Verkaufte Artikel")}</div><div class="v6-split">${v6Panel("TREND", "Monatsentwicklung", "Umsatz, DB II oder Absatz über den Zeitverlauf.", v6LineChart(r.months, metric, metric !== "quantity"))}${v6Panel("BREAKDOWN", "Warengruppenverteilung", "Anteile des aktuellen Sortiments.", v6Donut(r.categories, metric))}</div><div class="v6-split">${v6Panel("OUTLET REPORT", "Outlets im Vergleich", "Klick filtert die gesamte Ansicht.", v6BarChart(r.outlets, metric, { money: metric !== "quantity", click: "outlet" }))}${v6Panel(
      "TOP 9",
      "Stärkste Produkte",
      "Aus der aktuellen Auswahl.",
      v6BarChart(
        r.products.slice().sort((a, b) => b[metric] - a[metric]),
        metric,
        { money: metric !== "quantity" },
      ),
    )}</div>${v6Panel("DETAILS", "Artikel-Performance-Tabelle", "Sortieren, durchsuchen und exportieren.", v6ReportTable(r))}`;
  }
  function v6ReportsView() {
    return `<div class="v6-print-shell">${pageHeader("ANALYTICS / MANAGEMENT REPORTS", "GLB Report Studio", "Alle betriebswirtschaftlichen Kennzahlen an einem Ort. Filter, gespeicherte Ansichten, Export und Druck – ohne Cloudkosten.", `<button class="btn" data-view="operations">${I("bolt")} Mission Control</button>`)}${demoNotice()}${v6PrintSummary()}${v6ReportHeader("Management Reporting", "Die Module verwenden dieselbe betriebliche Datengrundlage.")}${v6ReportFilters()}<div class="v6-tabbar" role="tablist">${[
      ["performance", "Performance"],
      ["sortiment", "Sortiment & Rezepte"],
      ["service", "Service & Conversion"],
      ["inventory", "Lager & Einkauf"],
    ]
      .map(
        ([k, t]) =>
          `<button class="${k === V6_TAB ? "active" : ""}" data-v6-tab="${k}" role="tab" aria-selected="${k === V6_TAB}">${t}</button>`,
      )
      .join("")}</div>${
      V6_TAB === "performance"
        ? `<div class="v6-metric-tabs">${Object.entries(v6Metric)
            .map(([id, l]) => `<button data-v6-metric="${id}" class="${V6_METRIC === id ? "active" : ""}">${l}</button>`)
            .join("")}</div>`
        : ""
    }<div id="v6-report-content">${v6ReportContent()}</div>${S.v06Pinned.length ? `<section class="v6-saved"><h3>Gespeicherte Ansichten</h3><div>${S.v06Pinned.map((p, i) => `<div class="v6-saved-view"><button data-v6="apply-view" data-index="${i}">${I("chart")} ${esc(p.name)}</button><button aria-label="Gespeicherte Ansicht löschen" data-v6="delete-view" data-index="${i}">×</button></div>`).join("")}</div></section>` : ""}<div class="v6-report-fineprint">GLB AI Suite ist ein lokales Steuerungstool. Kein DATEV-/Kassenabschluss, keine Buchhaltung, kein revisionssicheres Archiv und keine verifizierte Gewinnprognose. DB II berücksichtigt aktuelle variable Produktkosten; Monatsfixkosten werden gesondert dargestellt.</div></div>`;
  }
  handlers.reports = v6ReportsView;
  Object.assign(labels, { reports: "Report Studio" });
  function v6Sidebar() {
    const nav = document.querySelector('.nav[aria-label="Hauptnavigation"]');
    if (nav && typeof nav.querySelector === "function" && !nav.querySelector('[data-view="reports"]')) {
      const h = [...nav.querySelectorAll(".v5-navgroup-label")].find((x) => x.textContent === "ÜBERSICHT");
      if (h) {
        const b = document.createElement("button");
        b.className = "nav-item v6-report-link";
        b.dataset.view = "reports";
        b.innerHTML = `<span class="nav-ico">${I("chart")}</span><span>Report Studio</span><span class="v6-nav-new">NEU</span>`;
        h.after(b);
      }
    }
    const right = document.querySelector(".top-right");
    if (right && typeof right.querySelector === "function" && !right.querySelector("#v6-report-quick")) {
      const btn = document.createElement("button");
      btn.id = "v6-report-quick";
      btn.className = "v6-icon-action";
      btn.dataset.view = "reports";
      btn.title = "Management Reports";
      btn.innerHTML = `${I("chart")}<span>Reports</span>`;
      right.prepend(btn);
    }
    const footer = document.querySelector(".sidebar-bottom .side-status strong");
    if (footer) footer.textContent = "Lokaler Arbeitsbereich · v0.6";
  }
  v6Sidebar();
  // Each operational tab gets context-specific reporting without disturbing existing forms and actions.
  const v6Sections = {
    products: v6Products,
    costs: v6Cost,
    calculator: v6Cost,
    outlets: v6Outlet,
    portfolio: v6Portfolio,
    funnel: v6Funnel,
    inventory: v6Inventory,
    stockledger: v6Inventory,
    recipes: v6Recipes,
    purchasing: v6Purchasing,
    orders: v6Orders,
    lifecycle: v6Lifecycle,
    market: v6Market,
    insights: v6MainOverview,
    menuimport: v6Recipes,
    groups: v6Products,
    import: v6MainOverview,
    setup: v6MainOverview,
  };
  for (const [name, fn] of Object.entries(v6Sections)) {
    const original = handlers[name];
    if (!original) continue;
    handlers[name] = () => {
      const html = original();
      let supplement = "";
      try {
        supplement = fn();
      } catch (e) {
        console.warn("Report " + name, e);
        supplement = `<p class="v6-report-error">Bericht für dieses Modul derzeit nicht berechenbar: ${esc(e.message)}</p>`;
      }
      return html + `<section class="v6-module-report">${supplement}</section>`;
    };
  }
  const v6OldOverview = v5OldOverview;
  handlers.overview = () =>
    v6MainOverview() +
    `<details class="v6-legacy-details"><summary>${I("layers")} Weitere operative Kennzahlen und die bisherige Detailansicht öffnen <span>+</span></summary><div class="v6-legacy-section">${v6OldOverview()}</div></details>`;
  const v6OldOperations = handlers.operations;
  handlers.operations = () => v6OldOperations() + `<section class="v6-module-report">${v6MainOverview()}</section>`;
  function v6CSV() {
    const r = v6Report();
    let rows, cols, name;
    if (V6_TAB === "inventory") {
      const st = v5State(),
        val = V6.inventorySummary(S, st);
      rows = val.warehouses;
      name = "Lageruebersicht";
      cols = [
        { label: "Lager", value: "name" },
        { label: "Lagerwert netto (geschaetzt)", value: (x) => V6.round(x.value) },
        { label: "Positionen", value: "count" },
        { label: "Warnpositionen", value: "risk" },
      ];
    } else if (V6_TAB === "service") {
      rows = V6.funnel(S, { outlet: V6_OUTLET }).steps;
      name = "Service_Funnel";
      cols = [
        { label: "Service Schritt", value: "id" },
        { label: "Anzahl", value: "count" },
        { label: "Quote je Covers %", value: "rate" },
        { label: "Ziel %", value: "goal" },
        { label: "DB netto", value: "db" },
        { label: "Zielpotential DB", value: "potentialDB" },
      ];
    } else if (V6_TAB === "sortiment") {
      rows = V6.recipeSummary(S).rows;
      name = "Rezepturen";
      cols = [
        { label: "Artikel", value: "name" },
        { label: "Rezeptkosten netto", value: "cost" },
        { label: "Warenquote %", value: "foodPct" },
        { label: "Rezept gueltig", value: "valid" },
      ];
    } else {
      rows = r.products;
      name = "Artikelperformance";
      cols = [
        { label: "Artikel", value: "name" },
        { label: "Absatz", value: "quantity" },
        { label: "Nettoumsatz", value: "revenue" },
        { label: "Warenkosten", value: "goods" },
        { label: "DB I", value: "db1" },
        { label: "DB II", value: "db2" },
        { label: "DB II Marge %", value: "marginPct" },
      ];
    }
    downloadFile(V6.safeCSV(rows, cols), `GLB_${name}_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
    toast("CSV-Report exportiert.");
  }
  function v6ReportAction(el) {
    const act = el.dataset.v6;
    switch (act) {
      case "csv":
        v6CSV();
        break;
      case "print":
        window.print();
        break;
      case "reset":
        V6_MONTH = V6_OUTLET = V6_CATEGORY = "all";
        render();
        break;
      case "save-view": {
        const label = prompt(
          "Bezeichnung für diese Report-Ansicht (z. B. September / Restaurant):",
          `${V6_TAB} · ${V6_MONTH === "all" ? "alle Monate" : V6_MONTH}`,
        );
        if (!label) return;
        if (S.v06Pinned.length >= 12) return toast("Maximal 12 gespeicherte Ansichten.", "error");
        S.v06Pinned.push({
          name: label.trim().slice(0, 80),
          tab: V6_TAB,
          month: V6_MONTH,
          outlet: V6_OUTLET,
          category: V6_CATEGORY,
          metric: V6_METRIC,
        });
        persist();
        render();
        toast("Berichtsansicht gespeichert.");
        break;
      }
      case "apply-view": {
        const p = S.v06Pinned[Number(el.dataset.index)];
        if (!p) return;
        V6_TAB = p.tab;
        V6_MONTH = p.month;
        V6_OUTLET = p.outlet;
        V6_CATEGORY = p.category;
        V6_METRIC = p.metric;
        render();
        break;
      }
      case "delete-view": {
        S.v06Pinned.splice(Number(el.dataset.index), 1);
        persist();
        render();
        break;
      }
    }
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-v6]");
    if (a) {
      e.preventDefault();
      v6ReportAction(a);
      return;
    }
    const tab = e.target.closest("[data-v6-tab]");
    if (tab) {
      V6_TAB = tab.dataset.v6Tab;
      render();
      return;
    }
    const metric = e.target.closest("[data-v6-metric]");
    if (metric) {
      V6_METRIC = metric.dataset.v6Metric;
      render();
      return;
    }
    const drill = e.target.closest("[data-v6-drill]");
    if (drill && drill.dataset.v6Drill === "outlet") {
      V6_OUTLET = drill.dataset.id;
      navigate("reports");
      V6_TAB = "performance";
      render();
      toast("Outlet-Filter aktiviert.");
    }
  });
  document.addEventListener("change", (e) => {
    switch (e.target.id) {
      case "v6-filter-month":
        V6_MONTH = e.target.value;
        render();
        break;
      case "v6-filter-outlet":
        V6_OUTLET = e.target.value;
        render();
        break;
      case "v6-filter-category":
        V6_CATEGORY = e.target.value;
        render();
        break;
      case "v6-table-sort":
        V6_METRIC = e.target.value;
        render();
        break;
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "v6-report-search") {
      V6_SEARCH = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const inp = document.querySelector("#v6-report-search");
      inp?.focus();
      inp?.setSelectionRange(pos, pos);
    }
    if (e.target.id === "v6-lift") {
      V6_LIFT = Number(e.target.value);
      const label = document.querySelector("#v6-lift-label"),
        result = document.querySelector("#v6-lift-result");
      if (label) label.textContent = V6_LIFT + " %";
      if (result) result.textContent = euro((v6Report().totals.revenue * V6_LIFT) / 100);
    }
  });

  // ===== GLB v0.8: mobile mission, reliable, reviewable menu import =====
  let V08_MENU_ROWS = [],
    V08_MENU_ERRORS = [],
    V08_MENU_FILE = "",
    V08_MENU_STATUS = "";
  function v08QuickLinks() {
    const links = [
      ["funnel", "Service Funnel", "Servicezahlen direkt erfassen"],
      ["inventory", "Inventur", "Artikel schnell zählen"],
      ["recipes", "Rezepte", "Rezepturen & Zutaten"],
      ["orders", "Bestellungen", "Bestellstatus und Wareneingang"],
      ["reports", "Reports", "Ergebnisse und Auswertungen"],
      ["menuimport", "Speisekarten", "Neue Speisekarte importieren"],
      ["market", "Mein Markt", "Wettbewerbsbeobachtung"],
    ];
    return links.filter((x) => window.GLBAccess?.canView(x[0]) ?? true);
  }
  handlers.myday = () =>
    `<div class="v08-today"><div class="v08-overline">DEIN ARBEITSTAG · GLB AI SUITE</div><h1>Guten Tag.<br><em>Direkt zur Aufgabe.</em></h1><p>${esc(S.business)} · ${esc(window.GLBAccess?.label(window.GLBAccess.role) || "GLB-Team")}</p><div class="v08-shortcut-grid">${v08QuickLinks()
      .map(
        ([view, name, detail]) =>
          `<button class="v08-shortcut" data-view="${view}"><span class="v08-shortcut-sym">↗</span><b>${name}</b><small>${detail}</small></button>`,
      )
      .join(
        "",
      )}</div><p class="v08-note">Alle Änderungen werden bei bestehender Internetverbindung mit der GLB Cloud synchronisiert. Den Speicherstatus oben überprüfen.</p></div>`;
  labels.myday = "Mein Arbeitsplatz";
  function v08MenuView() {
    const total = V08_MENU_ROWS.length;
    return (
      pageHeader(
        "SORTIMENT / IMPORT CENTER",
        "Speisekarte übernehmen",
        "PDF, CSV oder kopierter Text – mit überprüfbaren Artikeln, Preisänderung und Dublettencheck.",
        `<button class="btn" data-v08="menu-template">${I("download")} CSV-Vorlage</button>`,
      ) +
      `<div class="v08-import-grid"><section class="panel v08-import-main"><div class="v08-import-drop" id="v08-dropzone"><span class="v08-dropicon">↥</span><h2>Speisekarte hochladen</h2><p>CSV · PDF mit Text · TXT · maximal 12 MB</p><label class="btn btn-primary v08-file-select">Datei wählen<input type="file" id="v08-menu-file" accept=".pdf,.csv,.txt,.text,text/plain,text/csv,application/pdf" hidden></label><small>Du kannst eine Datei hierher ziehen oder auswählen.</small></div><div class="v08-divider">ODER TEXT EINFÜGEN</div><textarea class="v08-textbox" id="v08-menu-text" rows="7" placeholder="BURGER\nClassic Burger ........ 17,90 €\nVeggie Burger 16,50 €\nKAFFEE\nEspresso 3,40 €"></textarea><div class="v08-inline-actions"><button class="btn btn-primary" data-v08="parse-text">Text erkennen</button><button class="btn" data-v08="clear-preview">Vorschau zurücksetzen</button></div><div class="v08-help"><strong>Gut zu wissen:</strong> Bei gescannten PDFs oder Fotos fehlt oft auslesbarer Text. Dann zuerst Text mit einem OCR-Werkzeug extrahieren und hier einfügen. Beträge und Umsatzsteuer vor dem Speichern kontrollieren.</div></section><section class="panel v08-review"><div class="v08-review-head"><span class="v08-overline">IMPORTPRÜFUNG</span><h2>${total ? `${total} Artikel erkannt` : "Noch keine Artikel erkannt"}</h2><p>${esc(V08_MENU_STATUS || "Lade eine Speisekarte hoch oder füge den Text ein.")}</p></div>${
        total
          ? `<div class="v08-review-control"><label><input type="checkbox" id="v08-allow-update"> Bereits vorhandene Artikel mit gleichem Namen aktualisieren</label></div><div class="v08-review-items">${V08_MENU_ROWS.slice(
              0,
              180,
            )
              .map(
                (x, i) =>
                  `<div class="v08-review-item"><label class="v08-item-check"><input type="checkbox" data-v08-selected="${i}" checked></label><div class="v08-review-fields"><label>Artikelname<input data-v08-name="${i}" value="${esc(x.name)}" maxlength="120"></label><div class="v08-review-mini"><label>Warengruppe<input data-v08-category="${i}" value="${esc(x.category)}"></label><label>Preis €<input inputmode="decimal" data-v08-price="${i}" value="${String(x.grossPrice).replace(".", ",")}"></label><label>USt %<select data-v08-vat="${i}">${selectOptions(
                    [
                      [7, "7 %"],
                      [19, "19 %"],
                      [0, "0 %"],
                    ],
                    x.vat,
                  )}</select></label></div></div></div>`,
              )
              .join(
                "",
              )}</div><div class="v08-sticky-action"><button class="btn btn-primary" data-v08="commit-menu">Geprüfte Artikel speichern →</button><small>Bis zu 180 Artikel pro Import · Speichern erfolgt erst nach deiner Freigabe.</small></div>`
          : `<div class="v08-empty"><b>Deine Vorschau erscheint hier.</b><p>Erst erkennen, anschließend Preise prüfen und dann speichern.</p></div>`
      }${
        V08_MENU_ERRORS.length
          ? `<details class="v08-errors"><summary>${V08_MENU_ERRORS.length} Zeilen konnten nicht erkannt werden</summary><div>${V08_MENU_ERRORS.slice(
              0,
              30,
            )
              .map((x) => `<p>${esc(x)}</p>`)
              .join("")}</div></details>`
          : ""
      }</section></div>`
    );
  }
  handlers.menuimport = v08MenuView;
  async function v08MenuFile(file) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return toast("Maximal 12 MB pro Speisekarte", "error");
    V08_MENU_FILE = file.name;
    V08_MENU_STATUS = "Datei wird gelesen …";
    render();
    try {
      let txt = "";
      if (/\.pdf$/i.test(file.name)) {
        txt = await v4ExtractPDF(file);
        if (!txt.trim()) throw Error("PDF enthält keinen auslesbaren Text. Bei einem Scan bitte OCR verwenden.");
      } else if (/\.(csv|txt|text)$/i.test(file.name)) txt = await file.text();
      else throw Error("Bitte PDF, CSV oder TXT verwenden.");
      const result = /\.csv$/i.test(file.name) ? GLBMenu08.parseCSV(txt) : GLBMenu08.parseText(txt);
      V08_MENU_ROWS = result.rows;
      V08_MENU_ERRORS = result.errors || [];
      V08_MENU_STATUS = `Datei: ${file.name} · ${result.rows.length} erkannte Positionen`;
      if (!result.rows.length) throw Error("Kein eindeutig zuordenbarer Artikel mit Preis. Bitte CSV-Vorlage nutzen oder Text einfügen.");
      render();
      toast(`${result.rows.length} Positionen erkannt. Bitte Preise prüfen.`);
    } catch (e) {
      V08_MENU_STATUS = `Import fehlgeschlagen: ${e.message}`;
      V08_MENU_ROWS = [];
      render();
      toast(e.message, "error");
    }
  }
  function v08CommitMenu() {
    const rows = [];
    for (const el of document.querySelectorAll("[data-v08-selected]:checked")) {
      const i = Number(el.dataset.v08Selected),
        x = V08_MENU_ROWS[i];
      if (!x) continue;
      const name = String(document.querySelector(`[data-v08-name="${i}"]`)?.value || "").trim(),
        category = String(document.querySelector(`[data-v08-category="${i}"]`)?.value || "").trim() || "Speisekarte",
        price = V4.N(document.querySelector(`[data-v08-price="${i}"]`)?.value),
        vat = Number(document.querySelector(`[data-v08-vat="${i}"]`)?.value);
      if (name.length < 3 || !Number.isFinite(price) || price <= 0 || price > 9999 || ![0, 7, 19].includes(vat))
        return toast("Bitte Namen, Preise und USt bei allen markierten Artikeln überprüfen.", "error");
      rows.push({ ...x, name, category, grossPrice: price, vat });
    }
    if (!rows.length) return toast("Keine Artikel für den Import ausgewählt.", "error");
    const allowUpdate = !!document.querySelector("#v08-allow-update")?.checked;
    let added = 0,
      updated = 0,
      skipped = 0;
    for (const x of rows) {
      const matches = S.items.filter((it) => V4.norm(it.name) === V4.norm(x.name));
      if (matches.length) {
        if (allowUpdate && matches.length === 1) {
          Object.assign(matches[0], { grossPrice: x.grossPrice, category: x.category, vat: x.vat });
          updated++;
        } else skipped++;
        continue;
      }
      S.items.push({
        id: uid(),
        name: x.name,
        category: x.category,
        quantity: 0,
        costNet: 0,
        grossPrice: x.grossPrice,
        vat: x.vat,
        unit: x.unit,
      });
      added++;
    }
    if (!added && !updated) return toast(`${skipped} vorhandene Artikel übersprungen. Zum Aktualisieren die Option aktivieren.`, "error");
    markEdited();
    persist();
    V08_MENU_ROWS = [];
    V08_MENU_STATUS = `${added} neu, ${updated} aktualisiert, ${skipped} übersprungen`;
    render();
    toast(`Speisekartenimport: ${V08_MENU_STATUS}. Cloud-Sync beachten.`);
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-v08]");
    if (!el) return;
    e.preventDefault();
    switch (el.dataset.v08) {
      case "menu-template":
        downloadFile(
          "\uFEFFProdukt;Kategorie;Bruttopreis;USt;Einheit\nBurger Classic;Burger;17,90;7;Portion\nEspresso;Kaffee;3,40;19;Stück\n",
          "GLB_Speisekartenimport_Vorlage.csv",
          "text/csv;charset=utf-8",
        );
        break;
      case "parse-text": {
        const result = GLBMenu08.parseText(document.querySelector("#v08-menu-text")?.value || "");
        V08_MENU_ROWS = result.rows;
        V08_MENU_ERRORS = result.errors;
        V08_MENU_STATUS = `${result.rows.length} Textpositionen erkannt`;
        render();
        if (!result.rows.length) toast("Keine Artikel erkannt. Beispieltext überprüfen.", "error");
        break;
      }
      case "clear-preview":
        V08_MENU_ROWS = [];
        V08_MENU_ERRORS = [];
        V08_MENU_STATUS = "Vorschau zurückgesetzt.";
        render();
        break;
      case "commit-menu":
        v08CommitMenu();
        break;
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "v08-menu-file") void v08MenuFile(e.target.files?.[0]);
  });
  document.addEventListener("dragover", (e) => {
    if (e.target.closest?.("#v08-dropzone")) {
      e.preventDefault();
      e.target.closest("#v08-dropzone").classList.add("is-dragging");
    }
  });
  document.addEventListener("dragleave", (e) => {
    const z = e.target.closest?.("#v08-dropzone");
    if (z) z.classList.remove("is-dragging");
  });
  document.addEventListener("drop", (e) => {
    const z = e.target.closest?.("#v08-dropzone");
    if (!z) return;
    e.preventDefault();
    z.classList.remove("is-dragging");
    void v08MenuFile(e.dataTransfer?.files?.[0]);
  });
  // Restricted roles receive no cost/profit data. Show operational funnel only, never synthetic zero-cost margins.
  const v08FinancialFunnel = handlers.funnel;
  handlers.funnel = () => {
    const role = window.GLBAccess?.role;
    if (!["service_staff", "service_lead", "sales"].includes(role)) return v08FinancialFunnel();
    const records = (S.funnel || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = records.reduce((a, b) => a + (Number(b.covers) || 0), 0);
    const steps = [
      ["aperitif", "Aperitifs"],
      ["water", "Wasserflaschen"],
      ["upgrades", "Upgrades"],
      ["sides", "Beilagen"],
      ["desserts", "Desserts"],
      ["coffee", "Kaffees"],
    ];
    return (
      pageHeader(
        "SERVICE / VERKAUFSSTEUERUNG",
        "Service Funnel",
        "Tageszahlen erfassen und Verkaufsquoten verfolgen – ohne vertrauliche Kalkulationsdaten.",
        `<button data-action="new-funnel" class="btn btn-primary">${I("plus")} Tageszahlen erfassen</button>`,
      ) +
      `<section class="v08-staff-head"><div><small>ERFASSTE GÄSTE</small><strong>${number(total)}</strong></div><div><small>TAGE / OUTLETS</small><strong>${number(records.length)}</strong></div></section><div class="v08-staff-grid">${steps
        .map(([id, label]) => {
          const n = records.reduce((a, b) => a + (Number(b[id]) || 0), 0);
          return `<div class="v08-staff-metric"><span>${esc(label)}</span><strong>${number(n)}</strong><small>Quote je Covers: ${total ? ((n / total) * 100).toFixed(1).replace(".", ",") + " %" : "—"}</small></div>`;
        })
        .join(
          "",
        )}</div><section class="panel"><h3>Letzte Erfassungen</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>Datum</th><th>Outlet</th><th>Gäste</th><th>Aktion</th></tr></thead><tbody>${
        records
          .slice(0, 40)
          .map(
            (x) =>
              `<tr><td>${esc(x.date)}</td><td>${esc(S.outlets.find((o) => o.id === x.outletId)?.name || x.outletId)}</td><td>${number(x.covers)}</td><td><button class="btn btn-small" data-funnel-edit="${esc(x.id)}">Bearbeiten</button></td></tr>`,
          )
          .join("") || '<tr><td colspan="4">Noch keine Tageswerte erfasst.</td></tr>'
      }</tbody></table></div></section>`
    );
  };
  // Mobile inventory quick-entry for kitchen staff. Reuses the tested v4 counting handler.
  const v08InventoryFull = handlers.inventory;
  handlers.inventory = () => {
    if (window.GLBAccess?.role !== "kitchen_staff") return v08InventoryFull();
    const products = S.ingredients || [],
      locations = S.warehouses || [],
      counts = (S.inventoryCounts || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    return (
      pageHeader("KÜCHE / INVENTUR", "Schnell zählen", "Gebinde und lose Menge erfassen – optimiert für Smartphone und Tablet.") +
      `<div class="v08-staff-count"><form id="v4-count-form" class="v08-staff-count-form"><label>Lager auswählen<select name="warehouseId" required>${selectOptions(
        locations.map((x) => [x.id, x.name]),
        locations[0]?.id,
      )}</select></label><label>Rohware auswählen<select name="ingredientId" required>${selectOptions(
        products.map((x) => [x.id, x.name]),
        products[0]?.id,
      )}</select></label><label>Inventurdatum<input type="date" name="date" value="${V4_TODAY()}" max="${V4_TODAY()}" required></label><div class="v08-two-fields"><label>Volle Gebinde<input type="number" name="packs" min="0" step="0.01" inputmode="decimal" value="0" required></label><label>Lose Menge in Basiseinheit (g / ml / Stk.)<input type="number" name="loose" min="0" step="0.01" inputmode="decimal" value="0" required></label></div><button class="btn btn-primary" type="submit">${I("check")} Inventurposition speichern</button><p>Die lose Menge wird in Gramm, Millilitern oder Stück erfasst – je nach Einheit der Rohware.</p></form></div><section class="panel"><h3>Zuletzt gezählt</h3><div class="v08-recent-counts">${
        counts
          .slice(0, 12)
          .map(
            (x) =>
              `<div><span><b>${esc(products.find((p) => p.id === x.ingredientId)?.name || "Rohware")}</b><small>${esc(x.date)} · ${esc(locations.find((w) => w.id === x.warehouseId)?.name || "Lager")}</small></span><strong>${esc(String(x.baseQty))}</strong></div>`,
          )
          .join("") || "<p>Noch keine Inventurzählung vorhanden.</p>"
      }</div></section>`
    );
  };
  // ===== End GLB v0.8 extensions =====

  // Controlled entry point for the authenticated cloud bridge. Local Browser storage is never used in Cloud mode.
  window.GLBAppSync = {
    snapshot: () => JSON.parse(JSON.stringify(S)),
    hydrate: (source) => {
      const clean = migrate(JSON.parse(JSON.stringify(source)));
      S = { ...defaults(), ...clean };
      ensureV03();
      ensureV04();
      ensureV05();
      ensureV06();
      render();
    },
    startBlank: (name) => {
      S = defaults();
      S.mode = "own";
      S.business = name || "Neuer Betrieb";
      S.items = [];
      S.sales = [];
      S.market = [];
      S.monthlyCosts = {};
      S.funnel = [];
      S.marketDiscovered = [];
      S.marketLastScan = "";
      S.categoryGroups = {};
      S.ingredients = [];
      S.recipes = [];
      S.warehouses = [{ id: "wh-main", name: "Hauptlager", note: "" }];
      S.inventoryCounts = [];
      S.dailySales = [];
      S.stockMovements = [];
      S.purchaseOrders = [];
      S.ingredientWarehouses = {};
      S.v05SalesUsage = true;
      S.v04DemoSeeded = true;
      S.v06Pinned = [];
      ensureV03();
      ensureV04();
      ensureV05();
      ensureV06();
      render();
    },
    rerender: () => render(),
  };
  render();
})();
