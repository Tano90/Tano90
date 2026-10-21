// Data layer. Every function here has the signature the Supabase version will have:
// async, takes the session, enforces the same rules as the RLS policies in supabase/migrations/0001_schema.sql.
import "server-only";
import { type AllergenMap, rollUp } from "@/domain/allergens";
import { type CostContext, type CostIngredient, type CostRecipe, type RecipeCost, costPerBaseUnit, costRecipe, foodCostBp, netPrice } from "@/domain/costing";
import { evaluate } from "@/domain/haccp";
import { matchInvoice } from "@/domain/invoice";
import { productionNeeds, shareCost } from "@/domain/production";
import { classifyDishes } from "@/domain/menu-engineering";
import { billOfMaterials, summarizeMenu } from "@/domain/menus";
import { recipeNutrition } from "@/domain/nutrition";
import { type CountBreakdown, ORDER_RESERVE_PCT, countTotal, forecastUse, orderCoverDays, stockReport, suggestFromUse, suggestPacks, suggestWeight, weekdayUsage } from "@/domain/stock";
import { hashKey, newApiKey } from "@/lib/api-key";
import { accessOf } from "@/domain/access";
import { addDays, dayIn, startOfDay } from "@/lib/dates";
import type { CostSetup, FixedCost, FixedCostInput, FunnelDayInput, FunnelSetup } from "./cost-types";
import { type StepSetting, defaultSteps } from "@/domain/funnel";
import type { EInvoiceSave, InvoiceListRow } from "./finance-types";
import { countOf } from "@/lib/format";
import { gtinKey } from "@/lib/gtin";
import type { SaleInput } from "@/domain/pos";
import { type BaseUnit } from "@/domain/units";
import { Forbidden, assertCanChangeMember, canAccessOutlet, canEditLibrary, canManageTeam } from "./session-rules";
import { addMovement, db, newId, now } from "./store";
import type {
  AllergenRow, Category, CountEntry, HaccpItem, Room, Ingredient, Menu, Nutrition, Package, PurchaseOrder, Recipe, RecipeLine, Session, StockEvent, StockItem, Supplier,
} from "./types";

const visible = <T extends { archivedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.archivedAt);
const assertEditor = (s: Session) => {
  if (!canEditLibrary(s.role)) throw new Forbidden();
};
const assertOutlet = (s: Session, outletId: string) => {
  if (!canAccessOutlet(s, outletId)) throw new Forbidden("Kein Zugriff auf dieses Outlet.");
};

// ---------------------------------------------------------------- session & accounts

export async function getMembership(userId: string): Promise<Session | null> {
  const m = db().members.find((x) => x.userId === userId);
  if (!m) return null;
  return { userId: m.userId, name: m.name, email: m.email, role: m.role, libraryId: db().library.id, outletIds: m.allOutlets || m.role === "owner" || m.role === "admin" ? "all" : m.outletIds };
}

/** Demo login only: seeded users are found by email. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  return db().members.find((x) => x.email.toLowerCase() === email.toLowerCase())?.userId ?? null;
}

export async function createLibrary(_userId: string, _input: { libraryName: string; outletName: string; ownerName: string }): Promise<string> {
  throw new Error("Neue Betriebe brauchen die Datenbank (DATABASE_URL).");
}

export async function invitationPreview(_token: string): Promise<{ libraryName: string; email: string; role: Session["role"]; expired: boolean } | null> {
  return null;
}

export async function acceptInvitation(_userId: string, _token: string, _name: string): Promise<string> {
  throw new Error("Einladungen brauchen die Datenbank (DATABASE_URL).");
}

/** Removes the user's memberships; deletes the library if they were its only member. Returns false if they are the owner of a team. */
export async function deleteAccountData(_userId: string): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: "Im Demo-Modus können Konten nicht gelöscht werden." };
}

export type Billing = { plan: "trial" | "active" | "past_due" | "cancelled"; subscriptionStatus: string | null; trialEndsAt: string | null; currentPeriodEnd: string | null; stripeCustomerId: string | null; stripeSubscriptionId: string | null };

export async function getBilling(_s: Session): Promise<Billing> {
  return { plan: "trial", subscriptionStatus: null, trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(), currentPeriodEnd: null, stripeCustomerId: null, stripeSubscriptionId: null };
}

// ---------------------------------------------------------------- library & team

export async function getLibrary(_s: Session) {
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

export async function archiveOutlet(s: Session, outletId: string) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  const d = db();
  const o = visible(d.outlets).find((x) => x.id === outletId);
  if (!o) throw new Error("Outlet nicht gefunden.");
  if (visible(d.outlets).length <= 1) throw new Error("Das letzte Outlet lässt sich nicht archivieren.");
  const orders = d.orders.filter((x) => x.outletId === outletId && ["draft", "ordered", "partially_delivered"].includes(x.status)).length;
  if (orders) throw new Error(`${countOf(orders, "Bestellung ist", "Bestellungen sind")} noch offen (auch Entwürfe). Erst liefern lassen, stornieren oder löschen.`);
  if (d.events.some((e) => e.outletId === outletId && e.type === "count" && e.status === "open")) throw new Error("Hier läuft noch eine Inventur. Erst abschließen oder verwerfen.");
  const requests = d.production.filter((p) => (p.fromOutletId === outletId || p.kitchenOutletId === outletId) && (p.status === "requested" || p.status === "produced")).length;
  if (requests) throw new Error(`${countOf(requests, "Anforderung", "Anforderungen")} der Zentralküche ${requests === 1 ? "ist" : "sind"} noch offen.`);
  const live = new Set(visible(d.outlets).filter((x) => x.id !== outletId).map((x) => x.id));
  const stranded = d.members.filter((m) => m.role !== "owner" && m.role !== "admin" && !m.allOutlets && m.outletIds.includes(outletId) && !m.outletIds.some((id) => live.has(id)));
  if (stranded.length) throw new Error(`Nur diesem Outlet zugeordnet: ${stranded.map((m) => m.name).join(", ")}. Erst einem anderen Outlet zuordnen oder entfernen.`);
  o.archivedAt = now();
  for (const k of d.apiKeys) if (k.outletId === outletId && !k.revokedAt) k.revokedAt = now();
}

/** The whole demo store is one library; secrets (key hashes) are left out, as in the database export. */
export async function exportLibrary(s: Session): Promise<Record<string, unknown>> {
  if (!canManageTeam(s.role)) throw new Forbidden();
  const { apiKeys, ...rest } = db() as ReturnType<typeof db> & Record<string, unknown>;
  return { ...structuredClone(rest), apiKeys: apiKeys.map(({ keyHash: _, ...k }) => k) };
}












export async function listMembers(s: Session) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  return db().members;
}

/** Memory backend: adds the member directly. Postgres backend: creates an invitation and returns its token. */
export async function inviteMember(s: Session, input: { name: string; email: string; role: Session["role"]; outletIds: string[] }): Promise<{ token: string | null }> {
  if (!canManageTeam(s.role)) throw new Forbidden();
  const d = db();
  if (d.members.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) throw new Error("Diese E-Mail-Adresse ist schon im Team.");
  d.members.push({ id: newId("mem"), userId: newId("usr"), name: input.name, email: input.email, role: input.role, allOutlets: input.outletIds.length === 0, outletIds: input.outletIds });
  return { token: null };
}

export async function updateMember(s: Session, memberId: string, input: { role: Exclude<Session["role"], "owner">; outletIds: string[] }) {
  const d = db();
  const m = d.members.find((x) => x.id === memberId);
  if (!canManageTeam(s.role)) throw new Forbidden();
  if (!m) throw new Error("Teammitglied nicht gefunden.");
  assertCanChangeMember(s, m, { role: input.role }, d.members.filter((x) => x.role === "owner").length);
  m.role = input.role;
  m.allOutlets = input.role !== "outlet_staff";
  m.outletIds = input.role === "outlet_staff" ? input.outletIds : [];
}

export async function removeMember(s: Session, memberId: string) {
  const d = db();
  const m = d.members.find((x) => x.id === memberId);
  if (!m) return;
  assertCanChangeMember(s, m, { remove: true }, d.members.filter((x) => x.role === "owner").length);
  d.members = d.members.filter((x) => x.id !== memberId);
}

/** The owner hands ownership to another member and becomes admin. */
export async function transferOwnership(s: Session, memberId: string) {
  if (s.role !== "owner") throw new Forbidden("Nur der Inhaber kann die Inhaberschaft übertragen.");
  const d = db();
  const target = d.members.find((x) => x.id === memberId);
  const me = d.members.find((x) => x.userId === s.userId);
  if (!target || !me || target.id === me.id) throw new Error("Bitte ein anderes Teammitglied wählen.");
  target.role = "owner";
  target.allOutlets = true;
  target.outletIds = [];
  me.role = "admin";
}

export async function listCategories(_s: Session, kind: Category["kind"]) {
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

export async function getIngredient(s: Session, id: string) {
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
    outlets: visible(d.outlets).filter((o) => canAccessOutlet(s, o.id)).map((o) => ({
      id: o.id, name: o.name,
      carried: d.outletIngredients.some((x) => x.outletId === o.id && x.ingredientId === id),
      onHandBase: d.levels.find((l) => l.outletId === o.id && l.ingredientId === id)?.quantityBase ?? 0,
    })),
  };
}

/** Whether an outlet carries an item (it shows in its stock, counts and orders). Hiding needs zero stock there. */
export async function setOutletCarried(s: Session, ingredientId: string, outletId: string, carried: boolean) {
  assertEditor(s);
  assertOutlet(s, outletId);
  const d = db();
  const idx = d.outletIngredients.findIndex((x) => x.outletId === outletId && x.ingredientId === ingredientId);
  if (carried && idx < 0) d.outletIngredients.push({ outletId, ingredientId, parLevelBase: null, minLevelBase: null });
  if (!carried && idx >= 0) {
    const onHand = d.levels.find((l) => l.outletId === outletId && l.ingredientId === ingredientId)?.quantityBase ?? 0;
    if (Math.abs(onHand) > 1e-9) throw new Error("In diesem Outlet liegt noch Bestand. Erst ausbuchen oder umbuchen, dann ausblenden.");
    d.outletIngredients.splice(idx, 1);
  }
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
  const clash = input.gtin && visible(d.stockItems).find((x) => x.gtin && x.packageId !== input.packageId && gtinKey(x.gtin) === gtinKey(input.gtin!));
  if (clash) throw new Error(`GTIN ${input.gtin} gehört schon zu ${clash.name}. Ein Barcode zählt genau ein Gebinde.`);
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

/**
 * Archive a supplier. Refused while it has drafts or open orders. Its prices are archived too, so no
 * recipe keeps costing with a supplier you no longer buy from; the caller warns how many that is.
 */
export async function archiveSupplier(s: Session, id: string): Promise<{ pricesRemoved: number }> {
  assertEditor(s);
  const d = db();
  const open = d.orders.filter((o) => o.supplierId === id && ["draft", "ordered", "partially_delivered"].includes(o.status));
  if (open.length) throw new Error(`Bei diesem Lieferanten gibt es noch ${open.length} offene Bestellung(en) oder Entwürfe. Erst abschließen oder löschen.`);
  const row = d.suppliers.find((x) => x.id === id);
  if (!row) throw new Error("Lieferant nicht gefunden.");
  row.archivedAt = now();
  const items = d.stockItems.filter((x) => x.supplierId === id && !x.archivedAt);
  for (const si of items) {
    si.archivedAt = now();
    si.isPreferred = false;
  }
  return { pricesRemoved: items.length };
}

// ---------------------------------------------------------------- recipes

/** `outletId`: show that outlet's own sell price where one is set. */
export async function listRecipes(_s: Session, f: { q?: string; categoryId?: string; outletId?: string } = {}) {
  const d = db();
  const q = f.q?.trim().toLowerCase();
  const ctx = costContext();
  const memo = new Map<string, RecipeCost>();
  return visible(d.recipes)
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .filter((r) => !f.categoryId || r.categoryId === f.categoryId)
    .map((r) => {
      const c = costRecipe(toCostRecipe(r), ctx, memo);
      const own = f.outletId ? d.outletPrices.find((p) => p.recipeId === r.id && p.outletId === f.outletId) : undefined;
      const sell = own?.sellPriceCents ?? r.sellPriceCents;
      return {
        id: r.id,
        name: r.name,
        category: d.categories.find((c) => c.id === r.categoryId)?.name ?? "–",
        productType: r.productType,
        perPortionCents: c.perPortionCents,
        missing: c.missing,
        foodCostBp: foodCostBp(c.perPortionCents, sell, r.sellPriceIncludesVat, r.vatBp ?? d.library.defaultVatBp),
        targetFoodCostBp: r.targetFoodCostBp,
        sellPriceCents: sell,
        outletPrice: !!own,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function getRecipe(_s: Session, id: string) {
  const d = db();
  const recipe = d.recipes.find((r) => r.id === id);
  if (!recipe) return null;
  return {
    recipe,
    usedIn: d.recipes.filter((r) => !r.archivedAt && r.lines.some((l) => l.subRecipeId === id)).map((r) => ({ id: r.id, name: r.name })),
    outletPrices: d.outletPrices.filter((p) => p.recipeId === id).map(({ outletId, sellPriceCents }) => ({ outletId, sellPriceCents })),
  };
}

/** What a printed label needs: allergens and nutrition of the recipe, through all sub-recipes. */
export async function getRecipeLabel(_s: Session, id: string) {
  const d = db();
  const recipe = d.recipes.find((r) => r.id === id && !r.archivedAt);
  if (!recipe) return null;
  return {
    name: recipe.name, portions: recipe.portions, netUnit: recipe.netUnit, libraryName: d.library.name,
    allergens: recipeAllergens(recipe),
    nutrition: recipeNutrition(id, costContext(), (ing) => d.nutrition[ing])!,
  };
}

/** An outlet's own sell price for a recipe; null goes back to the recipe's price. */
export async function setRecipeOutletPrice(s: Session, recipeId: string, outletId: string, sellPriceCents: number | null) {
  assertEditor(s);
  const d = db();
  if (!d.recipes.some((r) => r.id === recipeId && !r.archivedAt)) throw new Error("Rezept nicht gefunden.");
  if (!visible(d.outlets).some((o) => o.id === outletId)) throw new Error("Outlet nicht gefunden.");
  d.outletPrices = d.outletPrices.filter((p) => !(p.recipeId === recipeId && p.outletId === outletId));
  if (sellPriceCents !== null) d.outletPrices.push({ recipeId, outletId, sellPriceCents });
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
  const parents = [
    ...db().recipes.filter((r) => !r.archivedAt && r.lines.some((l) => l.subRecipeId === id)),
    ...visible(db().menus).filter((m) => m.courses.some((c) => c.items.some((i) => i.recipeId === id))).map((m) => ({ name: `Menü „${m.name}“` })),
  ];
  if (parents.length) throw new Error(`Wird noch verwendet in: ${parents.map((r) => r.name).join(", ")}.`);
  const row = db().recipes.find((r) => r.id === id);
  if (row) row.archivedAt = now();
}

// ---------------------------------------------------------------- menus

export type MenuDraft = Pick<Menu, "name" | "categoryId" | "priceCents" | "priceIncludesVat" | "vatBp" | "targetMarginBp" | "validFrom" | "validTo"> & {
  id?: string;
  courses: { name: string; items: { recipeId: string; portions: number }[] }[];
};

export async function listMenus(_s: Session, f: { q?: string } = {}) {
  const d = db();
  const q = f.q?.trim().toLowerCase();
  const ctx = costContext();
  const memo = new Map<string, RecipeCost>();
  return visible(d.menus)
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .map((m) => {
      const sum = summarizeMenu(m, ctx, d.library.defaultVatBp, memo);
      return {
        id: m.id, name: m.name, category: d.categories.find((c) => c.id === m.categoryId)?.name ?? "–",
        courses: m.courses.length, dishes: m.courses.reduce((n, c) => n + c.items.length, 0),
        priceCents: m.priceCents, costCents: sum.costCents, missing: sum.missing, foodCostBp: sum.foodCostBp,
        marginBp: sum.marginBp, targetMarginBp: m.targetMarginBp, belowTarget: sum.belowTarget, validTo: m.validTo,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function getMenu(_s: Session, id: string, servings = 1) {
  const d = db();
  const menu = d.menus.find((m) => m.id === id);
  if (!menu) return null;
  const ctx = costContext();
  return { menu, summary: summarizeMenu(menu, ctx, d.library.defaultVatBp), bom: billOfMaterials(menu, ctx, servings) };
}

function assertMenuRecipes(draft: MenuDraft) {
  for (const c of draft.courses) for (const it of c.items) {
    const r = db().recipes.find((x) => x.id === it.recipeId);
    if (!r || r.archivedAt) throw new Error("Ein gewähltes Rezept gibt es nicht mehr.");
  }
}

export async function saveMenu(s: Session, draft: MenuDraft): Promise<string> {
  assertEditor(s);
  assertMenuRecipes(draft);
  const d = db();
  const courses = draft.courses.map((c, p) => ({ id: newId("mc"), name: c.name, position: p, items: c.items.map((it, i) => ({ id: newId("mi"), recipeId: it.recipeId, portions: it.portions, position: i })) }));
  const { id: _, courses: __, ...fields } = draft;
  if (draft.id) {
    const row = d.menus.find((m) => m.id === draft.id && !m.archivedAt);
    if (!row) throw new Error("Menü nicht gefunden.");
    Object.assign(row, fields, { courses, updatedAt: now() });
    return row.id;
  }
  const id = newId("menu");
  d.menus.push({ ...fields, id, libraryId: d.library.id, courses, archivedAt: null, updatedAt: now() });
  return id;
}

export async function archiveMenu(s: Session, id: string) {
  assertEditor(s);
  const row = db().menus.find((m) => m.id === id);
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
        parLevelBase: oi?.parLevelBase ?? null,
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

// ---------------------------------------------------------------- point of sale

export type ImportResult = { imported: number; duplicates: number; depleted: number; unmapped: number };

/** Books the ingredients of linked, not yet booked sales out of stock: one sale event per local day. */
function depletePending(outletId: string, userId: string | null): number {
  const d = db();
  const tz = d.outlets.find((o) => o.id === outletId)?.timezone;
  const items = new Map(d.posItems.filter((p) => p.outletId === outletId && p.recipeId && !p.ignored).map((p) => [p.id, p]));
  const pending = d.sales.filter((x) => x.outletId === outletId && !x.depletedEventId && items.has(x.posItemId));
  const byDay = new Map<string, typeof pending>();
  for (const x of pending) {
    const day = dayIn(tz, new Date(x.soldAt));
    byDay.set(day, [...(byDay.get(day) ?? []), x]);
  }
  const ctx = costContext();
  for (const group of byDay.values()) {
    const bom = billOfMaterials({ courses: [{ name: "", items: group.map((x) => ({ recipeId: items.get(x.posItemId)!.recipeId!, portions: x.quantity })) }] }, ctx);
    const occurredAt = group.map((x) => x.soldAt).sort().at(-1)!;
    const ev: StockEvent = { id: newId("ev"), outletId, type: "sale", status: "closed", occurredAt, counterpartOutletId: null, purchaseOrderId: null, note: `${group.length} Verkäufe`, createdBy: userId, closedAt: now() };
    d.events.push(ev);
    for (const l of bom.lines) {
      if (Math.abs(l.quantityBase) < 1e-9) continue; // a sale and its cancellation on the same day
      // Net cancellations come back at the current average cost, so they do not drag the average down.
      const avg = d.levels.find((x) => x.outletId === outletId && x.ingredientId === l.ingredientId)?.avgCostCents ?? 0;
      addMovement(d, { eventId: ev.id, outletId, ingredientId: l.ingredientId, deltaBase: -l.quantityBase, unitCostCents: avg, countedBase: null, reason: null });
      if (!d.outletIngredients.some((x) => x.outletId === outletId && x.ingredientId === l.ingredientId)) {
        d.outletIngredients.push({ outletId, ingredientId: l.ingredientId, parLevelBase: null, minLevelBase: null });
      }
    }
    for (const x of group) x.depletedEventId = ev.id;
  }
  return pending.length;
}

function importInto(outletId: string, rows: SaleInput[], userId: string | null): ImportResult {
  const d = db();
  let imported = 0;
  let duplicates = 0;
  for (const r of rows) {
    if (d.sales.some((x) => x.outletId === outletId && x.externalId === r.externalId)) { duplicates++; continue; }
    let item = d.posItems.find((p) => p.outletId === outletId && p.plu === r.plu);
    if (!item) {
      item = { id: newId("pos"), outletId, plu: r.plu, name: r.name, recipeId: null, ignored: false };
      d.posItems.push(item);
    }
    d.sales.push({ id: newId("sale"), outletId, posItemId: item.id, externalId: r.externalId, quantity: r.quantity, revenueNetCents: r.revenueNetCents, soldAt: r.soldAt, depletedEventId: null });
    imported++;
  }
  const depleted = depletePending(outletId, userId);
  const unmapped = d.sales.filter((x) => x.outletId === outletId && !x.depletedEventId && !d.posItems.find((p) => p.id === x.posItemId)?.ignored).length;
  return { imported, duplicates, depleted, unmapped };
}

export async function importSales(s: Session, outletId: string, rows: SaleInput[]): Promise<ImportResult> {
  assertOutlet(s, outletId);
  return importInto(outletId, rows, s.userId);
}

/** For the POS API: the key decides library and outlet. Returns null for an unknown or revoked key. */
export async function importSalesWithKey(key: string, rows: SaleInput[]): Promise<ImportResult | "read_only" | null> {
  const k = db().apiKeys.find((x) => x.keyHash === hashKey(key) && !x.revokedAt);
  if (!k || !k.outletId) return null;
  if (accessOf(await getBilling({} as Session)).readOnly) return "read_only";
  k.lastUsedAt = now();
  return importInto(k.outletId, rows, null);
}


export type ProductionInput = { recipeId: string; portions: number; neededOn: string; note: string | null };

const kitchenOf = () => visible(db().outlets).find((o) => o.isCentralKitchen) ?? null;

/** Requests the outlet made, and, for the central kitchen, everything it is asked to produce, with raw needs per day. */
export async function listProduction(s: Session, outletId: string) {
  assertOutlet(s, outletId);
  const d = db();
  const kitchen = kitchenOf();
  const isKitchen = kitchen?.id === outletId;
  const rows = d.production
    .filter((p) => p.fromOutletId === outletId || (isKitchen && p.kitchenOutletId === outletId))
    .map((p) => ({
      ...p,
      fromOutlet: d.outlets.find((o) => o.id === p.fromOutletId)?.name ?? "–",
      recipe: d.recipes.find((r) => r.id === p.recipeId)?.name ?? "–",
    }))
    .sort((a, b) => a.neededOn.localeCompare(b.neededOn) || a.recipe.localeCompare(b.recipe, "de"));
  const needs: Record<string, ReturnType<typeof productionNeeds>> = {};
  if (isKitchen) {
    const level = (id: string) => d.levels.find((l) => l.outletId === outletId && l.ingredientId === id)?.quantityBase ?? 0;
    for (const day of new Set(rows.filter((r) => r.status === "requested" && r.kitchenOutletId === outletId).map((r) => r.neededOn))) {
      needs[day] = productionNeeds(rows.filter((r) => r.status === "requested" && r.neededOn === day), costContext(), level);
    }
  }
  return { kitchen: kitchen && { id: kitchen.id, name: kitchen.name }, isKitchen, requests: rows, needs };
}

export async function requestProduction(s: Session, fromOutletId: string, input: ProductionInput) {
  assertOutlet(s, fromOutletId);
  const d = db();
  const kitchen = kitchenOf();
  if (!kitchen) throw new Error("Kein Outlet ist als Zentralküche markiert.");
  if (input.neededOn < dayIn(d.outlets.find((o) => o.id === fromOutletId)?.timezone)) throw new Error("Der Liefertag liegt in der Vergangenheit.");
  if (!d.recipes.some((r) => r.id === input.recipeId && !r.archivedAt)) throw new Error("Dieses Rezept gibt es nicht mehr.");
  const id = newId("pr");
  d.production.push({ id, fromOutletId, kitchenOutletId: kitchen.id, ...input, status: "requested", productionEventId: null, costCents: null, createdBy: s.userId, createdAt: now(), producedAt: null, deliveredAt: null });
  return id;
}

export async function cancelProductionRequest(s: Session, id: string) {
  const p = db().production.find((x) => x.id === id);
  if (!p) throw new Error("Anforderung nicht gefunden.");
  assertOutlet(s, p.fromOutletId);
  if (p.status !== "requested") throw new Error("Schon produziert, lässt sich nicht mehr stornieren.");
  p.status = "cancelled";
}

/** Produces the given requests in one run: raw goods leave the kitchen's stock, the cost is shared out. */
export async function produce(s: Session, kitchenOutletId: string, ids: string[]) {
  assertOutlet(s, kitchenOutletId);
  const d = db();
  const reqs = d.production.filter((p) => ids.includes(p.id) && p.kitchenOutletId === kitchenOutletId && p.status === "requested");
  if (!reqs.length) throw new Error("Nichts mehr zu produzieren: schon erledigt oder storniert.");
  const ctx = costContext();
  const bom = billOfMaterials({ courses: [{ name: "", items: reqs.map((r) => ({ recipeId: r.recipeId, portions: r.portions })) }] }, ctx);
  const ev: StockEvent = { id: newId("ev"), outletId: kitchenOutletId, type: "production", status: "closed", occurredAt: now(), counterpartOutletId: null, purchaseOrderId: null, note: `${reqs.length} Anforderungen`, createdBy: s.userId, closedAt: now() };
  d.events.push(ev);
  let total = 0;
  for (const l of bom.lines) {
    const m = addMovement(d, { eventId: ev.id, outletId: kitchenOutletId, ingredientId: l.ingredientId, deltaBase: -l.quantityBase, countedBase: null, reason: null });
    total += l.quantityBase * m.unitCostCents;
  }
  const memo = new Map<string, RecipeCost>();
  const share = shareCost(total, reqs.map((r) => {
    const rec = d.recipes.find((x) => x.id === r.recipeId)!;
    return { id: r.id, plannedCents: costRecipe(toCostRecipe(rec), ctx, memo).perPortionCents * r.portions, portions: r.portions };
  }));
  for (const r of reqs) Object.assign(r, { status: "produced", productionEventId: ev.id, costCents: share[r.id], producedAt: now() });
  return reqs.length;
}

export async function deliverProduction(s: Session, kitchenOutletId: string, ids: string[]) {
  assertOutlet(s, kitchenOutletId);
  const reqs = db().production.filter((p) => ids.includes(p.id) && p.kitchenOutletId === kitchenOutletId && p.status === "produced");
  for (const r of reqs) Object.assign(r, { status: "delivered", deliveredAt: now() });
  return reqs.length;
}

export type ChecklistDraft = { id?: string; name: string; items: { id?: string; label: string; kind: HaccpItem["kind"]; minValue: number | null; maxValue: number | null }[] };
export type HaccpEntry = { itemId: string; value: string; action: string | null };

/** Checks every entry against its control point; a value out of limits needs a corrective action. */
function readEntries(items: HaccpItem[], entries: HaccpEntry[]) {
  return entries.map((e) => {
    const item = items.find((i) => i.id === e.itemId);
    if (!item) throw new Error("Diesen Kontrollpunkt gibt es nicht mehr. Bitte neu laden.");
    const r = evaluate(item, e.value);
    if (!r) return null;
    if (!r.ok && !e.action?.trim()) throw new Error(`„${item.label}“: ${r.reason} Bitte die Korrekturmaßnahme eintragen.`);
    return {
      itemId: item.id, ok: r.ok, action: r.ok ? null : e.action!.trim(),
      valueNumber: item.kind === "temperature" ? Number(e.value.replace(",", ".")) : null,
      valueText: item.kind === "temperature" ? null : e.value.trim(),
    };
  }).filter((x) => x !== null);
}

export async function listChecklists(_s: Session) {
  return visible(db().haccpChecklists).map((c) => ({ ...c, items: [...c.items].sort((a, b) => a.position - b.position) }));
}

/** One outlet's day: every active checklist with what was recorded. */
export async function getHaccpDay(s: Session, outletId: string, day: string) {
  assertOutlet(s, outletId);
  const d = db();
  const records = d.haccpRecords.filter((r) => r.outletId === outletId && r.day === day)
    .map((r) => ({ ...r, recordedByName: d.members.find((m) => m.userId === r.recordedBy)?.name ?? "–" }));
  return { checklists: await listChecklists(s), records: Object.fromEntries(records.map((r) => [r.itemId, r])) };
}

export async function saveHaccpRecords(s: Session, outletId: string, day: string, entries: HaccpEntry[]) {
  assertOutlet(s, outletId);
  const d = db();
  const tz = d.outlets.find((o) => o.id === outletId)?.timezone;
  if (day > dayIn(tz)) throw new Error("Für künftige Tage lässt sich nichts eintragen.");
  const rows = readEntries(visible(d.haccpChecklists).flatMap((c) => c.items), entries);
  for (const r of rows) {
    d.haccpRecords = d.haccpRecords.filter((x) => !(x.itemId === r.itemId && x.outletId === outletId && x.day === day));
    d.haccpRecords.push({ ...r, outletId, day, recordedBy: s.userId, recordedAt: now() });
  }
  return rows.length;
}

/** Out-of-limit records in the period, newest first: the audit view. */
export async function haccpDeviations(s: Session, outletId: string, fromDay: string, toDay: string) {
  assertOutlet(s, outletId);
  const d = db();
  const items = new Map(d.haccpChecklists.flatMap((c) => c.items.map((i) => [i.id, { ...i, checklist: c.name }] as const)));
  return d.haccpRecords
    .filter((r) => r.outletId === outletId && !r.ok && r.day >= fromDay && r.day <= toDay && items.has(r.itemId))
    .map((r) => ({ ...r, label: items.get(r.itemId)!.label, checklist: items.get(r.itemId)!.checklist, kind: items.get(r.itemId)!.kind, recordedByName: d.members.find((m) => m.userId === r.recordedBy)?.name ?? "–" }))
    .sort((a, b) => b.day.localeCompare(a.day) || b.recordedAt.localeCompare(a.recordedAt));
}

export async function saveChecklist(s: Session, draft: ChecklistDraft) {
  assertEditor(s);
  const d = db();
  const row = draft.id ? d.haccpChecklists.find((c) => c.id === draft.id && !c.archivedAt) : undefined;
  if (draft.id && !row) throw new Error("Checkliste nicht gefunden.");
  const kept = new Set(draft.items.map((i) => i.id).filter(Boolean));
  const removed = (row?.items ?? []).filter((i) => !kept.has(i.id));
  if (removed.some((i) => d.haccpRecords.some((r) => r.itemId === i.id))) {
    throw new Error("Ein entfernter Kontrollpunkt hat schon Einträge. Damit das Protokoll vollständig bleibt, die Checkliste stattdessen archivieren und neu anlegen.");
  }
  const items = draft.items.map((i, p) => ({ ...i, id: i.id ?? newId("hi"), position: p }));
  if (row) Object.assign(row, { name: draft.name, items });
  else d.haccpChecklists.push({ id: newId("hc"), name: draft.name, archivedAt: null, items });
  return row?.id ?? d.haccpChecklists.at(-1)!.id;
}

export async function archiveChecklist(s: Session, id: string) {
  assertEditor(s);
  const row = db().haccpChecklists.find((c) => c.id === id);
  if (row) row.archivedAt = now();
}

export type InvoiceInput = { invoiceNumber: string; invoiceDate: string; lines: { lineId: string; quantityPacks: number; unitPriceCents: number }[] };

function orderForInvoice(s: Session, orderId: string) {
  const o = db().orders.find((x) => x.id === orderId);
  if (!o) throw new Error("Bestellung nicht gefunden.");
  assertOutlet(s, o.outletId);
  if (o.status !== "delivered" && o.status !== "partially_delivered") throw new Error("Eine Rechnung lässt sich erst nach dem Wareneingang abgleichen.");
  return o;
}

export async function getInvoice(s: Session, orderId: string) {
  const o = db().orders.find((x) => x.id === orderId);
  if (!o) return null;
  assertOutlet(s, o.outletId);
  const inv = db().invoices.find((i) => i.orderId === orderId);
  if (!inv) return null;
  const { lines, grossCents: _g, taxLines: _t, source: _s, sellerVatId: _v, document: _d, ...rest } = inv;
  // An invoice saved against an order is always matched one way or the other.
  return { ...rest, status: rest.status === "unmatched" ? ("mismatch" as const) : rest.status, approvedByName: memberName(inv.approvedBy), lines };
}
const memberName = (userId: string | null) => (userId ? db().members.find((m) => m.userId === userId)?.name ?? "–" : null);

/** Saves the invoice for an order and matches it; changing an approved invoice needs a new approval. */
export async function saveInvoice(s: Session, orderId: string, input: InvoiceInput) {
  assertEditor(s);
  const o = orderForInvoice(s, orderId);
  const d = db();
  if (d.invoices.some((i) => i.orderId !== orderId && i.supplierId === o.supplierId && i.invoiceNumber === input.invoiceNumber)) {
    throw new Error(`Rechnung ${input.invoiceNumber} dieses Lieferanten ist schon bei einer anderen Bestellung erfasst.`);
  }
  const by = new Map(input.lines.map((l) => [l.lineId, l]));
  const m = matchInvoice(o.lines.map((l) => ({
    lineId: l.id, orderedPacks: l.quantityPacks, receivedPacks: o.received[l.id] ?? 0, orderPriceCents: l.unitPriceCents,
    invoicedPacks: by.get(l.id)?.quantityPacks ?? 0, invoicePriceCents: by.get(l.id)?.unitPriceCents ?? l.unitPriceCents,
  })));
  const row = d.invoices.find((i) => i.orderId === orderId);
  const values = {
    invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate, status: m.status, totalNetCents: m.invoicedCents,
    note: null, approvedAt: null, approvedBy: null,
    lines: Object.fromEntries(m.lines.map((l) => [l.lineId, { quantityPacks: l.invoicedPacks, unitPriceCents: l.invoicePriceCents }])),
  };
  if (row) Object.assign(row, values);
  else d.invoices.push({ id: newId("inv"), orderId, supplierId: o.supplierId, ...values });
  return m.status;
}

/** Approves the invoice; a mismatch needs a reason (credit note asked for, accepted price increase ...). */
export async function approveInvoice(s: Session, orderId: string, note: string | null) {
  assertEditor(s);
  orderForInvoice(s, orderId);
  const inv = db().invoices.find((i) => i.orderId === orderId);
  if (!inv) throw new Error("Erst die Rechnung erfassen.");
  if (inv.status === "mismatch" && !note?.trim()) throw new Error("Die Rechnung weicht ab. Bitte kurz begründen, warum sie trotzdem passt.");
  Object.assign(inv, { status: "approved", note: note?.trim() || null, approvedAt: now(), approvedBy: s.userId });
}

/** Sales per linked dish in the period (outlet's local days), against what each portion earns. */
export async function getMenuEngineering(s: Session, outletId: string, fromDay: string, toDay: string) {
  assertOutlet(s, outletId);
  const d = db();
  const tz = d.outlets.find((o) => o.id === outletId)?.timezone;
  const [from, to] = [startOfDay(fromDay, tz), startOfDay(addDays(toDay, 1), tz)];
  const items = new Map(d.posItems.filter((p) => p.outletId === outletId).map((p) => [p.id, p]));
  const inPeriod = d.sales.filter((x) => x.outletId === outletId && x.soldAt >= from && x.soldAt < to);
  const byRecipe = new Map<string, { sold: number; revenue: number }>();
  let unlinked = 0;
  for (const x of inPeriod) {
    const p = items.get(x.posItemId);
    if (!p || p.ignored) continue;
    if (!p.recipeId) { unlinked += x.quantity; continue; }
    const t = byRecipe.get(p.recipeId) ?? { sold: 0, revenue: 0 };
    byRecipe.set(p.recipeId, { sold: t.sold + x.quantity, revenue: t.revenue + x.revenueNetCents });
  }
  const ctx = costContext();
  const memo = new Map<string, RecipeCost>();
  const dishes = [...byRecipe].flatMap(([recipeId, t]) => {
    const r = d.recipes.find((x) => x.id === recipeId);
    if (!r) return [];
    const own = d.outletPrices.find((p) => p.recipeId === recipeId && p.outletId === outletId)?.sellPriceCents ?? r.sellPriceCents;
    const listNet = own ? netPrice(own, r.sellPriceIncludesVat, r.vatBp ?? d.library.defaultVatBp) : 0;
    return [{ id: r.id, name: r.name, sold: t.sold, netPerPortionCents: t.revenue ? t.revenue / t.sold : listNet, costPerPortionCents: costRecipe(toCostRecipe(r), ctx, memo).perPortionCents }];
  });
  return { ...classifyDishes(dishes), unlinked };
}

export async function listPosItems(s: Session, outletId: string) {
  assertOutlet(s, outletId);
  const d = db();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  return d.posItems
    .filter((p) => p.outletId === outletId)
    .map((p) => {
      const sales = d.sales.filter((x) => x.posItemId === p.id);
      return {
        ...p,
        recipeName: d.recipes.find((r) => r.id === p.recipeId)?.name ?? null,
        sold30: sales.filter((x) => x.soldAt >= since).reduce((t, x) => t + x.quantity, 0),
        pending: sales.filter((x) => !x.depletedEventId).reduce((t, x) => t + x.quantity, 0),
      };
    })
    .sort((a, b) => a.plu.localeCompare(b.plu, "de", { numeric: true }));
}

/** Links a till item to a recipe (or ignores it). Sales waiting for a link are booked right away. */
export async function linkPosItem(s: Session, posItemId: string, v: { recipeId: string | null; ignored: boolean }) {
  const d = db();
  const p = d.posItems.find((x) => x.id === posItemId);
  if (!p) throw new Error("Kassenartikel nicht gefunden.");
  assertOutlet(s, p.outletId);
  if (v.recipeId && !d.recipes.some((r) => r.id === v.recipeId && !r.archivedAt)) throw new Error("Dieses Rezept gibt es nicht mehr.");
  p.recipeId = v.ignored ? null : v.recipeId;
  p.ignored = v.ignored;
  return { depleted: depletePending(p.outletId, s.userId) };
}

export async function listApiKeys(s: Session, outletId: string) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  return db().apiKeys.filter((k) => k.outletId === outletId).map(({ keyHash: _, ...k }) => k).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Creates a key for one outlet. The key itself is returned once and only its hash is kept. */
export async function createApiKey(s: Session, outletId: string, name: string) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  assertOutlet(s, outletId);
  const key = newApiKey();
  const row = { id: newId("key"), libraryId: db().library.id, outletId, name, keyHash: hashKey(key), lastUsedAt: null, revokedAt: null, createdAt: now() };
  db().apiKeys.push(row);
  return { id: row.id, key };
}

export async function revokeApiKey(s: Session, keyId: string) {
  if (!canManageTeam(s.role)) throw new Forbidden();
  const k = db().apiKeys.find((x) => x.id === keyId);
  if (k && !k.revokedAt) k.revokedAt = now();
}

/** Minimum (warns, daily alert) and target level (order suggestion) of an item in one outlet. null clears. */
export async function setStockLevels(s: Session, outletId: string, ingredientId: string, v: { minLevelBase: number | null; parLevelBase: number | null }) {
  assertOutlet(s, outletId);
  if (v.minLevelBase !== null && v.parLevelBase !== null && v.minLevelBase > v.parLevelBase) throw new Error("Der Mindestbestand liegt über dem Zielbestand.");
  const oi = db().outletIngredients.find((x) => x.outletId === outletId && x.ingredientId === ingredientId);
  if (!oi) throw new Error("Diese Zutat wird in diesem Outlet nicht geführt.");
  Object.assign(oi, v);
}

/** Moves stock to another outlet, valued at the sender's average cost. */
export async function recordTransfer(s: Session, fromOutletId: string, toOutletId: string, lines: { ingredientId: string; quantityBase: number }[]) {
  assertOutlet(s, fromOutletId);
  assertOutlet(s, toOutletId);
  if (fromOutletId === toOutletId) throw new Error("Bitte ein anderes Outlet als Ziel wählen.");
  if (!lines.length) throw new Error("Mindestens eine Position angeben.");
  const d = db();
  const ev: StockEvent = { id: newId("ev"), outletId: fromOutletId, type: "transfer", status: "closed", occurredAt: now(), counterpartOutletId: toOutletId, purchaseOrderId: null, note: null, createdBy: s.userId, closedAt: now() };
  d.events.push(ev);
  for (const l of lines) {
    const out = addMovement(d, { eventId: ev.id, outletId: fromOutletId, ingredientId: l.ingredientId, deltaBase: -l.quantityBase, countedBase: null, reason: null });
    addMovement(d, { eventId: ev.id, outletId: toOutletId, ingredientId: l.ingredientId, deltaBase: l.quantityBase, unitCostCents: out.unitCostCents, countedBase: null, reason: null });
    if (!d.outletIngredients.some((x) => x.outletId === toOutletId && x.ingredientId === l.ingredientId)) {
      d.outletIngredients.push({ outletId: toOutletId, ingredientId: l.ingredientId, parLevelBase: null, minLevelBase: null });
    }
  }
  return ev.id;
}

/** Transfers that left or reached the outlet, newest first. */
export async function listTransfers(s: Session, outletId: string) {
  assertOutlet(s, outletId);
  const d = db();
  const name = (id: string | null) => d.outlets.find((o) => o.id === id)?.name ?? "–";
  return d.events
    .filter((e) => e.type === "transfer" && (e.outletId === outletId || e.counterpartOutletId === outletId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((e) => {
      const outgoing = d.movements.filter((m) => m.eventId === e.id && m.outletId === e.outletId);
      return {
        id: e.id, occurredAt: e.occurredAt, direction: e.outletId === outletId ? ("out" as const) : ("in" as const),
        otherOutlet: name(e.outletId === outletId ? e.counterpartOutletId : e.outletId),
        by: d.members.find((m) => m.userId === e.createdBy)?.name ?? "–",
        valueCents: outgoing.reduce((t, m) => t - m.deltaBase * m.unitCostCents, 0),
        lines: outgoing.map((m) => {
          const i = d.ingredients.find((x) => x.id === m.ingredientId);
          return { id: m.id, ingredient: i?.name ?? "–", baseUnit: i?.baseUnit ?? ("g" as BaseUnit), quantityBase: -m.deltaBase };
        }),
      };
    });
}

/** Stock report for the calendar days fromDay..toDay (inclusive) in the outlet's time zone. */
export async function getStockReport(s: Session, outletId: string, fromDay: string, toDay: string) {
  assertOutlet(s, outletId);
  const d = db();
  const tz = d.outlets.find((o) => o.id === outletId)?.timezone;
  const events = new Map(d.events.filter((e) => e.status === "closed").map((e) => [e.id, e]));
  const moves = d.movements.filter((m) => m.outletId === outletId && events.has(m.eventId)).map((m) => {
    const e = events.get(m.eventId)!;
    return { ingredientId: m.ingredientId, eventType: e.type, occurredAt: new Date(e.occurredAt).toISOString(), deltaBase: m.deltaBase, unitCostCents: m.unitCostCents };
  });
  return stockReport(moves, startOfDay(fromDay, tz), startOfDay(addDays(toDay, 1), tz))
    .map((r) => {
      const i = d.ingredients.find((x) => x.id === r.ingredientId)!;
      return { ...r, name: i.name, baseUnit: i.baseUnit, category: d.categories.find((c) => c.id === i.categoryId)?.name ?? "–" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function getOpenCount(s: Session, outletId: string) {
  assertOutlet(s, outletId);
  const ev = db().events.find((e) => e.outletId === outletId && e.type === "count" && e.status === "open");
  if (!ev) return null;
  const d = db();
  const ids = new Set(d.outletIngredients.filter((x) => x.outletId === outletId).map((x) => x.ingredientId));
  const packages: Record<string, { id: string; label: string; quantityBase: number }[]> = {};
  for (const p of d.packages) if (ids.has(p.ingredientId)) (packages[p.ingredientId] ??= []).push({ id: p.id, label: p.label, quantityBase: p.quantityBase });
  // Scanned barcodes count one package of the item they are printed on.
  const barcodes: Record<string, { ingredientId: string; packageId: string }> = {};
  for (const si of visible(d.stockItems)) if (si.gtin && ids.has(si.ingredientId)) barcodes[gtinKey(si.gtin)] = { ingredientId: si.ingredientId, packageId: si.packageId };
  return { event: ev, draft: d.countDrafts[ev.id] ?? {}, breakdown: d.countBreakdowns?.[ev.id] ?? {}, packages, barcodes };
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

export async function saveCountLines(s: Session, eventId: string, counted: Record<string, CountEntry>) {
  const d = db();
  const ev = d.events.find((e) => e.id === eventId);
  if (!ev || ev.status !== "open") throw new Error("Diese Inventur ist nicht mehr offen.");
  assertOutlet(s, ev.outletId);
  const draft = (d.countDrafts[eventId] ??= {});
  const breakdowns = ((d.countBreakdowns ??= {})[eventId] ??= {});
  for (const [ing, entry] of Object.entries(counted)) {
    delete breakdowns[ing];
    if (entry === null) delete draft[ing];
    else if (typeof entry === "number") draft[ing] = entry;
    else {
      draft[ing] = countTotal(entry, d.packages.filter((p) => p.ingredientId === ing));
      breakdowns[ing] = entry;
    }
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
  delete d.countBreakdowns?.[eventId];
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
    const baseUnit = d.ingredients.find((i) => i.id === si.ingredientId)?.baseUnit ?? ("g" as BaseUnit);
    return { ...l, name: si.name, packageLabel: packOf(si).label, weighted: si.weighted, packBase: packOf(si).quantityBase, baseUnit, receivedPacks: order.received[l.id] ?? 0 };
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
  const tz = d.outlets.find((o) => o.id === outletId)?.timezone;
  const today = dayIn(tz);
  const coverDays = orderCoverDays(d.suppliers.find((x) => x.id === supplierId)?.leadTimeDays ?? null);
  const since = Date.now() - 29 * 86_400_000;
  const forecastOf = (ingredientId: string) => {
    const days: Record<string, number> = {};
    for (const m of d.movements) {
      if (m.outletId !== outletId || m.ingredientId !== ingredientId || m.deltaBase >= 0) continue;
      const e = d.events.find((x) => x.id === m.eventId);
      if (!e || e.status !== "closed" || !["sale", "production", "waste"].includes(e.type) || Date.parse(e.occurredAt) < since) continue;
      const day = dayIn(tz, new Date(e.occurredAt));
      days[day] = (days[day] ?? 0) - m.deltaBase;
    }
    return forecastUse(weekdayUsage(days, today), today, coverDays);
  };
  return visible(d.stockItems)
    .filter((si) => si.supplierId === supplierId && visibleIds.has(si.ingredientId))
    .map((si) => {
      const pack = packOf(si);
      const level = d.levels.find((l) => l.outletId === outletId && l.ingredientId === si.ingredientId);
      const oi = d.outletIngredients.find((x) => x.outletId === outletId && x.ingredientId === si.ingredientId);
      const packPrice = si.priceType === "per_pack" ? si.priceCents : Math.round(unitCostOf(si) * pack.quantityBase);
      const baseUnit = d.ingredients.find((i) => i.id === si.ingredientId)!.baseUnit;
      const onHand = level?.quantityBase ?? 0;
      const forecastBase = forecastOf(si.ingredientId);
      const s2 = suggestFromUse({ forecastBase, reservePct: ORDER_RESERVE_PCT, parBase: oi?.parLevelBase ?? null, onHandBase: onHand, onOrderBase: onOrder(si.ingredientId), packBase: pack.quantityBase });
      const target = Math.max(forecastBase * (1 + ORDER_RESERVE_PCT / 100), oi?.parLevelBase ?? 0);
      return {
        stockItemId: si.id,
        forecastBase: Math.round(forecastBase), coverDays, suggestedReason: s2.reason,
        name: si.name,
        baseUnit,
        packageLabel: pack.label,
        packBase: pack.quantityBase,
        weighted: si.weighted,
        packPriceCents: packPrice,
        onHandBase: onHand,
        parLevelBase: oi?.parLevelBase ?? null,
        suggestedPacks: si.weighted ? suggestWeight(target || null, onHand, onOrder(si.ingredientId), baseUnit) / pack.quantityBase : s2.packs,
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




















// ---------------------------------------------------------------- e-invoices

export async function saveEInvoice(s: Session, input: EInvoiceSave): Promise<string> {
  if (!canEditLibrary(s.role)) throw new Forbidden();
  const d = db();
  if (!d.suppliers.some((x) => x.id === input.supplierId)) throw new Error("Lieferant nicht gefunden.");
  if (d.invoices.some((i) => i.supplierId === input.supplierId && i.invoiceNumber === input.number)) throw new Error(`Rechnung ${input.number} dieses Lieferanten ist schon erfasst.`);
  const id = newId("inv");
  d.invoices.push({
    id, orderId: null, supplierId: input.supplierId, invoiceNumber: input.number, invoiceDate: input.date, status: "unmatched", totalNetCents: input.netCents,
    note: null, approvedAt: null, approvedBy: null, lines: {}, grossCents: input.grossCents, taxLines: input.taxLines, source: "einvoice", sellerVatId: input.sellerVatId, document: input.document,
  });
  return id;
}

export async function listInvoices(_s: Session, from: string, to: string): Promise<InvoiceListRow[]> {
  const d = db();
  return d.invoices.filter((i) => i.invoiceDate >= from && i.invoiceDate <= to)
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || a.invoiceNumber.localeCompare(b.invoiceNumber))
    .map((i) => {
      const sup = d.suppliers.find((x) => x.id === i.supplierId);
      return {
        id: i.id, supplierId: i.supplierId, supplierName: sup?.companyName ?? "–", number: i.invoiceNumber, date: i.invoiceDate,
        netCents: i.totalNetCents, grossCents: i.grossCents ?? null, taxLines: i.taxLines ?? [], status: i.status, source: i.source ?? "manual", orderId: i.orderId,
      };
    });
}









// ---------------------------------------------------------------- contribution margin: costs

export async function getCostSetup(s: Session): Promise<CostSetup> {
  if (!canEditLibrary(s.role)) throw new Forbidden();
  const d = db();
  return { variableRevenuePct: d.costSettings.variableRevenuePct, perItemCents: d.costSettings.perItemCents, fixed: d.fixedCosts.filter((f) => !f.archivedAt).map(({ archivedAt: _a, ...f }) => ({ ...f })) };
}

export async function saveCostSettings(s: Session, v: { variableRevenuePct: number; perItemCents: number }) {
  if (!canEditLibrary(s.role)) throw new Forbidden();
  db().costSettings = { ...v };
}

export async function saveFixedCost(s: Session, input: FixedCostInput): Promise<string> {
  if (!canEditLibrary(s.role)) throw new Forbidden();
  const d = db();
  const values = { outletId: input.outletId, name: input.name, category: input.category, monthlyCents: input.monthlyCents };
  if (input.id) {
    const f = d.fixedCosts.find((x) => x.id === input.id && !x.archivedAt);
    if (!f) throw new Error("Fixkosten nicht gefunden.");
    Object.assign(f, values);
    return f.id;
  }
  const id = newId("fix");
  d.fixedCosts.push({ id, ...values, archivedAt: null });
  return id;
}

export async function archiveFixedCost(s: Session, id: string) {
  if (!canEditLibrary(s.role)) throw new Forbidden();
  const f = db().fixedCosts.find((x) => x.id === id);
  if (f) f.archivedAt = now();
}

// ---------------------------------------------------------------- service funnel

const funnelOutlet = (s: Session, outletId: string) => {
  if (!db().outlets.some((o) => o.id === outletId && !o.archivedAt)) throw new Error("Outlet nicht gefunden.");
  if (!canAccessOutlet(s, outletId)) throw new Forbidden();
};

export async function getFunnel(s: Session, outletId: string, from: string, to: string): Promise<FunnelSetup> {
  funnelOutlet(s, outletId);
  const d = db();
  const costsVisible = canEditLibrary(s.role);
  const steps = defaultSteps().map((x) => ({ ...x, ...d.funnelSteps.find((y) => y.step === x.step) }));
  return {
    days: d.funnelDays.filter((x) => x.outletId === outletId && x.day >= from && x.day <= to).sort((a, b) => a.day.localeCompare(b.day)).map((x) => ({ ...x })),
    steps: steps.map((x) => (costsVisible ? x : { ...x, variableCents: 0 })), projectedDays: d.funnelProjectedDays, costsVisible,
  };
}

export async function saveFunnelDays(s: Session, outletId: string, days: FunnelDayInput[]): Promise<number> {
  funnelOutlet(s, outletId);
  const d = db();
  for (const input of days) {
    const old = d.funnelDays.find((x) => x.outletId === outletId && x.day === input.day);
    if (old) Object.assign(old, input);
    else d.funnelDays.push({ id: newId("fun"), outletId, ...input });
  }
  return days.length;
}

export async function deleteFunnelDay(s: Session, outletId: string, day: string) {
  funnelOutlet(s, outletId);
  const d = db();
  d.funnelDays = d.funnelDays.filter((x) => !(x.outletId === outletId && x.day === day));
}

export async function saveFunnelSettings(s: Session, v: { steps: StepSetting[]; projectedDays: number }) {
  if (!canEditLibrary(s.role)) throw new Forbidden();
  const d = db();
  d.funnelSteps = v.steps.map((x) => ({ ...x }));
  d.funnelProjectedDays = v.projectedDays;
}
