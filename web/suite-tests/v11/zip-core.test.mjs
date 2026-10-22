import { test } from "node:test";
import assert from "node:assert/strict";
import { numberDE, parseCSV, rowsFromCSV, calculateSales, suggestActions, csvExport } from "../../public/suite/src/v11/core.mjs";
const products = [
  { id: "p1", name: "Burger", unit_cost_net: 4, vat_percent: 7 },
  { id: "p2", name: "Kaffee", unit_cost_net: null, vat_percent: 19 },
];
const outlets = [{ id: "o1", name: "Restaurant" }];
const hash = "a".repeat(64);
test("German number and currency formats", () => {
  assert.equal(numberDE("1.234,56 €"), 1234.56);
  assert.equal(numberDE("1,5"), 1.5);
  assert.equal(numberDE("1,234.50"), 1234.5);
  assert.ok(Number.isNaN(numberDE("unbekannt")));
});
test("CSV semicolon, quotes, UTF-8 BOM and multiline", () => {
  const v = parseCSV(
    '\ufeffProdukt;Outlet;Monat;Menge;Bruttopreis\n"Burger";Restaurant;2026-10;2;21,40\n"Kaffee";Restaurant;2026-10;1;3,80\n',
  );
  assert.equal(v.length, 2);
  assert.equal(v[0].values.produkt, "Burger");
  const w = parseCSV('Produkt;Outlet\n"mehr\nzeilig";Bar');
  assert.equal(w[0].values.produkt, "mehr\nzeilig");
});
test("Import enforces existing products and outlets and month", () => {
  const v = rowsFromCSV("Produkt;Outlet;Monat;Menge;Bruttopreis\nBurger;Restaurant;2026-10;2;21,40", products, outlets, hash);
  assert.equal(v.errors.length, 0);
  assert.equal(v.valid[0].unit_cost_net, 4);
  assert.equal(v.valid[0].month, "2026-10-01");
  const bad = rowsFromCSV("Produkt;Outlet;Monat;Menge;Bruttopreis\nUnbekannt;Restaurant;2026-10;2;21,4", products, outlets, hash);
  assert.equal(bad.valid.length, 0);
  assert.match(bad.errors[0], /nicht im Artikelstamm/);
});
test("Import rejects malformed month and negative quantity", () => {
  const v = rowsFromCSV("Produkt;Outlet;Monat;Menge;Bruttopreis\nBurger;Restaurant;2026-14;-5;20", products, outlets, hash);
  assert.ok(v.errors.length > 0);
});
test("Net revenue and cost missing are not misrepresented", () => {
  const s = [
    {
      id: "1",
      product_id: "p1",
      outlet_id: "o1",
      quantity: 2,
      unit_price_gross: 21.4,
      unit_cost_net: 4,
      vat_percent: 7,
      month: "2026-10-01",
    },
    {
      id: "2",
      product_id: "p2",
      outlet_id: "o1",
      quantity: 1,
      unit_price_gross: 11.9,
      unit_cost_net: null,
      vat_percent: 19,
      month: "2026-10-01",
    },
  ];
  const a = calculateSales(s, products);
  assert.ok(Math.abs(a.gross - 54.7) < 1e-8);
  assert.ok(Math.abs(a.net - 50) < 1e-8);
  assert.equal(a.missingCost, 1);
  assert.equal(a.margin, null);
  assert.equal(a.products.find((x) => x.id === "p2").classification, "WE fehlt");
});
test("All known costs yield contribution margin", () => {
  const a = calculateSales(
    [
      {
        product_id: "p1",
        outlet_id: "o1",
        month: "2026-10-01",
        quantity: 2,
        unit_price_gross: 21.4,
        unit_cost_net: 4,
        vat_percent: 7,
      },
    ],
    products,
  );
  assert.ok(Math.abs(a.net - 40) < 1e-8);
  assert.ok(Math.abs(a.margin - 32) < 1e-8);
  assert.ok(Math.abs(a.foodCostPct - 20) < 1e-8);
});
test("Restock recommendation calculates from par", () => {
  const s = calculateSales([], products);
  const notes = suggestActions(s, [{ stock: 3, reorder_point: 5, par_level: 10 }], []);
  assert.match(notes[0].title, /Bestandsposition/);
});
test("CSV export quotes values", () => {
  const out = csvExport([{ Artikel: 'Burger "XL"', Menge: 2 }], ["Artikel", "Menge"]);
  assert.match(out, /"Burger ""XL"""/);
});
