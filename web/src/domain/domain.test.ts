import { describe, expect, it } from "vitest";
import { rollUp } from "./allergens";
import { type CostContext, type CostIngredient, type CostRecipe, costRecipe, foodCostBp } from "./costing";
import { applyMovement, stockReport, suggestPacks } from "./stock";
import { startOfDay, zoneOffsetMinutes } from "../lib/dates";
import { billOfMaterials, summarizeMenu } from "./menus";
import { parseSalesCsv } from "./pos";
import { toBase } from "./units";

const gram = { baseUnit: "g" as const, gramsPerPiece: null, mlPerGram: null };

describe("units", () => {
  it("converts within a dimension", () => {
    expect(toBase(1.5, "kg", gram)).toBe(1500);
    expect(toBase(75, "cl", { ...gram, baseUnit: "ml" })).toBe(750);
  });
  it("converts pieces through weight per piece", () => {
    expect(toBase(2, "piece", { ...gram, gramsPerPiece: 150 })).toBe(300);
    expect(toBase(300, "g", { baseUnit: "piece", gramsPerPiece: 150, mlPerGram: null })).toBe(2);
  });
  it("refuses conversions it has no data for", () => {
    expect(toBase(2, "piece", gram)).toBeNull();
    expect(toBase(100, "ml", gram)).toBeNull();
  });
});

// Spinach: box of 30 x 150 g for 15.00 EUR -> 1/3 ct per gram (the help-center example in the recon).
const spinach: CostIngredient = { id: "spinach", name: "Spinat", ...gram, price: { type: "per_pack", priceCents: 1500, packQuantityBase: 4500 } };
const onion: CostIngredient = { id: "onion", name: "Zwiebel", ...gram, gramsPerPiece: 120, price: { type: "per_unit", priceCents: 180, unitQuantityBase: 1000 } };
const salt: CostIngredient = { id: "salt", name: "Salz", ...gram, price: null };
const stock: CostRecipe = {
  id: "stock", name: "Fond", portions: 1, netQuantityBase: 2000, netUnit: "ml",
  lines: [{ ingredientId: "onion", quantity: 5, unit: "piece" }],
};
const soup: CostRecipe = {
  id: "soup", name: "Suppe", portions: 4, netQuantityBase: null, netUnit: "g",
  lines: [
    { ingredientId: "spinach", quantity: 450, unit: "g" },
    { subRecipeId: "stock", quantity: 0.5, unit: "l" },
  ],
};
const ctx = (extra: CostRecipe[] = []): CostContext => {
  const ings = new Map([spinach, onion, salt].map((i) => [i.id, i]));
  const recs = new Map([stock, soup, ...extra].map((r) => [r.id, r]));
  return { ingredient: (id) => ings.get(id), recipe: (id) => recs.get(id) };
};

describe("costing", () => {
  it("costs nested packages and pieces", () => {
    const c = costRecipe(stock, ctx());
    expect(c.totalCents).toBeCloseTo(108); // 5 x 120 g x 0.18 ct
    expect(c.perBaseUnitCents).toBeCloseTo(0.054);
  });
  it("costs a sub-recipe by its net yield and shows cost per portion", () => {
    const c = costRecipe(soup, ctx());
    expect(c.lines[0].costCents).toBeCloseTo(150); // 450 g spinach
    expect(c.lines[1].costCents).toBeCloseTo(27); // 500 ml of a 2 l stock that costs 108
    expect(c.perPortionCents).toBeCloseTo(177 / 4);
    expect(c.yieldBase).toBeCloseTo(950); // net not set: sum of the lines, ml counted as g
    expect(c.missing).toBe(0);
  });
  it("flags lines without price instead of costing them at zero silently", () => {
    const r: CostRecipe = { ...soup, id: "salty", lines: [...soup.lines, { ingredientId: "salt", quantity: 5, unit: "g" }] };
    const c = costRecipe(r, ctx([r]));
    expect(c.missing).toBe(1);
    expect(c.lines[2].warning).toContain("kein Preis");
  });
  it("uses portions of a sub-recipe", () => {
    const r: CostRecipe = { id: "bowl", name: "Bowl", portions: 1, netQuantityBase: null, netUnit: "g", lines: [{ subRecipeId: "soup", quantity: 1, unit: "portion" }] };
    expect(costRecipe(r, ctx([r])).totalCents).toBeCloseTo(177 / 4);
  });
  it("computes food cost against the net price", () => {
    expect(foodCostBp(300, 1070, true, 700)).toBe(3000); // 10.70 incl. 7 % VAT = 10.00 net
    expect(foodCostBp(300, null, true, 700)).toBeNull();
  });
});

describe("allergens", () => {
  it("lets the strongest status win and treats unknown as stronger than free", () => {
    const r = rollUp([{ gluten: "free", milk: "contains" }, { gluten: "unknown", milk: "free" }], { nuts: "may_contain" });
    expect(r.gluten).toBe("unknown");
    expect(r.milk).toBe("contains");
    expect(r.nuts).toBe("may_contain");
    expect(r.fish).toBe("unknown"); // nobody filled it in
  });
});

describe("stock", () => {
  it("re-averages on receipts and books issues at the average", () => {
    let l = { quantityBase: 0, avgCostCents: 0 };
    l = applyMovement(l, 1000, 0.5).level;
    l = applyMovement(l, 1000, 1).level;
    expect(l.avgCostCents).toBeCloseTo(0.75);
    const out = applyMovement(l, -500, 99);
    expect(out.bookedCost).toBeCloseTo(0.75);
    expect(out.level.quantityBase).toBe(1500);
  });
  it("suggests whole packs up to par", () => {
    expect(suggestPacks(5000, 1200, 1000, 1000)).toBe(3);
    expect(suggestPacks(5000, 6000, 0, 1000)).toBe(0);
    expect(suggestPacks(null, 0, 0, 1000)).toBe(0);
  });
});

describe("menus", () => {
  const menu = {
    priceCents: 2380, priceIncludesVat: true, vatBp: 1900, targetMarginBp: 7000,
    courses: [{ name: "Vorspeise", items: [{ recipeId: "soup", portions: 1 }] }, { name: "Hauptgang", items: [{ recipeId: "soup", portions: 2 }] }],
  };
  it("sums dish costs per course and computes the margin on the net price", () => {
    const sum = summarizeMenu(menu, ctx(), 1900);
    const perPortion = costRecipe(soup, ctx()).perPortionCents;
    expect(sum.courses.map((c) => c.costCents)).toEqual([perPortion, 2 * perPortion]);
    expect(sum.netPriceCents).toBe(2000);
    expect(sum.foodCostBp).toBe(Math.round(((3 * perPortion) / 2000) * 10000));
    expect(sum.marginBp).toBe(10000 - sum.foodCostBp!);
  });
  it("explodes sub-recipes into ingredients for the bill of materials", () => {
    // 3 portions of a 4-portion soup: 3/4 of 450 g spinach and 3/4 of 0.5 l stock = 375 ml of a 2 l batch of 5 onions.
    const bom = billOfMaterials(menu, ctx(), 1);
    expect(Object.fromEntries(bom.lines.map((l) => [l.ingredientId, l.quantityBase]))).toEqual({ spinach: 337.5, onion: 0.9375 * 120 });
    expect(bom.unknown).toBe(0);
    expect(billOfMaterials(menu, ctx(), 10).lines.find((l) => l.ingredientId === "spinach")!.quantityBase).toBe(3375);
  });
});

describe("stock report", () => {
  const mv = (ingredientId: string, eventType: string, occurredAt: string, deltaBase: number, unitCostCents = 1) => ({ ingredientId, eventType, occurredAt, deltaBase, unitCostCents });
  it("splits movements into opening, columns and closing; ignores what came after the period", () => {
    const [row] = stockReport([
      mv("a", "delivery", "2026-09-30T10:00:00Z", 1000),
      mv("a", "delivery", "2026-10-02T10:00:00Z", 500, 2),
      mv("a", "waste", "2026-10-03T10:00:00Z", -100, 1.5),
      mv("a", "count", "2026-10-04T10:00:00Z", -50, 1.5),
      mv("a", "transfer", "2026-10-05T10:00:00Z", -200, 1.5),
      mv("a", "sale", "2026-11-02T10:00:00Z", -300, 1.5),
    ], "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");
    expect(row.openingBase).toBe(1000);
    expect(row.closingBase).toBe(1150);
    expect(row.columns.delivered).toEqual({ base: 500, cents: 1000 });
    expect(row.columns.waste.base).toBe(-100);
    expect(row.columns.countDiff.base).toBe(-50);
    expect(row.columns.transfer.cents).toBe(-300);
    expect(row.columns.sold.base).toBe(0);
    expect(row.closingCents).toBe(1000 + 1000 - 150 - 75 - 300);
  });
});

describe("dates", () => {
  it("finds local midnight, also on daylight saving days", () => {
    expect(startOfDay("2026-10-20", "Europe/Berlin")).toBe("2026-10-19T22:00:00.000Z");
    expect(startOfDay("2026-12-01", "Europe/Berlin")).toBe("2026-11-30T23:00:00.000Z");
    expect(startOfDay("2026-03-29", "Europe/Berlin")).toBe("2026-03-28T23:00:00.000Z"); // DST starts 02:00 that day
    expect(startOfDay("2026-10-25", "Europe/Berlin")).toBe("2026-10-24T22:00:00.000Z"); // DST ends 03:00 that day
    expect(startOfDay("2026-10-20", "America/New_York")).toBe("2026-10-20T04:00:00.000Z");
    expect(startOfDay("2026-10-20", "UTC")).toBe("2026-10-20T00:00:00.000Z");
  });
});

describe("pos csv", () => {
  it("reads a German export with BOM, quotes, decimal comma and local times", () => {
    const csv = "﻿Belegposition;PLU;Artikel;Menge;Umsatz netto;Zeitpunkt\r\nB1-1;1001;\"Suppe; groß\";2;14,80;20.10.2026 12:30\r\nB1-2;1002;Ofengemüse;1;1.234,50;2026-10-20 13:05\r\n";
    const { rows, errors } = parseSalesCsv(csv, (ms) => zoneOffsetMinutes(ms, "Europe/Berlin"));
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({ externalId: "B1-1", plu: "1001", name: "Suppe; groß", quantity: 2, revenueNetCents: 1480, soldAt: "2026-10-20T10:30:00.000Z" });
    expect(rows[1].revenueNetCents).toBe(123450);
  });
  it("uses the offset of each sale's own date across daylight saving", () => {
    const berlin = (ms: number) => zoneOffsetMinutes(ms, "Europe/Berlin");
    const { rows } = parseSalesCsv("Beleg;PLU;Menge;Zeitpunkt\na;1;1;24.10.2026 20:00\nb;1;1;26.10.2026 20:00\n", berlin);
    expect(rows.map((r) => r.soldAt)).toEqual(["2026-10-24T18:00:00.000Z", "2026-10-26T19:00:00.000Z"]);
  });
  it("reads comma-separated English headers and ISO times with zone", () => {
    const { rows } = parseSalesCsv("id,sku,item,qty,net,timestamp\nx1,77,Tea,1.5,3.20,2026-10-20T08:00:00Z\n");
    expect(rows[0]).toMatchObject({ externalId: "x1", plu: "77", quantity: 1.5, revenueNetCents: 320, soldAt: "2026-10-20T08:00:00.000Z" });
  });
  it("names every bad row and a missing column", () => {
    const { rows, errors } = parseSalesCsv("Beleg;PLU;Menge;Zeitpunkt\n;1;1;20.10.2026\nb;1;-1;20.10.2026\nc;1;eins;20.10.2026\nd;1;1;31.02.2026\ne;1;1;20.10.2026\n");
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4, 5]);
    expect(parseSalesCsv("PLU;Menge\n1;1").errors[0].message).toMatch(/Spalte fehlt: Belegposition, Zeitpunkt/);
  });
});
