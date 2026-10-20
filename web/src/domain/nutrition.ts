// Nutrition of a recipe from its ingredients' values per 100 g (per 100 ml for liquids), through all sub-recipes.
import { type CostContext, costRecipe } from "./costing";
import { billOfMaterials } from "./menus";

export const NUTRIENTS = ["energyKcal", "fatG", "saturatedFatG", "carbohydrateG", "sugarsG", "proteinG", "saltG"] as const;
export type Nutrient = (typeof NUTRIENTS)[number];
export type NutritionValues = Record<Nutrient, number | null>;
export type Totals = Record<Nutrient, number>;

export type RecipeNutrition = {
  perBatch: Totals;
  /** Per 100 g (or 100 ml) of the finished recipe; null when the yield is unknown or counted in pieces. */
  per100: Totals | null;
  perPortion: Totals;
  /** Ingredients without values, or in pieces without a weight: the totals are too low by their share. */
  missing: string[];
  /** For the ingredient list on a label: heaviest first, grams per batch (null when unknown). */
  byWeight: { name: string; grams: number | null }[];
};

const zero = (): Totals => Object.fromEntries(NUTRIENTS.map((k) => [k, 0])) as Totals;
const scale = (t: Totals, f: number): Totals => Object.fromEntries(NUTRIENTS.map((k) => [k, t[k] * f])) as Totals;

export function recipeNutrition(recipeId: string, ctx: CostContext, valuesOf: (ingredientId: string) => NutritionValues | undefined): RecipeNutrition | null {
  const recipe = ctx.recipe(recipeId);
  if (!recipe) return null;
  const bom = billOfMaterials({ courses: [{ name: "", items: [{ recipeId, portions: recipe.portions }] }] }, ctx);
  const total = zero();
  const missing: string[] = [];
  const byWeight: RecipeNutrition["byWeight"] = [];
  for (const line of bom.lines) {
    const ing = ctx.ingredient(line.ingredientId);
    // g and ml count as they are (values are per 100 g or per 100 ml); pieces need a weight per piece.
    const amount = line.baseUnit === "piece" ? (ing?.gramsPerPiece ? line.quantityBase * ing.gramsPerPiece : null) : line.quantityBase;
    byWeight.push({ name: line.name, grams: amount });
    const v = valuesOf(line.ingredientId);
    if (amount === null || !v || NUTRIENTS.every((k) => v[k] === null)) {
      missing.push(line.name);
      continue;
    }
    for (const k of NUTRIENTS) total[k] += ((v[k] ?? 0) * amount) / 100;
  }
  if (bom.unknown > 0) missing.push(`${bom.unknown} Zeile(n) ohne Umrechnung`);
  const yieldBase = costRecipe(recipe, ctx).yieldBase;
  return {
    perBatch: total,
    per100: yieldBase && recipe.netUnit !== "piece" ? scale(total, 100 / yieldBase) : null,
    perPortion: scale(total, 1 / (recipe.portions || 1)),
    missing,
    byWeight: byWeight.sort((a, b) => (b.grams ?? -1) - (a.grams ?? -1)),
  };
}
