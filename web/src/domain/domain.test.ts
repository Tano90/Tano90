import { describe, expect, it } from "vitest";
import { rollUp } from "./allergens";
import { type CostContext, type CostIngredient, type CostRecipe, costRecipe, foodCostBp } from "./costing";
import { applyMovement, suggestPacks } from "./stock";
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
