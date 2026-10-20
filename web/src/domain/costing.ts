// Recipe costing. All money is in cents as plain numbers here; round only for display.
import { type BaseUnit, type Convertible, type Unit, conversionHint, toBase } from "./units";

export type PriceSource =
  | { type: "per_pack"; priceCents: number; packQuantityBase: number }
  | { type: "per_unit"; priceCents: number; unitQuantityBase: number };

export type CostIngredient = Convertible & { id: string; name: string; price: PriceSource | null };

export type LineUnit = Unit | "portion";
export type CostLine = { ingredientId?: string | null; subRecipeId?: string | null; quantity: number; unit: LineUnit };

export type CostRecipe = {
  id: string;
  name: string;
  portions: number;
  netQuantityBase: number | null;
  netUnit: BaseUnit;
  lines: CostLine[];
};

export type LineCost = { costCents: number | null; quantityBase: number | null; warning?: string };
export type RecipeCost = {
  totalCents: number;
  perPortionCents: number;
  /** Cost per g/ml/piece of the finished recipe, used when it is a sub-recipe. */
  perBaseUnitCents: number | null;
  yieldBase: number | null;
  /** Lines that could not be costed (no price, no conversion); the total is then too low. */
  missing: number;
  lines: LineCost[];
};

export type CostContext = {
  ingredient: (id: string) => CostIngredient | undefined;
  recipe: (id: string) => CostRecipe | undefined;
};

export const MAX_DEPTH = 10;

export function costPerBaseUnit(i: CostIngredient): number | null {
  if (!i.price) return null;
  const q = i.price.type === "per_pack" ? i.price.packQuantityBase : i.price.unitQuantityBase;
  return q > 0 ? i.price.priceCents / q : null;
}

// A recipe converts like an item whose base unit is its net unit. Density is taken as 1 g = 1 ml:
// kitchens mix the two for stocks and sauces, and the error is small next to yield losses.
const recipeConvertible = (r: CostRecipe): Convertible => ({ baseUnit: r.netUnit, gramsPerPiece: null, mlPerGram: 1 });

export function costRecipe(recipe: CostRecipe, ctx: CostContext, memo = new Map<string, RecipeCost>(), depth = 0): RecipeCost {
  const cached = memo.get(recipe.id);
  if (cached) return cached;
  if (depth > MAX_DEPTH) {
    return { totalCents: 0, perPortionCents: 0, perBaseUnitCents: null, yieldBase: null, missing: 1, lines: [] };
  }

  const lines: LineCost[] = [];
  let total = 0;
  let missing = 0;
  let summedYield = 0;
  let yieldKnown = true;

  for (const line of recipe.lines) {
    let lc: LineCost;
    if (line.ingredientId) {
      const ing = ctx.ingredient(line.ingredientId);
      if (!ing) lc = { costCents: null, quantityBase: null, warning: "Zutat nicht gefunden." };
      else if (line.unit === "portion") lc = { costCents: null, quantityBase: null, warning: "„Portion“ gibt es nur für Rezepte." };
      else {
        const q = toBase(line.quantity, line.unit, ing);
        const per = costPerBaseUnit(ing);
        if (q === null) lc = { costCents: null, quantityBase: null, warning: conversionHint(line.unit, ing) };
        else if (per === null) lc = { costCents: null, quantityBase: q, warning: `Für „${ing.name}“ ist kein Preis hinterlegt.` };
        else lc = { costCents: q * per, quantityBase: q };
      }
      const amountInNet = ing && line.unit !== "portion"
        ? toBase(line.quantity, line.unit, { baseUnit: recipe.netUnit, gramsPerPiece: ing.gramsPerPiece, mlPerGram: ing.mlPerGram ?? 1 })
        : null;
      if (amountInNet === null) yieldKnown = false;
      else summedYield += amountInNet;
    } else if (line.subRecipeId) {
      const sub = ctx.recipe(line.subRecipeId);
      if (!sub) {
        lc = { costCents: null, quantityBase: null, warning: "Unterrezept nicht gefunden." };
        yieldKnown = false;
      } else {
        const sc = costRecipe(sub, ctx, memo, depth + 1);
        const q = line.unit === "portion"
          ? sc.yieldBase !== null ? (line.quantity * sc.yieldBase) / sub.portions : null
          : toBase(line.quantity, line.unit, recipeConvertible(sub));
        if (q === null || sc.perBaseUnitCents === null) {
          lc = { costCents: null, quantityBase: q, warning: `Die Ausbeute von „${sub.name}“ ist unbekannt. Trage dort eine Nettomenge ein.` };
        } else {
          lc = { costCents: q * sc.perBaseUnitCents, quantityBase: q };
          if (sc.missing > 0) lc.warning = `„${sub.name}“ enthält Zeilen ohne Preis.`;
        }
        if (sc.missing > 0 && lc.costCents !== null) missing += 1;
        const inNet = q === null ? null : toBase(q, sub.netUnit, { baseUnit: recipe.netUnit, gramsPerPiece: null, mlPerGram: 1 });
        if (inNet === null) yieldKnown = false;
        else summedYield += inNet;
      }
    } else {
      lc = { costCents: null, quantityBase: null, warning: "Zeile ohne Artikel." };
    }
    if (lc.costCents === null) missing += 1;
    else total += lc.costCents;
    lines.push(lc);
  }

  const yieldBase = recipe.netQuantityBase ?? (yieldKnown && summedYield > 0 ? summedYield : null);
  const result: RecipeCost = {
    totalCents: total,
    perPortionCents: recipe.portions > 0 ? total / recipe.portions : total,
    perBaseUnitCents: yieldBase ? total / yieldBase : null,
    yieldBase,
    missing,
    lines,
  };
  memo.set(recipe.id, result);
  return result;
}

/** Food cost as basis points of the net sell price. */
export function foodCostBp(costCents: number, sellPriceCents: number | null, includesVat: boolean, vatBp: number): number | null {
  if (!sellPriceCents) return null;
  const net = includesVat ? sellPriceCents / (1 + vatBp / 10000) : sellPriceCents;
  return Math.round((costCents / net) * 10000);
}

export function netPrice(sellPriceCents: number, includesVat: boolean, vatBp: number): number {
  return includesVat ? sellPriceCents / (1 + vatBp / 10000) : sellPriceCents;
}
