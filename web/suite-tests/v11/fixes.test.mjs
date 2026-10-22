// Tests for the corrections made while integrating v1.1 RC1 (see replica/glb-v11-integration.md, section 5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { numberDE, numberInput, csvExport, calculateSales } from "../../public/suite/src/v11/core.mjs";
import { readPosImport, aggregateFunnel, applyStageMappings, findPosOverlaps, STAGES } from "../../public/suite/src/v11/intelligence.mjs";
import { initializeIntelligence } from "../../public/suite/src/v11/demo.mjs";

const hash = "b".repeat(64);
const outlets = [{ id: "o1", name: "Restaurant" }];
const products = [{ id: "p1", name: "Burger", unit_cost_net: 4, vat_percent: 7 }];

test("Zahlen: kleine Mengen, Dezimalpunkt, Dezimalkomma, Tausendertrennzeichen", () => {
  assert.equal(numberDE("0.001"), 0.001); // v1.1 RC1 lieferte 1
  assert.equal(numberDE("0,001"), 0.001);
  assert.equal(numberDE("0.5"), 0.5);
  assert.equal(numberDE("1.234"), 1234); // deutsches Tausendertrennzeichen in Texten und CSV
  assert.equal(numberDE("1.234.567,8"), 1234567.8);
  assert.equal(numberDE("1,234,567"), 1234567);
  assert.equal(numberDE("-2,5"), -2.5);
  assert.ok(Number.isNaN(numberDE("1.2.3")));
  assert.ok(Number.isNaN(numberDE("12 Stück")));
  // Werte aus <input type="number"> haben immer einen Punkt als Dezimalzeichen
  assert.equal(numberInput("1.234"), 1.234);
  assert.equal(numberInput("0.001"), 0.001);
  assert.ok(Number.isNaN(numberInput("")));
  assert.ok(Number.isNaN(numberInput("1,5")));
});

test("CSV-Export: Formeln werden entschärft, Zahlen bleiben Zahlen", () => {
  const out = csvExport([{ a: "=HYPERLINK(1)", b: -5, c: "-3,5", d: "@x" }], ["a", "b", "c", "d"]);
  assert.match(out, /"'=HYPERLINK\(1\)";"-5";"-3,5";"'@x"/);
});

test("Leerer Tagesfunnel: kein „vollständig“, kein DB von 0, klarer Leerzustand", () => {
  const a = aggregateFunnel([]);
  assert.equal(a.empty, true);
  assert.equal(a.checkCount, 0);
  assert.equal(a.guestComplete, false); // RC1: true
  assert.equal(a.guestStatus, "none");
  assert.equal(a.covers, null);
  assert.equal(a.margin, null); // RC1: 0
  assert.ok(a.stages.every((s) => s.rate === null && s.extraChecks === null));
});

test("Echte Null bleibt Null: Bons ohne Thema ergeben Quote 0, nicht „keine Daten“", () => {
  const r = readPosImport(
    "Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;Gaeste\n2026-10-20;A1;Restaurant;Burger;1;10;2\n",
    hash,
    "x.csv",
    products,
    outlets,
  );
  const a = aggregateFunnel(r.valid);
  assert.equal(a.empty, false);
  assert.equal(a.stages.find((s) => s.id === "dessert").rate, 0);
  assert.equal(a.guestStatus, "complete");
});

test("Gäste: je Bon genau einmal, widersprüchliche Angaben aus verschiedenen Quellen erkannt", () => {
  const base = {
    service_date: "2026-10-20",
    outlet_id: "o1",
    check_id: "A1",
    vat_percent: 7,
    unit_price_gross: 10,
    unit_cost_net: 2,
    stage: "none",
  };
  const a = aggregateFunnel([
    { ...base, product_name: "Burger", quantity: 1, guests: 2 },
    { ...base, product_name: "Fries", quantity: 1, guests: 2 },
  ]);
  assert.equal(a.covers, 2);
  const b = aggregateFunnel([
    { ...base, product_name: "Burger", quantity: 1, guests: 2 },
    { ...base, product_name: "Fries", quantity: 1, guests: 3 },
  ]);
  assert.equal(b.covers, null);
  assert.equal(b.guestStatus, "conflict");
  assert.equal(b.guestConflicts, 1);
});

test("Alle sechs Themen, Kaufquote je Bon, unabhängig voneinander", () => {
  assert.deepEqual(
    STAGES.map((s) => s.id),
    ["aperitif", "water", "upgrade", "dessert", "coffee", "afterglow"],
  );
  const d = initializeIntelligence({ outlets, items: [] }, "demo");
  const a = aggregateFunnel(d.intelligence.pos);
  for (const s of a.stages) assert.ok(s.checks > 0, `Beispieldaten ohne ${s.id}`);
  // a check with dessert and coffee counts for both topics
  const t010 = d.intelligence.pos.filter((x) => x.check_id === "T010").map((x) => x.stage);
  assert.ok(t010.includes("dessert") && t010.includes("coffee"));
  assert.equal(a.stages.find((s) => s.id === "coffee").checks, 2);
  assert.equal(a.checkCount, 12);
});

test("Storno: Position mit Bezug, Menge netto; ein vollständig stornierter Artikel zählt nicht als Kauf", () => {
  const csv =
    "Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;FunnelStufe;USt;PositionID;Typ;BezugsPosition\n" +
    "2026-10-20;A1;Restaurant;Burger;1;10;none;7;P1;Verkauf;\n" +
    "2026-10-20;A1;Restaurant;Espresso;1;3;coffee;19;P2;Verkauf;\n" +
    "2026-10-20;A1;Restaurant;Espresso;-1;3;coffee;19;P3;Storno;P2\n";
  const r = readPosImport(csv, hash, "s.csv", products, outlets);
  assert.deepEqual(r.errors, []);
  const a = aggregateFunnel(r.valid);
  assert.equal(a.stages.find((s) => s.id === "coffee").checks, 0);
  assert.ok(Math.abs(a.gross - 10) < 1e-9);
  assert.equal(a.voidLines, 1);
  const bad = readPosImport(csv.replace(";Storno;P2", ";Storno;").replace("P3", "P4"), hash, "s.csv", products, outlets);
  assert.match(bad.errors.join(" "), /BezugsPosition/);
  const neg = readPosImport(
    "Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;USt\n2026-10-20;A1;Restaurant;Burger;-1;10;7\n",
    hash,
    "n.csv",
    products,
    outlets,
  );
  assert.match(neg.errors.join(" "), /Negative Menge nur mit Typ Storno/);
});

test("Zuordnung Artikel → Thema wirkt rückwirkend und unabhängig von Groß-/Kleinschreibung", () => {
  const lines = [
    { product_name: "ESPRESSO", stage: "none" },
    { product_name: "espresso ", stage: "none" },
    { product_name: "Espresso", stage: "dessert" },
  ];
  const out = applyStageMappings(lines, [{ product_name: "Espresso", stage: "coffee" }]);
  assert.deepEqual(
    out.map((x) => x.stage),
    ["coffee", "coffee", "dessert"],
  );
});

test("Überschneidungen: gleiche PositionID sicher doppelt, gleicher Inhalt aus anderer Quelle nur zur Prüfung", () => {
  const existing = [
    {
      service_date: "2026-10-20",
      outlet_id: "o1",
      check_id: "A1",
      product_name: "Burger",
      quantity: 1,
      unit_price_gross: 10,
      source_hash: "h1",
      line_no: 2,
      source_system: "webhook",
      external_line_id: "X1",
    },
  ];
  const incoming = [
    {
      service_date: "2026-10-20",
      outlet_id: "o1",
      check_id: "A1",
      product_name: "burger",
      quantity: 1,
      unit_price_gross: 10,
      source_hash: "h2",
      line_no: 2,
      source_system: "csv",
    },
    {
      service_date: "2026-10-20",
      outlet_id: "o1",
      check_id: "A2",
      product_name: "Burger",
      quantity: 1,
      unit_price_gross: 10,
      source_hash: "h2",
      line_no: 3,
      source_system: "csv",
    },
    {
      service_date: "2026-10-20",
      outlet_id: "o1",
      check_id: "A1",
      product_name: "Burger",
      quantity: 1,
      unit_price_gross: 10,
      source_hash: "h3",
      line_no: 2,
      source_system: "webhook",
      external_line_id: "X1",
    },
  ];
  const r = findPosOverlaps(incoming, existing);
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.review.length, 1);
  assert.equal(r.fresh.length, 1);
  assert.equal(r.fresh[0].check_id, "A2"); // gleicher Betrag, anderer Bon: kein Duplikat
  // pending review lines are not counted until a decision is made
  const pending = aggregateFunnel([{ ...r.review[0].line, vat_percent: 7, guests: 1, stage: "none", review_status: "pending" }]);
  assert.equal(pending.empty, true);
  assert.equal(pending.pendingReview, 1);
});

test("PositionID doppelt in einer Datei wird gemeldet", () => {
  const r = readPosImport(
    "Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;USt;PositionID\n2026-10-20;A1;Restaurant;Burger;1;10;7;P1\n2026-10-20;A1;Restaurant;Burger;1;10;7;P1\n",
    hash,
    "d.csv",
    products,
    outlets,
  );
  assert.match(r.errors.join(" "), /PositionID P1 steht schon in Zeile 2/);
});

test("Demo-Initialisierung: alle v1.1-Bereiche sofort vorhanden, bestehende Schlüssel unberührt", () => {
  const d = initializeIntelligence({ outlets, items: [{ id: "x", name: "Classic Cheeseburger" }], sales: [1] }, "demo");
  assert.deepEqual(d.sales, [1]);
  for (const k of ["pos", "tags", "targets", "markets", "training", "tasks", "stock"]) assert.ok(Array.isArray(d.intelligence[k]), k);
  assert.ok(d.intelligence.pos.length > 0 && d.intelligence.stock.length === 3 && d.intelligence.tasks.length === 3);
  assert.equal(d.intelligence.pos[0].product_id, "x");
  // a second call does not seed twice; cloud mode never seeds
  const n = d.intelligence.pos.length;
  initializeIntelligence(d, "demo");
  assert.equal(d.intelligence.pos.length, n);
  assert.equal(initializeIntelligence({ outlets }, "cloud").intelligence.pos.length, 0);
});

test("Monatswerte: Netto, DB I und WE-Quote unverändert definiert (Brutto/(1+USt), Netto − WE)", () => {
  const a = calculateSales(
    [{ product_id: "p1", outlet_id: "o1", month: "2026-10-01", quantity: 2, unit_price_gross: 10.7, unit_cost_net: 4, vat_percent: 7 }],
    products,
  );
  assert.ok(Math.abs(a.net - 20) < 1e-9);
  assert.ok(Math.abs(a.margin - 12) < 1e-9);
  assert.ok(Math.abs(a.foodCostPct - 40) < 1e-9);
});
