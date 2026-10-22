// Oct 2026: data behind the interactive lifecycle chart – real values only, gaps stay gaps, filters by outlet and period.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/core.js");

const P = { id: "a", name: "Burger", vat: 7, unit: "Portion" };
const row = (month, quantity, o = {}) => ({ id: month + (o.outletId || "r") + quantity, productId: "a", outletId: "r", month, quantity, grossPrice: 10.7, ...o });
const other = (month) => ({ id: "o" + month, productId: "b", outletId: "r", month, quantity: 3, grossPrice: 5 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);

test("Graph: jeder Kalendermonat auf der Achse, fehlende Monate als Lücke (null), nicht als 0", () => {
  const s = C.lifecycleSeries([row("2026-01", 10), row("2026-02", 12), row("2026-05", 14)], P);
  assert.deepEqual(s.points.map((x) => [x.month, x.status, x.quantity]), [
    ["2026-01", "data", 10],
    ["2026-02", "data", 12],
    ["2026-03", "gap", null],
    ["2026-04", "gap", null],
    ["2026-05", "data", 14],
  ]);
  assert.deepEqual(s.gaps, ["2026-03", "2026-04"]);
  assert.equal(s.life.phase, "insufficient"); // only 3 months with data
  assert.equal(s.averages, null, "ohne vollständiges Vergleichsfenster keine Durchschnittslinien");
  assert.equal(s.points[4].changePct, null, "keine Veränderung über eine Lücke hinweg");
});

test("Graph: echte Null nur, wenn der Betrieb im Monat verkauft hat", () => {
  const s = C.lifecycleSeries([row("2026-01", 10), other("2026-02"), row("2026-03", 6)], P);
  assert.deepEqual(s.points.map((x) => x.status), ["data", "zero", "data"]);
  assert.equal(s.points[1].quantity, 0);
});

test("Graph: Kennzahlen je Monat aus den echten Zeilen; DB I nur mit Wareneinsatz", () => {
  const rows = [row("2026-01", 10), row("2026-01", 5, { outletId: "b", grossPrice: 21.4 })];
  const s = C.lifecycleSeries(rows, P, {}, () => 4);
  const p = s.points[0];
  assert.equal(p.quantity, 15);
  near(p.revenueNet, 10 * 10 + 5 * 20);
  near(p.grossAvg, (10 * 10.7 + 5 * 21.4) / 15);
  near(p.db1, 10 * 6 + 5 * 16);
  assert.equal(p.outlets, 2);
  assert.equal(p.lines, 2);
  const noCost = C.lifecycleSeries(rows, P, {}, (r) => (r.outletId === "b" ? null : 4)).points[0];
  assert.equal(noCost.db1, null);
  assert.equal(noCost.costMissing, true);
});

test("Graph: Outlet- und Zeitraumfilter wirken auf Punkte und Einordnung", () => {
  const rows = [
    ...["2026-01", "2026-02", "2026-03", "2026-04"].map((m, i) => row(m, [10, 10, 20, 20][i])),
    ...["2026-01", "2026-02", "2026-03", "2026-04"].map((m, i) => row(m, [20, 20, 10, 10][i], { outletId: "bar" })),
    row("2026-06", 50),
  ];
  const all = C.lifecycleSeries(rows, P, { to: "2026-04" });
  assert.equal(all.life.phase, "maturity"); // 30,30,30,30
  const r = C.lifecycleSeries(rows, P, { outletId: "r", to: "2026-04" });
  assert.equal(r.life.phase, "growth");
  near(r.life.changePct, 100);
  assert.deepEqual(r.averages, { before: 10, after: 20 });
  assert.deepEqual(r.window, ["2026-01", "2026-02", "2026-03", "2026-04"]);
  const bar = C.lifecycleSeries(rows, P, { outletId: "bar" });
  assert.equal(bar.life.phase, "decline");
  assert.equal(bar.points.length, 4, "Bar hat keine Juni-Daten");
  const from = C.lifecycleSeries(rows, P, { outletId: "r", from: "2026-03" });
  assert.deepEqual(from.points.map((x) => x.month), ["2026-03", "2026-04", "2026-05", "2026-06"]);
  assert.equal(from.points[2].status, "gap");
  assert.equal(from.life.phase, "insufficient");
});

test("Graph: ohne Daten leere Achse, bestehende Einordnung unverändert", () => {
  const s = C.lifecycleSeries([], P);
  assert.deepEqual(s.points, []);
  assert.equal(s.life.phase, "insufficient");
  const rows = ["2026-01", "2026-02", "2026-03", "2026-04"].map((m, i) => row(m, [10, 10, 20, 20][i]));
  assert.deepEqual(C.lifecycleSeries(rows, P).life, C.lifecycle(rows, "a"));
});
