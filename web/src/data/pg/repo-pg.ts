// Postgres implementation of the data layer. Same exports and return types as repo-memory.ts
// (enforced in repo.ts). Every query runs as the user (asUser), so RLS decides what is visible;
// the explicit role checks only give friendlier messages than a policy violation.
import "server-only";
import { type AllergenMap, rollUp } from "@/domain/allergens";
import { type CostContext, type CostIngredient, type CostRecipe, type RecipeCost, costPerBaseUnit, costRecipe, foodCostBp } from "@/domain/costing";
import { billOfMaterials, summarizeMenu } from "@/domain/menus";
import { type CountBreakdown, countTotal, stockReport, suggestPacks } from "@/domain/stock";
import { addDays, startOfDay } from "@/lib/dates";
import type { BaseUnit } from "@/domain/units";
import type { Billing, IngredientFilter, IngredientInput, MenuDraft, RecipeDraft, StockItemInput, SupplierInput } from "../repo-memory";
import { Forbidden, assertCanChangeMember, canEditLibrary, canManageTeam } from "../session-rules";
import type {
  AllergenRow, Category, CountEntry, Ingredient, Library, Member, Menu, MenuCourse, Nutrition, Outlet, Package, PurchaseOrder, Recipe, RecipeLine, Session,
  StockEvent, StockItem, StockMovement, Supplier,
} from "../types";
import { type Tx, asService, asUser, friendly } from "./client";

async function run<T>(s: Session, fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await asUser(s.userId, fn);
  } catch (e) {
    throw friendly(e);
  }
}
const assertEditor = (s: Session) => {
  if (!canEditLibrary(s.role)) throw new Forbidden();
};
const assertTeam = (s: Session) => {
  if (!canManageTeam(s.role)) throw new Forbidden();
};
const one = <T>(rows: T[], what = "Eintrag"): T => {
  if (!rows[0]) throw new Error(`${what} nicht gefunden.`);
  return rows[0];
};

// ---------------------------------------------------------------- library & team

export async function getLibrary(s: Session): Promise<Library> {
  return run(s, async (tx) => one(await tx<Library[]>`
    select id, name, currency, default_vat_bp, wage_cents_per_hour from libraries where id = ${s.libraryId}`, "Betrieb"));
}

export async function getBilling(s: Session): Promise<Billing> {
  return run(s, async (tx) => one(await tx<Billing[]>`
    select plan, subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id from libraries where id = ${s.libraryId}`, "Betrieb"));
}

export async function updateLibrary(s: Session, patch: { name: string; defaultVatBp: number; wageCentsPerHour: number | null }) {
  assertTeam(s);
  await run(s, (tx) => tx`update libraries set name = ${patch.name}, default_vat_bp = ${patch.defaultVatBp}, wage_cents_per_hour = ${patch.wageCentsPerHour} where id = ${s.libraryId}`);
}

export async function listOutlets(s: Session): Promise<Outlet[]> {
  // RLS (outlets_read) already limits staff to their own outlets.
  return run(s, (tx) => tx<Outlet[]>`
    select id, library_id, name, is_central_kitchen, timezone, archived_at from outlets
    where library_id = ${s.libraryId} and archived_at is null order by name`);
}

export async function createOutlet(s: Session, name: string, isCentralKitchen: boolean) {
  assertTeam(s);
  return run(s, async (tx) => {
    const [o] = await tx<{ id: string }[]>`insert into outlets (library_id, name, is_central_kitchen) values (${s.libraryId}, ${name}, ${isCentralKitchen}) returning id`;
    await tx`insert into outlet_ingredients (outlet_id, ingredient_id) select ${o.id}, id from ingredients where library_id = ${s.libraryId} and archived_at is null`;
    return o.id;
  });
}

export async function listMembers(s: Session): Promise<Member[]> {
  assertTeam(s);
  return run(s, (tx) => tx<Member[]>`
    select m.id, m.user_id, m.display_name as name, m.email, m.role, m.all_outlets,
           coalesce(array_agg(mo.outlet_id) filter (where mo.outlet_id is not null), '{}') as outlet_ids
    from memberships m left join membership_outlets mo on mo.membership_id = m.id
    where m.library_id = ${s.libraryId}
    group by m.id order by m.display_name`);
}

/** Creates an invitation and returns the raw token for the email link; only its hash is stored. */
export async function inviteMember(s: Session, input: { name: string; email: string; role: Session["role"]; outletIds: string[] }): Promise<{ token: string | null }> {
  assertTeam(s);
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const hash = await sha256(token);
  await run(s, async (tx) => {
    const [exists] = await tx`select 1 from memberships where library_id = ${s.libraryId} and lower(email) = lower(${input.email})`;
    if (exists) throw new Error("Diese E-Mail-Adresse ist schon im Team.");
    await tx`insert into invitations (library_id, email, role, outlet_ids, token_hash, expires_at, created_by)
      values (${s.libraryId}, ${input.email}, ${input.role}, ${input.outletIds}::uuid[], ${hash}, now() + interval '7 days', ${s.userId})`;
  });
  return { token };
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(buf).toString("hex");
}

async function memberAndOwners(tx: Tx, s: Session, memberId: string) {
  // Check the role first: "for update" hides rows the user may not change, which would read as "not found".
  if (!canManageTeam(s.role)) throw new Forbidden();
  const members = await tx<Member[]>`
    select m.id, m.user_id, m.display_name as name, m.email, m.role, m.all_outlets, '{}'::uuid[] as outlet_ids
    from memberships m where m.library_id = ${s.libraryId} for update`;
  const target = members.find((m) => m.id === memberId);
  if (!target) throw new Error("Teammitglied nicht gefunden.");
  return { target, owners: members.filter((m) => m.role === "owner").length, members };
}

export async function updateMember(s: Session, memberId: string, input: { role: Exclude<Session["role"], "owner">; outletIds: string[] }) {
  await run(s, async (tx) => {
    const { target, owners } = await memberAndOwners(tx, s, memberId);
    assertCanChangeMember(s, target, { role: input.role }, owners);
    await tx`update memberships set role = ${input.role}, all_outlets = ${input.role !== "outlet_staff"} where id = ${memberId}`;
    await tx`delete from membership_outlets where membership_id = ${memberId}`;
    if (input.role === "outlet_staff" && input.outletIds.length) {
      await tx`insert into membership_outlets (membership_id, outlet_id)
        select ${memberId}, o.id from outlets o where o.id = any(${input.outletIds}::uuid[]) and o.library_id = ${s.libraryId}`;
    }
  });
}

export async function removeMember(s: Session, memberId: string) {
  await run(s, async (tx) => {
    const { target, owners } = await memberAndOwners(tx, s, memberId);
    assertCanChangeMember(s, target, { remove: true }, owners);
    await tx`delete from memberships where id = ${memberId}`;
  });
}

export async function transferOwnership(s: Session, memberId: string) {
  if (s.role !== "owner") throw new Forbidden("Nur der Inhaber kann die Inhaberschaft übertragen.");
  await run(s, async (tx) => {
    const { target, members } = await memberAndOwners(tx, s, memberId);
    const me = members.find((m) => m.userId === s.userId);
    if (!me || me.id === target.id) throw new Error("Bitte ein anderes Teammitglied wählen.");
    await tx`update memberships set role = 'owner', all_outlets = true where id = ${target.id}`;
    await tx`delete from membership_outlets where membership_id = ${target.id}`;
    await tx`update memberships set role = 'admin' where id = ${me.id}`;
  });
}

export async function listCategories(s: Session, kind: Category["kind"]): Promise<Category[]> {
  return run(s, (tx) => tx<Category[]>`select id, kind, name from categories where library_id = ${s.libraryId} and kind = ${kind} order by name`);
}

// ---------------------------------------------------------------- costing context

type PriceRow = { ingredientId: string; priceType: "per_pack" | "per_unit"; priceCents: number; priceUnitQuantity: number | null; packQuantity: number };

async function loadCosting(tx: Tx, lib: string) {
  const [ings, prices, recipes, lines] = await Promise.all([
    tx<Ingredient[]>`select id, name, base_unit, grams_per_piece, ml_per_gram from ingredients where library_id = ${lib}`,
    tx<PriceRow[]>`
      select distinct on (si.ingredient_id) si.ingredient_id, si.price_type, si.price_cents, si.price_unit_quantity, p.quantity_base as pack_quantity
      from stock_items si join packages p on p.id = si.package_id
      where si.library_id = ${lib} and si.archived_at is null
      order by si.ingredient_id, si.is_preferred desc, si.created_at`,
    tx<Recipe[]>`select * from recipes where library_id = ${lib}`,
    tx<(RecipeLine & { recipeId: string })[]>`
      select rl.* from recipe_lines rl join recipes r on r.id = rl.recipe_id where r.library_id = ${lib} order by rl.position`,
  ]);
  const priceBy = new Map(prices.map((p) => [p.ingredientId, p]));
  const linesBy = new Map<string, RecipeLine[]>();
  for (const l of lines) linesBy.set(l.recipeId, [...(linesBy.get(l.recipeId) ?? []), l]);
  const toCostIngredient = (i: Ingredient): CostIngredient => {
    const p = priceBy.get(i.id);
    const price: CostIngredient["price"] = !p ? null
      : p.priceType === "per_pack" ? { type: "per_pack", priceCents: p.priceCents, packQuantityBase: p.packQuantity }
      : p.priceUnitQuantity ? { type: "per_unit", priceCents: p.priceCents, unitQuantityBase: p.priceUnitQuantity } : null;
    return { id: i.id, name: i.name, baseUnit: i.baseUnit, gramsPerPiece: i.gramsPerPiece, mlPerGram: i.mlPerGram, price };
  };
  const ingBy = new Map(ings.map((i) => [i.id, toCostIngredient(i)]));
  const recipeBy = new Map(recipes.map((r) => [r.id, { ...r, lines: linesBy.get(r.id) ?? [] }]));
  return { ingBy, recipeBy };
}

const toCostRecipe = (r: Pick<Recipe, "id" | "name" | "portions" | "netQuantityBase" | "netUnit" | "lines">): CostRecipe => ({
  id: r.id, name: r.name, portions: r.portions, netQuantityBase: r.netQuantityBase, netUnit: r.netUnit,
  lines: [...r.lines].sort((a, b) => a.position - b.position).map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, unit: l.unit })),
});

function contextOf(data: Awaited<ReturnType<typeof loadCosting>>, override?: CostRecipe): CostContext {
  return {
    ingredient: (id) => data.ingBy.get(id),
    recipe: (id) => {
      if (override?.id === id) return override;
      const r = data.recipeBy.get(id);
      return r && toCostRecipe(r);
    },
  };
}

async function allergenMaps(tx: Tx, lib: string) {
  const rows = await tx<{ ingredientId: string; allergen: string; status: string }[]>`
    select ia.ingredient_id, ia.allergen, ia.status from ingredient_allergens ia join ingredients i on i.id = ia.ingredient_id where i.library_id = ${lib}`;
  const extra = await tx<{ recipeId: string; allergen: string; status: string }[]>`
    select ra.recipe_id, ra.allergen, ra.status from recipe_extra_allergens ra join recipes r on r.id = ra.recipe_id where r.library_id = ${lib}`;
  const byIng = new Map<string, AllergenRow>();
  for (const r of rows) byIng.set(r.ingredientId, { ...byIng.get(r.ingredientId), [r.allergen]: r.status });
  const byRecipe = new Map<string, AllergenRow>();
  for (const r of extra) byRecipe.set(r.recipeId, { ...byRecipe.get(r.recipeId), [r.allergen]: r.status });
  return { byIng, byRecipe };
}

function recipeAllergens(
  r: { lines: Pick<RecipeLine, "ingredientId" | "subRecipeId">[]; extraAllergens: AllergenRow },
  maps: Awaited<ReturnType<typeof allergenMaps>>,
  recipes: Map<string, Recipe & { lines: RecipeLine[] }>,
  seen = new Set<string>(),
): AllergenMap {
  const parts: AllergenMap[] = r.lines.map((l) => {
    if (l.ingredientId) return maps.byIng.get(l.ingredientId) ?? {};
    const sub = l.subRecipeId ? recipes.get(l.subRecipeId) : undefined;
    if (!sub || seen.has(sub.id)) return {};
    return recipeAllergens({ lines: sub.lines, extraAllergens: maps.byRecipe.get(sub.id) ?? {} }, maps, recipes, new Set([...seen, sub.id]));
  });
  return rollUp(parts, r.extraAllergens);
}

// ---------------------------------------------------------------- ingredients

export async function listIngredients(s: Session, f: IngredientFilter = {}) {
  const q = f.q?.trim() ? `%${f.q.trim().toLowerCase()}%` : null;
  return run(s, async (tx) => {
    const { ingBy } = await loadCosting(tx, s.libraryId);
    const rows = await tx<{ id: string; name: string; category: string | null; supplier: string | null; baseUnit: BaseUnit; allergensVerified: boolean }[]>`
      select i.id, i.name, c.name as category, i.base_unit, i.allergens_verified,
        (select sp.company_name from stock_items si join suppliers sp on sp.id = si.supplier_id
          where si.ingredient_id = i.id and si.archived_at is null order by si.is_preferred desc, si.created_at limit 1) as supplier
      from ingredients i left join categories c on c.id = i.category_id
      where i.library_id = ${s.libraryId} and i.archived_at is null
        and (${q}::text is null or lower(i.name) like ${q} or lower(coalesce(i.internal_uid, '')) like ${q})
        and (${f.categoryId ?? null}::uuid is null or i.category_id = ${f.categoryId ?? null})
        and (${f.supplierId ?? null}::uuid is null or exists (select 1 from stock_items si where si.ingredient_id = i.id and si.supplier_id = ${f.supplierId ?? null} and si.archived_at is null))
        and (${!!f.unverified} = false or not i.allergens_verified)
      order by i.name collate "C"`;
    return rows
      .map((r) => ({ ...r, category: r.category ?? "–", supplier: r.supplier ?? "–", costPerBaseCents: costPerBaseUnit(ingBy.get(r.id)!) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
}

export async function getIngredient(s: Session, id: string) {
  if (!isUuid(id)) return null;
  return run(s, async (tx) => {
    const [ingredient] = await tx<Ingredient[]>`select * from ingredients where id = ${id}`;
    if (!ingredient) return null;
    const packages = await tx<Package[]>`select id, ingredient_id, parent_package_id, count, quantity_base, label from packages where ingredient_id = ${id} order by quantity_base`;
    const stockItems = await tx<(StockItem & { supplier: string; packageLabel: string })[]>`
      select si.*, coalesce(sp.company_name, '–') as supplier, p.label as package_label
      from stock_items si join packages p on p.id = si.package_id left join suppliers sp on sp.id = si.supplier_id
      where si.ingredient_id = ${id} and si.archived_at is null order by si.is_preferred desc, si.created_at`;
    const allergens = Object.fromEntries((await tx<{ allergen: string; status: string }[]>`select allergen, status from ingredient_allergens where ingredient_id = ${id}`).map((r) => [r.allergen, r.status])) as AllergenRow;
    const [nutrition] = await tx<Nutrition[]>`select energy_kcal, fat_g, saturated_fat_g, carbohydrate_g, sugars_g, protein_g, salt_g from ingredient_nutrition where ingredient_id = ${id}`;
    const usedIn = await tx<{ id: string; name: string }[]>`
      select distinct r.id, r.name from recipes r join recipe_lines rl on rl.recipe_id = r.id where rl.ingredient_id = ${id} and r.archived_at is null order by r.name`;
    const { ingBy } = await loadCosting(tx, s.libraryId);
    return {
      ingredient,
      packages,
      stockItems,
      costPerBaseCents: costPerBaseUnit(ingBy.get(id)!),
      allergens,
      verified: ingredient.allergensVerified,
      nutrition: nutrition ?? null,
      usedIn,
    };
  });
}

export async function saveIngredient(s: Session, input: IngredientInput): Promise<string> {
  assertEditor(s);
  return run(s, async (tx) => {
    const [dup] = await tx<{ name: string }[]>`
      select name from ingredients where library_id = ${s.libraryId} and archived_at is null and lower(name) = lower(${input.name}) and id <> coalesce(${input.id ?? null}::uuid, '00000000-0000-0000-0000-000000000000')`;
    if (dup) throw new Error(`Es gibt schon eine Zutat „${dup.name}“.`);
    const values = {
      name: input.name, shortName: input.shortName, internalUid: input.internalUid, categoryId: input.categoryId,
      gramsPerPiece: input.gramsPerPiece, mlPerGram: input.mlPerGram,
    };
    if (input.id) {
      one(await tx`update ingredients set ${tx(values)} where id = ${input.id} returning id`, "Zutat");
      return input.id;
    }
    const [row] = await tx<{ id: string }[]>`insert into ingredients ${tx({ ...values, libraryId: s.libraryId, baseUnit: input.baseUnit })} returning id`;
    await tx`insert into outlet_ingredients (outlet_id, ingredient_id) select id, ${row.id} from outlets where library_id = ${s.libraryId}`;
    return row.id;
  }).catch((e) => {
    if (String(e.message).includes("schon")) throw e;
    if ((e as Error).message === "Diesen Eintrag gibt es schon.") throw new Error("Diese interne Nummer ist schon vergeben.");
    throw e;
  });
}

export async function archiveIngredient(s: Session, id: string) {
  assertEditor(s);
  await run(s, async (tx) => {
    const used = await tx<{ name: string }[]>`select distinct r.name from recipes r join recipe_lines rl on rl.recipe_id = r.id where rl.ingredient_id = ${id} and r.archived_at is null`;
    if (used.length) throw new Error(`Wird noch in ${used.length} Rezept(en) verwendet: ${used.map((r) => r.name).join(", ")}.`);
    await tx`update ingredients set archived_at = now() where id = ${id}`;
  });
}

export async function savePackage(s: Session, input: Omit<Package, "id"> & { id?: string }): Promise<string> {
  assertEditor(s);
  return run(s, async (tx) => {
    const values = { ingredientId: input.ingredientId, parentPackageId: input.parentPackageId, count: input.count, quantityBase: input.quantityBase, label: input.label };
    if (input.id) {
      await tx`update packages set ${tx(values)} where id = ${input.id}`;
      return input.id;
    }
    return (await tx<{ id: string }[]>`insert into packages ${tx(values)} returning id`)[0].id;
  });
}

export async function deletePackage(s: Session, id: string) {
  assertEditor(s);
  await run(s, async (tx) => {
    const [used] = await tx`select 1 from stock_items where package_id = ${id} and archived_at is null`;
    if (used) throw new Error("Ein Lieferantenartikel nutzt dieses Gebinde.");
    const [child] = await tx`select 1 from packages where parent_package_id = ${id}`;
    if (child) throw new Error("Ein anderes Gebinde baut auf diesem auf.");
    await tx`delete from packages where id = ${id}`;
  });
}

export async function saveStockItem(s: Session, input: StockItemInput): Promise<string> {
  assertEditor(s);
  return run(s, async (tx) => {
    const [names] = await tx<{ ing: string; pack: string }[]>`
      select i.name as ing, p.label as pack from ingredients i join packages p on p.ingredient_id = i.id where i.id = ${input.ingredientId} and p.id = ${input.packageId}`;
    if (!names) throw new Error("Gebinde gehört nicht zu dieser Zutat.");
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from stock_items where ingredient_id = ${input.ingredientId} and archived_at is null and id <> coalesce(${input.id ?? null}::uuid, '00000000-0000-0000-0000-000000000000')`;
    const preferred = input.isPreferred || n === 0;
    if (preferred) await tx`update stock_items set is_preferred = false where ingredient_id = ${input.ingredientId}`;
    const values = {
      ingredientId: input.ingredientId, supplierId: input.supplierId, packageId: input.packageId, name: `${names.ing}, ${names.pack}`,
      priceType: input.priceType, priceCents: input.priceCents, priceUnit: input.priceUnit, priceUnitQuantity: input.priceUnitQuantity,
      isPreferred: preferred, supplierSku: input.supplierSku, gtin: input.gtin, weighted: input.weighted,
    };
    let id = input.id;
    if (id) {
      const [old] = await tx<{ priceCents: number }[]>`select price_cents from stock_items where id = ${id}`;
      await tx`update stock_items set ${tx(values)} where id = ${id}`;
      if (old && old.priceCents !== input.priceCents) await tx`insert into stock_item_price_history (stock_item_id, price_cents, source) values (${id}, ${input.priceCents}, 'manual')`;
    } else {
      id = (await tx<{ id: string }[]>`insert into stock_items ${tx({ ...values, libraryId: s.libraryId })} returning id`)[0].id;
      await tx`insert into stock_item_price_history (stock_item_id, price_cents, source) values (${id}, ${input.priceCents}, 'manual')`;
    }
    return id;
  });
}

export async function archiveStockItem(s: Session, id: string) {
  assertEditor(s);
  await run(s, (tx) => tx`update stock_items set archived_at = now(), is_preferred = false where id = ${id}`);
}

export async function setIngredientAllergens(s: Session, id: string, map: AllergenRow, verified: boolean) {
  assertEditor(s);
  await run(s, async (tx) => {
    await tx`delete from ingredient_allergens where ingredient_id = ${id}`;
    const rows = Object.entries(map).map(([allergen, status]) => ({ ingredientId: id, allergen, status }));
    if (rows.length) await tx`insert into ingredient_allergens ${tx(rows)}`;
    await tx`update ingredients set allergens_verified = ${verified} where id = ${id}`;
  });
}

export async function setNutrition(s: Session, id: string, n: Nutrition) {
  assertEditor(s);
  await run(s, (tx) => tx`
    insert into ingredient_nutrition ${tx({ ingredientId: id, ...n })}
    on conflict (ingredient_id) do update set energy_kcal = excluded.energy_kcal, fat_g = excluded.fat_g, saturated_fat_g = excluded.saturated_fat_g,
      carbohydrate_g = excluded.carbohydrate_g, sugars_g = excluded.sugars_g, protein_g = excluded.protein_g, salt_g = excluded.salt_g, updated_at = now()`);
}

// ---------------------------------------------------------------- suppliers

export async function listSuppliers(s: Session) {
  return run(s, (tx) => tx<(Supplier & { itemCount: number })[]>`
    select sp.*, (select count(*)::int from stock_items si where si.supplier_id = sp.id and si.archived_at is null) as item_count
    from suppliers sp where sp.library_id = ${s.libraryId} and sp.archived_at is null order by sp.company_name`);
}

export async function getSupplier(s: Session, id: string) {
  if (!isUuid(id)) return null;
  return run(s, async (tx) => {
    const [supplier] = await tx<Supplier[]>`select * from suppliers where id = ${id}`;
    if (!supplier) return null;
    const items = await tx<(StockItem & { packageLabel: string })[]>`
      select si.*, p.label as package_label from stock_items si join packages p on p.id = si.package_id
      where si.supplier_id = ${id} and si.archived_at is null order by si.name`;
    return { supplier, items };
  });
}

export async function saveSupplier(s: Session, input: SupplierInput): Promise<string> {
  assertEditor(s);
  return run(s, async (tx) => {
    const values = {
      companyName: input.companyName, email: input.email, orderEmail: input.orderEmail, phone: input.phone,
      customerNumber: input.customerNumber, leadTimeDays: input.leadTimeDays, minOrderCents: input.minOrderCents,
    };
    if (input.id) {
      await tx`update suppliers set ${tx(values)} where id = ${input.id}`;
      return input.id;
    }
    return (await tx<{ id: string }[]>`insert into suppliers ${tx({ ...values, libraryId: s.libraryId })} returning id`)[0].id;
  }).catch((e) => {
    if ((e as Error).message === "Diesen Eintrag gibt es schon.") throw new Error("Einen Lieferanten mit diesem Namen gibt es schon.");
    throw e;
  });
}

export async function archiveSupplier(s: Session, id: string): Promise<{ pricesRemoved: number }> {
  assertEditor(s);
  return run(s, async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from purchase_orders where supplier_id = ${id} and status in ('draft', 'ordered', 'partially_delivered')`;
    if (n) throw new Error(`Bei diesem Lieferanten gibt es noch ${n} offene Bestellung(en) oder Entwürfe. Erst abschließen oder löschen.`);
    one(await tx`update suppliers set archived_at = now() where id = ${id} and archived_at is null returning id`, "Lieferant");
    const items = await tx`update stock_items set archived_at = now(), is_preferred = false where supplier_id = ${id} and archived_at is null returning id`;
    return { pricesRemoved: items.length };
  });
}

// ---------------------------------------------------------------- recipes

export async function listRecipes(s: Session, f: { q?: string; categoryId?: string } = {}) {
  return run(s, async (tx) => {
    const data = await loadCosting(tx, s.libraryId);
    const [lib] = await tx<{ defaultVatBp: number }[]>`select default_vat_bp from libraries where id = ${s.libraryId}`;
    const cats = new Map((await tx<Category[]>`select id, name from categories where library_id = ${s.libraryId}`).map((c) => [c.id, c.name]));
    const ctx = contextOf(data);
    const memo = new Map<string, RecipeCost>();
    const q = f.q?.trim().toLowerCase();
    return [...data.recipeBy.values()]
      .filter((r) => !r.archivedAt && (!q || r.name.toLowerCase().includes(q)) && (!f.categoryId || r.categoryId === f.categoryId))
      .map((r) => {
        const c = costRecipe(toCostRecipe(r), ctx, memo);
        return {
          id: r.id,
          name: r.name,
          category: (r.categoryId && cats.get(r.categoryId)) || "–",
          productType: r.productType,
          perPortionCents: c.perPortionCents,
          missing: c.missing,
          foodCostBp: foodCostBp(c.perPortionCents, r.sellPriceCents, r.sellPriceIncludesVat, r.vatBp ?? lib.defaultVatBp),
          targetFoodCostBp: r.targetFoodCostBp,
          sellPriceCents: r.sellPriceCents,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
}

export async function getRecipe(s: Session, id: string) {
  if (!isUuid(id)) return null;
  return run(s, async (tx) => {
    const [row] = await tx<Recipe[]>`select * from recipes where id = ${id}`;
    if (!row) return null;
    const lines = await tx<RecipeLine[]>`select id, ingredient_id, sub_recipe_id, quantity, unit, position, note from recipe_lines where recipe_id = ${id} order by position`;
    const extra = await tx<{ allergen: string; status: string }[]>`select allergen, status from recipe_extra_allergens where recipe_id = ${id}`;
    const usedIn = await tx<{ id: string; name: string }[]>`
      select distinct r.id, r.name from recipes r join recipe_lines rl on rl.recipe_id = r.id where rl.sub_recipe_id = ${id} and r.archived_at is null order by r.name`;
    const recipe: Recipe = { ...row, lines, extraAllergens: Object.fromEntries(extra.map((e) => [e.allergen, e.status])) as AllergenRow };
    return { recipe, usedIn };
  });
}

export async function lineOptions(s: Session, excludeRecipeId?: string) {
  return run(s, async (tx) => {
    const ings = await tx<{ value: string; label: string; baseUnit: BaseUnit }[]>`
      select id as value, name as label, base_unit from ingredients where library_id = ${s.libraryId} and archived_at is null`;
    const recs = await tx<{ value: string; label: string; baseUnit: BaseUnit }[]>`
      select id as value, name as label, net_unit as base_unit from recipes
      where library_id = ${s.libraryId} and archived_at is null and product_type = 'semi_finished' and id <> coalesce(${excludeRecipeId ?? null}::uuid, '00000000-0000-0000-0000-000000000000')`;
    return [...ings.map((i) => ({ ...i, hint: "Zutat" })), ...recs.map((r) => ({ ...r, hint: "Unterrezept" }))].sort((a, b) => a.label.localeCompare(b.label, "de"));
  });
}

export async function previewRecipe(s: Session, draft: RecipeDraft) {
  return run(s, async (tx) => {
    const data = await loadCosting(tx, s.libraryId);
    const [lib] = await tx<{ defaultVatBp: number; wageCentsPerHour: number | null }[]>`select default_vat_bp, wage_cents_per_hour from libraries where id = ${s.libraryId}`;
    const id = draft.id ?? "__draft";
    const lines = draft.lines.map((l, i) => ({ ...l, id: String(i), note: null }));
    const cr = toCostRecipe({ ...draft, id, lines });
    const cost = costRecipe(cr, contextOf(data, cr));
    const maps = await allergenMaps(tx, s.libraryId);
    const prepCostCents = draft.prepMinutes && lib.wageCentsPerHour ? ((draft.prepMinutes / 60) * lib.wageCentsPerHour) / draft.portions : null;
    return {
      cost,
      foodCostBp: foodCostBp(cost.perPortionCents, draft.sellPriceCents, draft.sellPriceIncludesVat, draft.vatBp ?? lib.defaultVatBp),
      prepCostCents,
      allergens: recipeAllergens({ lines, extraAllergens: draft.extraAllergens }, maps, data.recipeBy),
    };
  });
}

export async function saveRecipe(s: Session, draft: RecipeDraft): Promise<string> {
  assertEditor(s);
  return run(s, async (tx) => {
    const values = {
      name: draft.name, categoryId: draft.categoryId, productType: draft.productType, portions: draft.portions,
      netQuantityBase: draft.netQuantityBase, netUnit: draft.netUnit, sellPriceCents: draft.sellPriceCents,
      sellPriceIncludesVat: draft.sellPriceIncludesVat, vatBp: draft.vatBp, targetFoodCostBp: draft.targetFoodCostBp,
      prepMinutes: draft.prepMinutes, instructions: draft.instructions,
    };
    let id = draft.id;
    if (id) {
      const [old] = await tx<{ productType: string }[]>`select product_type from recipes where id = ${id}`;
      if (!old) throw new Error("Rezept nicht gefunden.");
      if (old.productType === "semi_finished" && draft.productType === "finished") {
        const [usedAsSub] = await tx`select 1 from recipe_lines where sub_recipe_id = ${id}`;
        if (usedAsSub) throw new Error("Dieses Rezept wird als Unterrezept verwendet und muss halbfertig bleiben.");
      }
      await tx`update recipes set ${tx(values)} where id = ${id}`;
      await tx`delete from recipe_lines where recipe_id = ${id}`;
      await tx`delete from recipe_extra_allergens where recipe_id = ${id}`;
    } else {
      id = (await tx<{ id: string }[]>`insert into recipes ${tx({ ...values, libraryId: s.libraryId })} returning id`)[0].id;
    }
    const lines = draft.lines.map((l, i) => ({ recipeId: id, ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, unit: l.unit, position: i }));
    if (lines.length) await tx`insert into recipe_lines ${tx(lines)}`; // the cycle trigger rejects A -> B -> A
    const extra = Object.entries(draft.extraAllergens).map(([allergen, status]) => ({ recipeId: id, allergen, status }));
    if (extra.length) await tx`insert into recipe_extra_allergens ${tx(extra)}`;
    return id!;
  });
}

export async function archiveRecipe(s: Session, id: string) {
  assertEditor(s);
  await run(s, async (tx) => {
    const parents = await tx<{ name: string }[]>`
      select distinct r.name from recipes r join recipe_lines rl on rl.recipe_id = r.id where rl.sub_recipe_id = ${id} and r.archived_at is null
      union all
      select distinct 'Menü „' || m.name || '“' from menus m join menu_courses c on c.menu_id = m.id join menu_items mi on mi.course_id = c.id
      where mi.recipe_id = ${id} and m.archived_at is null`;
    if (parents.length) throw new Error(`Wird noch verwendet in: ${parents.map((r) => r.name).join(", ")}.`);
    await tx`update recipes set archived_at = now() where id = ${id}`;
  });
}

// ---------------------------------------------------------------- menus

async function loadMenus(tx: Tx, lib: string, id?: string): Promise<Menu[]> {
  const menus = await tx<Omit<Menu, "courses">[]>`
    select id, library_id, name, category_id, price_cents, price_includes_vat, vat_bp, target_margin_bp, valid_from, valid_to, archived_at, updated_at
    from menus where library_id = ${lib} and (${id ?? null}::uuid is null or id = ${id ?? null})`;
  if (!menus.length) return [];
  const courses = await tx<(Omit<MenuCourse, "items"> & { menuId: string })[]>`
    select id, menu_id, name, position from menu_courses where menu_id = any(${menus.map((m) => m.id)}::uuid[]) order by position`;
  const items = await tx<(MenuCourse["items"][number] & { courseId: string })[]>`
    select id, course_id, recipe_id, portions, position from menu_items where course_id = any(${courses.map((c) => c.id)}::uuid[]) order by position`;
  return menus.map((m) => ({
    ...m,
    courses: courses.filter((c) => c.menuId === m.id).map(({ menuId: _, ...c }) => ({ ...c, items: items.filter((i) => i.courseId === c.id).map(({ courseId: __, ...i }) => i) })),
  }));
}

export async function listMenus(s: Session, f: { q?: string } = {}) {
  return run(s, async (tx) => {
    const [data, menus, [lib], cats] = await Promise.all([
      loadCosting(tx, s.libraryId),
      loadMenus(tx, s.libraryId),
      tx<{ defaultVatBp: number }[]>`select default_vat_bp from libraries where id = ${s.libraryId}`,
      tx<Category[]>`select id, name from categories where library_id = ${s.libraryId} and kind = 'menu'`,
    ]);
    const ctx = contextOf(data);
    const memo = new Map<string, RecipeCost>();
    const q = f.q?.trim().toLowerCase();
    return menus
      .filter((m) => !m.archivedAt && (!q || m.name.toLowerCase().includes(q)))
      .map((m) => {
        const sum = summarizeMenu(m, ctx, lib.defaultVatBp, memo);
        return {
          id: m.id, name: m.name, category: cats.find((c) => c.id === m.categoryId)?.name ?? "–",
          courses: m.courses.length, dishes: m.courses.reduce((n, c) => n + c.items.length, 0),
          priceCents: m.priceCents, costCents: sum.costCents, missing: sum.missing, foodCostBp: sum.foodCostBp,
          marginBp: sum.marginBp, targetMarginBp: m.targetMarginBp, belowTarget: sum.belowTarget, validTo: m.validTo,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
}

export async function getMenu(s: Session, id: string, servings = 1) {
  if (!isUuid(id)) return null;
  return run(s, async (tx) => {
    const [menu] = await loadMenus(tx, s.libraryId, id);
    if (!menu) return null;
    const data = await loadCosting(tx, s.libraryId);
    const [lib] = await tx<{ defaultVatBp: number }[]>`select default_vat_bp from libraries where id = ${s.libraryId}`;
    const ctx = contextOf(data);
    return { menu, summary: summarizeMenu(menu, ctx, lib.defaultVatBp), bom: billOfMaterials(menu, ctx, servings) };
  });
}

export async function saveMenu(s: Session, draft: MenuDraft): Promise<string> {
  assertEditor(s);
  return run(s, async (tx) => {
    const recipeIds = [...new Set(draft.courses.flatMap((c) => c.items.map((i) => i.recipeId)))];
    if (recipeIds.some((r) => !isUuid(r))) throw new Error("Ein gewähltes Rezept gibt es nicht mehr.");
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from recipes where id = any(${recipeIds}::uuid[]) and archived_at is null`;
    if (n !== recipeIds.length) throw new Error("Ein gewähltes Rezept gibt es nicht mehr.");
    const values = {
      name: draft.name, categoryId: draft.categoryId, priceCents: draft.priceCents, priceIncludesVat: draft.priceIncludesVat,
      vatBp: draft.vatBp, targetMarginBp: draft.targetMarginBp, validFrom: draft.validFrom, validTo: draft.validTo,
    };
    let id = draft.id;
    if (id) {
      const updated = await tx`update menus set ${tx(values)}, updated_at = now() where id = ${id} and archived_at is null returning id`;
      if (!updated.length) throw new Error("Menü nicht gefunden.");
      await tx`delete from menu_courses where menu_id = ${id}`; // cascades the items
    } else {
      id = (await tx<{ id: string }[]>`insert into menus ${tx({ ...values, libraryId: s.libraryId })} returning id`)[0].id;
    }
    for (const [p, c] of draft.courses.entries()) {
      const [course] = await tx<{ id: string }[]>`insert into menu_courses ${tx({ menuId: id, name: c.name, position: p })} returning id`;
      if (c.items.length) await tx`insert into menu_items ${tx(c.items.map((it, i) => ({ courseId: course.id, recipeId: it.recipeId, portions: it.portions, position: i })))}`;
    }
    return id!;
  });
}

export async function archiveMenu(s: Session, id: string) {
  assertEditor(s);
  await run(s, (tx) => tx`update menus set archived_at = now() where id = ${id}`);
}

// ---------------------------------------------------------------- stock

export async function getStock(s: Session, outletId: string, q = "") {
  const like = q.trim() ? `%${q.trim().toLowerCase()}%` : null;
  return run(s, async (tx) => {
    const rows = await tx<{ id: string; name: string; baseUnit: BaseUnit; category: string | null; quantityBase: number | null; avgCostCents: number | null; minLevelBase: number | null; parLevelBase: number | null }[]>`
      select i.id, i.name, i.base_unit, c.name as category, sl.quantity_base, sl.avg_cost_cents, oi.min_level_base, oi.par_level_base
      from outlet_ingredients oi
      join ingredients i on i.id = oi.ingredient_id and i.archived_at is null
      left join categories c on c.id = i.category_id
      left join stock_levels sl on sl.outlet_id = oi.outlet_id and sl.ingredient_id = i.id
      where oi.outlet_id = ${outletId} and (${like}::text is null or lower(i.name) like ${like})`;
    return rows
      .map((r) => {
        const qty = r.quantityBase ?? 0;
        const avg = r.avgCostCents ?? 0;
        return {
          id: r.id, name: r.name, baseUnit: r.baseUnit, category: r.category ?? "–", quantityBase: qty, avgCostCents: avg,
          valueCents: Math.max(qty, 0) * avg, minLevelBase: r.minLevelBase, parLevelBase: r.parLevelBase, belowMin: r.minLevelBase != null && qty < r.minLevelBase,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
}

export async function listStockEvents(s: Session, outletId: string, type?: StockEvent["type"]) {
  return run(s, async (tx) => {
    const events = await tx<(StockEvent & { createdByName: string | null })[]>`
      select e.*, (select m.display_name from memberships m where m.user_id = e.created_by and m.library_id = ${s.libraryId}) as created_by_name
      from stock_events e where e.outlet_id = ${outletId} and (${type ?? null}::stock_event_type is null or e.type = ${type ?? null})
      order by e.occurred_at desc limit 200`;
    if (!events.length) return [];
    const moves = await tx<(StockMovement & { eventId: string; ingredient: string; baseUnit: BaseUnit })[]>`
      select m.id, m.stock_event_id as event_id, m.outlet_id, m.ingredient_id, m.delta_base, m.unit_cost_cents, m.counted_base, m.reason,
             i.name as ingredient, i.base_unit
      from stock_movements m join ingredients i on i.id = m.ingredient_id
      where m.stock_event_id = any(${events.map((e) => e.id)}::uuid[])`;
    return events.map((e) => {
      const lines = moves.filter((m) => m.eventId === e.id);
      return { ...e, createdByName: e.createdByName ?? "–", valueCents: lines.reduce((sum, m) => sum + m.deltaBase * m.unitCostCents, 0), lines };
    });
  });
}

export async function recordWaste(s: Session, outletId: string, lines: { ingredientId: string; quantityBase: number; reason: string }[]) {
  if (!lines.length) throw new Error("Mindestens eine Position angeben.");
  return run(s, async (tx) => {
    const [ev] = await tx<{ id: string }[]>`
      insert into stock_events (library_id, outlet_id, type, created_by, closed_at) values (${s.libraryId}, ${outletId}, 'waste', ${s.userId}, now()) returning id`;
    // unit cost is set to the current average by the trigger for outgoing movements
    await tx`insert into stock_movements ${tx(lines.map((l) => ({ stockEventId: ev.id, outletId, ingredientId: l.ingredientId, deltaBase: -l.quantityBase, reason: l.reason })))}`;
    return ev.id;
  });
}

/** Minimum (warns, daily alert) and target level (order suggestion) of an item in one outlet. null clears. */
export async function setStockLevels(s: Session, outletId: string, ingredientId: string, v: { minLevelBase: number | null; parLevelBase: number | null }) {
  if (v.minLevelBase !== null && v.parLevelBase !== null && v.minLevelBase > v.parLevelBase) throw new Error("Der Mindestbestand liegt über dem Zielbestand.");
  await run(s, async (tx) => {
    const updated = await tx`
      update outlet_ingredients set min_level_base = ${v.minLevelBase}, par_level_base = ${v.parLevelBase}
      where outlet_id = ${outletId} and ingredient_id = ${ingredientId} returning 1`;
    if (!updated.length) throw new Error("Diese Zutat wird in diesem Outlet nicht geführt.");
  });
}

/** Moves stock to another outlet, valued at the sender's average cost. */
export async function recordTransfer(s: Session, fromOutletId: string, toOutletId: string, lines: { ingredientId: string; quantityBase: number }[]) {
  if (fromOutletId === toOutletId) throw new Error("Bitte ein anderes Outlet als Ziel wählen.");
  if (!lines.length) throw new Error("Mindestens eine Position angeben.");
  return run(s, async (tx) => {
    const [access] = await tx<{ from: boolean; to: boolean }[]>`select can_access_outlet(${fromOutletId}) as from, can_access_outlet(${toOutletId}) as to`;
    if (!access.from || !access.to) throw new Forbidden();
    const [ev] = await tx<{ id: string }[]>`
      insert into stock_events (library_id, outlet_id, type, counterpart_outlet_id, created_by, closed_at)
      values (${s.libraryId}, ${fromOutletId}, 'transfer', ${toOutletId}, ${s.userId}, now()) returning id`;
    for (const l of lines) {
      // The trigger books the outgoing line at the sender's average; the receiver takes that value.
      const [out] = await tx<{ unitCostCents: number }[]>`
        insert into stock_movements ${tx({ stockEventId: ev.id, outletId: fromOutletId, ingredientId: l.ingredientId, deltaBase: -l.quantityBase })} returning unit_cost_cents`;
      await tx`insert into stock_movements ${tx({ stockEventId: ev.id, outletId: toOutletId, ingredientId: l.ingredientId, deltaBase: l.quantityBase, unitCostCents: out.unitCostCents })}`;
      await tx`insert into outlet_ingredients (outlet_id, ingredient_id) values (${toOutletId}, ${l.ingredientId}) on conflict do nothing`;
    }
    return ev.id;
  });
}

/** Transfers that left or reached the outlet, newest first. */
export async function listTransfers(s: Session, outletId: string) {
  return run(s, async (tx) => {
    const visible = await tx<{ id: string; occurredAt: string; outletId: string; counterpartOutletId: string; by: string | null }[]>`
      select e.id, e.occurred_at, e.outlet_id, e.counterpart_outlet_id,
        (select m.display_name from memberships m where m.user_id = e.created_by and m.library_id = e.library_id) as by
      from stock_events e
      where e.type = 'transfer' and (e.outlet_id = ${outletId} or e.counterpart_outlet_id = ${outletId})
      order by e.occurred_at desc limit 100`;
    if (!visible.length) return [];
    // The other outlet's name and the sender's lines are read with the service role, but only for events
    // the user may see: staff of the receiving outlet may not read the sending outlet itself.
    const ids = visible.map((e) => e.id);
    const names = new Map((await asService((sv) => sv<{ id: string; name: string }[]>`
      select id, name from outlets where id = any(${[...new Set(visible.flatMap((e) => [e.outletId, e.counterpartOutletId]))]}::uuid[])`)).map((o) => [o.id, o.name]));
    const events = visible.map((e) => ({ ...e, from: names.get(e.outletId) ?? "–", to: names.get(e.counterpartOutletId) ?? "–" }));
    const moves = await asService((sv) => sv<{ id: string; eventId: string; ingredient: string; baseUnit: BaseUnit; deltaBase: number; unitCostCents: number }[]>`
      select m.id, m.stock_event_id as event_id, i.name as ingredient, i.base_unit, m.delta_base, m.unit_cost_cents
      from stock_movements m join stock_events e on e.id = m.stock_event_id join ingredients i on i.id = m.ingredient_id
      where m.stock_event_id = any(${ids}::uuid[]) and m.outlet_id = e.outlet_id`);
    return events.map((e) => {
      const outgoing = moves.filter((m) => m.eventId === e.id);
      const out = e.outletId === outletId;
      return {
        id: e.id, occurredAt: e.occurredAt, direction: out ? ("out" as const) : ("in" as const), otherOutlet: out ? e.to : e.from, by: e.by ?? "–",
        valueCents: outgoing.reduce((t, m) => t - m.deltaBase * m.unitCostCents, 0),
        lines: outgoing.map((m) => ({ id: m.id, ingredient: m.ingredient, baseUnit: m.baseUnit, quantityBase: -m.deltaBase })),
      };
    });
  });
}

/** Stock report for the calendar days fromDay..toDay (inclusive) in the outlet's time zone. */
export async function getStockReport(s: Session, outletId: string, fromDay: string, toDay: string) {
  return run(s, async (tx) => {
    const [outlet] = await tx<{ timezone: string }[]>`select timezone from outlets where id = ${outletId}`;
    if (!outlet) return [];
    const to = startOfDay(addDays(toDay, 1), outlet.timezone);
    const moves = await tx<{ ingredientId: string; eventType: string; occurredAt: string; deltaBase: number; unitCostCents: number }[]>`
      select m.ingredient_id, e.type as event_type, e.occurred_at, m.delta_base, m.unit_cost_cents
      from stock_movements m join stock_events e on e.id = m.stock_event_id
      where m.outlet_id = ${outletId} and e.status = 'closed' and e.occurred_at < ${to}`;
    const ings = await tx<{ id: string; name: string; baseUnit: BaseUnit; category: string | null }[]>`
      select i.id, i.name, i.base_unit, c.name as category from ingredients i left join categories c on c.id = i.category_id
      where i.id = any(${[...new Set(moves.map((m) => m.ingredientId))]}::uuid[])`;
    const byId = new Map(ings.map((i) => [i.id, i]));
    return stockReport(moves.map((m) => ({ ...m, occurredAt: new Date(m.occurredAt).toISOString() })), startOfDay(fromDay, outlet.timezone), to)
      .map((r) => {
        const i = byId.get(r.ingredientId)!;
        return { ...r, name: i.name, baseUnit: i.baseUnit, category: i.category ?? "–" };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
}

export async function getOpenCount(s: Session, outletId: string) {
  return run(s, async (tx) => {
    const [event] = await tx<StockEvent[]>`select * from stock_events where outlet_id = ${outletId} and type = 'count' and status = 'open'`;
    if (!event) return null;
    const lines = await tx<{ ingredientId: string; countedBase: number; breakdown: CountBreakdown | null }[]>`select ingredient_id, counted_base, breakdown from stock_count_lines where stock_event_id = ${event.id}`;
    const packs = await tx<{ id: string; ingredientId: string; label: string; quantityBase: number }[]>`
      select p.id, p.ingredient_id, p.label, p.quantity_base from packages p
      join outlet_ingredients oi on oi.ingredient_id = p.ingredient_id and oi.outlet_id = ${outletId}
      order by p.quantity_base`;
    const packages: Record<string, { id: string; label: string; quantityBase: number }[]> = {};
    for (const p of packs) (packages[p.ingredientId] ??= []).push({ id: p.id, label: p.label, quantityBase: p.quantityBase });
    return {
      event,
      draft: Object.fromEntries(lines.map((l) => [l.ingredientId, l.countedBase])) as Record<string, number>,
      breakdown: Object.fromEntries(lines.filter((l) => l.breakdown).map((l) => [l.ingredientId, l.breakdown!])) as Record<string, CountBreakdown>,
      packages,
    };
  });
}

export async function startCount(s: Session, outletId: string) {
  return run(s, async (tx) => {
    const [open] = await tx`select 1 from stock_events where outlet_id = ${outletId} and type = 'count' and status = 'open'`;
    if (open) throw new Error("Für dieses Outlet läuft schon eine Inventur.");
    const [ev] = await tx<{ id: string }[]>`insert into stock_events (library_id, outlet_id, type, status, created_by) values (${s.libraryId}, ${outletId}, 'count', 'open', ${s.userId}) returning id`;
    return ev.id;
  });
}

export async function saveCountLines(s: Session, eventId: string, counted: Record<string, CountEntry>) {
  await run(s, async (tx) => {
    const [ev] = await tx`select 1 from stock_events where id = ${eventId} and status = 'open'`;
    if (!ev) throw new Error("Diese Inventur ist nicht mehr offen.");
    for (const [ingredientId, entry] of Object.entries(counted)) {
      if (entry === null) {
        await tx`delete from stock_count_lines where stock_event_id = ${eventId} and ingredient_id = ${ingredientId}`;
        continue;
      }
      let qty = entry as number;
      let breakdown: CountBreakdown | null = null;
      if (typeof entry !== "number") {
        const packs = await tx<{ id: string; quantityBase: number }[]>`select id, quantity_base from packages where ingredient_id = ${ingredientId}`;
        qty = countTotal(entry, packs);
        breakdown = entry;
      }
      await tx`
        insert into stock_count_lines (stock_event_id, ingredient_id, counted_base, breakdown) values (${eventId}, ${ingredientId}, ${qty}, ${breakdown ? tx.json(breakdown) : null})
        on conflict (stock_event_id, ingredient_id) do update set counted_base = excluded.counted_base, breakdown = excluded.breakdown, updated_at = now()`;
    }
  });
}

export async function closeCount(s: Session, eventId: string) {
  return run(s, async (tx) => {
    const [ev] = await tx<{ outletId: string }[]>`select outlet_id from stock_events where id = ${eventId} and status = 'open' for update`;
    if (!ev) throw new Error("Diese Inventur ist nicht mehr offen.");
    const lines = await tx<{ ingredientId: string; countedBase: number; onHand: number | null; avg: number | null; listPrice: number | null }[]>`
      select cl.ingredient_id, cl.counted_base, sl.quantity_base as on_hand, sl.avg_cost_cents as avg,
        (select case when si.price_type = 'per_pack' then si.price_cents / p.quantity_base else si.price_cents / nullif(si.price_unit_quantity, 0) end
           from stock_items si join packages p on p.id = si.package_id
           where si.ingredient_id = cl.ingredient_id and si.archived_at is null order by si.is_preferred desc limit 1) as list_price
      from stock_count_lines cl left join stock_levels sl on sl.outlet_id = ${ev.outletId} and sl.ingredient_id = cl.ingredient_id
      where cl.stock_event_id = ${eventId}`;
    let changed = 0;
    for (const l of lines) {
      const delta = l.countedBase - (l.onHand ?? 0);
      if (Math.abs(delta) < 1e-9) continue;
      await tx`insert into stock_movements ${tx({ stockEventId: eventId, outletId: ev.outletId, ingredientId: l.ingredientId, deltaBase: delta, unitCostCents: l.avg || l.listPrice || 0, countedBase: l.countedBase })}`;
      changed++;
    }
    await tx`update stock_events set status = 'closed', closed_at = now() where id = ${eventId}`;
    return { counted: lines.length, changed };
  });
}

// ---------------------------------------------------------------- purchasing

type OrderRow = Omit<PurchaseOrder, "lines" | "received">;
type LineRow = PurchaseOrder["lines"][number] & { purchaseOrderId: string; receivedPacks: number };

async function loadOrders(tx: Tx, where: { outletId?: string; id?: string; statuses?: string[] }) {
  const orders = await tx<OrderRow[]>`
    select id, outlet_id, supplier_id, order_number, status, ordered_at, expected_delivery_date, note, created_at
    from purchase_orders
    where (${where.outletId ?? null}::uuid is null or outlet_id = ${where.outletId ?? null})
      and (${where.id ?? null}::uuid is null or id = ${where.id ?? null})
      and (${where.statuses ?? null}::po_status[] is null or status = any(${where.statuses ?? null}::po_status[]))
    order by created_at desc`;
  if (!orders.length) return [];
  const lines = await tx<LineRow[]>`
    select id, purchase_order_id, stock_item_id, quantity_packs, unit_price_cents, received_packs from purchase_order_lines
    where purchase_order_id = any(${orders.map((o) => o.id)}::uuid[])`;
  return orders.map((o): PurchaseOrder => {
    const mine = lines.filter((l) => l.purchaseOrderId === o.id);
    return {
      ...o,
      lines: mine.map((l) => ({ id: l.id, stockItemId: l.stockItemId, quantityPacks: l.quantityPacks, unitPriceCents: l.unitPriceCents })),
      received: Object.fromEntries(mine.filter((l) => l.receivedPacks > 0).map((l) => [l.id, l.receivedPacks])),
    };
  });
}
const orderTotal = (o: PurchaseOrder) => o.lines.reduce((sum, l) => sum + l.quantityPacks * l.unitPriceCents, 0);
const TAB_STATUSES = { draft: ["draft"], open: ["ordered", "partially_delivered"], delivered: ["delivered", "cancelled"] };

export async function listOrders(s: Session, outletId: string, tab: "draft" | "open" | "delivered") {
  return run(s, async (tx) => {
    const orders = await loadOrders(tx, { outletId, statuses: TAB_STATUSES[tab] });
    const names = new Map((await tx<{ id: string; companyName: string }[]>`select id, company_name from suppliers where library_id = ${s.libraryId}`).map((x) => [x.id, x.companyName]));
    return orders.map((o) => ({ ...o, supplier: names.get(o.supplierId) ?? "–", totalCents: orderTotal(o) }));
  });
}

export async function orderCounts(s: Session, outletId: string) {
  return run(s, async (tx) => {
    const rows = await tx<{ status: string; n: number }[]>`select status, count(*)::int as n from purchase_orders where outlet_id = ${outletId} group by status`;
    const n = (st: string[]) => rows.filter((r) => st.includes(r.status)).reduce((sum, r) => sum + r.n, 0);
    return { draft: n(TAB_STATUSES.draft), open: n(TAB_STATUSES.open), delivered: n(TAB_STATUSES.delivered) };
  });
}

export async function getOrder(s: Session, id: string) {
  if (!isUuid(id)) return null;
  return run(s, async (tx) => {
    const [order] = await loadOrders(tx, { id });
    if (!order) return null;
    const [supplier] = await tx<Supplier[]>`select * from suppliers where id = ${order.supplierId}`;
    const [outlet] = await tx<Outlet[]>`select id, library_id, name, is_central_kitchen, timezone, archived_at from outlets where id = ${order.outletId}`;
    const items = await tx<{ id: string; name: string; label: string; weighted: boolean }[]>`
      select si.id, si.name, p.label, si.weighted from stock_items si join packages p on p.id = si.package_id
      where si.id = any(${order.lines.map((l) => l.stockItemId)}::uuid[])`;
    const lines = order.lines.map((l) => {
      const si = items.find((x) => x.id === l.stockItemId)!;
      return { ...l, name: si.name, packageLabel: si.label, weighted: si.weighted, receivedPacks: order.received[l.id] ?? 0 };
    });
    return { order, supplier, lines, totalCents: orderTotal(order), outlet };
  });
}

export async function orderableItems(s: Session, outletId: string, supplierId: string) {
  return run(s, async (tx) => {
    const rows = await tx<{ stockItemId: string; name: string; baseUnit: BaseUnit; packageLabel: string; packBase: number; priceType: string; priceCents: number; priceUnitQuantity: number | null; onHandBase: number | null; parLevelBase: number | null; onOrderBase: number }[]>`
      select si.id as stock_item_id, si.name, i.base_unit, p.label as package_label, p.quantity_base as pack_base,
             si.price_type, si.price_cents, si.price_unit_quantity, sl.quantity_base as on_hand_base, oi.par_level_base,
             coalesce((
               select sum((pol.quantity_packs - pol.received_packs) * p2.quantity_base)
               from purchase_order_lines pol
               join purchase_orders po on po.id = pol.purchase_order_id and po.outlet_id = ${outletId} and po.status in ('ordered', 'partially_delivered')
               join stock_items si2 on si2.id = pol.stock_item_id and si2.ingredient_id = si.ingredient_id
               join packages p2 on p2.id = si2.package_id), 0) as on_order_base
      from stock_items si
      join packages p on p.id = si.package_id
      join ingredients i on i.id = si.ingredient_id and i.archived_at is null
      join outlet_ingredients oi on oi.ingredient_id = i.id and oi.outlet_id = ${outletId}
      left join stock_levels sl on sl.ingredient_id = i.id and sl.outlet_id = ${outletId}
      where si.supplier_id = ${supplierId} and si.archived_at is null`;
    return rows
      .map((r) => {
        const packPrice = r.priceType === "per_pack" ? r.priceCents : Math.round((r.priceCents / (r.priceUnitQuantity || 1)) * r.packBase);
        return {
          stockItemId: r.stockItemId, name: r.name, baseUnit: r.baseUnit, packageLabel: r.packageLabel, packPriceCents: packPrice,
          onHandBase: r.onHandBase ?? 0, parLevelBase: r.parLevelBase,
          suggestedPacks: suggestPacks(r.parLevelBase, r.onHandBase ?? 0, r.onOrderBase, r.packBase),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  });
}

export async function saveOrderDraft(s: Session, input: { id?: string; outletId: string; supplierId: string; expectedDeliveryDate: string | null; note: string | null; lines: { stockItemId: string; quantityPacks: number }[] }) {
  const wanted = input.lines.filter((l) => l.quantityPacks > 0);
  if (!wanted.length) throw new Error("Die Bestellung hat keine Positionen.");
  return run(s, async (tx) => {
    const prices = await tx<{ id: string; packPrice: number }[]>`
      select si.id, case when si.price_type = 'per_pack' then si.price_cents else round(si.price_cents / nullif(si.price_unit_quantity, 0) * p.quantity_base) end as pack_price
      from stock_items si join packages p on p.id = si.package_id
      where si.id = any(${wanted.map((l) => l.stockItemId)}::uuid[]) and si.supplier_id = ${input.supplierId}`;
    if (prices.length !== wanted.length) throw new Error("Ein Artikel gehört nicht zu diesem Lieferanten.");
    let id = input.id;
    if (id) {
      const [o] = await tx<{ status: string }[]>`select status from purchase_orders where id = ${id} for update`;
      if (!o || o.status !== "draft") throw new Error("Nur Entwürfe können geändert werden.");
      await tx`update purchase_orders set supplier_id = ${input.supplierId}, expected_delivery_date = ${input.expectedDeliveryDate}, note = ${input.note} where id = ${id}`;
      await tx`delete from purchase_order_lines where purchase_order_id = ${id}`;
    } else {
      const [{ nextOrderNumber }] = await tx<{ nextOrderNumber: string }[]>`select next_order_number(${s.libraryId})`;
      id = (await tx<{ id: string }[]>`
        insert into purchase_orders (library_id, outlet_id, supplier_id, order_number, expected_delivery_date, note, created_by)
        values (${s.libraryId}, ${input.outletId}, ${input.supplierId}, ${nextOrderNumber}, ${input.expectedDeliveryDate}, ${input.note}, ${s.userId}) returning id`)[0].id;
    }
    await tx`insert into purchase_order_lines ${tx(wanted.map((l) => ({ purchaseOrderId: id, stockItemId: l.stockItemId, quantityPacks: l.quantityPacks, unitPriceCents: prices.find((p) => p.id === l.stockItemId)!.packPrice })))}`;
    return id!;
  });
}

/** Marks the order as sent; the caller sends the email (once, keyed by the order id). */
export async function sendOrder(s: Session, id: string) {
  return run(s, async (tx) => {
    const [o] = await tx<{ status: string; orderEmail: string | null }[]>`
      select po.status, sp.order_email from purchase_orders po join suppliers sp on sp.id = po.supplier_id where po.id = ${id} for update of po`;
    if (!o) throw new Error("Bestellung nicht gefunden.");
    if (o.status !== "draft") return { alreadySent: true, to: null };
    await tx`update purchase_orders set status = 'ordered', ordered_at = now() where id = ${id}`;
    return { alreadySent: false, to: o.orderEmail };
  });
}

export async function deleteOrderDraft(s: Session, id: string) {
  await run(s, async (tx) => {
    const [o] = await tx<{ status: string }[]>`select status from purchase_orders where id = ${id}`;
    if (!o) return;
    if (o.status !== "draft") throw new Error("Nur Entwürfe können gelöscht werden.");
    await tx`delete from purchase_orders where id = ${id}`;
  });
}

export async function receiveDelivery(s: Session, id: string, input: { lines: { lineId: string; packs: number; weightBase?: number | null }[]; addToStock: boolean }) {
  return run(s, async (tx) => {
    const [o] = await tx<{ status: string; outletId: string }[]>`select status, outlet_id from purchase_orders where id = ${id} for update`;
    if (!o) throw new Error("Bestellung nicht gefunden.");
    if (o.status !== "ordered" && o.status !== "partially_delivered") throw new Error("Diese Bestellung erwartet keine Lieferung.");
    const received = input.lines.filter((l) => l.packs > 0 || (l.weightBase ?? 0) > 0);
    if (!received.length) throw new Error("Es wurde nichts als geliefert eingetragen.");
    const lines = await tx<{ id: string; quantityPacks: number; receivedPacks: number; unitPriceCents: number; ingredientId: string; name: string; weighted: boolean; packBase: number; perUnit: number }[]>`
      select pol.id, pol.quantity_packs, pol.received_packs, pol.unit_price_cents, si.ingredient_id, si.name, si.weighted, p.quantity_base as pack_base,
             case when si.price_type = 'per_pack' then si.price_cents / p.quantity_base else si.price_cents / nullif(si.price_unit_quantity, 0) end as per_unit
      from purchase_order_lines pol join stock_items si on si.id = pol.stock_item_id join packages p on p.id = si.package_id
      where pol.purchase_order_id = ${id}`;
    for (const r of received) {
      const l = lines.find((x) => x.id === r.lineId);
      if (!l) throw new Error("Unbekannte Position.");
      const open = l.quantityPacks - l.receivedPacks;
      if (r.packs > open + 1e-9) throw new Error(`„${l.name}“: ${r.packs} geliefert, offen sind nur ${open}. Mehrlieferungen bitte als eigene Position erfassen.`);
    }
    const [ev] = await tx<{ id: string }[]>`
      insert into stock_events (library_id, outlet_id, type, purchase_order_id, note, created_by, closed_at)
      values (${s.libraryId}, ${o.outletId}, 'delivery', ${id}, ${input.addToStock ? null : "Ohne Lagerbuchung"}, ${s.userId}, now()) returning id`;
    for (const r of received) {
      const l = lines.find((x) => x.id === r.lineId)!;
      await tx`update purchase_order_lines set received_packs = received_packs + ${r.packs} where id = ${l.id}`;
      if (input.addToStock) {
        const weighed = l.weighted && r.weightBase ? r.weightBase : null;
        const base = weighed ?? r.packs * l.packBase;
        const cost = weighed ? l.perUnit : (r.packs * l.unitPriceCents) / (base || 1);
        await tx`insert into stock_movements ${tx({ stockEventId: ev.id, outletId: o.outletId, ingredientId: l.ingredientId, deltaBase: base, unitCostCents: cost })}`;
      }
    }
    const [{ complete }] = await tx<{ complete: boolean }[]>`select bool_and(received_packs >= quantity_packs) as complete from purchase_order_lines where purchase_order_id = ${id}`;
    const status = complete ? "delivered" : "partially_delivered";
    await tx`update purchase_orders set status = ${status} where id = ${id}`;
    return { status: status as "delivered" | "partially_delivered" };
  });
}

// ---------------------------------------------------------------- dashboard

export async function dashboard(s: Session, outletId: string) {
  const [stock, recipes, counts, waste] = await Promise.all([
    getStock(s, outletId),
    listRecipes(s),
    orderCounts(s, outletId),
    run(s, (tx) => tx<{ cents: number | null }[]>`
      select -sum(m.delta_base * m.unit_cost_cents) as cents from stock_movements m join stock_events e on e.id = m.stock_event_id
      where m.outlet_id = ${outletId} and e.type = 'waste' and e.occurred_at > now() - interval '7 days'`),
  ]);
  const priced = recipes.filter((r) => r.foodCostBp !== null && r.productType === "finished");
  return {
    stockValueCents: stock.reduce((sum, r) => sum + r.valueCents, 0),
    belowMin: stock.filter((r) => r.belowMin),
    avgFoodCostBp: priced.length ? Math.round(priced.reduce((sum, r) => sum + r.foodCostBp!, 0) / priced.length) : null,
    overTarget: priced.filter((r) => r.targetFoodCostBp !== null && r.foodCostBp! > r.targetFoodCostBp),
    missingPrices: recipes.filter((r) => r.missing > 0),
    openOrders: counts.open,
    draftOrders: counts.draft,
    wasteCents: waste[0]?.cents ?? 0,
  };
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ---------------------------------------------------------------- session & accounts

export async function getMembership(userId: string): Promise<Session | null> {
  if (!isUuid(userId)) return null;
  return asUser(userId, async (tx) => {
    const [m] = await tx<{ libraryId: string; role: Session["role"]; displayName: string; email: string; allOutlets: boolean; outletIds: string[] }[]>`
      select m.library_id, m.role, m.display_name, m.email, m.all_outlets,
             coalesce(array_agg(mo.outlet_id) filter (where mo.outlet_id is not null), '{}') as outlet_ids
      from memberships m left join membership_outlets mo on mo.membership_id = m.id
      where m.user_id = ${userId} group by m.id limit 1`;
    if (!m) return null;
    const all = m.allOutlets || m.role === "owner" || m.role === "admin";
    return { userId, name: m.displayName || m.email, email: m.email, role: m.role, libraryId: m.libraryId, outletIds: all ? "all" : m.outletIds };
  });
}

/** Demo login only (local development with seeded users). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const [u] = await asService((tx) => tx<{ id: string }[]>`select id from auth.users where lower(email) = lower(${email})`);
  return u?.id ?? null;
}

export async function createLibrary(userId: string, input: { libraryName: string; outletName: string; ownerName: string }): Promise<string> {
  try {
    return await asUser(userId, async (tx) => (await tx<{ createLibrary: string }[]>`select create_library(${input.libraryName}, ${input.outletName}, ${input.ownerName})`)[0].createLibrary);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new Error("Du gehörst schon zu einem Betrieb.");
    throw friendly(e);
  }
}

export async function invitationPreview(token: string) {
  const hash = await sha256(token);
  const [row] = await asService((tx) => tx<{ libraryName: string; email: string; role: Session["role"]; expired: boolean }[]>`select * from invitation_preview(${hash})`);
  return row ?? null;
}

export async function acceptInvitation(userId: string, token: string, name: string): Promise<string> {
  const hash = await sha256(token);
  try {
    return await asUser(userId, async (tx) => (await tx<{ acceptInvitation: string }[]>`select accept_invitation(${hash}, ${name})`)[0].acceptInvitation);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P0002") throw new Error("Die Einladung ist ungültig oder abgelaufen.");
    if (code === "42501") throw new Error("Die Einladung gilt für eine andere E-Mail-Adresse.");
    throw friendly(e);
  }
}

/**
 * Deletes what belongs only to this user. If they are the library's only member, the whole library goes
 * (cascade). An owner with a team must hand over ownership first, so the team keeps its data.
 */
export async function deleteAccountData(userId: string): Promise<{ ok: boolean; reason?: string }> {
  return asService(async (tx) => {
    const mems = await tx<{ id: string; libraryId: string; role: string; members: number; owners: number }[]>`
      select m.id, m.library_id, m.role,
        (select count(*)::int from memberships x where x.library_id = m.library_id) as members,
        (select count(*)::int from memberships x where x.library_id = m.library_id and x.role = 'owner') as owners
      from memberships m where m.user_id = ${userId}`;
    for (const m of mems) {
      if (m.role === "owner" && m.owners === 1 && m.members > 1) {
        return { ok: false, reason: "Du bist die einzige Inhaberin bzw. der einzige Inhaber eines Teams. Übertrage die Inhaberschaft zuerst." };
      }
    }
    for (const m of mems) {
      if (m.members === 1) await tx`select delete_library(${m.libraryId})`;
      else await tx`delete from memberships where id = ${m.id}`;
    }
    await tx`update stock_events set created_by = null where created_by = ${userId}`;
    return { ok: true };
  });
}
