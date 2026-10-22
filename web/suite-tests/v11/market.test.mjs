// KI-Marktcheck in two views (Oct 2026): sections, comparability, filters, review list, surroundings.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as M from "../../public/suite/src/v11/market.mjs";

const GROUPS = { Burger: "Küche", Dessert: "Küche", Getränke: "Getränke", Cocktails: "Getränke", Upgrades: "Zusatzverkauf" };
const PRODUCTS = [
  { id: "p1", name: "Classic Cheeseburger", category: "Burger", unit: "Portion", grossPrice: 17.9 },
  { id: "p2", name: "Apfelstrudel", category: "Dessert", unit: "Portion", grossPrice: 10.2 },
  { id: "p3", name: "Hausgemachte Limonade", category: "Getränke", unit: "0,4 l", grossPrice: 5.9 },
  { id: "p4", name: "Signature Cocktail", category: "Cocktails", unit: "Glas", grossPrice: 9.5 },
  { id: "p5", name: "Surf & Turf Upgrade", category: "Upgrades", unit: "Portion", grossPrice: 12.5 },
];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);

test("Speisen/Getränke: aus der eigenen Oberkategorie oder manuell, sonst offen (nichts geraten)", () => {
  assert.deepEqual(M.sectionOf("Burger", GROUPS), { section: "food", source: "group" });
  assert.deepEqual(M.sectionOf("Cocktails", GROUPS), { section: "drink", source: "group" });
  assert.deepEqual(M.sectionOf("Upgrades", GROUPS), { section: null, source: null });
  assert.deepEqual(M.sectionOf("Getränkekarte Spezial", {}), { section: null, source: null }, "kein Raten über den Namen");
  assert.deepEqual(M.sectionOf("Upgrades", GROUPS, { Upgrades: "food" }), { section: "food", source: "manual" });
  assert.deepEqual(M.sectionOf("Burger", GROUPS, { Burger: "drink" }).section, "drink", "manuelle Wahl hat Vorrang");
  const c = M.categoriesBySection(PRODUCTS, GROUPS, {});
  assert.deepEqual(c, { food: ["Burger", "Dessert"], drink: ["Cocktails", "Getränke"], open: ["Upgrades"] });
});

test("Mengen lesen", () => {
  assert.deepEqual(M.parseAmount("0,4 l"), { value: 400, base: "ml" });
  assert.deepEqual(M.parseAmount("40cl"), { value: 400, base: "ml" });
  assert.deepEqual(M.parseAmount("250 g"), { value: 250, base: "g" });
  assert.deepEqual(M.parseAmount("1 kg"), { value: 1000, base: "g" });
  assert.equal(M.parseAmount("Portion"), null);
  assert.equal(M.parseAmount("0 g"), null);
});

test("Vergleichbarkeit: Abweichung nur bei gleicher Menge und bestätigtem Leistungsumfang oder umgerechnet", () => {
  const base = { ownPrice: 17.9, competitorPrice: 16, ownPortion: "Portion", competitorPortion: "Portion" };
  const ok = M.comparability({ ...base, scope: "same" });
  assert.equal(ok.level, "comparable");
  near(ok.delta, ((17.9 - 16) / 16) * 100);
  assert.equal(M.comparability({ ...base, scope: "different" }).level, "not");
  assert.equal(M.comparability({ ...base, scope: "different" }).delta, null);
  assert.equal(M.comparability({ ...base }).level, "unchecked", "Leistung nicht bestätigt");
  assert.equal(M.comparability({ ...base, competitorPortion: "", scope: "same" }).level, "unchecked");
  const norm = M.comparability({ ownPrice: 5.9, competitorPrice: 4.5, ownPortion: "0,4 l", competitorPortion: "0,3 l", scope: "same" });
  assert.equal(norm.level, "normalized");
  assert.equal(norm.per, "100 ml");
  near(norm.delta, ((5.9 / 4 - 4.5 / 3) / (4.5 / 3)) * 100);
  assert.equal(M.comparability({ ownPrice: 5.9, competitorPrice: 4.5, ownPortion: "0,4 l", competitorPortion: "250 g", scope: "same" }).level, "not");
  assert.equal(M.comparability({ ownPrice: 5.9, competitorPrice: 4.5, ownPortion: "Glas", competitorPortion: "0,2 l", scope: "same" }).level, "not");
  assert.equal(M.comparability({ ownPrice: 5.9, competitorPrice: 0, ownPortion: "x", competitorPortion: "x", scope: "same" }).level, "not");
  assert.equal(M.comparability({ ...base, competitorPortion: "portion ", scope: "same" }).level, "comparable");
});

test("Zeilen aus KI-Marktcheck und Mein Markt, Filter Speisen/Getränke und Warengruppe, Prüfliste", () => {
  const obs = [
    { id: "o1", competitor_name: "Bistro A", own_product: "classic cheeseburger", competitor_product: "Cheeseburger", competitor_price_gross: 16, our_price_gross: 17.9, source_url: "https://a.example", checked_on: "2026-10-01" },
    { id: "o2", competitor_name: "Bar B", own_product_id: "p3", own_product: "Limo", own_portion: "0,4 l", competitor_portion: "0,3 l", scope: "same", competitor_product: "Limonade", competitor_price_gross: 4.5, our_price_gross: 5.9, source_url: "https://b.example", checked_on: "2026-10-05" },
    { id: "o3", competitor_name: "C", own_product: "Gibt es nicht", competitor_product: "x", competitor_price_gross: 3, our_price_gross: 4, source_url: "https://c.example", checked_on: "2026-09-01" },
  ];
  const mm = [{ id: "m1", productId: "p2", competitor: "Café D", competitorProduct: "Strudel", unit: "Portion", grossPrice: 9, observedAt: "2026-10-03", sourceUrl: "" }];
  const rows = M.comparisonRows(obs, mm, PRODUCTS, GROUPS, {});
  assert.deepEqual(rows.map((r) => r.id), ["o2", "m1", "o1", "o3"], "neueste zuerst, alle Quellen erhalten");
  const r = Object.fromEntries(rows.map((x) => [x.id, x]));
  assert.equal(r.o1.product.id, "p1", "Zuordnung über den Namen ohne Groß-/Kleinschreibung");
  assert.equal(r.o1.cmp.level, "unchecked", "alte Beobachtung ohne Mengen: nicht verglichen, sondern zur Prüfung");
  assert.equal(r.o2.cmp.level, "normalized");
  assert.equal(r.m1.cmp.level, "comparable");
  assert.equal(r.m1.origin, "meinMarkt");
  assert.equal(r.o3.product, null);
  assert.deepEqual(M.filterRows(rows, { section: "drink", category: "all" }).map((x) => x.id), ["o2"]);
  assert.deepEqual(M.filterRows(rows, { section: "food", category: "all" }).map((x) => x.id), ["m1", "o1"]);
  assert.deepEqual(M.filterRows(rows, { section: "food", category: "Dessert" }).map((x) => x.id), ["m1"]);
  assert.deepEqual(M.filterRows(rows, { section: "open", category: "all" }).map((x) => x.id), ["o3"]);
  assert.deepEqual(M.filterRows(rows, { section: "all", category: "all" }).length, 4);
  const review = M.reviewList(rows);
  assert.deepEqual(review.map((x) => x.row.id), ["o1", "o3"]);
  assert.match(review[1].reasons.join(), /nicht im Produktstamm/);
});

test("Umgebung: Luftlinie, Sortierung, Kategorienfilter, fehlende Angaben sichtbar", () => {
  near(Math.round(M.distanceMeters(50.8, 6.48, 50.81, 6.48)), 1112);
  assert.equal(M.formatDistance(456), "460 m Luftlinie");
  assert.equal(M.formatDistance(1234), "1,2 km Luftlinie");
  assert.equal(M.formatDistance(null), "Entfernung unbekannt");
  const places = [
    { name: "Zeta", category: "bar", distance_m: 300, address: "A 1", website: "https://z", lat: 1, lon: 1 },
    { name: "Alpha", category: "restaurant", distance_m: 900, address: "", website: null, lat: 1, lon: 1 },
    { name: "Mitte", category: "cafe", distance_m: null, address: "", website: null, lat: null, lon: null },
    { name: "Beta", category: "events_venue", distance_m: 100, address: "B", website: null, lat: 1, lon: 1 },
  ];
  assert.deepEqual(M.arrangePlaces(places).map((p) => p.name), ["Beta", "Zeta", "Alpha", "Mitte"]);
  assert.deepEqual(M.arrangePlaces(places, { sort: "category" }).map((p) => p.name), ["Zeta", "Mitte", "Alpha", "Beta"]);
  assert.deepEqual(M.arrangePlaces(places, { categories: ["bar", "events_venue"] }).map((p) => p.name), ["Beta", "Zeta"]);
  assert.deepEqual(M.missingInfo(places[2]), ["Adresse", "Website", "Position"]);
  assert.equal(M.categoryLabel("events_venue"), "Veranstaltungsort");
});
