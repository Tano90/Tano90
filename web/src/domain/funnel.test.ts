import { describe, expect, it } from "vitest";
import { type FunnelDay, type StepSetting, biggestGap, defaultSteps, funnelSummary, parseDay, parseFunnelCsv } from "./funnel";

const day = (d: string, covers: number, x: Partial<FunnelDay> = {}): FunnelDay => ({ outletId: "o1", day: d, covers, aperitif: 0, water: 0, upgrades: 0, sides: 0, desserts: 0, coffee: 0, ...x });
const steps: StepSetting[] = defaultSteps().map((s) => (s.step === "desserts" ? { ...s, priceGrossCents: 1070, vatBp: 700, variableCents: 250, goalPct: 40 } : s));

describe("funnelSummary", () => {
  it("rates per 100 guests, actual DB II and the scenario at the target rate", () => {
    const r = funnelSummary([day("2026-10-01", 100, { desserts: 20 }), day("2026-10-02", 100, { desserts: 30 })], steps, { projectedDays: 26 });
    const d = r.steps.find((s) => s.id === "desserts")!;
    expect(r.covers).toBe(200);
    expect(d.currentPct).toBe(25);
    // 10,70 gross at 7 % = 10,00 net, 7,50 DB II per dessert
    expect(d.netRevenueCents).toBe(50000);
    expect(d.db2Cents).toBe(37500);
    // target 40 % of 200 guests = 80, 30 more
    expect(d.deltaUnits).toBe(30);
    expect(d.revenueDeltaCents).toBe(30000);
    expect(d.db2DeltaCents).toBe(22500);
    // two observed outlet-days, 26 planned: ×13
    expect(r.monthlyDb2DeltaCents).toBe(22500 * 13);
    expect(biggestGap(r)?.id).toBe("desserts");
  });
  it("traffic lift and goal override; no guests gives no rate and no scenario", () => {
    const r = funnelSummary([day("2026-10-01", 100, { desserts: 40 })], steps, { trafficLiftPct: 10, goals: { desserts: 50 } });
    expect(r.steps.find((s) => s.id === "desserts")!.deltaUnits).toBeCloseTo(15);
    const empty = funnelSummary([], steps);
    expect(empty.steps[0].currentPct).toBeNull();
    expect(empty.revenueDeltaCents).toBe(0);
    expect(biggestGap(empty)).toBeNull();
  });
});

describe("parseFunnelCsv", () => {
  it("reads German headers and dates, last row per day wins, names bad rows", () => {
    const { rows, errors } = parseFunnelCsv("﻿Datum;Gäste;Aperitif;Wasser;Desserts;Kaffee\n01.10.2026;120;30;80;25;60\n2026-10-02;90;;;10;\n31.02.2026;10\n01.10.2026;121;31;80;25;60\n2026-10-03;x\n");
    expect(rows.map((r) => [r.day, r.covers, r.aperitif, r.desserts])).toEqual([["2026-10-01", 121, 31, 25], ["2026-10-02", 90, 0, 10]]);
    expect(errors).toEqual([{ row: 4, message: "Datum „31.02.2026“ ist kein gültiges Datum." }, { row: 6, message: "„x“ ist keine ganze Zahl ab 0." }]);
    expect(parseFunnelCsv("Tag;Aperitif\n").errors[0].message).toMatch(/Covers/);
  });
  it("parses days", () => {
    expect(parseDay("1.2.26")).toBe("2026-02-01");
    expect(parseDay("2026-13-01")).toBeNull();
  });
});
