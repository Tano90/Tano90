// Menu costing and the bill of materials. Pure functions over the same context as recipe costing,
// so a price change on an ingredient shows up in every menu the next time it is read.
import { type CostContext, type RecipeCost, costPerBaseUnit, costRecipe, foodCostBp, netPrice } from "./costing";
import type { BaseUnit } from "./units";

export type MenuShape = {
  priceCents: number | null;
  priceIncludesVat: boolean;
  vatBp: number | null;
  targetMarginBp: number | null;
  courses: { name: string; items: { recipeId: string; portions: number }[] }[];
};

export type BomLine = { ingredientId: string; name: string; baseUnit: BaseUnit; quantityBase: number; costCents: number | null };

export type MenuSummary = {
  costCents: number;
  /** Dishes whose cost is incomplete (a line without price or conversion). */
  missing: number;
  courses: { name: string; costCents: number; items: { recipeId: string; name: string; portions: number; perPortionCents: number; costCents: number; missing: number }[] }[];
  netPriceCents: number | null;
  foodCostBp: number | null;
  marginBp: number | null;
  belowTarget: boolean;
};

export function summarizeMenu(menu: MenuShape, ctx: CostContext, defaultVatBp: number, memo = new Map<string, RecipeCost>()): MenuSummary {
  let costCents = 0;
  let missing = 0;
  const courses = menu.courses.map((c) => {
    const items = c.items.map((it) => {
      const r = ctx.recipe(it.recipeId);
      const rc = r ? costRecipe(r, ctx, memo) : null;
      const perPortionCents = rc?.perPortionCents ?? 0;
      const m = rc ? rc.missing : 1;
      if (m > 0) missing += 1;
      return { recipeId: it.recipeId, name: r?.name ?? "Rezept nicht gefunden", portions: it.portions, perPortionCents, costCents: perPortionCents * it.portions, missing: m };
    });
    const sum = items.reduce((s, i) => s + i.costCents, 0);
    costCents += sum;
    return { name: c.name, costCents: sum, items };
  });
  const vat = menu.vatBp ?? defaultVatBp;
  const fc = foodCostBp(costCents, menu.priceCents, menu.priceIncludesVat, vat);
  const marginBp = fc === null ? null : 10000 - fc;
  return {
    costCents,
    missing,
    courses,
    netPriceCents: menu.priceCents ? netPrice(menu.priceCents, menu.priceIncludesVat, vat) : null,
    foodCostBp: fc,
    marginBp,
    belowTarget: marginBp !== null && menu.targetMarginBp !== null && marginBp < menu.targetMarginBp,
  };
}

/**
 * Everything a menu needs from the store, summed per ingredient through every level of sub-recipes.
 * `unknown` counts lines whose quantity could not be worked out (no conversion, sub-recipe without yield).
 */
export function billOfMaterials(menu: Pick<MenuShape, "courses">, ctx: CostContext, servings = 1): { lines: BomLine[]; unknown: number } {
  const qty = new Map<string, number>();
  const memo = new Map<string, RecipeCost>();
  let unknown = 0;
  const explode = (recipeId: string, batches: number, depth: number) => {
    const r = ctx.recipe(recipeId);
    if (!r || depth > 10) return void (unknown += 1);
    const rc = costRecipe(r, ctx, memo);
    r.lines.forEach((line, i) => {
      const q = rc.lines[i]?.quantityBase ?? null;
      if (q === null) return void (unknown += 1);
      if (line.ingredientId) qty.set(line.ingredientId, (qty.get(line.ingredientId) ?? 0) + q * batches);
      else if (line.subRecipeId) {
        const sub = ctx.recipe(line.subRecipeId);
        const yieldBase = sub ? costRecipe(sub, ctx, memo).yieldBase : null;
        if (!sub || !yieldBase) return void (unknown += 1);
        explode(sub.id, (batches * q) / yieldBase, depth + 1);
      }
    });
  };
  for (const c of menu.courses) for (const it of c.items) {
    const r = ctx.recipe(it.recipeId);
    explode(it.recipeId, r ? (it.portions * servings) / r.portions : 0, 0);
  }
  const lines = [...qty].map(([id, quantityBase]) => {
    const ing = ctx.ingredient(id);
    const per = ing ? costPerBaseUnit(ing) : null;
    return { ingredientId: id, name: ing?.name ?? "?", baseUnit: ing?.baseUnit ?? "g", quantityBase, costCents: per === null ? null : per * quantityBase };
  });
  return { lines: lines.sort((a, b) => a.name.localeCompare(b.name, "de")), unknown };
}
