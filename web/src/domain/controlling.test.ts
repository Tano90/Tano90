import { describe, expect, it } from "vitest";
import { controlling } from "./controlling";

const m = (eventType: string, day: string, deltaBase: number, unitCostCents: number) => ({ ingredientId: "i", eventType, occurredAt: `${day}T10:00:00.000Z`, deltaBase, unitCostCents });

describe("controlling", () => {
  it("food cost = opening + purchases ± transfers − closing; parts add up", () => {
    const moves = [
      m("delivery", "2026-09-20", 10_000, 0.5),   // before: opening 50 €
      m("delivery", "2026-10-02", 20_000, 0.5),   // purchases 100 €
      m("sale", "2026-10-10", -8_000, 0.5),       // sold 40 €
      m("waste", "2026-10-11", -1_000, 0.5),      // waste 5 €
      m("transfer", "2026-10-12", -2_000, 0.5),   // sent away 10 €
      m("count", "2026-10-31", -500, 0.5),        // count difference 2,50 €
      m("delivery", "2026-11-02", 5_000, 0.5),    // after the period: ignored
    ];
    const r = controlling(moves, "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z", 20_000);
    expect(r.openingCents).toBe(5000);
    expect(r.purchasesCents).toBe(10000);
    expect(r.transfersCents).toBe(-1000);
    expect(r.closingCents).toBe(5000 + 10000 - 4000 - 500 - 1000 - 250);
    expect(r.foodCostCents).toBe(4000 + 500 + 250);
    expect(r.soldCents + r.wasteCents + r.countDiffCents).toBe(r.foodCostCents);
    expect(r.foodCostShare).toBeCloseTo(4750 / 20000);
  });
  it("no revenue, no share", () => {
    expect(controlling([], "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z", 0).foodCostShare).toBeNull();
  });
});
