// Imports a supplier price list through the same repo functions the editor uses, so rights, validation and
// price history behave exactly as when typing prices by hand. Backend-agnostic (memory or Postgres).
import "server-only";
import * as repo from "@/data/repo";
import type { Session } from "@/data/types";
import { type PlanRow, type PriceRow, type Snapshot, planPriceList } from "@/domain/price-list";

async function snapshot(s: Session, rows: PriceRow[]): Promise<Snapshot> {
  const ingredients = (await repo.listIngredients(s)).map((i) => ({ id: i.id, name: i.name, baseUnit: i.baseUnit }));
  const wanted = new Set(rows.map((r) => r.ingredient.toLocaleLowerCase("de")));
  const snap: Snapshot = { ingredients, packages: new Map(), items: new Map() };
  for (const i of ingredients.filter((x) => wanted.has(x.name.toLocaleLowerCase("de")))) {
    const d = await repo.getIngredient(s, i.id);
    if (!d) continue;
    snap.packages.set(i.id, d.packages.map((p) => ({ id: p.id, label: p.label, quantityBase: p.quantityBase })));
    snap.items.set(i.id, d.stockItems.map((x) => ({ id: x.id, supplierId: x.supplierId, packageId: x.packageId, priceType: x.priceType, priceCents: x.priceCents, priceUnitQuantity: x.priceUnitQuantity })));
  }
  return snap;
}

export async function planImport(s: Session, supplierId: string, rows: PriceRow[]): Promise<PlanRow[]> {
  return planPriceList(rows, supplierId, await snapshot(s, rows));
}

/** Applies a fresh plan. Returns what was done; a failing row is reported and the rest continues. */
export async function applyImport(s: Session, supplierId: string, rows: PriceRow[]) {
  const plan = await planImport(s, supplierId, rows);
  const categories = await repo.listCategories(s, "ingredient");
  const done = { ingredients: 0, prices: 0, changed: 0, same: 0 };
  const errors: { row: number; message: string }[] = plan.filter((p) => p.kind === "error").map((p) => ({ row: p.row, message: p.message! }));
  for (const p of plan) {
    if (p.kind === "error") continue;
    if (p.kind === "same") { done.same++; continue; }
    try {
      let ingredientId = p.ingredientId;
      if (!ingredientId) {
        const categoryId = p.category ? categories.find((c) => c.name.toLocaleLowerCase("de") === p.category!.toLocaleLowerCase("de"))?.id ?? null : null;
        ingredientId = await repo.saveIngredient(s, { name: p.ingredient, shortName: null, internalUid: null, categoryId, baseUnit: p.baseUnit, gramsPerPiece: null, mlPerGram: null });
        done.ingredients++;
      }
      const packageId = p.packageId ?? await repo.savePackage(s, { ingredientId, parentPackageId: null, count: 1, quantityBase: p.packBase, label: p.packLabel });
      const existing = p.itemId ? (await repo.getIngredient(s, ingredientId))?.stockItems.find((x) => x.id === p.itemId) : undefined;
      await repo.saveStockItem(s, {
        id: p.itemId, ingredientId, supplierId, packageId,
        priceType: p.perUnitBase ? "per_unit" : "per_pack", priceCents: p.priceCents,
        priceUnit: p.perUnitBase ? p.baseUnit : null, priceUnitQuantity: p.perUnitBase,
        isPreferred: existing?.isPreferred ?? false, supplierSku: p.sku ?? existing?.supplierSku ?? null, gtin: existing?.gtin ?? null, weighted: existing?.weighted ?? false,
      });
      if (p.kind === "changed") done.changed++;
      else done.prices++;
    } catch (e) {
      errors.push({ row: p.row, message: e instanceof Error ? e.message : "Konnte nicht gespeichert werden." });
    }
  }
  return { ...done, errors };
}
