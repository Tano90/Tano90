// Oct 2026: two separate price goals per article – target goods quota vs. calculated floor from fixed costs and profit goal.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/core.js");

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`);
const model = C.monthlyCostModel({ energy: 1000, payroll: 1000, overhead: 0, goods: 300 }, 10000); // fixed rate 20 %

test("Preis für Ziel-Warenquote = Wareneinsatz netto ÷ Zielquote × USt-Faktor", () => {
  const t = C.priceTargets({ vat: 7, grossPrice: 29.5, costNet: 11.65 }, { targetGoodsPct: 30, monthlyModel: model, profitPct: 10 });
  near(t.quotaGross, (11.65 / 0.3) * 1.07);
  near(t.quotaNow, (11.65 / (29.5 / 1.07)) * 100);
  near(t.quotaGap, t.quotaGross - 29.5);
});

test("Kalkulatorische Untergrenze stimmt mit dem bestehenden Zielpreismodell überein", () => {
  const p = { vat: 19, grossPrice: 11.9, costNet: 3 };
  const t = C.priceTargets(p, { targetGoodsPct: 30, monthlyModel: model, profitPct: 10 });
  near(t.floorGross, C.targetPriceModel(p, model, 10).targetGross);
  near(t.floorGross, (3 / 0.7) * 1.19);
});

test("Zwei Ziele werden getrennt eingeordnet; keine Senkung, wenn der Preis über beiden liegt", () => {
  const above = C.priceTargets({ vat: 19, grossPrice: 30, costNet: 3 }, { targetGoodsPct: 30, monthlyModel: model, profitPct: 10 });
  assert.equal(above.status, "ok");
  assert.ok(above.quotaGap < 0 && above.floorGap < 0); // negative gap = reached; the page shows "erreicht", never a lower price
  const quotaOnly = C.priceTargets({ vat: 7, grossPrice: 29.5, costNet: 11.65 }, { targetGoodsPct: 30, monthlyModel: model, profitPct: 10 });
  assert.equal(quotaOnly.status, "below-quota");
  const both = C.priceTargets({ vat: 19, grossPrice: 4, costNet: 3 }, { targetGoodsPct: 30, monthlyModel: model, profitPct: 10 });
  assert.equal(both.status, "below-both");
});

test("Ohne Kosten oder ohne Ziel kein künstlicher Preis", () => {
  assert.equal(C.priceTargets({ vat: 19, grossPrice: 10 }, { targetGoodsPct: 30, monthlyModel: model }).status, "no-cost");
  const noGoal = C.priceTargets({ vat: 19, grossPrice: 10, costNet: 3 }, { targetGoodsPct: null, monthlyModel: C.monthlyCostModel({}, 0) });
  assert.equal(noGoal.quotaGross, null);
  assert.equal(noGoal.floorGross, null);
  assert.equal(noGoal.status, "no-goal");
});
