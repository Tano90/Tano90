import { describe, expect, it } from "vitest";
import { rollUp } from "./allergens";
import { type CostContext, type CostIngredient, type CostRecipe, costRecipe, foodCostBp } from "./costing";
import { applyMovement, stockReport, suggestPacks, suggestWeight } from "./stock";
import { startOfDay, zoneOffsetMinutes } from "../lib/dates";
import { billOfMaterials, summarizeMenu } from "./menus";
import { evaluate } from "./haccp";
import { matchInvoice } from "./invoice";
import { classifyDishes } from "./menu-engineering";
import { recipeNutrition } from "./nutrition";
import { parseSalesCsv } from "./pos";
import { productionNeeds, shareCost } from "./production";
import { type Snapshot, parsePriceList, planPriceList } from "./price-list";
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
    expect(rows).toHaveLength(2);
    expect(errors.map((e) => e.row)).toEqual([2, 4, 5]); // -1 is a cancellation now, not an error
    expect(rows.map((r) => r.quantity)).toEqual([-1, 1]);
    expect(parseSalesCsv("Beleg;PLU;Menge;Zeitpunkt\n\na;1;x;20.10.2026\n").errors[0].row).toBe(3); // blank line still counts
    expect(parseSalesCsv("PLU;Menge\n1;1").errors[0].message).toMatch(/Spalte fehlt: Belegposition, Zeitpunkt/);
  });
});

describe("nutrition", () => {
  it("adds up per batch, per 100 g and per portion through sub-recipes, and names what is missing", () => {
    // Spinach 23 kcal / 100 g, onions 40 kcal / 100 g at 120 g each; the stock (2 l from 5 onions) has no other data.
    const values = (id: string) => (id === "spinach" ? { energyKcal: 23, fatG: 0.4, saturatedFatG: 0, carbohydrateG: 3.6, sugarsG: 0.4, proteinG: 2.9, saltG: 0.2 }
      : id === "onion" ? { energyKcal: 40, fatG: 0.1, saturatedFatG: 0, carbohydrateG: 9, sugarsG: 4.2, proteinG: 1.1, saltG: 0 } : undefined);
    const n = recipeNutrition("soup", ctx(), values)!;
    // 450 g spinach + 1/4 of the stock: 150 g onions.
    expect(n.perBatch.energyKcal).toBeCloseTo(4.5 * 23 + 1.5 * 40, 6);
    expect(n.perPortion.energyKcal).toBeCloseTo((4.5 * 23 + 1.5 * 40) / 4, 6);
    expect(n.per100!.energyKcal).toBeCloseTo(((4.5 * 23 + 1.5 * 40) * 100) / 950, 6); // yield: 450 g + 0.5 l stock
    expect(n.missing).toEqual([]);
    expect(n.byWeight.map((x) => x.name)).toEqual(["Spinat", "Zwiebel"]);
    expect(recipeNutrition("soup", ctx(), (id) => (id === "spinach" ? values(id) : undefined))!.missing).toEqual(["Zwiebel"]);
  });
});

describe("menu engineering", () => {
  it("splits by 70 % of an even share and the sales-weighted margin", () => {
    const d = (id: string, sold: number, net: number, cost: number) => ({ id, name: id, sold, netPerPortionCents: net, costPerPortionCents: cost });
    const r = classifyDishes([d("a", 50, 1000, 300), d("b", 30, 600, 300), d("c", 15, 1200, 200), d("d", 5, 500, 400), d("x", 0, 900, 100)]);
    expect(r.shareLinePct).toBeCloseTo(17.5); // 4 dishes sold: 25 % x 0.7
    expect(r.marginLineCents).toBeCloseTo((700 * 50 + 300 * 30 + 1000 * 15 + 100 * 5) / 100);
    expect(Object.fromEntries(r.dishes.map((x) => [x.id, x.group]))).toEqual({ a: "star", b: "workhorse", c: "puzzle", d: "dog" });
    expect(classifyDishes([]).dishes).toEqual([]);
  });
});

describe("suggestWeight", () => {
  it("fills up to the target by weight, rounded up to 100 g, pieces whole", () => {
    expect(suggestWeight(4000, 1234, 0, "g")).toBe(2800);
    expect(suggestWeight(4000, 1000, 3000, "g")).toBe(0);
    expect(suggestWeight(null, 0, 0, "g")).toBe(0);
    expect(suggestWeight(10, 2.5, 0, "piece")).toBe(8);
  });
});

describe("price list", () => {
  const table = [
    ["Zutat", "Gebinde", "Inhalt", "Einheit", "Preis", "Preis je", "Artikelnummer"],
    ["Butter", "Karton 10 × 250 g", 2.5, "kg", "23,90", "", "B-1"],
    ["Knollensellerie", "", "1", "kg", 2.4, "kg", null],
    ["Rote Beete", "Kiste 5 kg", 5, "kg", 6.5, "", null],
    ["Sahne", "1 l", 1, "l", "abc", "", null],
    ["Milch", "1 l", 1, "Fass", 1, "", null],
    ["", "", "", "", "", "", ""],
  ];
  it("reads German headers, units and price bases, and names bad rows", () => {
    const { rows, errors } = parsePriceList(table);
    expect(rows.map((r) => [r.ingredient, r.packLabel, r.packBase, r.baseUnit, r.priceCents, r.perUnitBase])).toEqual([
      ["Butter", "Karton 10 × 250 g", 2500, "g", 2390, null],
      ["Knollensellerie", "1 kg", 1000, "g", 240, 1000],
      ["Rote Beete", "Kiste 5 kg", 5000, "g", 650, null],
    ]);
    expect(errors.map((e) => e.row)).toEqual([5, 6]);
    expect(parsePriceList([["Name", "Preis"]]).errors[0].message).toMatch(/Spalte fehlt: Inhalt, Einheit/);
  });
  it("plans new, changed and unchanged prices for one supplier", () => {
    const { rows } = parsePriceList(table);
    const snap: Snapshot = {
      ingredients: [{ id: "i-b", name: "Butter", baseUnit: "g" }, { id: "i-s", name: "Knollensellerie", baseUnit: "g" }],
      packages: new Map([["i-b", [{ id: "p-b", label: "10x250 g", quantityBase: 2500 }]], ["i-s", [{ id: "p-s", label: "1 kg", quantityBase: 1000 }]]]),
      items: new Map([["i-b", [{ id: "s-b", supplierId: "sup", packageId: "p-b", priceType: "per_pack" as const, priceCents: 2290, priceUnitQuantity: null }]],
        ["i-s", [{ id: "s-s", supplierId: "sup", packageId: "p-s", priceType: "per_unit" as const, priceCents: 240, priceUnitQuantity: 1000 }]]]),
    };
    const plan = planPriceList(rows, "sup", snap);
    expect(plan.map((p) => p.kind)).toEqual(["changed", "same", "new_ingredient"]);
    expect(plan[0]).toMatchObject({ itemId: "s-b", packageId: "p-b", oldPriceCents: 2290 }); // same size, other label: same package
    expect(planPriceList(rows, "other-supplier", snap)[0].kind).toBe("new_price");
    expect(planPriceList([...rows, { ...rows[0], row: 9 }], "sup", snap).at(-1)!.message).toMatch(/Doppelt.*Zeile 2/);
    expect(planPriceList([{ ...rows[0], baseUnit: "ml" }], "sup", snap)[0].message).toMatch(/in g\/kg geführt/);
  });
});

describe("invoice match", () => {
  it("flags quantity and price differences against what arrived", () => {
    const r = matchInvoice([
      { lineId: "a", orderedPacks: 2, receivedPacks: 2, orderPriceCents: 1000, invoicedPacks: 2, invoicePriceCents: 1000 },
      { lineId: "b", orderedPacks: 3, receivedPacks: 2, orderPriceCents: 500, invoicedPacks: 3, invoicePriceCents: 500 },
      { lineId: "c", orderedPacks: 1, receivedPacks: 1, orderPriceCents: 800, invoicedPacks: 1, invoicePriceCents: 850 },
    ]);
    expect(r.lines.map((l) => [l.qtyOff, l.priceOff, l.diffCents])).toEqual([[false, false, 0], [true, false, 500], [false, true, 50]]);
    expect([r.expectedCents, r.invoicedCents, r.diffCents, r.status]).toEqual([3800, 4350, 550, "mismatch"]);
    expect(matchInvoice([{ lineId: "a", orderedPacks: 1, receivedPacks: 1, orderPriceCents: 100, invoicedPacks: 1, invoicePriceCents: 100 }]).status).toBe("matched");
  });
});

describe("haccp", () => {
  it("checks limits; empty means not recorded", () => {
    const fridge = { kind: "temperature" as const, minValue: 0, maxValue: 4 };
    expect(evaluate(fridge, "3,5")).toEqual({ ok: true });
    expect(evaluate(fridge, "6")).toEqual({ ok: false, reason: "Über 4 °C." });
    expect(evaluate({ kind: "temperature", minValue: -25, maxValue: -18 }, "-12")).toEqual({ ok: false, reason: "Über -18 °C." });
    expect(evaluate(fridge, "warm")).toEqual({ ok: false, reason: "Keine gültige Temperatur." });
    expect(evaluate(fridge, " ")).toBeNull();
    expect(evaluate({ kind: "check", minValue: null, maxValue: null }, "not_ok")).toEqual({ ok: false, reason: "Nicht in Ordnung." });
  });
});

describe("production", () => {
  it("adds raw needs across requests and shows what is short", () => {
    const n = productionNeeds([{ recipeId: "soup", portions: 4 }, { recipeId: "soup", portions: 4 }], ctx(), (id) => (id === "spinach" ? 500 : 0));
    const spinach = n.lines.find((l) => l.ingredientId === "spinach")!;
    expect([spinach.needBase, spinach.shortBase]).toEqual([900, 400]);
  });
  it("shares the real cost by planned cost, else by portions", () => {
    expect(shareCost(300, [{ id: "a", plannedCents: 100, portions: 1 }, { id: "b", plannedCents: 200, portions: 1 }])).toEqual({ a: 100, b: 200 });
    expect(shareCost(90, [{ id: "a", plannedCents: 0, portions: 1 }, { id: "b", plannedCents: 0, portions: 2 }])).toEqual({ a: 30, b: 60 });
  });
});

describe("variance (Soll-Ist)", () => {
  it("theoretical from sales, waste and production; actual includes what the count found missing", async () => {
    const { stockReport, variance } = await import("./stock");
    const m = (ingredientId: string, eventType: string, deltaBase: number, at = "2026-10-10T10:00:00Z") => ({ ingredientId, eventType, occurredAt: at, deltaBase, unitCostCents: 0.01 });
    const rows = stockReport([
      m("butter", "delivery", 5000, "2026-10-01T08:00:00Z"), m("butter", "sale", -2000), m("butter", "waste", -200), m("butter", "production", -300), m("butter", "count", -500),
      m("salz", "sale", -100), m("salz", "count", 50),
    ], "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");
    const v = variance(rows);
    expect(v.map((x) => x.ingredientId)).toEqual(["butter", "salz"]);
    expect(v[0]).toMatchObject({ theoreticalBase: 2500, actualBase: 3000, diffBase: -500, pct: 20 });
    expect(v[0].diffCents).toBeCloseTo(-5);
    expect(v[1]).toMatchObject({ theoreticalBase: 100, actualBase: 50, pct: -50 });
  });
});

describe("order suggestion from use", () => {
  it("averages by weekday over four weeks and forecasts the coming days", async () => {
    const { weekdayUsage, forecastUse, suggestFromUse } = await import("./stock");
    // 2026-10-21 is a Wednesday. Fridays used 2000 g, Saturdays 3000 g, other days 500 g.
    const days: Record<string, number> = {};
    for (let i = 1; i <= 28; i++) {
      const d = new Date("2026-10-21T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      const wd = (d.getUTCDay() + 6) % 7;
      days[d.toISOString().slice(0, 10)] = wd === 4 ? 2000 : wd === 5 ? 3000 : 500;
    }
    const per = weekdayUsage(days, "2026-10-21");
    expect(per).toEqual([500, 500, 500, 500, 2000, 3000, 500]);
    expect(forecastUse(per, "2026-10-21", 3)).toBe(500 + 2000 + 3000); // Thu, Fri, Sat
    expect(suggestFromUse({ forecastBase: 5500, reservePct: 10, parBase: 2000, onHandBase: 1000, onOrderBase: 0, packBase: 2500 })).toEqual({ packs: 3, reason: "use" });
    expect(suggestFromUse({ forecastBase: 100, reservePct: 10, parBase: 5000, onHandBase: 1000, onOrderBase: 0, packBase: 2500 })).toEqual({ packs: 2, reason: "par" });
    expect(suggestFromUse({ forecastBase: 100, reservePct: 10, parBase: null, onHandBase: 1000, onOrderBase: 0, packBase: 2500 })).toEqual({ packs: 0, reason: null });
  });
});
