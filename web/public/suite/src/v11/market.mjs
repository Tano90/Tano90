/** KI-Marktcheck, two views (Oct 2026). Pure functions for ui.mjs and the unit tests.
 *  A: food and drink price comparison – section (Speisen/Getränke) per Warengruppe, comparability of quantity and
 *     scope, deviation only for comparable pairs. B: surroundings – categories, straight-line distance, sorting. */
import { norm } from "./core.mjs";

export const SECTIONS = { food: "Speisen", drink: "Getränke" };
export const PLACE_CATEGORIES = [
  ["restaurant", "Restaurant"],
  ["cafe", "Café"],
  ["bar", "Bar"],
  ["pub", "Kneipe"],
  ["biergarten", "Biergarten"],
  ["fast_food", "Imbiss"],
  ["events_venue", "Veranstaltungsort"],
];
export const categoryLabel = (c) => PLACE_CATEGORIES.find((x) => x[0] === c)?.[1] || "Gastronomie (ohne Kategorie)";

/** Section of a Warengruppe: a manual choice wins; otherwise the suite's own Oberkategorie "Küche" → food,
 *  "Getränke" → drink. Everything else stays open (null) for manual review – nothing is guessed from names. */
export function sectionOf(category, categoryGroups = {}, manual = {}) {
  const m = manual[category];
  if (m === "food" || m === "drink") return { section: m, source: "manual" };
  const g = categoryGroups[category];
  if (g === "Küche") return { section: "food", source: "group" };
  if (g === "Getränke") return { section: "drink", source: "group" };
  return { section: null, source: null };
}

/** "250 g", "0,4 l", "40 cl", "1 kg", "330ml" → { value, base: "g" | "ml" }; anything else → null. */
export function parseAmount(text) {
  const m = String(text || "")
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\b/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!(n > 0)) return null;
  const f = { kg: [1000, "g"], g: [1, "g"], l: [1000, "ml"], cl: [10, "ml"], ml: [1, "ml"] }[m[2]];
  return { value: n * f[0], base: f[1] };
}

/** Comparability of one observation.
 *  scope: "same" (Leistungsumfang vergleichbar), "different", or anything else = not checked.
 *  level: "comparable" | "normalized" (different amount, converted per 100 g / 100 ml) | "not" | "unchecked".
 *  delta (in %) only for comparable and normalized pairs. */
export function comparability({ ownPrice, competitorPrice, ownPortion, competitorPortion, scope }) {
  const own = Number(ownPrice),
    other = Number(competitorPrice);
  const result = (level, reason, extra = {}) => ({ level, reason, delta: null, ...extra });
  if (!(own > 0) || !(other > 0)) return result("not", "Ein Preis fehlt");
  if (!String(competitorPortion || "").trim() || !String(ownPortion || "").trim())
    return result("unchecked", "Menge bzw. Portion nicht erfasst – Vergleichbarkeit prüfen");
  if (scope === "different") return result("not", "Leistungsumfang unterschiedlich (z. B. Beilagen, Qualität)");
  if (scope !== "same") return result("unchecked", "Leistungsumfang noch nicht bestätigt – Vergleichbarkeit prüfen");
  const a = parseAmount(ownPortion),
    b = parseAmount(competitorPortion);
  const samePortion = norm(ownPortion) === norm(competitorPortion) || (a && b && a.base === b.base && Math.abs(a.value - b.value) < 1e-9);
  if (samePortion) return result("comparable", "Gleiche Menge, Leistung vergleichbar", { delta: ((own - other) / other) * 100 });
  if (a && b && a.base === b.base) {
    const unit = a.base === "g" ? "100 g" : "100 ml",
      ownPer = (own / a.value) * 100,
      otherPer = (other / b.value) * 100;
    return result("normalized", `Unterschiedliche Menge – umgerechnet je ${unit}`, {
      delta: ((ownPer - otherPer) / otherPer) * 100,
      per: unit,
      ownPer,
      otherPer,
    });
  }
  return result("not", `Mengen nicht vergleichbar (${ownPortion} / ${competitorPortion})`);
}

/** Rows for view A from both stores: KI-Marktcheck observations and the price observations of "Mein Markt".
 *  products: suite items { id, name, category, unit, grossPrice }. Nothing is deleted or rewritten here. */
export function comparisonRows(observations, meinMarkt, products, categoryGroups, manualSections) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const byName = (n) => products.find((p) => norm(p.name) === norm(n));
  const rows = [];
  for (const o of observations || []) {
    const p = (o.own_product_id && byId.get(o.own_product_id)) || byName(o.own_product);
    const ownPortion = o.own_portion || "";
    rows.push({
      id: o.id,
      origin: "v11",
      product: p || null,
      ownName: p?.name || o.own_product,
      competitor: o.competitor_name,
      competitorProduct: o.competitor_product,
      competitorPortion: o.competitor_portion || "",
      ownPortion,
      competitorPrice: Number(o.competitor_price_gross),
      ownPrice: Number(o.our_price_gross),
      source: o.source_url,
      checked: o.checked_on,
      note: o.note || "",
      placeUrl: o.place_url || "",
      example: o.example === true,
      cmp: comparability({
        ownPrice: o.our_price_gross,
        competitorPrice: o.competitor_price_gross,
        ownPortion,
        competitorPortion: o.competitor_portion,
        scope: o.scope,
      }),
      raw: o,
    });
  }
  for (const m of meinMarkt || []) {
    const p = byId.get(m.productId);
    const unitsMatch = p && String(p.unit || "Portion").trim().toLowerCase() === String(m.unit || "").trim().toLowerCase();
    const cmp = comparability({
      ownPrice: p?.grossPrice,
      competitorPrice: m.grossPrice,
      ownPortion: p?.unit || "Portion",
      competitorPortion: m.unit,
      scope: unitsMatch ? "same" : "unknown",
    });
    rows.push({
      id: m.id,
      origin: "meinMarkt",
      product: p || null,
      ownName: p?.name || "Artikel gelöscht",
      competitor: m.competitor,
      competitorProduct: m.competitorProduct,
      competitorPortion: m.unit || "",
      ownPortion: p?.unit || "Portion",
      competitorPrice: Number(m.grossPrice),
      ownPrice: Number(p?.grossPrice),
      source: m.sourceUrl || "",
      checked: m.observedAt || "",
      note: m.source || "",
      placeUrl: "",
      // Mein Markt only records the unit; same unit counts as comparable there, the scope was not asked
      cmp: unitsMatch ? { ...cmp, reason: "Gleiche Einheit laut Mein Markt; Leistungsumfang dort nicht abgefragt" } : cmp,
      raw: m,
    });
  }
  for (const r of rows) {
    const s = r.product ? sectionOf(r.product.category, categoryGroups, manualSections) : { section: null, source: null };
    r.section = s.section;
    r.sectionSource = s.source;
    r.category = r.product?.category || "";
  }
  return rows.sort((a, b) => String(b.checked).localeCompare(String(a.checked)));
}

/** filter: { section: "all" | "food" | "drink" | "open", category: "all" | name } */
export function filterRows(rows, filter) {
  return rows.filter(
    (r) =>
      (filter.section === "all" ||
        (filter.section === "open" ? r.section === null : r.section === filter.section)) &&
      (!filter.category || filter.category === "all" || r.category === filter.category),
  );
}

/** Warengruppen of the product master per section, for the second filter. */
export function categoriesBySection(products, categoryGroups, manualSections) {
  const out = { food: new Set(), drink: new Set(), open: new Set() };
  for (const p of products) {
    if (!p.category) continue;
    const s = sectionOf(p.category, categoryGroups, manualSections).section;
    out[s || "open"].add(p.category);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, "de"))]));
}

/** Rows that need a person: unknown own article, open section, or comparability not checked. */
export function reviewList(rows) {
  return rows
    .map((r) => ({
      row: r,
      reasons: [
        !r.product && "Eigener Artikel nicht im Produktstamm gefunden",
        r.product && r.section === null && `Warengruppe „${r.category || "ohne"}“ ist weder Speisen noch Getränken zugeordnet`,
        r.cmp.level === "unchecked" && r.cmp.reason,
      ].filter(Boolean),
    }))
    .filter((x) => x.reasons.length);
}

// ---------- B: surroundings ----------
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180,
    a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export const formatDistance = (m) =>
  m === null || m === undefined ? "Entfernung unbekannt" : m < 1000 ? `${Math.round(m / 10) * 10} m Luftlinie` : `${(m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km Luftlinie`;

/** sort: "distance" | "category" | "name"; categories: list of shown categories (empty = all) */
export function arrangePlaces(places, { sort = "distance", categories = [] } = {}) {
  const dist = (p) => (p.distance_m === null || p.distance_m === undefined ? Infinity : p.distance_m);
  const list = places.filter((p) => !categories.length || categories.includes(p.category));
  const by = {
    distance: (a, b) => dist(a) - dist(b) || a.name.localeCompare(b.name, "de"),
    category: (a, b) => categoryLabel(a.category).localeCompare(categoryLabel(b.category), "de") || dist(a) - dist(b),
    name: (a, b) => a.name.localeCompare(b.name, "de"),
  }[sort];
  return [...list].sort(by || ((a, b) => dist(a) - dist(b)));
}

/** What is missing in an OSM entry – shown at the entry instead of hiding it. */
export function missingInfo(p) {
  return [!p.address && "Adresse", !p.website && "Website", (p.lat === null || p.lat === undefined) && "Position", !p.category && "Kategorie"].filter(Boolean);
}
