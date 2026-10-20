// Data layer. Every function here has the signature the Supabase version will have:
// async, takes the session, enforces the same rules as the RLS policies in schema.sql.
import "server-only";
import { type AllergenMap, rollUp } from "@/domain/allergens";
import { type CostContext, type CostIngredient, type CostRecipe, type RecipeCost, costPerBaseUnit, costRecipe, foodCostBp } from "@/domain/costing";
import { suggestPacks } from "@/domain/stock";
import { type BaseUnit } from "@/domain/units";
import { Forbidden, canAccessOutlet, canEditLibrary, canManageTeam } from "./session";
import { addMovement, db, newId, now } from "./store";
import type {
  AllergenRow, Ingredient, Nutrition, Package, PurchaseOrder, Recipe, RecipeLine, Session, StockEvent, StockItem, Supplier,
} from "./types";

const visible = <T extends { archivedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.archivedAt);
const assertEditor = (s: Session) => {
  if (!canEditLibrary(s.role)) throw new Forbidden();
};
const assertOutlet = (s: Session, outletId: string) => {
  if (!canAccessOutlet(s, outletId)) throw new Forbidden("Kein Zugriff auf dieses Outlet.");
};

// ---------------------------------------------------------------- library & team

export async function getLibrary() {
  return db().library;
}

export async function updateLibrary(s: Session, patch: { name: string; defaultVatBp: number; wageCentsPerHour: number | null }) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  Object.assign(db().library, patch);
}

export async function listOutlets(s: Session) {
  return visible(db().outlets).filter((o) => canAccessOutlet(s, o.id));
}

export async function createOutlet(s: Session, name: string, isCentralKitchen: boolean) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  const d = db();
  if (d.outlets.some((o) => o.name.toLowerCase() === name.toLowerCase())) throw new Error("Ein Outlet mit diesem Namen gibt es schon.");
  const id = newId("out");
  d.outlets.push({ id, libraryId: d.library.id, name, isCentralKitchen, timezone: "Europe/Berlin", archivedAt: null });
  for (const i of d.ingredients) d.outletIngredients.push({ outletId: id, ingredientId: i.id, parLevelBase: null, minLevelBase: null });
  return id;
}

export async function listMembers(s: Session) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  return db().members;
}

export async function inviteMember(s: Session, input: { name: string; email: string; role: Session["role"]; outletIds: string[] }) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  const d = db();
  if (d.members.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) throw new Error("Diese E-Mail-Adresse ist schon im Team.");
  d.members.push({ id: newId("mem"), userId: newId("usr"), name: input.name, email: input.email, role: input.role, allOutlets: input.outletIds.length === 0, outletIds: input.outletIds });
}

export async function listCategories(kind: "ingredient" | "recipe") {
  return db().categories.filter((c) => c.kind === kind);
}

// ---------------------------------------------------------------- costing context

function preferredItem(ingredientId: string): StockItem | undefined {
  const items = visible(db().stockItems).filter((x) => x.ingredientId === ingredientId);
  return items.find((x) => x.isPreferred) ?? items[0];
}

function toCostIngredient(i: Ingredient): CostIngredient {
  const si = preferredItem(i.id);
  const pack = si && db().packages.find((p) => p.id === si.packageId);
  let price: CostIngredient["price"] = null;
  if (si && si.priceType === "per_pack" && pack) price = { type: "per_pack", priceCents: si.priceCents, packQuantityBase: pack.quantityBase };
  if (si && si.priceType === "per_unit" && si.priceUnitQuantity) price = { type: "per_unit", priceCents: si.priceCents, unitQuantityBase: si.priceUnitQuantity };
  return { id: i.id, name: i.name, baseUnit: i.baseUnit, gramsPerPiece: i.gramsPerPiece, mlPerGram: i.mlPerGram, price };
}

const toCostRecipe = (r: Pick<Recipe, "id" | "name" | "portions" | "netQuantityBase" | "netUnit" | "lines">): CostRecipe => ({
  id: r.id, name: r.name, portions: r.portions, netQuantityBase: r.netQuantityBase, netUnit: r.netUnit,
  lines: [...r.lines].sort((a, b) => a.position - b.position).map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, unit: l.unit })),
});

function costContext(override?: CostRecipe): CostContext {
  const d = db();
  return {
    ingredient: (id) => {
      const i = d.ingredients.find((x) => x.id === id);
      return i && toCostIngredient(i);
    },
    recipe: (id) => {
      if (override && override.id === id) return override;
      const r = d.recipes.find((x) => x.id === id);
      return r && toCostRecipe(r);
    },
  };
}

function recipeAllergens(r: Pick<Recipe, "lines" | "extraAllergens">, seen = new Set<string>()): AllergenMap {
  const d = db();
  const parts: AllergenMap[] = r.lines.map((l) => {
    if (l.ingredientId) return d.allergens[l.ingredientId] ?? {};
    const sub = l.subRecipeId && d.recipes.find((x) => x.id === l.subRecipeId);
    if (!sub || seen.has(sub.id)) return {};
    return recipeAllergens(sub, new Set([...seen, sub.id]));
  });
  return rollUp(parts, r.extraAllergens);
}

// ---------------------------------------------------------------- ingredients

export type IngredientFilter = { q?: string; categoryId?: string; supplierId?: string; unverified?: boolean };

export async function listIngredients(_s: Session, f: IngredientFilter = {}) {
  const d = db();
  const q = f.q?.trim().toLowerCase();
  return visible(d.ingredients)
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.internalUid?.toLowerCase().includes(q))
    .filter((i) => !f.categoryId || i.categoryId === f.categoryId)
    .filter((i) => !f.supplierId || d.stockItems.some((x) => x.ingredientId === i.id && x.supplierId === f.supplierId && !x.archivedAt))
    .filter((i) => !f.unverified || !d.verified[i.id])
    .map((i) => {
      const si = preferredItem(i.id);
      return {
        id: i.id,
        name: i.name,
        category: d.categories.find((c) => c.id === i.categoryId)?.name ?? "–",
        supplier: si ? d.suppliers.find((x) => x.id === si.supplierId)?.companyName ?? "–" : "–",
        baseUnit: i.baseUnit,
        costPerBaseCents: costPerBaseUnit(toCostIngredient(i)),
        allergensVerified: !!d.verified[i.id],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function getIngredient(_s: Session, id: string) {
  const d = db();
  const ingredient = d.ingredients.find((i) => i.id === id);
  if (!ingredient) return null;
  const packages = d.packages.filter((p) => p.ingredientId === id);
  const stockItems = visible(d.stockItems).filter((x) => x.ingredientId === id).map((x) => ({
    ...x,
    supplier: d.suppliers.find((s) => s.id === x.supplierId)?.companyName ?? "–",
    packageLabel: packages.find((p) => p.id === x.packageId)?.label ?? "–",
  }));
  const usedIn = d.recipes.filter((r) => !r.archivedAt && r.lines.some((l) => l.ingredientId === id)).map((r) => ({ id: r.id, name: r.name }));
  return {
    ingredient,
    packages,
    stockItems,
    costPerBaseCents: costPerBaseUnit(toCostIngredient(ingredient)),
    allergens: d.allergens[id] ?? {},
    verified: !!d.verified[id],
    nutrition: d.nutrition[id] ?? null,
    usedIn,
  };
}

export type IngredientInput = Pick<Ingredient, "name" | "shortName" | "internalUid" | "categoryId" | "baseUnit" | "gramsPerPiece" | "mlPerGram"> & { id?: string };

export async function saveIngredient(s: Session, input: IngredientInput): Promise<string> {
  assertEditor(s);
  const d = db();
  const dupName = d.ingredients.find((i) => !i.archivedAt && i.id !== input.id && i.name.toLowerCase() === input.name.toLowerCase());
  if (dupName) throw new Error(`Es gibt schon eine Zutat „${dupName.name}“.`);
  if (input.internalUid && d.ingredients.some((i) => i.id !== input.id && i.internalUid === input.internalUid)) {
    throw new Error("Diese interne Nummer ist schon vergeben.");
  }
  if (input.id) {
    const row = d.ingredients.find((i) => i.id === input.id);
    if (!row) throw new Error("Zutat nicht gefunden.");
    Object.assign(row, input, { updatedAt: now() });
    return row.id;
  }
  const id = newId("ing");
  d.ingredients.push({ ...input, id, libraryId: d.library.id, allergensVerified: false, archivedAt: null, updatedAt: now() });
  d.allergens[id] = {};
  d.verified[id] = false;
  for (const o of d.outlets) d.outletIngredients.push({ outletId: o.id, ingredientId: id, parLevelBase: null, minLevelBase: null });
  return id;
}

export async function archiveIngredient(s: Session, id: string) {
  assertEditor(s);
  const used = db().recipes.filter((r) => !r.archivedAt && r.lines.some((l) => l.ingredientId === id));
  if (used.length) throw new Error(`Wird noch in ${used.length} Rezept(en) verwendet: ${used.map((r) => r.name).join(", ")}.`);
  const row = db().ingredients.find((i) => i.id === id);
  if (row) row.archivedAt = now();
}

export async function savePackage(s: Session, input: Omit<Package, "id"> & { id?: string }): Promise<string> {
  assertEditor(s);
  const d = db();
  if (input.id) {
    Object.assign(d.packages.find((p) => p.id === input.id)!, input);
    return input.id;
  }
  const id = newId("pk");
  d.packages.push({ ...input, id });
  return id;
}

export async function deletePackage(s: Session, id: string) {
  assertEditor(s);
  const d = db();
  if (d.stockItems.some((x) => x.packageId === id && !x.archivedAt)) throw new Error("Ein Lieferantenartikel nutzt dieses Gebinde.");
  if (d.packages.some((p) => p.parentPackageId === id)) throw new Error("Ein anderes Gebinde baut auf diesem auf.");
  d.packages = d.packages.filter((p) => p.id !== id);
}

export type StockItemInput = Pick<StockItem, "ingredientId" | "supplierId" | "packageId" | "priceType" | "priceCents" | "priceUnit" | "priceUnitQuantity" | "isPreferred" | "supplierSku" | "gtin" | "weighted"> & { id?: string };

export async function saveStockItem(s: Session, input: StockItemInput): Promise<string> {
  assertEditor(s);
  const d = db();
  const ing = d.ingredients.find((i) => i.id === input.ingredientId)!;
  const pack = d.packages.find((p) => p.id === input.packageId)!;
  const name = `${ing.name}, ${pack.label}`;
  if (input.isPreferred) d.stockItems.filter((x) => x.ingredientId === input.ingredientId).forEach((x) => (x.isPreferred = false));
  if (input.id) {
    Object.assign(d.stockItems.find((x) => x.id === input.id)!, input, { name });
    return input.id;
  }
  const id = newId("si");
  const first = !d.stockItems.some((x) => x.ingredientId === input.ingredientId && !x.archivedAt);
  d.stockItems.push({ ...input, id, name, isPreferred: input.isPreferred || first, archivedAt: null });
  return id;
}

export async function archiveStockItem(s: Session, id: string) {
  assertEditor(s);
  const row = db().stockItems.find((x) => x.id === id);
  if (row) {
    row.archivedAt = now();
    row.isPreferred = false;
  }
}

export async function setIngredientAllergens(s: Session, id: string, map: AllergenRow, verified: boolean) {
  assertEditor(s);
  db().allergens[id] = map;
  db().verified[id] = verified;
}

export async function setNutrition(s: Session, id: string, n: Nutrition) {
  assertEditor(s);
  db().nutrition[id] = n;
}

// ---------------------------------------------------------------- suppliers

export async function listSuppliers(_s: Session) {
  const d = db();
  return visible(d.suppliers)
    .map((x) => ({ ...x, itemCount: visible(d.stockItems).filter((i) => i.supplierId === x.id).length }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "de"));
}

export async function getSupplier(_s: Session, id: string) {
  const d = db();
  const supplier = d.suppliers.find((x) => x.id === id);
  if (!supplier) return null;
  const items = visible(d.stockItems).filter((i) => i.supplierId === id).map((i) => ({
    ...i,
    packageLabel: d.packages.find((p) => p.id === i.packageId)?.label ?? "–",
  }));
  return { supplier, items };
}

export type SupplierInput = Pick<Supplier, "companyName" | "email" | "orderEmail" | "phone" | "customerNumber" | "leadTimeDays" | "minOrderCents"> & { id?: string };

export async function saveSupplier(s: Session, input: SupplierInput): Promise<string> {
  assertEditor(s);
  const d = db();
  if (d.suppliers.some((x) => x.id !== input.id && !x.archivedAt && x.companyName.toLowerCase() === input.companyName.toLowerCase())) {
    throw new Error("Einen Lieferanten mit diesem Namen gibt es schon.");
  }
  if (input.id) {
    Object.assign(d.suppliers.find((x) => x.id === input.id)!, input);
    return input.id;
  }
  const id = newId("sup");
  d.suppliers.push({ ...input, id, libraryId: d.library.id, archivedAt: null });
  return id;
}

// ---------------------------------------------------------------- recipes

export async function listRecipes(_s: Session, f: { q?: string; categoryId?: string } = {}) {
  const d = db();
  const q = f.q?.trim().toLowerCase();
  const ctx = costContext();
  const memo = new Map<string, RecipeCost>();
  return visible(d.recipes)
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .filter((r) => !f.categoryId || r.categoryId === f.categoryId)
    .map((r) => {
      const c = costRecipe(toCostRecipe(r), ctx, memo);
      return {
        id: r.id,
        name: r.name,
        category: d.categories.find((c) => c.id === r.categoryId)?.name ?? "–",
        productType: r.productType,
        perPortionCents: c.perPortionCents,
        missing: c.missing,
        foodCostBp: foodCostBp(c.perPortionCents, r.sellPriceCents, r.sellPriceIncludesVat, r.vatBp ?? d.library.defaultVatBp),
        targetFoodCostBp: r.targetFoodCostBp,
        sellPriceCents: r.sellPriceCents,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function getRecipe(_s: Session, id: string) {
  const d = db();
  const recipe = d.recipes.find((r) => r.id === id);
  if (!recipe) return null;
  return { recipe, usedIn: d.recipes.filter((r) => !r.archivedAt && r.lines.some((l) => l.subRecipeId === id)).map((r) => ({ id: r.id, name: r.name })) };
}

/** Options for recipe lines: ingredients plus semi-finished recipes (never the recipe itself). */
export async function lineOptions(_s: Session, excludeRecipeId?: string) {
  const d = db();
  return [
    ...visible(d.ingredients).map((i) => ({ value: i.id, label: i.name, hint: "Zutat", baseUnit: i.baseUnit as BaseUnit })),
    ...visible(d.recipes)
      .filter((r) => r.productType === "semi_finished" && r.id !== excludeRecipeId)
      .map((r) => ({ value: r.id, label: r.name, hint: "Unterrezept", baseUnit: r.netUnit as BaseUnit })),
  ].sort((a, b) => a.label.localeCompare(b.label, "de"));
}

export type RecipeDraft = Pick<Recipe, "name" | "categoryId" | "productType" | "portions" | "netQuantityBase" | "netUnit" | "sellPriceCents" | "sellPriceIncludesVat" | "vatBp" | "targetFoodCostBp" | "prepMinutes" | "instructions" | "extraAllergens"> & {
  id?: string;
  lines: Omit<RecipeLine, "id" | "note">[];
};

/** Cost, food cost and allergens of a recipe as it is being edited, without saving. */
export async function previewRecipe(_s: Session, draft: RecipeDraft) {
  const d = db();
  const id = draft.id ?? "__draft";
  const cr = toCostRecipe({ ...draft, id, lines: draft.lines.map((l, i) => ({ ...l, id: String(i), note: null })) });
  const cost = costRecipe(cr, costContext(cr));
  const vat = draft.vatBp ?? d.library.defaultVatBp;
  const prepCostCents = draft.prepMinutes && d.library.wageCentsPerHour ? (draft.prepMinutes / 60) * d.library.wageCentsPerHour / draft.portions : null;
  return {
    cost,
    foodCostBp: foodCostBp(cost.perPortionCents, draft.sellPriceCents, draft.sellPriceIncludesVat, vat),
    prepCostCents,
    allergens: recipeAllergens({ lines: draft.lines.map((l, i) => ({ ...l, id: String(i), note: null })), extraAllergens: draft.extraAllergens }),
  };
}

function wouldCycle(recipeId: string, lines: RecipeDraft["lines"]): string | null {
  const d = db();
  const stack = lines.filter((l) => l.subRecipeId).map((l) => l.subRecipeId!);
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === recipeId) return id;
    if (seen.has(id)) continue;
    seen.add(id);
    const r = d.recipes.find((x) => x.id === id);
    r?.lines.forEach((l) => l.subRecipeId && stack.push(l.subRecipeId));
  }
  return null;
}

export async function saveRecipe(s: Session, draft: RecipeDraft): Promise<string> {
  assertEditor(s);
  const d = db();
  const id = draft.id ?? newId("rec");
  if (draft.id && wouldCycle(id, draft.lines)) throw new Error("Ein Unterrezept enthält dieses Rezept selbst. Das ergäbe eine Endlosschleife.");
  const lines: RecipeLine[] = draft.lines.map((l, i) => ({ ...l, id: newId("rl"), position: i, note: null }));
  if (draft.id) {
    const row = d.recipes.find((r) => r.id === draft.id);
    if (!row) throw new Error("Rezept nicht gefunden.");
    if (row.productType === "semi_finished" && draft.productType === "finished" && d.recipes.some((r) => r.lines.some((l) => l.subRecipeId === row.id))) {
      throw new Error("Dieses Rezept wird als Unterrezept verwendet und muss halbfertig bleiben.");
    }
    Object.assign(row, draft, { lines, updatedAt: now() });
  } else {
    d.recipes.push({ ...draft, id, libraryId: d.library.id, lines, archivedAt: null, updatedAt: now() });
  }
  return id;
}

export async function archiveRecipe(s: Session, id: string) {
  assertEditor(s);
  const parents = db().recipes.filter((r) => !r.archivedAt && r.lines.some((l) => l.subRecipeId === id));
  if (parents.length) throw new Error(`Wird noch verwendet in: ${parents.map((r) => r.name).join(", ")}.`);
  const row = db().recipes.find((r) => r.id === id);
  if (row) row.archivedAt = now();
}

// ---------------------------------------------------------------- stock

function packOf(si: StockItem) {
  return db().packages.find((p) => p.id === si.packageId)!;
}

/** Cost per base unit of a stock item at its current price. */
function unitCostOf(si: StockItem): number {
  return si.priceType === "per_pack" ? si.priceCents / packOf(si).quantityBase : si.priceCents / (si.priceUnitQuantity || 1);
}

export async function getStock(s: Session, outletId: string, q = "") {
  assertOutlet(s, outletId);
  const d = db();
  const query = q.trim().toLowerCase();
  const visibleIds = new Set(d.outletIngredients.filter((x) => x.outletId === outletId).map((x) => x.ingredientId));
  return visible(d.ingredients)
    .filter((i) => visibleIds.has(i.id) && (!query || i.name.toLowerCase().includes(query)))
    .map((i) => {
      const level = d.levels.find((l) => l.outletId === outletId && l.ingredientId === i.id);
      const oi = d.outletIngredients.find((x) => x.outletId === outletId && x.ingredientId === i.id);
      const qty = level?.quantityBase ?? 0;
      return {
        id: i.id,
        name: i.name,
        baseUnit: i.baseUnit,
        category: d.categories.find((c) => c.id === i.categoryId)?.name ?? "–",
        quantityBase: qty,
        avgCostCents: level?.avgCostCents ?? 0,
        valueCents: Math.max(qty, 0) * (level?.avgCostCents ?? 0),
        minLevelBase: oi?.minLevelBase ?? null,
        belowMin: oi?.minLevelBase != null && qty < oi.minLevelBase,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function listStockEvents(s: Session, outletId: string, type?: StockEvent["type"]) {
  assertOutlet(s, outletId);
  const d = db();
  return d.events
    .filter((e) => e.outletId === outletId && (!type || e.type === type))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((e) => {
      const moves = d.movements.filter((m) => m.eventId === e.id);
      return {
        ...e,
        createdByName: d.members.find((m) => m.userId === e.createdBy)?.name ?? "–",
        valueCents: moves.reduce((sum, m) => sum + m.deltaBase * m.unitCostCents, 0),
        lines: moves.map((m) => ({ ...m, ingredient: d.ingredients.find((i) => i.id === m.ingredientId)?.name ?? "–", baseUnit: d.ingredients.find((i) => i.id === m.ingredientId)?.baseUnit ?? "g" })),
      };
    });
}

export async function recordWaste(s: Session, outletId: string, lines: { ingredientId: string; quantityBase: number; reason: string }[]) {
  assertOutlet(s, outletId);
  if (!lines.length) throw new Error("Mindestens eine Position angeben.");
  const d = db();
  const ev: StockEvent = { id: newId("ev"), outletId, type: "waste", status: "closed", occurredAt: now(), counterpartOutletId: null, purchaseOrderId: null, note: null, createdBy: s.userId, closedAt: now() };
  d.events.push(ev);
  for (const l of lines) addMovement(d, { eventId: ev.id, outletId, ingredientId: l.ingredientId, deltaBase: -l.quantityBase, countedBase: null, reason: l.reason });
  return ev.id;
}

export async function getOpenCount(s: Session, outletId: string) {
  assertOutlet(s, outletId);
  const ev = db().events.find((e) => e.outletId === outletId && e.type === "count" && e.status === "open");
  return ev ? { event: ev, draft: db().countDrafts[ev.id] ?? {} } : null;
}

export async function startCount(s: Session, outletId: string) {
  assertOutlet(s, outletId);
  const d = db();
  if (d.events.some((e) => e.outletId === outletId && e.type === "count" && e.status === "open")) throw new Error("Für dieses Outlet läuft schon eine Inventur.");
  const ev: StockEvent = { id: newId("ev"), outletId, type: "count", status: "open", occurredAt: now(), counterpartOutletId: null, purchaseOrderId: null, note: null, createdBy: s.userId, closedAt: null };
  d.events.push(ev);
  d.countDrafts[ev.id] = {};
  return ev.id;
}

export async function saveCountLines(s: Session, eventId: string, counted: Record<string, number | null>) {
  const d = db();
  const ev = d.events.find((e) => e.id === eventId);
  if (!ev || ev.status !== "open") throw new Error("Diese Inventur ist nicht mehr offen.");
  assertOutlet(s, ev.outletId);
  const draft = (d.countDrafts[eventId] ??= {});
  for (const [ing, qty] of Object.entries(counted)) {
    if (qty === null) delete draft[ing];
    else draft[ing] = qty;
  }
}

/** Book the difference for every counted item. Items not counted keep their stock. */
export async function closeCount(s: Session, eventId: string) {
  const d = db();
  const ev = d.events.find((e) => e.id === eventId);
  if (!ev || ev.status !== "open") throw new Error("Diese Inventur ist nicht mehr offen.");
  assertOutlet(s, ev.outletId);
  const draft = d.countDrafts[eventId] ?? {};
  let changed = 0;
  for (const [ingredientId, counted] of Object.entries(draft)) {
    const level = d.levels.find((l) => l.outletId === ev.outletId && l.ingredientId === ingredientId);
    const delta = counted - (level?.quantityBase ?? 0);
    if (Math.abs(delta) < 1e-9) continue;
    const si = preferredItem(ingredientId);
    addMovement(d, { eventId, outletId: ev.outletId, ingredientId, deltaBase: delta, unitCostCents: level?.avgCostCents || (si ? unitCostOf(si) : 0), countedBase: counted, reason: null });
    changed++;
  }
  ev.status = "closed";
  ev.closedAt = now();
  delete d.countDrafts[eventId];
  return { counted: Object.keys(draft).length, changed };
}

// ---------------------------------------------------------------- purchasing

const orderTotal = (o: PurchaseOrder) => o.lines.reduce((sum, l) => sum + l.quantityPacks * l.unitPriceCents, 0);

export async function listOrders(s: Session, outletId: string, tab: "draft" | "open" | "delivered") {
  assertOutlet(s, outletId);
  const d = db();
  const statuses = { draft: ["draft"], open: ["ordered", "partially_delivered"], delivered: ["delivered", "cancelled"] }[tab];
  return d.orders
    .filter((o) => o.outletId === outletId && statuses.includes(o.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({ ...o, supplier: d.suppliers.find((x) => x.id === o.supplierId)?.companyName ?? "–", totalCents: orderTotal(o) }));
}

export async function orderCounts(s: Session, outletId: string) {
  assertOutlet(s, outletId);
  const mine = db().orders.filter((o) => o.outletId === outletId);
  return {
    draft: mine.filter((o) => o.status === "draft").length,
    open: mine.filter((o) => o.status === "ordered" || o.status === "partially_delivered").length,
    delivered: mine.filter((o) => o.status === "delivered" || o.status === "cancelled").length,
  };
}

export async function getOrder(s: Session, id: string) {
  const d = db();
  const order = d.orders.find((o) => o.id === id);
  if (!order) return null;
  assertOutlet(s, order.outletId);
  const supplier = d.suppliers.find((x) => x.id === order.supplierId)!;
  const lines = order.lines.map((l) => {
    const si = d.stockItems.find((x) => x.id === l.stockItemId)!;
    return { ...l, name: si.name, packageLabel: packOf(si).label, weighted: si.weighted, receivedPacks: order.received[l.id] ?? 0 };
  });
  return { order, supplier, lines, totalCents: orderTotal(order), outlet: d.outlets.find((o) => o.id === order.outletId)! };
}

/** Articles a supplier sells that the outlet can see, with stock and a par-level suggestion. */
export async function orderableItems(s: Session, outletId: string, supplierId: string) {
  assertOutlet(s, outletId);
  const d = db();
  const visibleIds = new Set(d.outletIngredients.filter((x) => x.outletId === outletId).map((x) => x.ingredientId));
  const onOrder = (ingredientId: string) =>
    d.orders
      .filter((o) => o.outletId === outletId && (o.status === "ordered" || o.status === "partially_delivered"))
      .flatMap((o) => o.lines.map((l) => ({ l, o })))
      .filter(({ l }) => d.stockItems.find((x) => x.id === l.stockItemId)?.ingredientId === ingredientId)
      .reduce((sum, { l, o }) => {
        const si = d.stockItems.find((x) => x.id === l.stockItemId)!;
        return sum + (l.quantityPacks - (o.received[l.id] ?? 0)) * packOf(si).quantityBase;
      }, 0);
  return visible(d.stockItems)
    .filter((si) => si.supplierId === supplierId && visibleIds.has(si.ingredientId))
    .map((si) => {
      const pack = packOf(si);
      const level = d.levels.find((l) => l.outletId === outletId && l.ingredientId === si.ingredientId);
      const oi = d.outletIngredients.find((x) => x.outletId === outletId && x.ingredientId === si.ingredientId);
      const packPrice = si.priceType === "per_pack" ? si.priceCents : Math.round(unitCostOf(si) * pack.quantityBase);
      return {
        stockItemId: si.id,
        name: si.name,
        baseUnit: d.ingredients.find((i) => i.id === si.ingredientId)!.baseUnit,
        packageLabel: pack.label,
        packPriceCents: packPrice,
        onHandBase: level?.quantityBase ?? 0,
        parLevelBase: oi?.parLevelBase ?? null,
        suggestedPacks: suggestPacks(oi?.parLevelBase ?? null, level?.quantityBase ?? 0, onOrder(si.ingredientId), pack.quantityBase),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function saveOrderDraft(s: Session, input: { id?: string; outletId: string; supplierId: string; expectedDeliveryDate: string | null; note: string | null; lines: { stockItemId: string; quantityPacks: number }[] }) {
  assertOutlet(s, input.outletId);
  const d = db();
  const lines = input.lines.filter((l) => l.quantityPacks > 0).map((l, i) => {
    const si = d.stockItems.find((x) => x.id === l.stockItemId)!;
    const packPrice = si.priceType === "per_pack" ? si.priceCents : Math.round(unitCostOf(si) * packOf(si).quantityBase);
    return { id: newId(`pol${i}`), stockItemId: l.stockItemId, quantityPacks: l.quantityPacks, unitPriceCents: packPrice };
  });
  if (!lines.length) throw new Error("Die Bestellung hat keine Positionen.");
  if (input.id) {
    const o = d.orders.find((x) => x.id === input.id);
    if (!o || o.status !== "draft") throw new Error("Nur Entwürfe können geändert werden.");
    Object.assign(o, { supplierId: input.supplierId, expectedDeliveryDate: input.expectedDeliveryDate, note: input.note, lines });
    return o.id;
  }
  const id = newId("po");
  d.orders.push({
    id, outletId: input.outletId, supplierId: input.supplierId, orderNumber: `B-${String(++d.seq).padStart(4, "0")}`, status: "draft",
    orderedAt: null, expectedDeliveryDate: input.expectedDeliveryDate, note: input.note, lines, received: {}, createdAt: now(),
  });
  return id;
}

/** Marks the order as sent. The e-mail to the supplier is sent by the backend (Resend); here it is only recorded. */
export async function sendOrder(s: Session, id: string) {
  const d = db();
  const o = d.orders.find((x) => x.id === id);
  if (!o) throw new Error("Bestellung nicht gefunden.");
  assertOutlet(s, o.outletId);
  if (o.status !== "draft") return { alreadySent: true, to: null };
  const supplier = d.suppliers.find((x) => x.id === o.supplierId)!;
  o.status = "ordered";
  o.orderedAt = now();
  return { alreadySent: false, to: supplier.orderEmail };
}

export async function deleteOrderDraft(s: Session, id: string) {
  const d = db();
  const o = d.orders.find((x) => x.id === id);
  if (!o) return;
  assertOutlet(s, o.outletId);
  if (o.status !== "draft") throw new Error("Nur Entwürfe können gelöscht werden.");
  d.orders = d.orders.filter((x) => x.id !== id);
}

export async function receiveDelivery(s: Session, id: string, input: { lines: { lineId: string; packs: number; weightBase?: number | null }[]; addToStock: boolean }) {
  const d = db();
  const o = d.orders.find((x) => x.id === id);
  if (!o) throw new Error("Bestellung nicht gefunden.");
  assertOutlet(s, o.outletId);
  if (o.status !== "ordered" && o.status !== "partially_delivered") throw new Error("Diese Bestellung erwartet keine Lieferung.");
  const received = input.lines.filter((l) => l.packs > 0 || (l.weightBase ?? 0) > 0);
  if (!received.length) throw new Error("Es wurde nichts als geliefert eingetragen.");
  for (const r of received) {
    const line = o.lines.find((l) => l.id === r.lineId);
    if (!line) throw new Error("Unbekannte Position.");
    const open = line.quantityPacks - (o.received[line.id] ?? 0);
    if (r.packs > open + 1e-9) {
      const si = d.stockItems.find((x) => x.id === line.stockItemId)!;
      throw new Error(`„${si.name}“: ${r.packs} geliefert, offen sind nur ${open}. Mehrlieferungen bitte als eigene Position erfassen.`);
    }
  }
  const ev: StockEvent = { id: newId("ev"), outletId: o.outletId, type: "delivery", status: "closed", occurredAt: now(), counterpartOutletId: null, purchaseOrderId: o.id, note: input.addToStock ? null : "Ohne Lagerbuchung", createdBy: s.userId, closedAt: now() };
  d.events.push(ev);
  for (const r of received) {
    const line = o.lines.find((l) => l.id === r.lineId)!;
    const si = d.stockItems.find((x) => x.id === line.stockItemId)!;
    const pack = packOf(si);
    o.received[line.id] = (o.received[line.id] ?? 0) + r.packs;
    if (input.addToStock) {
      // Weighted articles are booked at the weighed quantity and their per-kg price; the rest at pack price.
      const weighed = si.weighted && r.weightBase ? r.weightBase : null;
      const base = weighed ?? r.packs * pack.quantityBase;
      const cost = weighed ? unitCostOf(si) : (r.packs * line.unitPriceCents) / (base || 1);
      addMovement(d, { eventId: ev.id, outletId: o.outletId, ingredientId: si.ingredientId, deltaBase: base, unitCostCents: cost, countedBase: null, reason: null });
    }
  }
  const complete = o.lines.every((l) => (o.received[l.id] ?? 0) >= l.quantityPacks);
  o.status = complete ? "delivered" : "partially_delivered";
  return { status: o.status };
}

// ---------------------------------------------------------------- dashboard

export async function dashboard(s: Session, outletId: string) {
  const stock = await getStock(s, outletId);
  const recipes = await listRecipes(s);
  const priced = recipes.filter((r) => r.foodCostBp !== null && r.productType === "finished");
  const avgFoodCost = priced.length ? Math.round(priced.reduce((sum, r) => sum + r.foodCostBp!, 0) / priced.length) : null;
  const counts = await orderCounts(s, outletId);
  const d = db();
  const since = Date.now() - 7 * 86400000;
  const wasteCents = d.movements
    .filter((m) => m.outletId === outletId && d.events.find((e) => e.id === m.eventId)?.type === "waste" && Date.parse(d.events.find((e) => e.id === m.eventId)!.occurredAt) >= since)
    .reduce((sum, m) => sum - m.deltaBase * m.unitCostCents, 0);
  return {
    stockValueCents: stock.reduce((sum, r) => sum + r.valueCents, 0),
    belowMin: stock.filter((r) => r.belowMin),
    avgFoodCostBp: avgFoodCost,
    overTarget: priced.filter((r) => r.targetFoodCostBp !== null && r.foodCostBp! > r.targetFoodCostBp),
    missingPrices: recipes.filter((r) => r.missing > 0),
    openOrders: counts.open,
    draftOrders: counts.draft,
    wasteCents,
  };
}
