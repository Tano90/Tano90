import { describe, expect, it } from "vitest";
import { contributionSummary, fixedCostsForPeriod, itemContribution, targetPrice } from "./contribution";

const v = { revenuePct: 2, perItemCents: 10 };

describe("contribution margin", () => {
  it("DB I and DB II per item", () => {
    const c = itemContribution({ id: "a", name: "Pasta", quantity: 100, revenueNetCents: 100000, costPerPortionCents: 280 }, v);
    expect(c).toMatchObject({ cogsCents: 28000, db1Cents: 72000, variableCents: 2000 + 1000, db2Cents: 69000, db2PerPortionCents: 690, db2RatioBp: 6900, foodCostBp: 2800, unknownCost: false });
    expect(itemContribution({ id: "b", name: "?", quantity: 2, revenueNetCents: 2000, costPerPortionCents: null }, v)).toMatchObject({ unknownCost: true, foodCostBp: null });
  });

  it("summary with fixed costs and break-even", () => {
    const items = [itemContribution({ id: "a", name: "Pasta", quantity: 100, revenueNetCents: 100000, costPerPortionCents: 280 }, v)];
    const s = contributionSummary(items, 50000);
    expect(s).toMatchObject({ revenueNetCents: 100000, db2Cents: 69000, fixedCents: 50000, resultCents: 19000 });
    expect(s.breakEvenRevenueCents).toBe(Math.round(50000 / 0.69));
    expect(contributionSummary([], 50000).breakEvenRevenueCents).toBeNull();
  });

  it("fixed costs pro rata by days", () => {
    expect(fixedCostsForPeriod(310000, "2026-10-01", "2026-10-31")).toBe(310000);
    expect(fixedCostsForPeriod(310000, "2026-10-01", "2026-10-10")).toBe(100000);
    expect(fixedCostsForPeriod(300000, "2026-10-31", "2026-11-01")).toBe(Math.round(300000 / 31 + 300000 / 30));
  });

  it("target price from food cost share or DB II, gross, rounded up to 10 cents", () => {
    // 2,80 € cost at 28 % → 10,00 € net + 0,10 € / 0,98 packaging, +7 % VAT = 10,81 → 10,90
    expect(targetPrice({ costPerPortionCents: 280, vatBp: 700, variable: v, foodCostBp: 2800 })).toBe(1090);
    // (2,80 + 0,10 + 7,00) / 0,98 = 10,102 net → 10,81 gross → 10,90
    expect(targetPrice({ costPerPortionCents: 280, vatBp: 700, variable: v, db2Cents: 700 })).toBe(1090);
    expect(() => targetPrice({ costPerPortionCents: 280, vatBp: 700, variable: v, foodCostBp: 0 })).toThrow();
  });
});
