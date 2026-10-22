// Website revision (Oct 2026): forecast basis per ingredient and data quality from several sources.
const test = require("node:test");
const assert = require("node:assert/strict");
const v = require("../src/v04core.js");

const ingredients = [
  { id: "patty", name: "Patty", packQty: 10, packUnit: "stk", packCostNet: 20 },
  { id: "beans", name: "Kaffeebohnen", packQty: 1, packUnit: "kg", packCostNet: 18 },
  { id: "salt", name: "Salz", packQty: 1, packUnit: "kg", packCostNet: 1 },
  { id: "milk", name: "Milch", packQty: 1, packUnit: "l", packCostNet: 1.2 },
];
const recipes = [
  { productId: "burger", yieldPortions: 1, lines: [{ ingredientId: "patty", amount: 1, unit: "stk" }] },
  { productId: "steak", yieldPortions: 1, lines: [{ ingredientId: "salt", amount: 2, unit: "g" }] },
  { productId: "latte", yieldPortions: 1, lines: [{ ingredientId: "milk", amount: 200, unit: "g" }] }, // g vs l: not convertible
];
const days = (n, f) => Array.from({ length: n }, (_, i) => f("2026-10-" + String(28 - i).padStart(2, "0")));
const counts = ["patty", "beans", "salt", "milk"].map((id) => ({ date: "2026-10-27", warehouseId: "w", ingredientId: id, baseQty: 5 }));
const forecast = (dailySales, inventoryCounts = counts) =>
  v.demandForecast({ dailySales, recipes, ingredients, inventoryCounts, referenceDate: "2026-10-28", periodDays: 7, leadDays: 0, wasteSafetyPct: 0 });

test("not in any recipe: usage not determinable, no order quantity, others still computed", () => {
  const f = forecast([...days(28, (d) => ({ date: d, productId: "burger", quantity: 10 })), ...days(28, (d) => ({ date: d, productId: "latte", quantity: 3 }))]);
  const row = (id) => f.rows.find((r) => r.id === id);
  assert.equal(row("beans").basis, "not-in-recipe");
  assert.equal(row("beans").packs, null);
  assert.equal(row("beans").estimatedNet, null);
  assert.equal(row("patty").basis, "computed");
  assert.ok(row("patty").packs > 0);
  assert.equal(row("milk").basis, "invalid-unit");
  assert.equal(row("milk").packs, null);
  assert.equal(row("salt").basis, "no-sales", "in a recipe, but the dish was not sold: a real zero");
  assert.equal(row("salt").packs, 0);
});

test("without any recorded day nothing is a real zero", () => {
  const f = forecast([]);
  assert.equal(f.rows.find((r) => r.id === "salt").basis, "no-data");
  assert.equal(f.rows.find((r) => r.id === "salt").packs, null);
  assert.equal(f.dataQuality.rating, "unzureichend");
});

test("data quality is not just the number of days", () => {
  const all = days(28, (d) => ({ date: d, productId: "burger", quantity: 10 }));
  assert.equal(forecast(all).dataQuality.rating, "gut");
  const noStock = forecast(all, []);
  assert.equal(noStock.quality, "gut", "day coverage alone stays as before");
  assert.equal(noStock.dataQuality.rating, "eingeschränkt");
  assert.match(noStock.dataQuality.reasons.join(), /kein gezählter Bestand/);
  const mostlyWithoutRecipe = forecast([...all, ...days(28, (d) => ({ date: d, productId: "espresso", quantity: 40 }))]);
  assert.equal(mostlyWithoutRecipe.dataQuality.rating, "unzureichend");
  assert.match(mostlyWithoutRecipe.dataQuality.reasons.join(), /verkauften Einheiten mit Rezept/);
});

test("days recorded with zero sales are told apart from missing days", () => {
  const f = forecast([...days(20, (d) => ({ date: d, productId: "burger", quantity: 10 })), { date: "2026-10-05", productId: "burger", quantity: 0 }]);
  assert.equal(f.dataQuality.observedDays, 21);
  assert.equal(f.dataQuality.zeroDays, 1);
  assert.equal(f.dataQuality.missingDays, 7);
});

const v5 = require("../src/v05core.js");
test("completeness: setup done once is not the same as all articles calculable", () => {
  const items = [
    { id: "burger", name: "Burger", costNet: 0 },
    { id: "cola", name: "Cola 0,33", costNet: 0.62 },
    { id: "salad", name: "Salat", costNet: 0 },
    { id: "pie", name: "Kuchen", costNet: 0 },
  ];
  const ingredients = [
    { id: "patty", name: "Patty", packQty: 10, packUnit: "stk", packCostNet: 20 },
    { id: "leaf", name: "Blattsalat", packQty: 1, packUnit: "kg", packCostNet: null },
  ];
  const recipes = [
    { productId: "burger", yieldPortions: 1, lines: [{ ingredientId: "patty", amount: 1, unit: "stk" }] },
    { productId: "salad", yieldPortions: 1, lines: [{ ingredientId: "leaf", amount: 120, unit: "g" }] },
  ];
  const c = v5.completeness({ items, ingredients, recipes, sales: [{ productId: "pie", quantity: 3 }] });
  assert.equal(c.recipe, 1);
  assert.equal(c.direct, 1, "Direktverkauf mit Einkaufspreis zählt als kalkulierbar");
  assert.equal(c.recipeIncomplete, 1);
  assert.equal(c.none, 1);
  assert.equal(c.calculable, 2);
  assert.deepEqual(c.soldWithoutCost.map((x) => x.name), ["Kuchen"]);
  assert.deepEqual(c.ingredientsWithoutPrice.map((x) => x.name), ["Blattsalat"]);
  const steps = v5.readiness({ items, ingredients, recipes, warehouses: [{}], inventoryCounts: [{}], dailySales: [{}] });
  assert.equal(steps.filter((s) => s.ready).length, 6);
  assert.equal(steps.find((s) => s.id === "recipes").hint, "2 von 4 Artikeln mit Rezept");
});

const C = require("../src/core.js");
const V6 = require("../src/v06core.js");
test("cost states: migration, dated changes, month valuation with labelled substitute", () => {
  const p = { id: "b", name: "Burger", category: "Burger", grossPrice: 11.9, vat: 19, costNet: 3, quantity: 0 };
  assert.equal(C.migrateCostHistory([p]), 1);
  assert.equal(C.migrateCostHistory([p]), 0, "idempotent");
  assert.equal(p.costHistory[0].validFrom, null);
  p.costNet = 4;
  assert.equal(C.recordCost(p, { validFrom: "2026-09-15", source: "Kosten bearbeitet" }), true);
  assert.equal(C.recordCost(p, { validFrom: "2026-09-15" }), false, "unchanged cost adds nothing");
  assert.deepEqual(C.costAt(p, "2026-10"), { costNet: 4, costDetail: undefined, source: "history", validFrom: "2026-09-15", fallback: null });
  assert.equal(C.costAt(p, "2026-09").costNet, 4, "valid from the 15th: September is valued with the new state");
  const aug = C.costAt(p, "2026-08");
  assert.equal(aug.costNet, 3);
  assert.equal(aug.fallback, "undated", "the undated old value is a labelled substitute");

  const data = { items: [p], outlets: [{ id: "o", name: "O" }], sales: [
    { id: "s1", productId: "b", outletId: "o", month: "2026-08", quantity: 10, grossPrice: 11.9 },
    { id: "s2", productId: "b", outletId: "o", month: "2026-10", quantity: 10, grossPrice: 11.9 },
  ] };
  const hist = V6.performance(data, { costBasis: "history" });
  const now = V6.performance(data, { costBasis: "current" });
  assert.equal(C.round(hist.totals.goods), 70, "August 10 × 3 + October 10 × 4");
  assert.equal(C.round(now.totals.goods), 80, "scenario: all at today's 4");
  assert.equal(hist.costFallback.undated, 1);
  assert.deepEqual(now.costFallback, {});
});

test("import plan: same file twice adds nothing in 'add', modes are explicit", () => {
  const key = (r) => `${r.productId}|${r.outletId}|${r.month}`;
  const period = (r) => r.month;
  const existing = [
    { productId: "a", outletId: "o", month: "2026-08", quantity: 5 },
    { productId: "a", outletId: "o", month: "2026-09", quantity: 7 },
  ];
  const file = [
    { productId: "a", outletId: "o", month: "2026-09", quantity: 9, grossPrice: 10 },
    { productId: "a", outletId: "o", month: "2026-09", quantity: 1, grossPrice: 8 }, // same month, other price: kept together
    { productId: "b", outletId: "o", month: "2026-09", quantity: 3 },
  ];
  const add = C.planImport(existing, file, { keyOf: key, periodOf: period, mode: "add" });
  assert.deepEqual([add.added, add.skipped, add.present], [1, 2, 2]);
  const again = C.planImport(add.result, file, { keyOf: key, periodOf: period, mode: "add" });
  assert.equal(again.added, 0, "re-importing the same file adds nothing");
  const update = C.planImport(existing, file, { keyOf: key, periodOf: period, mode: "update" });
  assert.equal(update.result.filter((r) => r.month === "2026-09" && r.productId === "a").reduce((s, r) => s + r.quantity, 0), 10);
  assert.equal(update.result.some((r) => r.month === "2026-08"), true, "other months untouched");
  const replace = C.planImport([...existing, { productId: "z", outletId: "o", month: "2026-09", quantity: 1 }], file, { keyOf: key, periodOf: period, mode: "replace" });
  assert.equal(replace.result.some((r) => r.productId === "z"), false, "replace clears the file's months");
  assert.equal(replace.result.some((r) => r.month === "2026-08"), true);
  assert.equal(C.fingerprint("a;b\r\n1;2\r\n"), C.fingerprint("﻿a;b\n1;2"), "same content, other line endings/BOM");
  assert.notEqual(C.fingerprint("a;b\n1;2"), C.fingerprint("a;b\n1;3"));
});

test("portfolio analysis: within a group, reasons with medians and DB share, low confidence on thin data", () => {
  const item = (id, quantity, grossPrice, costNet) => ({ id, name: id, category: "Burger", quantity, grossPrice, costNet, vat: 7 });
  const r = C.portfolioAnalysis([item("a", 200, 16.05, 4), item("b", 180, 10.7, 6), item("c", 20, 21.4, 5), item("d", 10, 9.63, 7), item("e", 0, 12, 4)]);
  assert.equal(r.withoutSales, 1, "no sales in the selection is left out, not classified");
  assert.equal(r.rows.length, 4);
  const a = r.rows.find((x) => x.id === "a");
  assert.equal(a.quadrant, "star");
  assert.match(a.reason, /Median/);
  assert.match(a.reason, /% des Gesamt-DB II/);
  assert.match(a.check, /Absatz ≥ 190/);
  assert.equal(r.rows.find((x) => x.id === "d").confidence, "normal");
  assert.equal(r.rows[0].id, "a", "sorted by total contribution");
  const tiny = C.portfolioAnalysis([item("x", 5, 10, 3), item("y", 50, 10, 4)]);
  assert.equal(tiny.small, true);
  assert.ok(tiny.rows.every((x) => x.confidence === "gering"));
  const loss = C.portfolioAnalysis([item("l", 50, 5, 8), item("m", 60, 10, 3), item("n", 70, 12, 3), item("o", 80, 9, 2)]);
  assert.match(loss.rows.find((x) => x.id === "l").action, /Verlustartikel/);
});

test("lifecycle: a month with business data but no sale of this article is a real zero, a month without data is missing", () => {
  const sale = (productId, month, quantity) => ({ productId, month, quantity, grossPrice: 10, outletId: "o" });
  const other = ["2026-05", "2026-06", "2026-07", "2026-08"].map((m) => sale("x", m, 50));
  const r = C.lifecycle([sale("a", "2026-05", 20), sale("a", "2026-06", 20), sale("a", "2026-07", 4), ...other], "a");
  assert.equal(r.phase, "decline", "August had business sales, article none: 0, so (4+0)/2 vs (20+20)/2");
  assert.deepEqual(r.zeroMonths, ["2026-08"]);
  assert.deepEqual(r.period, ["2026-05", "2026-06", "2026-07", "2026-08"]);
  assert.equal(r.points.find((p) => p.month === "2026-08").zero, true);
  const gap = C.lifecycle([sale("a", "2026-04", 10), sale("a", "2026-05", 10), sale("a", "2026-07", 10), sale("a", "2026-08", 10)], "a");
  assert.equal(gap.phase, "incomplete");
  assert.deepEqual(gap.missingMonths, ["2026-06"]);
});

const M = require("../src/v08menu.js");
test("Speisekarte: USt aus Voreinstellung je Speisen/Getränke, Quelle und Prüfhinweise je Zeile", () => {
  const r = M.parseText("BURGER\nClassic Burger 17,90 €\nGRILL\nRinderfilet\n39,90 €\nWEINE\nHAUSWEIN 6,50\nRosé 0,2l 6,90\nWasser 0,50", { vatFood: 7, vatDrinks: 19 });
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  assert.equal(by["Classic Burger"].vat, 7);
  assert.equal(by["Classic Burger"].vatSource, "Speisen-Voreinstellung");
  assert.deepEqual(by["Classic Burger"].flags, []);
  assert.match(by["Rinderfilet"].flags.join(), /zwei Zeilen/);
  assert.equal(by["HAUSWEIN"].vat, 19);
  assert.match(by["HAUSWEIN"].flags.join(), /Großbuchstaben/);
  assert.match(by["Rosé 0,2l"].flags.join(), /Ziffern/);
  assert.match(by["Wasser"].flags.join(), /unter 1 €/);
  // explicit single rate (older callers) still wins
  assert.ok(M.parseText("Espresso 3,40", { vat: 19 }).rows.every((x) => x.vat === 19));
});
test("Speisekarte CSV: Steuersatz aus Datei bleibt, fehlender wird je Warengruppe vorbelegt", () => {
  const r = M.parseCSV("Produkt;Kategorie;Bruttopreis;USt\nEspresso;Kaffee;3,40;\nSchnitzel;Hauptgerichte;19,90;\nWein;Weine;6,50;7", { vatFood: 7, vatDrinks: 19 });
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  assert.equal(by.Espresso.vat, 19);
  assert.equal(by.Schnitzel.vat, 7);
  assert.equal(by.Wein.vat, 7);
  assert.equal(by.Wein.vatSource, "Datei");
  assert.equal(M.isDrinkCategory("Vom Schwein"), false);
  assert.equal(M.isDrinkCategory("Barbecue"), false);
});

const X = require("../src/xlsx.js");
test("Excel-Export: gültiges ZIP, Zahlen bleiben Zahlen, Formeln werden nicht ausgeführt", () => {
  const b = Buffer.from(
    X.report({
      title: "T",
      meta: [["Zeitraum", "September 2026"]],
      cols: [
        { label: "Artikel", value: "n" },
        { label: "Umsatz", unit: "€", style: "eur", value: "v" },
      ],
      rows: [{ n: "=1+1", v: 1234.5 }],
    }),
  );
  assert.equal(b.readUInt32LE(0), 0x04034b50);
  assert.equal(b.readUInt32LE(b.length - 22), 0x06054b50);
  const text = b.toString("utf8");
  assert.match(text, /<v>1234\.5<\/v>/);
  assert.match(text, /t="inlineStr"><is><t xml:space="preserve">=1\+1<\/t>/);
  assert.doesNotMatch(text, /<f>/);
  assert.match(text, /Umsatz \(€\)/);
  assert.equal(X.colName(0), "A");
  assert.equal(X.colName(26), "AA");
});
