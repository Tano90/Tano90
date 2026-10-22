/* GLB AI Suite – v1.1 Intelligence Center inside the existing suite.
   Views: Management-Cockpit, Verkauf & Monatsimport, Menu Engineering, Mindestbestände, Team & Aufgaben,
   Tagesfunnel (Kassenbons), Funnel Quest, KI-Marktcheck, Strukturcheck. Calculations come unchanged from
   v11/core.mjs and v11/intelligence.mjs (v1.1 RC1); data are the suite's own articles, outlets and sales. */
import { money, percent, numberDE, numberInput, rowsFromCSV, sha256, calculateSales, suggestActions, csvExport, norm } from "./core.mjs";
import {
  readPosImport,
  aggregateFunnel,
  compareMarket,
  STAGES,
  scoreQuiz,
  STAGE_IDS,
  applyStageMappings,
  findPosOverlaps,
} from "./intelligence.mjs";
import { initializeIntelligence } from "./demo.mjs";
import * as T from "./tasks.mjs";
import * as cloud from "./cloud.mjs";

const G = window.GLBSuite;
const { esc, I, pageHeader, panelHeader, demoNotice, dateDE } = G.ui;
const S = () => G.S;

// ---------- mode, roles, data adapters ----------
const FINANCE = ["owner", "editor", "restaurant_manager", "general_manager"];
const isCloud = () => cloud.cloudOpen();
const role = () => (isCloud() ? window.GLBCloudContext.role : "owner");
const finance = () => FINANCE.includes(role());
const canUpdateInventory = () => ["owner", "editor", "kitchen_lead", "restaurant_manager", "general_manager"].includes(role());
const canUpdateTasks = () => role() !== "viewer";
const exampleData = () => S().mode !== "own";
const sourceLabel = () =>
  exampleData()
    ? "Beispieldaten – kein echter Umsatz"
    : isCloud()
      ? "Eigene Daten aus dem Cloud-Arbeitsbereich"
      : "Eigene Daten, nur in diesem Browser";

// POS lines and training results of the cloud live in their own tables, never in the workspace document.
const CLOUD = { pos: [], since: "", truncated: false, training: [], loaded: false, error: "" };
const intel = () => S().intelligence;
const posLines = () => (isCloud() ? CLOUD.pos : intel().pos);
const trainingRows = () => (isCloud() ? CLOUD.training : intel().training);

const products = () =>
  (S().items || []).map((p) => ({
    id: p.id,
    name: p.name,
    vat_percent: Number(p.vat) || 7,
    unit_cost_net: Number(p.costNet) > 0 ? Number(p.costNet) : null,
  }));
const outlets = () => (S().outlets || []).map((o) => ({ id: o.id, name: o.name }));
/** Sales in the v1.1 shape. Imported lines carry their cost and VAT snapshot; older lines use the cost state valid in
 *  their month (the suite's history) – a missing cost stays missing ("WE fehlt"). */
function v11Sales() {
  const byId = new Map((S().items || []).map((p) => [p.id, p]));
  return (S().sales || [])
    .filter((s) => /^\d{4}-\d{2}$/.test(String(s.month || "")))
    .map((s) => {
      const p = byId.get(s.productId);
      let cost = null;
      if ("unitCostNet" in s) cost = s.unitCostNet;
      else if (p) {
        const c = Number(G.costAt(p, s.month)?.costNet);
        cost = c > 0 ? c : null;
      }
      return {
        id: s.id,
        product_id: s.productId,
        outlet_id: s.outletId,
        product_name: p?.name,
        month: s.month + "-01",
        quantity: Number(s.quantity),
        unit_price_gross: Number(s.grossPrice),
        unit_cost_net: cost,
        vat_percent: Number(s.vatPercent ?? p?.vat ?? 7),
        source_hash: s.sourceHash,
        line_no: s.lineNo,
        snapshot: "unitCostNet" in s,
      };
    });
}

// ---------- module state ----------
const V = {
  outlet: "all",
  month: "all",
  search: "",
  preview: null,
  funnelDate: "all",
  posPreview: null,
  trainingStage: "aperitif",
  quizFeedback: null,
  ai: null,
  aiMeta: null,
  discover: null,
  legacy: null,
  legacyUrl: (() => {
    try {
      return localStorage.getItem("glb_v11_legacy_url") || "";
    } catch {
      return "";
    }
  })(),
  summary: null,
  taskOutlet: "all",
  taskStatus: "all",
  taskPrio: "all",
  taskSort: "due",
  taskGroup: true,
};
const tag = (txt, cls = "neutral") => `<span class="tag tag-${cls}">${esc(txt)}</span>`;
const kpi = (label, value, foot, accent = "") =>
  `<article class="v6-stat ${accent}"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(foot)}</span></article>`;
const pl = (n, one, many) => `${Number(n).toLocaleString("de-DE")} ${Number(n) === 1 ? one : many}`;
const today = () => new Date().toISOString().slice(0, 10);
// training limit per calendar day in Germany (SQL 006 uses the same time zone)
const berlinDay = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(d));
const scoped = () => v11Sales().filter((x) => V.month === "all" || x.month.slice(0, 7) === V.month);
const stats = () => calculateSales(scoped(), products(), V.outlet);
const selection = () =>
  `${V.month === "all" ? "alle Monate" : G.ui.periodName(V.month)} · ${V.outlet === "all" ? "alle Outlets" : outlets().find((o) => o.id === V.outlet)?.name || "Outlet"}`;
function filters() {
  const months = [...new Set(v11Sales().map((x) => x.month.slice(0, 7)))].sort().reverse();
  return `<div class="v11-filters"><label class="field"><span>Outlet</span><select data-v11-filter="outlet">${G.ui.selectOptions(
    [["all", "Alle Outlets"], ...outlets().map((o) => [o.id, o.name])],
    V.outlet,
  )}</select></label><label class="field"><span>Monat</span><select data-v11-filter="month">${G.ui.selectOptions(
    [["all", "Alle Monate"], ...months.map((m) => [m, G.ui.periodName(m)])],
    V.month,
  )}</select></label></div>`;
}
const needCloudData = () =>
  isCloud() && !CLOUD.loaded
    ? `<div class="notice">${I("info")}<span>Kassenbons und Trainingsergebnisse werden geladen …</span></div>`
    : "";

// ---------- Management-Cockpit ----------
function cockpit() {
  const s = stats();
  const open = (S().tasks || []).filter((t) => t.status !== "done").length;
  const cards = finance()
    ? [
        kpi("Bruttoumsatz", money(s.gross), "Summe der Monatsverkäufe"),
        kpi("Nettoumsatz", money(s.net), "Brutto ÷ (1 + USt) je Zeile"),
        kpi(
          "Deckungsbeitrag I",
          s.margin === null ? "Unvollständig" : money(s.margin),
          s.margin === null ? `Wareneinsatz fehlt bei ${pl(s.missingCost, "Zeile", "Zeilen")}` : "Netto minus Wareneinsatz",
          "mint",
        ),
        kpi(
          "Wareneinsatzquote",
          s.missingCost ? "Unvollständig" : percent(s.foodCostPct),
          s.missingCost ? "Nicht alle Zeilen mit Kosten" : "Wareneinsatz ÷ Netto",
        ),
      ]
    : [kpi("Offene Aufgaben", String(open), "Team & Aufgaben"), kpi("Outlets", String(outlets().length), "Bereiche des Betriebs")];
  const notes = suggestActions(s, S().parStock || [], S().tasks || []);
  const target = { inventory: "v11stock", menu: "v11menu", tasks: "v11tasks", sales: "v11sales" };
  const quick = [
    ["v11sales", "Verkauf & Monatsimport", "Kassendaten mit Vorschau übernehmen"],
    ["v11menu", "Menu Engineering", "Absatz und DB I je Artikel vergleichen"],
    ["v11funnel", "Tagesfunnel", "Kaufquoten je Bon aus Kassendaten"],
    ["v11stock", "Mindestbestände", "Bestellvorschläge aus Ziel − Ist"],
    ["v11tasks", "Team & Aufgaben", "Maßnahmen festlegen und erledigen"],
    ["v11training", "Funnel Quest", "Kurze Verkaufstrainings"],
  ].filter(([v]) => window.GLBAccess?.canView(v) ?? true);
  return (
    pageHeader(
      "MANAGEMENT-COCKPIT",
      "Management-Cockpit",
      finance()
        ? `Monatsverkäufe auf einen Blick. ${esc(sourceLabel())}.`
        : "Offene Aufgaben und Bereiche des Betriebs. Umsatzzahlen sieht die Geschäftsleitung.",
    ) +
    demoNotice() +
    (finance()
      ? `<div class="v11-headline"><p class="v11-scope">Auswahl: <b>${esc(selection())}</b>. Kosten: Snapshot beim Import, bei älteren Zeilen der Kostenstand des Monats. Kassenbon-Umsätze aus dem Tagesfunnel sind nicht addiert.</p>${filters()}</div>`
      : "") +
    `<section class="v6-kpis">${cards.join("")}</section>` +
    `<div class="content-grid">${finance() ? `<section class="panel">${panelHeader("Umsatzentwicklung", "Bruttoumsatz je Monat")}${chart(s)}</section>` : `<section class="panel">${panelHeader("Kennzahlen")}<p class="calc-note">Umsatz- und Kostenkennzahlen sind der Geschäftsleitung vorbehalten.</p></section>`}` +
    `<section class="panel">${panelHeader("Management-Hinweise", "Regelbasiert, keine KI")}<div class="v11-notes">${notes
      .filter((n) => window.GLBAccess?.canView(target[n.target]) ?? true)
      .map(
        (n) =>
          `<div class="v11-note ${n.level}"><span class="tag tag-${n.level === "warning" ? "orange" : n.level === "ok" ? "neutral" : "blue"}">${n.level === "warning" ? "Achtung" : n.level === "ok" ? "OK" : "Hinweis"}</span><div><b>${esc(n.title)}</b><p>${esc(n.detail)}</p></div><button type="button" class="btn btn-small" data-view="${target[n.target]}" aria-label="${esc(n.title)} öffnen">Öffnen</button></div>`,
      )
      .join("")}</div></section></div>` +
    `<section class="panel" style="margin-top:18px">${panelHeader("Schnellzugriff")}<div class="v11-quick">${quick
      .map(([v, t, d]) => `<button type="button" class="v11-quick-item" data-view="${v}"><b>${esc(t)}</b><small>${esc(d)}</small></button>`)
      .join("")}</div></section>`
  );
}
function chart(s) {
  if (!s.months.length)
    return G.ui.empty("Keine Verkaufsdaten in dieser Auswahl", "Andere Auswahl wählen oder Monatsverkäufe importieren.");
  const max = Math.max(...s.months.map((x) => x.value), 1);
  return `<div class="v11-chart" role="img" aria-label="Bruttoumsatz je Monat">${s.months
    .slice(-12)
    .map((x) => {
      const h = Math.max(3, Math.round((x.value / max) * 100));
      return `<div class="v11-bar" title="${esc(x.month)}: ${esc(money(x.value))}"><em>${esc(Math.round(x.value).toLocaleString("de-DE"))} €</em><span style="height:${h}%"></span><strong>${esc(x.month.slice(5))}/${esc(x.month.slice(2, 4))}</strong></div>`;
    })
    .join("")}</div>`;
}

// ---------- Verkauf & Monatsimport ----------
function salesView() {
  const s = stats();
  const pName = new Map(products().map((x) => [x.id, x.name])),
    oName = new Map(outlets().map((x) => [x.id, x.name]));
  const rows = scoped()
    .filter((x) => V.outlet === "all" || x.outlet_id === V.outlet)
    .reverse();
  const p = V.preview;
  return (
    pageHeader(
      "VERKAUF & MONATSIMPORT",
      "Verkauf & Monatsimport",
      "Importiert statt geschätzt. Vorhandene Verkäufe werden nie still überschrieben.",
    ) +
    demoNotice() +
    `<div class="v11-headline"><p class="v11-scope">Auswahl: <b>${esc(selection())}</b></p>${filters()}</div>` +
    `<div class="content-grid"><section class="panel">${panelHeader("Neuen Import vorbereiten", "CSV, UTF-8, Semikolon oder Komma")}<p class="calc-note">Pflichtspalten: <b>Produkt;Outlet;Monat;Menge;Bruttopreis</b>. Monat als <b>2026-10</b>. Artikel und Outlet müssen angelegt sein. Bruttopreis je Einheit, Zahlen deutsch (1.234,50). Wareneinsatz und USt werden aus dem Artikelstamm als Snapshot je Zeile gespeichert.</p><div class="v11-upload"><label class="field"><span>CSV-Datei auswählen</span><input id="v11-sales-file" type="file" accept=".csv,text/csv"></label><div class="actions"><button type="button" class="btn btn-primary" data-v11="preview-sales">Datei prüfen</button><button type="button" class="btn" data-v11="sales-template">${I("download")} Muster</button></div></div>${p ? salesPreview(p) : ""}</section>` +
    `<section class="panel">${panelHeader("Datenqualität", "Prüfung der gespeicherten Monatsverkäufe")}<div class="v11-list"><div><span><b>Verkaufszeilen</b><small>in der Auswahl</small></span><b>${s.rows}</b></div><div><span><b>Artikelstamm</b><small>Artikel mit eindeutigem Namen</small></span><b>${products().length}</b></div><div><span><b>Zeilen ohne Wareneinsatz</b><small>DB nur bei vollständigen Kosten</small></span><b>${s.missingCost ? tag(String(s.missingCost) + " fehlen", "orange") : tag("0 – vollständig", "neutral")}</b></div></div><div class="actions" style="margin-top:14px"><button type="button" class="btn" data-v11="export-sales-filtered">${I("download")} Aktuelle Auswahl exportieren</button><button type="button" class="btn" data-v11="export-sales-all">${I("download")} Alle Verkaufsdaten exportieren</button></div><p class="calc-note">Beide Exporte haben das Importformat (Produkt;Outlet;Monat;Menge;Bruttopreis). Der Dateiname nennt die Auswahl.</p></section></div>` +
    `<section class="panel" style="margin-top:18px">${panelHeader(`Verkaufsdaten (${rows.length}${rows.length > 100 ? ", neueste 100 sichtbar" : ""})`)}<div class="table-scroll"><table class="data-table"><thead><tr><th>Monat</th><th>Artikel</th><th>Outlet</th><th class="align-right">Menge</th><th class="align-right">Bruttopreis</th><th class="align-right">Bruttoumsatz</th><th>Kosten</th></tr></thead><tbody>${
      rows
        .slice(0, 100)
        .map(
          (x) =>
            `<tr><td>${esc(x.month.slice(0, 7))}</td><td><b>${esc(pName.get(x.product_id) || "–")}</b></td><td>${esc(oName.get(x.outlet_id) || "–")}</td><td class="align-right">${esc(x.quantity.toLocaleString("de-DE"))}</td><td class="align-right">${money(x.unit_price_gross)}</td><td class="align-right">${money(x.quantity * x.unit_price_gross)}</td><td>${x.unit_cost_net === null ? tag("WE fehlt", "orange") : x.snapshot ? "Snapshot" : "Kostenstand"}</td></tr>`,
        )
        .join("") || `<tr><td colspan="7">Keine Verkaufsdaten in dieser Auswahl.</td></tr>`
    }</tbody></table></div></section>`
  );
}
function salesPreview(p) {
  return `<div class="v11-preview" role="status"><p class="notice">${I("info")}<span>${p.valid.length} gültige Zeilen vorbereitet${p.dupes ? `, davon ${p.dupes} bereits importiert (gleicher Dateiinhalt und Zeile, werden übersprungen)` : ""}. Import erst nach Bestätigung.</span></p>${
    p.errors.length
      ? `<div class="v11-errors"><b>${p.errors.length} Fehler – Import gesperrt, bis die Datei korrigiert ist:</b><ul>${p.errors
          .slice(0, 12)
          .map((e) => `<li>${esc(e)}</li>`)
          .join("")}</ul>${p.errors.length > 12 ? `<p>Weitere ${p.errors.length - 12} Fehler nicht angezeigt.</p>` : ""}</div>`
      : ""
  }<div class="actions"><button type="button" class="btn btn-primary" data-v11="commit-sales" ${p.errors.length || !p.valid.length ? "disabled" : ""}>${p.valid.length - (p.dupes || 0)} Zeilen importieren</button><button type="button" class="btn" data-v11="cancel-sales">Abbrechen</button></div></div>`;
}
async function previewSales() {
  const file = document.querySelector("#v11-sales-file")?.files?.[0];
  if (!file) throw Error("Bitte zuerst eine CSV-Datei auswählen.");
  if (file.size > 5_000_000) throw Error("Datei über 5 MB. Bitte in Monatsdateien aufteilen.");
  const content = await file.text(),
    hash = await sha256(content);
  const r = rowsFromCSV(content, products(), outlets(), hash, file.name);
  const known = new Set((S().sales || []).filter((x) => x.sourceHash).map((x) => `${x.sourceHash}:${x.lineNo}`));
  r.dupes = r.valid.filter((x) => known.has(`${x.source_hash}:${x.line_no}`)).length;
  V.preview = r;
  G.render();
  G.toast(
    `${r.valid.length} Zeilen geprüft${r.errors.length ? `, ${r.errors.length} Fehler` : ""}.`,
    r.errors.length ? "error" : undefined,
  );
}
function commitSales() {
  const p = V.preview;
  if (!p || p.errors.length || !p.valid.length) throw Error("Keine fehlerfreie Importvorschau vorhanden.");
  const known = new Set((S().sales || []).filter((x) => x.sourceHash).map((x) => `${x.sourceHash}:${x.lineNo}`));
  const fresh = p.valid.filter((x) => !known.has(`${x.source_hash}:${x.line_no}`));
  for (const x of fresh)
    S().sales.push({
      id: G.uid(),
      productId: x.product_id,
      outletId: x.outlet_id,
      month: x.month.slice(0, 7),
      quantity: x.quantity,
      grossPrice: x.unit_price_gross,
      unitCostNet: x.unit_cost_net,
      vatPercent: x.vat_percent,
      sourceHash: x.source_hash,
      lineNo: x.line_no,
      fileName: x.file_name,
      importId: x.source_hash,
    });
  (S().importLog ||= []).push({
    kind: "sales",
    hash: p.valid[0].source_hash,
    fileName: p.valid[0].file_name,
    mode: "add",
    importedAt: new Date().toISOString(),
    added: fresh.length,
  });
  V.preview = null;
  G.markEdited();
  G.persist();
  G.render();
  G.toast(`Import abgeschlossen: ${fresh.length} neue Zeilen, ${p.valid.length - fresh.length} bereits vorhandene übersprungen.`);
}
function exportSales(all) {
  const pName = new Map(products().map((x) => [x.id, x.name])),
    oName = new Map(outlets().map((x) => [x.id, x.name]));
  const src = all ? v11Sales() : scoped().filter((x) => V.outlet === "all" || x.outlet_id === V.outlet);
  if (!src.length) throw Error("Keine Verkaufsdaten für diesen Export.");
  const rows = src.map((s) => ({
    Produkt: pName.get(s.product_id),
    Outlet: oName.get(s.outlet_id),
    Monat: s.month.slice(0, 7),
    Menge: s.quantity,
    Bruttopreis: String(s.unit_price_gross).replace(".", ","),
  }));
  const scope = all ? "alle" : selection().replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g, "_");
  G.download(
    "﻿" + csvExport(rows, ["Produkt", "Outlet", "Monat", "Menge", "Bruttopreis"]),
    `GLB_Verkaufsdaten_${scope}.csv`,
    "text/csv;charset=utf-8",
  );
  G.toast(`${rows.length} Zeilen exportiert (${all ? "alle Verkaufsdaten" : selection()}).`);
}

// ---------- Menu Engineering ----------
const CLASS_TAG = { Star: "neutral", Renner: "blue", Puzzle: "blue", Penner: "red", "WE fehlt": "orange" };
const ADVICE = {
  Star: "Qualität halten, prominent platzieren",
  Renner: "Preis oder Wareneinsatz prüfen",
  Puzzle: "Sichtbarkeit und Verkaufssätze prüfen",
  Penner: "Rezeptur oder Positionierung prüfen",
  "WE fehlt": "Wareneinsatz hinterlegen",
};
function menuView() {
  const s = stats();
  const q = norm(V.search);
  const list = s.products.filter((x) => norm(x.name).includes(q));
  const count = (c) => String(s.products.filter((x) => x.classification === c).length);
  return (
    pageHeader(
      "MENU ENGINEERING",
      "Menu Engineering",
      "Absatz × Deckungsbeitrag I je verkaufter Einheit, relativ zu den Artikeln der Auswahl.",
      `<button type="button" class="btn" data-view="portfolio">Renner-Penner (DB II) öffnen</button>`,
    ) +
    demoNotice() +
    `<div class="v11-headline"><p class="v11-scope">Auswahl: <b>${esc(selection())}</b></p>${filters()}</div>` +
    `<section class="v6-kpis">${kpi("Stars", count("Star"), "Hoher Absatz · hoher DB")}${kpi("Renner", count("Renner"), "Hoher Absatz · niedriger DB")}${kpi("Puzzle", count("Puzzle"), "Niedriger Absatz · hoher DB")}${kpi("Penner", count("Penner"), "Niedriger Absatz · niedriger DB")}</section>` +
    `<section class="panel">${panelHeader("Artikelperformance", `${list.length} Artikel`, `<input class="search-input" id="v11-article-search" placeholder="Artikel suchen …" value="${esc(V.search)}" aria-label="Artikel suchen">`)}<div class="table-scroll"><table class="data-table"><thead><tr><th>Artikel</th><th class="align-right">Absatz</th><th class="align-right">Bruttoumsatz</th><th class="align-right">DB I netto</th><th class="align-right">DB I je Einheit</th><th>Klasse</th><th>Empfehlung</th></tr></thead><tbody>${
      list
        .map(
          (x) =>
            `<tr><td><b>${esc(x.name)}</b></td><td class="align-right">${esc(x.qty.toLocaleString("de-DE"))}</td><td class="align-right">${money(x.gross)}</td><td class="align-right">${x.margin === null ? "—" : money(x.margin)}</td><td class="align-right">${x.unitMargin == null ? "—" : money(x.unitMargin)}</td><td>${tag(x.classification, CLASS_TAG[x.classification])}</td><td class="small">${esc(ADVICE[x.classification])}${x.margin === null && finance() ? ` <button type="button" class="btn btn-small" data-v11="backfill" data-id="${esc(x.id)}">WE nachtragen</button>` : ""}</td></tr>`,
        )
        .join("") || `<tr><td colspan="7">Keine passenden Artikel in dieser Auswahl.</td></tr>`
    }</tbody></table></div><p class="calc-note"><b>Berechnungsgrundlage:</b> Median von Absatz und DB I je Einheit über die Artikel mit vollständigen Kosten (aktuell ${s.products.filter((x) => x.margin !== null).length}). DB I = Netto − Wareneinsatz. Artikel ohne Wareneinsatz werden nicht eingestuft („WE fehlt“). Renner-Penner im Bereich Verkauf & Analyse rechnet mit DB II und Vergleichsgruppen; beide Sichten bleiben bewusst nebeneinander.</p></section>`
  );
}
function backfillModal(productId) {
  const p = S().items.find((x) => x.id === productId);
  if (!p) return;
  const missing = v11Sales().filter((x) => x.product_id === p.id && x.unit_cost_net === null).length;
  document.querySelector("#modal-layer").innerHTML =
    `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="v11-cost-title"><div class="modal-header"><h2 id="v11-cost-title">${esc(p.name)} – Wareneinsatz nachtragen</h2><button type="button" class="close-btn" data-v11="close" aria-label="Fenster schließen">×</button></div><form id="v11-cost-form"><input type="hidden" name="id" value="${esc(p.id)}"><p>${pl(missing, "Verkaufszeile", "Verkaufszeilen")} ohne Wareneinsatz. Der bestätigte Netto-Stückpreis wird nur bei diesen Zeilen eingetragen und als neuer Kostenstand ab heute im Artikel gespeichert. <b>Vorhandene Kosten-Snapshots bleiben unverändert.</b></p><div class="field"><label for="v11-cost">Wareneinsatz netto je Einheit (€)</label><input id="v11-cost" name="cost" required inputmode="decimal" placeholder="z. B. 4,20" value="${Number(p.costNet) > 0 ? String(p.costNet).replace(".", ",") : ""}"></div><div class="modal-footer"><button type="button" class="btn" data-v11="close">Abbrechen</button><button type="submit" class="btn btn-primary">Kosten bestätigt nachtragen</button></div></form></div>`;
  document.querySelector("#v11-cost")?.focus();
}
function saveBackfill(obj) {
  const cost = numberDE(obj.cost);
  if (!Number.isFinite(cost) || cost < 0) throw Error("Kostenwert muss 0 oder mehr sein.");
  const p = S().items.find((x) => x.id === obj.id);
  if (!p) throw Error("Artikel nicht gefunden.");
  const byId = new Map(v11Sales().map((x) => [x.id, x]));
  let n = 0;
  for (const s of S().sales)
    if (s.productId === p.id && byId.get(s.id)?.unit_cost_net === null) {
      s.unitCostNet = cost; // only missing values; existing snapshots are not touched
      n++;
    }
  p.costNet = cost;
  G.recordCost(p, { validFrom: today(), source: "WE nachgetragen (Menu Engineering)" });
  G.closeModal();
  G.markEdited();
  G.persist();
  G.render();
  G.toast(`${n} Verkaufszeilen mit bestätigtem Wareneinsatz ergänzt.`);
}

// ---------- Mindestbestände ----------
function stockView() {
  const items = S().parStock || [];
  const low = items.filter((x) => Number(x.stock) <= Number(x.reorder_point));
  const edit = canUpdateInventory();
  return (
    pageHeader(
      "MINDESTBESTÄNDE",
      "Mindestbestände & Bestellvorschläge",
      "Einfache Liste mit Ist-, Mindest- und Zielbestand. Der verbrauchsbasierte Bestell-Forecast bleibt daneben bestehen.",
      `<button type="button" class="btn" data-view="purchasing">Bestell-Forecast öffnen</button><button type="button" class="btn btn-primary" data-v11="export-orders">${I("download")} ${low.length} Bestellvorschläge exportieren</button>`,
    ) +
    demoNotice() +
    `<div class="content-grid"><section class="panel">${panelHeader("Bestandsübersicht", "", tag(low.length ? `${low.length} unter Mindestbestand` : "Alle im Soll", low.length ? "orange" : "neutral"))}<div class="v11-list">${
      items
        .map((x) => {
          const isLow = Number(x.stock) <= Number(x.reorder_point);
          return `<div><span><b>${esc(x.name)}</b><small>${esc(x.supplier || "Lieferant fehlt")} · Mindest ${esc(fmt(x.reorder_point))} · Ziel ${esc(fmt(x.par_level))} ${esc(x.unit)}</small></span><span class="v11-right"><b>${esc(fmt(x.stock))} ${esc(x.unit)}</b> ${isLow ? tag(`Bestellen: ${fmt(Math.max(0, Number(x.par_level) - Number(x.stock)))} ${x.unit}`, "orange") : tag("Ausreichend", "neutral")}${edit ? ` <button type="button" class="btn btn-small" data-v11="edit-stock" data-id="${esc(x.id)}" aria-label="Bestand ${esc(x.name)} ändern">Bestand ändern</button>` : ""}</span></div>`;
        })
        .join("") || G.ui.empty("Keine Positionen", "Lege rechts die erste Position an.")
    }</div></section>` +
    `<section class="panel">${panelHeader("Position anlegen")}${
      edit
        ? `<form id="v11-stock-form" class="v11-form"><div class="field"><label for="v11-s-name">Name</label><input id="v11-s-name" name="name" required maxlength="160" placeholder="z. B. Rinderhüfte"></div><div class="form-grid"><div class="field"><label for="v11-s-unit">Einheit</label><input id="v11-s-unit" name="unit" value="Stück" maxlength="32" required></div><div class="field"><label for="v11-s-stock">Ist-Bestand</label><input id="v11-s-stock" name="stock" type="number" min="0" step="0.001" value="0" required></div><div class="field"><label for="v11-s-min">Mindestbestand</label><input id="v11-s-min" name="reorder_point" type="number" min="0" step="0.001" value="5" required></div><div class="field"><label for="v11-s-par">Zielbestand</label><input id="v11-s-par" name="par_level" type="number" min="0" step="0.001" value="15" required></div></div><div class="field"><label for="v11-s-sup">Lieferant (optional)</label><input id="v11-s-sup" name="supplier" maxlength="120"></div><button class="btn btn-primary" type="submit">Position speichern</button></form>`
        : `<p class="calc-note">Deine Rolle darf Bestände nur lesen.</p>`
    }<p class="calc-note">Bestellvorschlag = Zielbestand − Ist-Bestand, sobald der Mindestbestand erreicht ist. Mengen in der Einheit der Position. Für Verbrauch aus Rezepten und Tagesabsätzen: Bestell-Forecast.</p></section></div>`
  );
}
const fmt = (n) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 3 });
function stockModal(id) {
  const x = (S().parStock || []).find((i) => i.id === id);
  if (!x) return;
  document.querySelector("#modal-layer").innerHTML =
    `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="v11-stock-title"><div class="modal-header"><h2 id="v11-stock-title">${esc(x.name)} – Bestand korrigieren</h2><button type="button" class="close-btn" data-v11="close" aria-label="Fenster schließen">×</button></div><form id="v11-stockfix-form"><input type="hidden" name="id" value="${esc(x.id)}"><input type="hidden" name="version" value="${esc(x.version || 1)}"><p>Aktueller Bestand: ${esc(fmt(x.stock))} ${esc(x.unit)}. Die Änderung erhöht die Versionsnummer der Position; parallele Änderungen werden erkannt.</p><div class="field"><label for="v11-newstock">Neuer Ist-Bestand in ${esc(x.unit)}</label><input id="v11-newstock" type="number" name="stock" value="${esc(x.stock)}" min="0" step="0.001" required></div><div class="modal-footer"><button type="button" class="btn" data-v11="close">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div></form></div>`;
  document.querySelector("#v11-newstock")?.focus();
}
function exportOrders() {
  const low = (S().parStock || [])
    .filter((x) => Number(x.stock) <= Number(x.reorder_point))
    .map((x) => ({
      Artikel: x.name,
      Einheit: x.unit,
      Bestand: x.stock,
      Mindestbestand: x.reorder_point,
      Zielbestand: x.par_level,
      Bestellmenge: Math.max(0, Number(x.par_level) - Number(x.stock)),
      Lieferant: x.supplier,
    }));
  if (!low.length) throw Error("Es sind keine Bestellvorschläge erforderlich.");
  G.download(
    "﻿" + csvExport(low, ["Artikel", "Einheit", "Bestand", "Mindestbestand", "Zielbestand", "Bestellmenge", "Lieferant"]),
    "GLB_Bestellvorschlaege.csv",
    "text/csv;charset=utf-8",
  );
}

// ---------- Team & Aufgaben ----------
const PRIO = { high: ["Hoch", "red"], medium: ["Mittel", "orange"], normal: ["Normal", "neutral"] };
const outletChoices = () => [[T.GENERAL, T.GENERAL_LABEL], ...outlets().map((o) => [o.id, o.name])];
function taskRow(t, edit, day) {
  const o = T.taskOutlet(t),
    late = T.isOverdue(t, day);
  return `<div class="v11-task ${t.status === "done" ? "done" : ""}"><input type="checkbox" id="v11-task-${esc(t.id)}" data-v11-task-toggle="${esc(t.id)}" ${t.status === "done" ? "checked" : ""} ${edit ? "" : "disabled"} aria-label="Aufgabe „${esc(t.title)}“ ${t.status === "done" ? "wieder öffnen" : "als erledigt markieren"}"><label for="v11-task-${esc(t.id)}"><b>${esc(t.title)}</b><small><span class="v11-task-outlet">${esc(T.outletLabel(o, outlets()))}</span> · Fällig: ${t.due_on ? esc(dateDE(t.due_on)) : "ohne Termin"} · ${t.status === "done" ? "Erledigt" : late ? "<b class=\"v11-late\">Überfällig</b>" : "Offen"}</small></label><span class="v11-task-side">${tag(PRIO[t.priority]?.[0] || "Normal", PRIO[t.priority]?.[1] || "neutral")}${edit ? `<button type="button" class="btn btn-small btn-quiet" data-v11="task-outlet" data-id="${esc(t.id)}" aria-label="Outlet von „${esc(t.title)}“ ändern">Outlet ändern</button>` : ""}</span></div>`;
}
function tasksView() {
  const all = S().tasks || [],
    day = berlinDay(),
    edit = canUpdateTasks(),
    list = T.sortTasks(T.filterTasks(all, { outlet: V.taskOutlet, status: V.taskStatus, priority: V.taskPrio }, day), V.taskSort, outlets()),
    grouped = V.taskGroup && V.taskOutlet === "all",
    stats = T.outletStats(all, outlets(), day),
    unknown = all.filter((t) => T.taskOutlet(t) !== null && !outlets().some((o) => o.id === T.taskOutlet(t))).length,
    sel = (name, label, options, value) =>
      `<label class="field"><span>${label}</span><select data-v11-filter="${name}">${G.ui.selectOptions(options, value)}</select></label>`;
  const body = !list.length
    ? G.ui.empty(all.length ? "Keine Aufgabe passt zum Filter" : "Noch keine Aufgaben", all.length ? "Filter oben anpassen." : "Lege rechts die erste Maßnahme an.")
    : grouped
      ? T.groupByOutlet(list, outlets())
          .map((g) => `<h3 class="v11-task-group">${esc(g.label)} <small>${pl(g.tasks.length, "Aufgabe", "Aufgaben")}</small></h3><div class="v11-tasks">${g.tasks.map((t) => taskRow(t, edit, day)).join("")}</div>`)
          .join("")
      : `<div class="v11-tasks">${list.map((t) => taskRow(t, edit, day)).join("")}</div>`;
  const preset = V.taskOutlet !== "all" ? V.taskOutlet : T.GENERAL;
  return (
    pageHeader(
      "TEAM & AUFGABEN",
      "Team & Aufgaben",
      "Operative Maßnahmen je Outlet nach Priorität, Termin und Status.",
      tag(`${all.filter((x) => x.status !== "done").length} offen`, "blue"),
    ) +
    `<section class="panel v11-task-overview">${panelHeader("Offen und überfällig je Outlet", "Klick filtert die Liste")}<div class="v11-outlet-chips">${stats
      .map(
        (x) =>
          `<button type="button" class="v11-outlet-chip ${V.taskOutlet === (x.id ?? T.GENERAL) ? "active" : ""}" data-v11="task-outlet-filter" data-outlet="${esc(x.id ?? T.GENERAL)}" aria-pressed="${V.taskOutlet === (x.id ?? T.GENERAL)}"><b>${esc(x.label)}</b><span>${pl(x.open, "offen", "offen")}${x.overdue ? ` · <b class="v11-late">${x.overdue} überfällig</b>` : " · nichts überfällig"}</span></button>`,
      )
      .join("")}</div>${unknown ? `<p class="calc-note">${pl(unknown, "Aufgabe verweist", "Aufgaben verweisen")} auf ein Outlet, das es nicht mehr gibt. Sie bleiben unverändert und sind unter „Outlet nicht mehr vorhanden“ zu finden.</p>` : ""}</section>` +
    `<div class="content-grid"><section class="panel">${panelHeader("Aufgabenliste", `${pl(list.length, "Aufgabe", "Aufgaben")} im Filter`)}<div class="v11-filters v11-task-filters">${sel(
      "taskOutlet",
      "Outlet",
      [["all", "Alle Outlets"], ...outletChoices()],
      V.taskOutlet,
    )}${sel("taskStatus", "Status", [["all", "Alle"], ["open", "Offen"], ["overdue", "Überfällig"], ["done", "Erledigt"]], V.taskStatus)}${sel(
      "taskPrio",
      "Priorität",
      [["all", "Alle"], ["high", "Hoch"], ["medium", "Mittel"], ["normal", "Normal"]],
      V.taskPrio,
    )}${sel("taskSort", "Sortierung", [["due", "Fälligkeit"], ["priority", "Priorität"], ["status", "Status"], ["outlet", "Outlet"]], V.taskSort)}${
      V.taskOutlet === "all"
        ? `<label class="v11-check"><input type="checkbox" data-v11-task-group ${V.taskGroup ? "checked" : ""}> Nach Outlet gruppieren</label>`
        : ""
    }</div>${body}</section><section class="panel">${panelHeader("Neue Aufgabe")}${
      edit
        ? `<form id="v11-task-form" class="v11-form"><div class="field"><label for="v11-t-title">Beschreibung</label><input id="v11-t-title" name="title" placeholder="Welche Maßnahme steht an?" maxlength="250" required></div><div class="field"><label for="v11-t-outlet">Outlet</label><select id="v11-t-outlet" name="outlet_id" required>${G.ui.selectOptions(outletChoices(), preset)}</select></div><div class="form-grid"><div class="field"><label for="v11-t-prio">Priorität</label><select id="v11-t-prio" name="priority"><option value="normal">Normal</option><option value="medium">Mittel</option><option value="high">Hoch</option></select></div><div class="field"><label for="v11-t-due">Fälligkeit</label><input id="v11-t-due" name="due_on" type="date"></div></div><button class="btn btn-primary" type="submit">Aufgabe erstellen</button></form><p class="calc-note">Aufgaben ohne Outlet aus früheren Versionen stehen unter „${T.GENERAL_LABEL}“. Über „Outlet“ an der Aufgabe lassen sie sich gezielt zuordnen.</p>`
        : `<p class="calc-note">Deine Rolle darf Aufgaben nur lesen.</p>`
    }</section></div>`
  );
}
/** outlet: null for general, else an outlet id of this workspace (checked by resolveOutletChoice; SQL 007 checks again). */
function addTask(title, priority = "normal", due_on = null, outlet = null) {
  (S().tasks ||= []).push({
    id: G.uid(),
    title: title.slice(0, 250),
    priority,
    status: "open",
    due_on,
    outlet_id: outlet,
    version: 1,
    created_at: new Date().toISOString(),
  });
  G.markEdited();
  G.persist();
}
function taskOutletModal(id) {
  const t = (S().tasks || []).find((x) => x.id === id);
  if (!t) throw Error("Aufgabe nicht gefunden – wurde sie inzwischen gelöscht?");
  const current = T.taskOutlet(t);
  const options = outletChoices();
  if (current !== null && !outlets().some((o) => o.id === current)) options.push([current, "Outlet nicht mehr vorhanden (unverändert lassen)"]);
  document.querySelector("#modal-layer").innerHTML =
    `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="v11-to-title"><div class="modal-header"><h2 id="v11-to-title">Outlet zuordnen</h2><button type="button" class="close-btn" data-v11="close" aria-label="Fenster schließen">×</button></div><form id="v11-task-outlet-form"><input type="hidden" name="id" value="${esc(t.id)}"><input type="hidden" name="version" value="${esc(t.version || 1)}"><p><b>${esc(t.title)}</b></p><div class="field"><label for="v11-to-outlet">Outlet</label><select id="v11-to-outlet" name="outlet_id">${G.ui.selectOptions(options, current ?? T.GENERAL)}</select></div><div class="modal-footer"><button type="button" class="btn" data-v11="close">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div></form></div>`;
  document.querySelector("#v11-to-outlet")?.focus();
}

// ---------- Tagesfunnel ----------
function funnelData() {
  const lines = applyStageMappings(posLines(), intel().tags);
  const targets = Object.fromEntries(intel().targets.map((t) => [t.stage, t.target_ratio]));
  return { lines, stats: aggregateFunnel(lines, { outlet: V.outlet, date: V.funnelDate, targets }) };
}
function funnelView() {
  const { lines, stats: s } = funnelData();
  const dates = [...new Set(lines.map((x) => String(x.service_date).slice(0, 10)))].sort().reverse();
  const range = dates.length ? `${dateDE(dates.at(-1))} bis ${dateDE(dates[0])}` : "keine Tage";
  const potential = s.stages
    .filter((x) => x.extraChecks > 0)
    .sort((a, b) => (b.dbPotential ?? b.revenuePotential ?? 0) - (a.dbPotential ?? a.revenuePotential ?? 0));
  const pending = lines.filter((l) => l.review_status === "pending");
  const guestText = {
    none: "Keine Bons in der Auswahl",
    complete: "Laut Kasse, je Bon einmal gezählt",
    partial: "Nicht für alle Bons geliefert",
    conflict: `${s.guestConflicts} Bons mit widersprüchlichen Angaben`,
  }[s.guestStatus];
  return (
    pageHeader(
      "TAGESFUNNEL · KASSENBONS",
      "Tagesfunnel (Kassenbons)",
      "Kaufquote je Bon aus einzelnen Kassenpositionen. Ergänzt den Service Funnel (Erfassung je Gast), ersetzt ihn nicht.",
      `<button type="button" class="btn" data-view="funnel">Service Funnel öffnen</button>`,
    ) +
    demoNotice() +
    needCloudData() +
    `<div class="notice">${I("info")}<span><b>Datenbasis:</b> ${lines.length} Kassenpositionen (${isCloud() ? `Cloud, ab ${dateDE(CLOUD.since)} geladen – ältere Tage nur über „Längeren Zeitraum auswerten“` : "in diesem Browser"}), Zeitraum ${esc(range)}. Kaufquote = Bons mit mindestens einem Artikel des Themas ÷ alle Bons. Monatsverkäufe enthalten keine Bons und fließen hier nicht ein; Kassenumsätze werden nicht zum Monatsumsatz addiert.${CLOUD.truncated ? " <b>Mehr als 50.000 Positionen: nicht alle geladen.</b>" : ""}</span></div>` +
    `<div class="v11-filters"><label class="field"><span>Outlet</span><select data-v11-filter="outlet">${G.ui.selectOptions([["all", "Alle Outlets"], ...outlets().map((o) => [o.id, o.name])], V.outlet)}</select></label><label class="field"><span>Tag</span><select data-v11-filter="funnelDate">${G.ui.selectOptions([["all", "Alle Tage"], ...dates.map((d) => [d, dateDE(d)])], V.funnelDate)}</select></label></div>` +
    (s.empty
      ? `<section class="panel">${G.ui.empty("Keine Kassenbons in dieser Auswahl", lines.length ? "Anderen Tag oder anderes Outlet wählen." : "Tages-POS-CSV unten importieren. Ohne Bons gibt es keine Quote – das ist keine Null.")}</section>`
      : `<section class="v6-kpis">${kpi("Bons", String(s.checkCount), "Eindeutige Belege")}${kpi("Gäste", s.covers === null ? "unbekannt" : String(s.covers), guestText)}${kpi("Bruttoverkauf", money(s.gross), "Nur Tagesdaten, Stornos verrechnet")}${kpi("Deckungsbeitrag I", s.margin === null ? "unvollständig" : money(s.margin), s.costMissing ? `Wareneinsatz fehlt bei ${pl(s.costMissing, "Position", "Positionen")}` : "Netto minus direkte Kosten", "mint")}</section>` +
        `<section class="panel">${panelHeader("Kaufquote je Bon und Thema", "Sechs unabhängige Themen; ein Bon kann mehrere enthalten")}<div class="v11-funnel">${s.stages
          .map(
            (x) =>
              `<div class="v11-funnel-line"><div class="v11-funnel-head"><b>${esc(x.name)}</b><span>${x.rate === null ? "—" : percent(x.rate * 100)} <small>Ziel ${percent(x.target * 100)} · ${x.rate === null ? "keine Bons" : x.rate >= x.target ? "erreicht" : "unter Ziel"}</small></span></div><div class="v11-meter" role="img" aria-label="${esc(x.name)}: ${x.rate === null ? "keine Daten" : percent(x.rate * 100)} von Ziel ${percent(x.target * 100)}"><div style="width:${Math.min(100, (x.rate ?? 0) * 100)}%"></div><i style="left:${x.target * 100}%"></i></div><small>${pl(x.checks, "Bon", "Bons")} · ${pl(x.units, "Einheit", "Einheiten")} · ${money(x.gross)} brutto${!x.costsOk && x.units ? " · Wareneinsatz unvollständig" : ""}</small></div>`,
          )
          .join(
            "",
          )}</div><p class="calc-note">Die Kaufquote je Bon ist nicht „Verkäufe je Gast“ (Service Funnel) und keine Angebotsquote: Ob der Service etwas angeboten hat, steht nicht im Kassenbon.</p></section>`) +
    (pending.length
      ? `<section class="panel" style="margin-top:18px">${panelHeader("Zur Prüfung: mögliche Überschneidungen", `${pending.length} Positionen zählen bis zur Entscheidung nicht`)}<p class="calc-note">Gleicher Bon, Artikel, Menge und Preis kamen bereits aus einer anderen Datei oder Quelle. Gleiche Beträge allein beweisen kein Duplikat.</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Tag</th><th>Bon</th><th>Artikel</th><th class="align-right">Menge</th><th>Quelle</th></tr></thead><tbody>${pending
          .slice(0, 50)
          .map(
            (l) =>
              `<tr><td>${esc(dateDE(l.service_date))}</td><td>${esc(l.check_id)}</td><td>${esc(l.product_name)}</td><td class="align-right">${esc(l.quantity)}</td><td>${esc(l.file_name)}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div><div class="actions"><button type="button" class="btn btn-primary" data-v11="review-accept">Als eigene Verkäufe übernehmen</button><button type="button" class="btn" data-v11="review-reject">Als Duplikate verwerfen</button></div></section>`
      : "") +
    `<div class="content-grid" style="margin-top:18px"><section class="panel">${panelHeader("Schulung nach Potenzial", "Simulation – keine Prognose")}${
      potential.length
        ? potential
            .map(
              (x) =>
                `<div class="v11-lesson"><b>${esc(x.name)} · ${pl(x.extraChecks, "zusätzlicher Bon", "zusätzliche Bons")}</b><p>Bei Zielquote ${percent(x.target * 100)}: ${x.revenuePotential === null ? "Umsatz nicht ermittelbar" : money(x.revenuePotential) + " zusätzlicher Nettoumsatz"}; ${x.dbPotential === null ? "DB mangels Wareneinsatz nicht berechenbar" : money(x.dbPotential) + " zusätzlicher DB I"}. Annahme: 1 zusätzlicher Artikel je gewonnenem Bon, beobachteter Durchschnittspreis. Keine Fixkosten, keine Kausalität.</p><div class="actions"><button type="button" class="btn btn-small" data-v11="start-training" data-stage="${esc(x.id)}">Training starten</button>${canUpdateTasks() ? `<button type="button" class="btn btn-small" data-v11="training-task" data-stage="${esc(x.id)}">Schulung als Aufgabe anlegen</button>` : ""}</div></div>`,
            )
            .join("")
        : G.ui.empty("Kein Potenzial gegenüber den Zielquoten", "Entweder sind die Ziele erreicht oder es fehlen Bons.")
    }</section><section class="panel">${panelHeader("Kassenbons importieren", "CSV mit einer Zeile je Position")}<p class="calc-note">Pflicht: <code>Datum;BonID;Outlet;Produkt;Menge;Bruttopreis</code>. Optional: Gaeste, Mitarbeiter, FunnelStufe, USt, WareneinsatzNetto, <b>PositionID</b> (stabile Positionsnummer der Kasse), <b>Typ</b> (Verkauf, Storno, Korrektur) mit <b>BezugsPosition</b>. Artikel ohne USt-Spalte müssen im Artikelstamm stehen.</p><div class="field"><label for="v11-pos-file">Datei auswählen</label><input type="file" id="v11-pos-file" accept=".csv,text/csv"></div><div class="actions"><button type="button" class="btn btn-primary" data-v11="preview-pos">CSV prüfen</button><button type="button" class="btn" data-v11="pos-template">${I("download")} Vorlage</button></div>${V.posPreview ? posPreview(V.posPreview) : ""}</section></div>` +
    `<div class="content-grid" style="margin-top:18px"><section class="panel">${panelHeader("Tag für Tag")}${
      s.days.length
        ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Tag</th><th class="align-right">Bons</th><th class="align-right">Brutto</th><th class="align-right">Netto</th></tr></thead><tbody>${s.days.map((x) => `<tr><td>${esc(dateDE(x.date))}</td><td class="align-right">${x.checks}</td><td class="align-right">${money(x.gross)}</td><td class="align-right">${money(x.net)}</td></tr>`).join("")}</tbody></table></div>`
        : G.ui.empty("Noch keine Tagesdaten", "")
    }${isCloud() ? `<form id="v11-summary-form" class="v11-form"><h3>Längeren Zeitraum auswerten</h3><p class="calc-note">Der Server zählt Bons und Themen; einzelne Positionen werden dafür nicht in den Browser geladen.</p><div class="form-grid"><div class="field"><label for="v11-sum-from">Von</label><input id="v11-sum-from" name="from" type="date" required></div><div class="field"><label for="v11-sum-to">Bis</label><input id="v11-sum-to" name="to" type="date" required></div></div><button class="btn" type="submit">Auswerten</button></form>${V.summary ? summaryTable(V.summary) : ""}` : ""}</section>` +
    `<section class="panel">${panelHeader("Ziele und Zuordnung")}<form id="v11-target-form" class="v11-form"><div class="form-grid"><div class="field"><label for="v11-tg-stage">Thema</label><select id="v11-tg-stage" name="stage">${STAGES.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div><div class="field"><label for="v11-tg-target">Zielquote in %</label><input id="v11-tg-target" name="target" type="number" step="1" min="0" max="100" value="30" required></div></div><button class="btn btn-primary" type="submit">Zielwert setzen</button></form><hr class="split-divider"><form id="v11-tag-form" class="v11-form"><div class="field"><label for="v11-tag-name">Artikelname wie in der Kasse</label><input id="v11-tag-name" name="product_name" maxlength="200" required list="v11-known-products"></div><datalist id="v11-known-products">${[...new Set(lines.map((x) => x.product_name))].map((x) => `<option value="${esc(x)}"></option>`).join("")}</datalist><div class="field"><label for="v11-tag-stage">Thema</label><select id="v11-tag-stage" name="stage"><option value="none">Ohne Thema</option>${STAGES.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div><button class="btn" type="submit">Artikel dauerhaft zuordnen</button></form><p class="calc-note">${s.unclassified} Positionen ohne Thema. Zuordnungen wirken rückwirkend auf alle Positionen ohne Thema, unabhängig von Groß-/Kleinschreibung. Eine in der Datei angegebene FunnelStufe hat Vorrang.</p></section></div>`
  );
}
function summaryTable(sum) {
  const st = sum.stages || {};
  return `<div class="table-scroll" style="margin-top:10px"><table class="data-table"><caption class="calc-note">${esc(dateDE(sum.from))} bis ${esc(dateDE(sum.to))}: ${sum.checks} Bons, ${sum.lines} Positionen, Gäste ${sum.guests_complete ? sum.covers : "unvollständig"}</caption><thead><tr><th>Thema</th><th class="align-right">Bons</th><th class="align-right">Kaufquote</th></tr></thead><tbody>${STAGES.map((x) => `<tr><td>${esc(x.name)}</td><td class="align-right">${st[x.id] ?? 0}</td><td class="align-right">${sum.checks ? percent(((st[x.id] ?? 0) / sum.checks) * 100) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}
function posPreview(p) {
  return `<div class="v11-preview" role="status"><p class="notice">${I("info")}<span>${p.valid.length} gültige Positionen · ${p.errors.length} Fehler · ${p.warnings.length} Hinweise · ${p.overlap.fresh.length} neu · ${p.overlap.duplicates.length} sicher doppelt (werden übersprungen) · ${p.overlap.review.length} mögliche Überschneidungen</span></p>${
    p.errors.length
      ? `<div class="v11-errors"><ul>${p.errors
          .slice(0, 8)
          .map((e) => `<li>${esc(e)}</li>`)
          .join("")}</ul></div>`
      : ""
  }${
    p.warnings.length
      ? `<details><summary>${p.warnings.length} Hinweise</summary><ul>${p.warnings
          .slice(0, 20)
          .map((e) => `<li>${esc(e)}</li>`)
          .join("")}</ul></details>`
      : ""
  }${
    p.overlap.review.length
      ? `<fieldset class="v11-choice"><legend>Mögliche Überschneidungen (${p.overlap.review.length})</legend><label><input type="radio" name="v11-overlap" value="review" checked> Zur Prüfung zurückstellen (zählen bis zur Entscheidung nicht)</label><label><input type="radio" name="v11-overlap" value="skip"> Nicht übernehmen</label><label><input type="radio" name="v11-overlap" value="accept"> Trotzdem übernehmen</label></fieldset>`
      : ""
  }<div class="actions"><button type="button" class="btn btn-primary" data-v11="commit-pos" ${p.errors.length || !p.valid.length ? "disabled" : ""}>Import bestätigen</button><button type="button" class="btn" data-v11="clear-pos">Abbrechen</button></div></div>`;
}
async function previewPos() {
  const f = document.querySelector("#v11-pos-file")?.files?.[0];
  if (!f) throw Error("CSV-Datei fehlt.");
  if (f.size > 5_000_000) throw Error("Datei über 5 MB. Bitte in Tagesdateien aufteilen.");
  const text = await f.text(),
    hash = await sha256(text);
  const r = readPosImport(text, hash, f.name, products(), outlets(), intel().tags);
  r.overlap = findPosOverlaps(r.valid, posLines());
  V.posPreview = r;
  G.render();
  G.toast(`${r.valid.length} Kassenpositionen geprüft.`, r.errors.length ? "error" : undefined);
}
async function commitPos() {
  const p = V.posPreview;
  if (!p || p.errors.length || !p.valid.length) throw Error("Es liegt keine fehlerfreie Importvorschau vor.");
  const decision = document.querySelector('input[name="v11-overlap"]:checked')?.value || "review";
  if (isCloud()) {
    const r = await cloud.insertPos(p.valid, decision);
    await loadCloudData();
    V.posPreview = null;
    G.render();
    G.toast(
      `${r.inserted} neue Positionen gespeichert, ${r.duplicates} Duplikate übersprungen${r.review ? `, ${r.review} zur Prüfung` : ""}.`,
    );
    return;
  }
  const add = [...p.overlap.fresh];
  if (decision === "accept") add.push(...p.overlap.review.map((x) => x.line));
  if (decision === "review") add.push(...p.overlap.review.map((x) => ({ ...x.line, review_status: "pending" })));
  intel().pos.push(...add.map((x) => ({ ...x, id: G.uid() })));
  V.posPreview = null;
  G.markEdited();
  G.persist();
  G.render();
  G.toast(`${add.length} neue Kassenpositionen gespeichert, ${p.overlap.duplicates.length} Duplikate übersprungen.`);
}
async function decide(accept) {
  const pending = posLines().filter((l) => l.review_status === "pending");
  if (!pending.length) return;
  if (isCloud()) {
    await cloud.decideReview(
      pending.map((x) => x.id),
      accept ? "accept" : "reject",
    );
    await loadCloudData();
  } else {
    if (accept) for (const l of pending) delete l.review_status;
    else intel().pos = intel().pos.filter((l) => l.review_status !== "pending");
    G.markEdited();
    G.persist();
  }
  G.render();
  G.toast(accept ? `${pending.length} Positionen übernommen.` : `${pending.length} Positionen verworfen.`);
}

// ---------- Funnel Quest ----------
const level = (p) => (p >= 500 ? "Profi" : p >= 300 ? "Fortgeschritten" : p >= 100 ? "Einsteiger" : "Start");
function trainingView() {
  const chosen = STAGES.find((x) => x.id === V.trainingStage) || STAGES[0];
  const records = trainingRows();
  const points = records.reduce((a, r) => a + Number(r.points || 0), 0);
  const done = new Set(records.map((r) => r.stage)),
    solved = new Set(records.filter((r) => r.correct).map((r) => r.stage));
  const already = records.some((r) => r.stage === chosen.id && berlinDay(r.created_at) === berlinDay());
  const ordered = finance()
    ? funnelData()
        .stats.stages.filter((x) => x.extraChecks > 0)
        .sort((a, b) => (b.dbPotential ?? b.revenuePotential ?? 0) - (a.dbPotential ?? a.revenuePotential ?? 0))
    : [];
  const fb = V.quizFeedback;
  return (
    pageHeader(
      "FUNNEL QUEST",
      "Funnel Quest – Training",
      "Kurze Verkaufstrainings mit Frage, Rückmeldung und Punkten. Nur für dich sichtbar, kein Ranking, keine Bewertung.",
    ) +
    needCloudData() +
    `<section class="v6-kpis">${kpi("Deine Punkte", points + " XP", "Nur eigene Trainings")}${kpi("Missionen", `${done.size} / ${STAGES.length}`, `${solved.size} richtig gelöst`)}${kpi("Stufe", level(points), "Lernanreiz, keine Leistungsbewertung")}${kpi("Themen", String(STAGES.length), "Für kurze Teambriefings")}</section>` +
    `<div class="content-grid"><section class="panel">${panelHeader("Mission wählen", "100 XP je richtige Antwort, ein gespeicherter Versuch je Thema und Tag")}<div class="v11-missions">${STAGES.map(
      (x) =>
        `<button type="button" class="v11-mission ${x.id === chosen.id ? "selected" : ""}" data-v11="choose-mission" data-stage="${x.id}" aria-pressed="${x.id === chosen.id}"><b>${esc(x.name)}</b><span>${esc(x.lesson)}</span>${solved.has(x.id) ? tag("Richtig gelöst", "neutral") : done.has(x.id) ? tag("Versucht", "orange") : tag("Offen", "blue")}</button>`,
    ).join("")}</div>${
      ordered.length
        ? `<p class="calc-note"><b>Priorität aus den Kassenbons:</b> ${ordered
            .slice(0, 3)
            .map((x) => `${esc(x.name)}: ${x.dbPotential === null ? "DB unbekannt" : esc(money(x.dbPotential)) + " DB-I-Szenario"}`)
            .join(" · ")}</p>`
        : ""
    }</section>` +
    `<section class="panel">${panelHeader(`Mission: ${chosen.name}`, `Thema ${STAGES.indexOf(chosen) + 1} von 6`)}<p class="v11-tip"><b>Lernhinweis:</b> ${esc(chosen.tip)}</p><form id="v11-quiz-form"><fieldset class="v11-choice"><legend>${esc(chosen.question)}</legend><input type="hidden" name="stage" value="${chosen.id}">${chosen.options.map((o, i) => `<label><input type="radio" name="answer" value="${i}" required> ${esc(o)}</label>`).join("")}</fieldset><button class="btn btn-primary" type="submit" ${already ? "disabled" : ""}>${already ? "Heute bereits beantwortet" : "Antwort prüfen (+100 XP möglich)"}</button></form>${fb ? `<div class="notice ${fb.correct ? "" : "warn"}" role="status" style="margin-top:14px">${I(fb.correct ? "check" : "info")}<span>${esc(fb.message)}</span></div>` : ""}<p class="calc-note">Punkte sind ein Lernanreiz. Sie fließen in keine Personalentscheidung ein.${isCloud() ? " Die Antwort wird auf dem Server geprüft." : " Demo: Ergebnisse bleiben in diesem Browser."}</p></section></div>`
  );
}
async function submitQuiz(obj) {
  const stage = obj.stage;
  if (!STAGE_IDS.has(stage)) throw Error("Ungültige Mission.");
  if (obj.answer === undefined || obj.answer === "") throw Error("Bitte eine Antwort wählen.");
  if (trainingRows().some((r) => r.stage === stage && berlinDay(r.created_at) === berlinDay()))
    throw Error("Diese Mission hast du heute schon beantwortet.");
  let result;
  if (isCloud()) {
    result = await cloud.submitTraining(stage, obj.answer);
    CLOUD.training = await cloud.loadTraining();
  } else {
    result = scoreQuiz(stage, obj.answer);
    intel().training.push({ id: G.uid(), stage, correct: result.correct, points: result.points, created_at: new Date().toISOString() });
    G.persist();
  }
  V.quizFeedback = {
    correct: result.correct,
    message: result.correct ? `Richtig! +${result.points} XP. ${result.tip}` : `Nicht ganz. ${result.tip}`,
  };
  G.render();
}

// ---------- KI-Marktcheck ----------
function marketView() {
  const rows = compareMarket(intel().markets, products());
  const names = new Set(rows.map((x) => x.competitor_name));
  const d = V.discover;
  return (
    pageHeader(
      "KI-MARKTCHECK",
      "KI-Marktcheck",
      "Wettbewerber finden, belegte Preise vergleichen, optional von einer KI einordnen lassen. Mein Markt (Umkreis 20 km) bleibt daneben bestehen.",
      `<button type="button" class="btn" data-view="market">Mein Markt öffnen</button>`,
    ) +
    demoNotice() +
    `<section class="v6-kpis">${kpi("Beobachtungen", String(rows.length), "Mit Quelle und Prüfdatum")}${kpi("Betriebe", String(names.size), "Wettbewerbsumfeld")}${kpi("Quellen", String(new Set(rows.map((x) => x.source_url)).size), "Von dir eingetragen, nicht geprüft")}${kpi("KI-Auswertung", isCloud() ? "Auf Anfrage" : "Nur mit Cloud", "Server mit eigenem API-Schlüssel")}</section>` +
    `<div class="content-grid"><section class="panel">${panelHeader("Marktpreis mit Quelle erfassen", "Keine Schätzpreise")}<form id="v11-market-form" class="v11-form"><div class="form-grid"><div class="field"><label for="v11-m-comp">Wettbewerber</label><input id="v11-m-comp" name="competitor_name" maxlength="160" required placeholder="Restaurant XY"></div><div class="field"><label for="v11-m-own">Eigenes Produkt</label><input id="v11-m-own" name="own_product" maxlength="200" required placeholder="z. B. Classic Cheeseburger" list="v11-own-products"></div></div><datalist id="v11-own-products">${products()
      .map((p) => `<option value="${esc(p.name)}"></option>`)
      .join(
        "",
      )}</datalist><div class="field"><label for="v11-m-cprod">Vergleichbares Konkurrenzprodukt</label><input id="v11-m-cprod" name="competitor_product" maxlength="200" required></div><div class="form-grid"><div class="field"><label for="v11-m-cprice">Konkurrenzpreis brutto (€)</label><input id="v11-m-cprice" type="number" name="competitor_price_gross" min="0.01" step="0.01" required></div><div class="field"><label for="v11-m-oprice">Unser Bruttopreis (€)</label><input id="v11-m-oprice" type="number" name="our_price_gross" min="0.01" step="0.01" required></div><div class="field"><label for="v11-m-url">Quelle (https-Link)</label><input id="v11-m-url" name="source_url" type="url" placeholder="https://…" required></div><div class="field"><label for="v11-m-date">Prüfdatum</label><input id="v11-m-date" name="checked_on" type="date" max="${today()}" required></div></div><div class="field"><label for="v11-m-note">Vergleich / Besonderheiten</label><input id="v11-m-note" name="note" maxlength="1000" placeholder="Grammatur, Beilage, Qualität, Aktion …"></div><button class="btn btn-primary" type="submit">Beobachtung speichern</button></form></section>` +
    `<section class="panel">${panelHeader("Umfeld entdecken", "OpenStreetMap, ohne Speisekartenpreise")}<form id="v11-discover-form" class="v11-form"><div class="form-grid"><div class="field"><label for="v11-d-lat">Breitengrad</label><input id="v11-d-lat" name="lat" type="number" step="0.00001" min="-90" max="90" placeholder="50,80" required value="${esc(S().marketLocation?.lat ?? "")}"></div><div class="field"><label for="v11-d-lon">Längengrad</label><input id="v11-d-lon" name="lon" type="number" step="0.00001" min="-180" max="180" placeholder="6,48" required value="${esc(S().marketLocation?.lon ?? "")}"></div><div class="field"><label for="v11-d-radius">Umkreis</label><select id="v11-d-radius" name="radius"><option value="1000">1 km</option><option value="2000" selected>2 km</option><option value="5000">5 km</option></select></div></div><button class="btn" type="submit">Gastronomie suchen</button></form><p class="calc-note">Liefert Namen, Küche und Adresse aus OpenStreetMap. ${isCloud() ? "Die Suche läuft über den Server dieser Website." : "Demo: Die Suche geht direkt vom Browser an OpenStreetMap."}</p><div id="v11-discover-status" aria-live="polite">${d?.error ? `<p class="notice warn">${I("info")}<span>${esc(d.error)}</span></p>` : ""}</div>${
      d?.places
        ? `<div class="v11-list">${d.places.map((x) => `<div><span><b>${esc(x.name)}</b><small>${esc([x.cuisine, x.address].filter(Boolean).join(" · ") || "Gastronomie")}</small></span><a href="${esc(x.source_url)}" target="_blank" rel="noopener noreferrer">OSM-Eintrag ↗</a></div>`).join("") || "<p>Keine Einträge im Umkreis.</p>"}</div>`
        : ""
    }</section></div>` +
    `<section class="panel" style="margin-top:18px">${panelHeader("Preisvergleich", "", tag("Ungeprüfte Eingaben", "orange"))}<div class="table-scroll"><table class="data-table"><thead><tr><th>Betrieb</th><th>Vergleich</th><th class="align-right">Konkurrenz</th><th class="align-right">Wir</th><th class="align-right">Abweichung</th><th>Beleg</th></tr></thead><tbody>${
      rows
        .map(
          (x) =>
            `<tr><td><b>${esc(x.competitor_name)}</b></td><td>${esc(x.own_name)} / ${esc(x.competitor_product)}${x.note ? `<div class="micro">${esc(x.note)}</div>` : ""}</td><td class="align-right">${money(x.competitor_price_gross)}</td><td class="align-right">${money(x.our_price_gross)}</td><td class="align-right">${x.delta === null ? "—" : (x.delta > 0 ? "+" : "") + percent(x.delta)}</td><td><a href="${esc(x.source_url)}" target="_blank" rel="noopener noreferrer">${esc(dateDE(x.checked_on))} ↗</a></td></tr>`,
        )
        .join("") || `<tr><td colspan="6">Noch keine dokumentierten Marktpreise.</td></tr>`
    }</tbody></table></div><div class="actions" style="margin-top:14px"><button type="button" class="btn btn-primary" data-v11="market-ai" ${!isCloud() || !rows.length ? "disabled" : ""}>KI-Einordnung erstellen</button>${!isCloud() ? `<span class="calc-note">Nur mit angemeldetem Cloud-Arbeitsbereich und eingerichtetem Server-Schlüssel.</span>` : ""}</div><p class="calc-note">Die KI erhält nur diese Vergleichswerte und Links; sie öffnet die Links nicht und prüft keine Quellen. Ohne eingerichteten Schlüssel gibt es keine Auswertung – dann steht hier eine Fehlermeldung, kein Ergebnis.</p>${
      V.ai
        ? `<div class="v11-ai" role="region" aria-label="KI-Einordnung"><b>KI-Einordnung – vor Preisänderungen selbst prüfen</b>${V.aiMeta ? `<small>${esc(V.aiMeta)}</small>` : ""}<div>${esc(V.ai)}</div></div>`
        : ""
    }</section>`
  );
}
async function discover(obj) {
  const lat = numberInput(obj.lat),
    lon = numberInput(obj.lon),
    radius = Number(obj.radius);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180)
    throw Error("Gültige Koordinaten erforderlich.");
  if (![1000, 2000, 5000].includes(radius)) throw Error("Umkreis 1, 2 oder 5 km.");
  V.discover = { loading: true };
  const status = document.querySelector("#v11-discover-status");
  if (status) status.textContent = "Suche läuft …";
  try {
    const r = isCloud()
      ? await cloud.protectedApi("/api/suite/market/discover", { lat, lon, radius })
      : await discoverDirect(lat, lon, radius);
    V.discover = { places: r.places || [] };
    G.toast(`${V.discover.places.length} Betriebe gefunden (ohne Speisekartenpreise).`);
  } catch (e) {
    V.discover = { error: `Umfeldsuche nicht verfügbar: ${e.message}` };
  }
  G.render();
}
async function discoverDirect(lat, lon, radius) {
  const q = `[out:json][timeout:20];(nwr["amenity"~"^(restaurant|cafe|bar)$"](around:${radius},${lat},${lon}););out center 60;`;
  let r;
  try {
    r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: new URLSearchParams({ data: q }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    throw new Error(
      e?.name === "TimeoutError" ? "OpenStreetMap hat nicht innerhalb von 25 Sekunden geantwortet." : "Keine Verbindung zu OpenStreetMap.",
    );
  }
  if (!r.ok) throw new Error(r.status === 429 ? "OpenStreetMap ist gerade überlastet." : `OpenStreetMap meldet HTTP ${r.status}.`);
  const obj = await r.json();
  return {
    places: (obj.elements || [])
      .filter((e) => e.tags?.name)
      .slice(0, 25)
      .map((e) => ({
        name: e.tags.name,
        cuisine: e.tags.cuisine || null,
        source_url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
        address: [e.tags["addr:street"], e.tags["addr:housenumber"], e.tags["addr:city"]].filter(Boolean).join(" "),
      })),
  };
}
async function marketAI() {
  if (!isCloud()) throw Error("Die KI-Einordnung braucht die Anmeldung in der Cloud.");
  if (!intel().markets.length) throw Error("Erst Vergleichspreise mit Quellen hinterlegen.");
  const r = await cloud.protectedApi("/api/suite/market/analyze", { observations: intel().markets.slice(0, 25) });
  if (!r.answer) throw Error("Die KI hat keine Antwort geliefert.");
  V.ai = r.answer;
  V.aiMeta = `${r.source_count} Beobachtungen · Modell ${r.model} · ${r.disclaimer}`;
  G.render();
}
function saveMarket(obj) {
  if (!finance()) throw Error("Keine Berechtigung für Marktdaten.");
  const price = numberInput(obj.competitor_price_gross),
    ours = numberInput(obj.our_price_gross);
  let url;
  try {
    url = new URL(obj.source_url);
  } catch {
    throw Error("Ungültiger Quell-Link.");
  }
  if (url.protocol !== "https:" || !(price > 0 && ours > 0)) throw Error("Nur https-Quellen und positive Preise.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.checked_on) || obj.checked_on > today()) throw Error("Ungültiges Prüfdatum.");
  const rec = {
    id: G.uid(),
    competitor_name: obj.competitor_name.trim(),
    own_product: obj.own_product.trim(),
    competitor_product: obj.competitor_product.trim(),
    competitor_price_gross: price,
    our_price_gross: ours,
    source_url: url.href,
    checked_on: obj.checked_on,
    note: (obj.note || "").trim(),
    created_at: new Date().toISOString(),
  };
  if (!rec.competitor_name || !rec.own_product || !rec.competitor_product) throw Error("Pflichtangaben fehlen.");
  intel().markets.push(rec);
  G.markEdited();
  G.persist();
  G.render();
  G.toast("Beobachtung mit Quelle gespeichert.");
}

// ---------- Strukturcheck (read-only bridge) ----------
function legacyView() {
  const l = V.legacy;
  return (
    pageHeader(
      "STRUKTURCHECK",
      "Arbeitsbereich-Strukturcheck",
      "Nur lesen: welche Datenbereiche der Arbeitsbereich enthält und wie viele Einträge. Alle Module der bisherigen Suite sind in dieser Anwendung enthalten.",
    ) +
    `<section class="panel">${panelHeader("Datenbereiche", isCloud() ? "Aus der Cloud (rollengefiltert)" : "Aus diesem Browser")}<button type="button" class="btn btn-primary" data-v11="load-legacy">Struktur einlesen (nur lesen)</button>${
      l
        ? `<div class="table-scroll" style="margin-top:12px"><table class="data-table"><thead><tr><th>Bereich</th><th class="align-right">Einträge</th></tr></thead><tbody>${Object.entries(
            l,
          )
            .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="align-right">${esc(v)}</td></tr>`)
            .join("")}</tbody></table></div>`
        : ""
    }<hr class="split-divider"><form id="v11-legacy-form" class="v11-form"><div class="field"><label for="v11-legacy-url">Adresse einer weiteren, separat betriebenen Installation (optional)</label><input id="v11-legacy-url" type="url" name="legacy_url" placeholder="https://…" value="${esc(V.legacyUrl)}"></div><button class="btn" type="submit">Link speichern</button></form>${V.legacyUrl ? `<p><a href="${esc(V.legacyUrl)}" target="_blank" rel="noopener noreferrer">Andere Installation öffnen ↗</a></p>` : ""}</section>`
  );
}
async function loadLegacy() {
  const data = isCloud() ? (await cloud.readWorkspaceStructure()).data : S();
  V.legacy = Object.fromEntries(
    Object.entries(data || {})
      .filter(([k]) => k !== "intelligence")
      .map(([k, v]) => [k, Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length + " Felder" : typeof v]),
  );
  if (!isCloud() && S().intelligence)
    for (const [k, v] of Object.entries(S().intelligence)) if (Array.isArray(v)) V.legacy["intelligence." + k] = v.length;
  G.render();
  G.toast("Struktur gelesen. Nichts wurde verändert.");
}

// ---------- cloud data, ensure, registration ----------
async function loadCloudData() {
  CLOUD.loaded = false;
  CLOUD.error = "";
  try {
    if (finance()) {
      const r = await cloud.loadPos();
      Object.assign(CLOUD, { pos: r.rows, since: r.since, truncated: r.truncated });
    } else CLOUD.pos = [];
    CLOUD.training = role() === "viewer" ? [] : await cloud.loadTraining();
  } catch (e) {
    CLOUD.error = e.message;
    G.toast(e.message, "error");
  }
  CLOUD.loaded = true;
  G.render();
}
window.addEventListener("glb:cloud-open", () => {
  Object.assign(V, {
    preview: null,
    posPreview: null,
    ai: null,
    discover: null,
    legacy: null,
    summary: null,
    quizFeedback: null,
    outlet: "all",
    month: "all",
    funnelDate: "all",
  });
  void loadCloudData();
});
window.addEventListener("glb:cloud-close", () => {
  Object.assign(CLOUD, { pos: [], training: [], since: "", truncated: false, loaded: false });
  Object.assign(V, { preview: null, posPreview: null, ai: null, discover: null, legacy: null, summary: null, quizFeedback: null });
});
G.registerEnsure((data) => {
  // cloud: POS lines and training never live in the shared workspace document
  initializeIntelligence(data, window.GLB_CLOUD_ENABLED ? "cloud" : data.mode === "own" ? "own" : "demo");
  if (window.GLB_CLOUD_ENABLED) {
    data.intelligence.pos = [];
    data.intelligence.training = [];
  }
});
window.GLBSuite.backupExtras = () =>
  isCloud()
    ? {
        intelligenceCloud: {
          note: "Kassenbons der geladenen 90 Tage und eigene Trainingsergebnisse aus den Cloud-Tabellen",
          posSince: CLOUD.since,
          pos: CLOUD.pos,
          training: CLOUD.training,
        },
      }
    : {};

const VIEWS = [
  ["v11cockpit", "Management-Cockpit", cockpit, "DEIN ARBEITSPLATZ", "◩"],
  ["v11tasks", "Team & Aufgaben", tasksView, "DEIN ARBEITSPLATZ", "☑"],
  ["v11training", "Funnel Quest", trainingView, "DEIN ARBEITSPLATZ", "★"],
  ["v11sales", "Verkauf & Monatsimport", salesView, "VERKAUF & ANALYSE", "⇪"],
  ["v11menu", "Menu Engineering", menuView, "VERKAUF & ANALYSE", "◆"],
  ["v11funnel", "Tagesfunnel (Kassenbons)", funnelView, "VERKAUF & ANALYSE", "◷"],
  ["v11market", "KI-Marktcheck", marketView, "VERKAUF & ANALYSE", "⌁"],
  ["v11stock", "Mindestbestände", stockView, "WARENWIRTSCHAFT", "▤"],
  ["v11legacy", "Strukturcheck", legacyView, "MANAGEMENT", "▧"],
];
for (const [id, label, fn] of VIEWS) G.registerView(id, label, fn);
const groups = {};
for (const [id, label, , group, icon] of VIEWS) (groups[group] ||= []).push([id, label, icon]);
for (const [group, links] of Object.entries(groups)) window.GLB08UI?.addLinks(group, links);

// ---------- events ----------
const ACTIONS = {
  "preview-sales": previewSales,
  "commit-sales": commitSales,
  "cancel-sales": () => ((V.preview = null), G.render()),
  "sales-template": () =>
    G.download(
      "﻿Produkt;Outlet;Monat;Menge;Bruttopreis\r\nClassic Cheeseburger;Restaurant;2026-10;30;17,90\r\nSignature Cocktail;Bar;2026-10;16;9,50\r\n",
      "GLB_Verkaufsimport_Muster.csv",
      "text/csv;charset=utf-8",
    ),
  "export-sales-filtered": () => exportSales(false),
  "export-sales-all": () => exportSales(true),
  backfill: (el) => backfillModal(el.dataset.id),
  close: () => G.closeModal(),
  "edit-stock": (el) => stockModal(el.dataset.id),
  "export-orders": exportOrders,
  "preview-pos": previewPos,
  "commit-pos": commitPos,
  "clear-pos": () => ((V.posPreview = null), G.render()),
  "pos-template": () =>
    G.download(
      "﻿Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;Gaeste;Mitarbeiter;FunnelStufe;USt;WareneinsatzNetto;PositionID;Typ;BezugsPosition\r\n2026-10-21;B-001;Restaurant;Classic Cheeseburger;2;17,90;2;;none;7;4,55;B-001-1;Verkauf;\r\n2026-10-21;B-001;Restaurant;Signature Cocktail;1;9,50;2;;aperitif;19;2,45;B-001-2;Verkauf;\r\n",
      "GLB_Tages_POS_Muster.csv",
      "text/csv;charset=utf-8",
    ),
  "review-accept": () => decide(true),
  "review-reject": () => decide(false),
  "start-training": (el) => {
    V.trainingStage = el.dataset.stage;
    V.quizFeedback = null;
    G.navigate("v11training");
  },
  "choose-mission": (el) => {
    V.trainingStage = el.dataset.stage;
    V.quizFeedback = null;
    G.render();
  },
  "training-task": (el) => {
    const st = STAGES.find((x) => x.id === el.dataset.stage);
    if (!st) return;
    // only an outlet chosen in the funnel filter is taken over; "Alle Outlets" gives a general task, never a guess
    const outlet = V.outlet !== "all" && outlets().some((o) => o.id === V.outlet) ? V.outlet : null;
    addTask(`Training ${st.name}: ${st.tip}`, "medium", null, outlet);
    G.render();
    G.toast(
      outlet
        ? `Schulungsaufgabe für ${T.outletLabel(outlet, outlets())} in Team & Aufgaben angelegt.`
        : `Schulungsaufgabe als „${T.GENERAL_LABEL}“ angelegt – im Funnel war kein einzelnes Outlet gewählt.`,
    );
  },
  "task-outlet": (el) => taskOutletModal(el.dataset.id),
  "task-outlet-filter": (el) => {
    V.taskOutlet = el.dataset.outlet;
    G.render();
  },
  "market-ai": marketAI,
  "load-legacy": loadLegacy,
};
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-v11]");
  if (!el || !ACTIONS[el.dataset.v11]) return;
  e.preventDefault();
  el.disabled = true;
  try {
    await ACTIONS[el.dataset.v11](el);
  } catch (err) {
    G.toast(err.message || String(err), "error");
  } finally {
    if (el.isConnected) el.disabled = false;
  }
});
document.addEventListener("change", (e) => {
  const f = e.target.dataset?.v11Filter;
  if (f) {
    V[f] = e.target.value;
    V.summary = null;
    G.render();
    return;
  }
  if (e.target.matches?.("[data-v11-task-group]")) {
    V.taskGroup = e.target.checked;
    G.render();
    return;
  }
  const t = e.target.dataset?.v11TaskToggle;
  if (t) {
    const task = (S().tasks || []).find((x) => x.id === t);
    if (!task || !canUpdateTasks()) return;
    task.status = e.target.checked ? "done" : "open";
    task.version = (task.version || 1) + 1;
    G.persist();
    G.render();
    G.toast(task.status === "done" ? "Aufgabe erledigt." : "Aufgabe wieder offen.");
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "v11-article-search") {
    V.search = e.target.value;
    const pos = e.target.selectionStart;
    G.render();
    const n = document.querySelector("#v11-article-search");
    n?.focus();
    n?.setSelectionRange(pos, pos);
  }
});
const FORMS = {
  "v11-cost-form": saveBackfill,
  "v11-stock-form": (o) => {
    if (!canUpdateInventory()) throw Error("Keine Berechtigung für Bestände.");
    const d = {
      name: o.name.trim(),
      unit: o.unit.trim(),
      stock: numberInput(o.stock),
      reorder_point: numberInput(o.reorder_point),
      par_level: numberInput(o.par_level),
      supplier: (o.supplier || "").trim(),
    };
    if (!d.name || !d.unit) throw Error("Name und Einheit fehlen.");
    if ([d.stock, d.reorder_point, d.par_level].some((x) => !Number.isFinite(x) || x < 0)) throw Error("Ungültige Bestandszahlen.");
    if (d.par_level < d.reorder_point) throw Error("Zielbestand muss mindestens so hoch wie der Mindestbestand sein.");
    (S().parStock ||= []).push({ id: G.uid(), ...d, version: 1 });
    G.markEdited();
    G.persist();
    G.render();
    G.toast("Bestandsposition gespeichert.");
  },
  "v11-stockfix-form": (o) => {
    if (!canUpdateInventory()) throw Error("Keine Berechtigung für Bestände.");
    const n = numberInput(o.stock);
    if (!Number.isFinite(n) || n < 0) throw Error("Bestand muss 0 oder höher sein.");
    const x = (S().parStock || []).find((i) => i.id === o.id);
    if (!x) throw Error("Position nicht gefunden – wurde sie inzwischen gelöscht?");
    if (Number(x.version || 1) !== Number(o.version))
      throw Error("Änderungskonflikt: Die Position wurde parallel geändert. Bitte neu öffnen.");
    x.stock = n;
    x.version = Number(x.version || 1) + 1;
    G.closeModal();
    G.markEdited();
    G.persist();
    G.render();
    G.toast("Bestand geändert.");
  },
  "v11-task-form": (o) => {
    if (!canUpdateTasks()) throw Error("Deine Rolle darf Aufgaben nur lesen.");
    if (!o.title?.trim()) throw Error("Aufgabenbeschreibung fehlt.");
    if (!["normal", "medium", "high"].includes(o.priority)) throw Error("Ungültige Priorität.");
    const outlet = T.resolveOutletChoice(o.outlet_id, outlets());
    addTask(o.title.trim(), o.priority, o.due_on || null, outlet);
    G.render();
    G.toast(`Aufgabe erstellt (${T.outletLabel(outlet, outlets())}).`);
  },
  "v11-task-outlet-form": (o) => {
    if (!canUpdateTasks()) throw Error("Deine Rolle darf Aufgaben nur lesen.");
    const t = (S().tasks || []).find((x) => x.id === o.id);
    if (!t) throw Error("Aufgabe nicht gefunden – wurde sie inzwischen gelöscht?");
    if (Number(t.version || 1) !== Number(o.version))
      throw Error("Änderungskonflikt: Die Aufgabe wurde parallel geändert. Bitte neu öffnen.");
    const keepUnknown = o.outlet_id === T.taskOutlet(t) && !outlets().some((x) => x.id === o.outlet_id);
    t.outlet_id = keepUnknown ? t.outlet_id : T.resolveOutletChoice(o.outlet_id, outlets());
    t.version = Number(t.version || 1) + 1;
    G.closeModal();
    G.markEdited();
    G.persist();
    G.render();
    G.toast(`Outlet gespeichert: ${T.outletLabel(T.taskOutlet(t), outlets())}.`);
  },
  "v11-target-form": (o) => {
    const num = numberInput(o.target);
    if (!Number.isFinite(num) || num < 0 || num > 100 || !STAGE_IDS.has(o.stage)) throw Error("Ziel zwischen 0 und 100 % angeben.");
    const old = intel().targets.find((x) => x.stage === o.stage);
    if (old) old.target_ratio = num / 100;
    else intel().targets.push({ stage: o.stage, target_ratio: num / 100 });
    G.persist();
    G.render();
    G.toast("Zielquote gespeichert.");
  },
  "v11-tag-form": (o) => {
    const name = o.product_name.trim();
    if (!name || (!STAGE_IDS.has(o.stage) && o.stage !== "none")) throw Error("Artikel oder Thema fehlt.");
    if (!posLines().some((l) => norm(l.product_name) === norm(name))) throw Error("Artikel kommt in den Kassenbons noch nicht vor.");
    const old = intel().tags.find((x) => norm(x.product_name) === norm(name));
    if (old) old.stage = o.stage;
    else intel().tags.push({ product_name: name, stage: o.stage });
    G.persist();
    G.render();
    G.toast("Zuordnung gespeichert; gilt rückwirkend.");
  },
  "v11-quiz-form": submitQuiz,
  "v11-market-form": saveMarket,
  "v11-discover-form": discover,
  "v11-summary-form": async (o) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.from) || !/^\d{4}-\d{2}-\d{2}$/.test(o.to) || o.from > o.to) throw Error("Zeitraum prüfen.");
    V.summary = await cloud.posSummary(o.from, o.to, V.outlet);
    G.render();
  },
  "v11-legacy-form": (o) => {
    const url = (o.legacy_url || "").trim();
    if (url && !/^https:\/\/\S+$/.test(url)) throw Error("Nur https-Adressen.");
    V.legacyUrl = url;
    try {
      localStorage.setItem("glb_v11_legacy_url", url);
    } catch {
      /* link only for this visit */
    }
    G.render();
    G.toast("Link gespeichert.");
  },
};
document.addEventListener("submit", async (e) => {
  // getAttribute: a field named "id" inside the form would shadow form.id (v1.1 RC1 failed this way)
  const handler = FORMS[e.target.getAttribute?.("id")];
  if (!handler) return;
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await handler(Object.fromEntries(new FormData(e.target).entries()));
  } catch (err) {
    G.toast(err.message || String(err), "error");
  } finally {
    if (btn?.isConnected) btn.disabled = false;
  }
});
if (window.GLBCloudContext?.org) void loadCloudData();
// test hook: lets the browser tests read derived numbers without scraping
window.GLBV11 = { stats: () => stats(), funnel: () => funnelData().stats, sales: () => v11Sales(), state: V, cloud: CLOUD };
