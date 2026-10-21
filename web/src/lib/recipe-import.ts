// Imports recipes through the same repo functions the editor uses, so rights and validation are the same as typing.
import "server-only";
import * as repo from "@/data/repo";
import type { Session } from "@/data/types";
import { type ImportRecipe, type PlannedRecipe, planRecipeImport, saveOrder } from "@/domain/recipe-import";

async function snapshot(s: Session) {
  const [ingredients, recipes] = await Promise.all([repo.listIngredients(s), repo.listRecipes(s)]);
  return { ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit })), recipes: recipes.map((r) => ({ id: r.id, name: r.name })) };
}

export async function planRecipes(s: Session, recipes: ImportRecipe[], createIngredients: boolean): Promise<PlannedRecipe[]> {
  return planRecipeImport(recipes, await snapshot(s), createIngredients);
}

/** Saves every new recipe without errors; sub-recipes from the file first. A failing recipe is reported, the rest continues. */
export async function applyRecipes(s: Session, recipes: ImportRecipe[], createIngredients: boolean) {
  const planned = planRecipeImport(recipes, await snapshot(s), createIngredients);
  const categories = await repo.listCategories(s, "recipe");
  const savedIds = new Map<string, string>();
  const createdIngredients = new Map<string, string>();
  const done = { recipes: 0, ingredients: 0, skipped: planned.filter((p) => p.status === "exists").length, errors: [] as { row: number; message: string }[] };
  for (const p of planned.filter((x) => x.status === "error")) done.errors.push({ row: p.row, message: `${p.name}: ${p.message}` });
  for (const p of saveOrder(planned)) {
    try {
      const lines = [];
      for (const [position, l] of p.lines.entries()) {
        let ingredientId: string | null = null;
        let subRecipeId: string | null = null;
        if (l.kind === "ingredient") ingredientId = l.ingredientId;
        else if (l.kind === "recipe") subRecipeId = l.recipeId;
        else if (l.kind === "file_recipe") {
          subRecipeId = savedIds.get(l.recipeName.toLocaleLowerCase("de")) ?? null;
          if (!subRecipeId) throw new Error(`Grundrezept „${l.recipeName}“ wurde nicht gespeichert.`);
        } else {
          const key = l.name.toLocaleLowerCase("de");
          ingredientId = createdIngredients.get(key) ?? null;
          if (!ingredientId) {
            ingredientId = await repo.saveIngredient(s, { name: l.name, shortName: null, internalUid: null, categoryId: null, baseUnit: l.baseUnit, gramsPerPiece: null, mlPerGram: null });
            createdIngredients.set(key, ingredientId);
            done.ingredients++;
          }
        }
        lines.push({ ingredientId, subRecipeId, quantity: l.quantity, unit: l.unit, position });
      }
      const id = await repo.saveRecipe(s, {
        name: p.name, categoryId: p.category ? categories.find((c) => c.name.toLocaleLowerCase("de") === p.category!.toLocaleLowerCase("de"))?.id ?? null : null,
        productType: p.semiFinished ? "semi_finished" : "finished", portions: p.portions, netQuantityBase: null, netUnit: "g",
        sellPriceCents: p.sellPriceCents, sellPriceIncludesVat: true, vatBp: null, targetFoodCostBp: null, prepMinutes: null,
        instructions: p.instructions, extraAllergens: {}, lines,
      });
      savedIds.set(p.name.toLocaleLowerCase("de"), id);
      done.recipes++;
    } catch (e) {
      done.errors.push({ row: p.row, message: `${p.name}: ${e instanceof Error ? e.message : "konnte nicht gespeichert werden."}` });
    }
  }
  return done;
}
