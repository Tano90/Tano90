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
