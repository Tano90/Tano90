// Central kitchen: what a set of requests needs in raw goods, and how a production run's cost is shared out.
import type { CostContext } from "./costing";
import { billOfMaterials } from "./menus";
import type { BaseUnit } from "./units";

export type Need = { ingredientId: string; name: string; baseUnit: BaseUnit; needBase: number; onHandBase: number; shortBase: number };

export function productionNeeds(requests: { recipeId: string; portions: number }[], ctx: CostContext, onHand: (ingredientId: string) => number): { lines: Need[]; unknown: number } {
  const bom = billOfMaterials({ courses: [{ name: "", items: requests }] }, ctx);
  return {
    unknown: bom.unknown,
    lines: bom.lines.map((l) => {
      const have = onHand(l.ingredientId);
      return { ingredientId: l.ingredientId, name: l.name, baseUnit: l.baseUnit, needBase: l.quantityBase, onHandBase: have, shortBase: Math.max(0, l.quantityBase - Math.max(have, 0)) };
    }),
  };
}

/** Splits what a run actually cost by each request's planned cost (by portions when nothing has a price). */
export function shareCost(totalCents: number, plans: { id: string; plannedCents: number; portions: number }[]): Record<string, number> {
  const planned = plans.reduce((t, p) => t + p.plannedCents, 0);
  const portions = plans.reduce((t, p) => t + p.portions, 0);
  return Object.fromEntries(plans.map((p) => [p.id, planned > 0 ? (totalCents * p.plannedCents) / planned : portions > 0 ? (totalCents * p.portions) / portions : 0]));
}
