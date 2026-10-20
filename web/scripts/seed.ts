// Loads the demo bistro (the same fictional data as the in-memory store) into Postgres.
//   DATABASE_URL=postgres://... npx tsx --conditions=react-server scripts/seed.ts
// Replaces an existing demo library. Refuses to run against a real Supabase project unless SEED_FORCE=1,
// because it writes demo users straight into auth.users.
import { createHash } from "node:crypto";
import postgres from "postgres";
import { seed } from "../src/data/store";

/** Stable UUID for a seed id, so links like the screenshot routes stay the same between runs. */
export const sid = (x: string) => {
  const h = createHash("md5").update(`kitchen-ledger:${x}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
const sql = postgres(url, { max: 1, onnotice: () => {}, transform: postgres.camel });
const d = seed();
const u = (x: string | null) => (x ? sid(x) : null);

try {
  const [{ real }] = await sql<{ real: boolean }[]>`select exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'identities') as real`;
  if (real && process.env.SEED_FORCE !== "1") {
    console.error("This looks like a real Supabase project (auth.identities exists). Sign up in the app instead, or set SEED_FORCE=1.");
    process.exit(1);
  }
  await sql.begin(async (tx) => {
    const lib = sid(d.library.id);
    await tx`select delete_library(${lib})`;
    await tx`delete from auth.users where id = any(${d.members.map((m) => sid(m.userId))}::uuid[])`;
    await tx`insert into auth.users ${tx(d.members.map((m) => ({ id: sid(m.userId), email: m.email })))}`;
    await tx`insert into libraries ${tx({ id: lib, name: d.library.name, currency: d.library.currency, defaultVatBp: d.library.defaultVatBp, wageCentsPerHour: d.library.wageCentsPerHour })}`;
    await tx`insert into outlets ${tx(d.outlets.map((o) => ({ id: sid(o.id), libraryId: lib, name: o.name, isCentralKitchen: o.isCentralKitchen, timezone: o.timezone })))}`;
    await tx`insert into memberships ${tx(d.members.map((m) => ({ id: sid(m.id), libraryId: lib, userId: sid(m.userId), role: m.role, allOutlets: m.allOutlets, displayName: m.name, email: m.email })))}`;
    const mo = d.members.flatMap((m) => m.outletIds.map((o) => ({ membershipId: sid(m.id), outletId: sid(o) })));
    if (mo.length) await tx`insert into membership_outlets ${tx(mo)}`;
    await tx`insert into categories ${tx(d.categories.map((c) => ({ id: sid(c.id), libraryId: lib, kind: c.kind, name: c.name })))}`;
    await tx`insert into suppliers ${tx(d.suppliers.map((x) => ({ id: sid(x.id), libraryId: lib, companyName: x.companyName, email: x.email, orderEmail: x.orderEmail, leadTimeDays: x.leadTimeDays })))}`;
    await tx`insert into ingredients ${tx(d.ingredients.map((i) => ({ id: sid(i.id), libraryId: lib, name: i.name, categoryId: u(i.categoryId), baseUnit: i.baseUnit, gramsPerPiece: i.gramsPerPiece, mlPerGram: i.mlPerGram, allergensVerified: d.verified[i.id] ?? false })))}`;
    const pk = [...d.packages].sort((a, b) => Number(!!a.parentPackageId) - Number(!!b.parentPackageId));
    await tx`insert into packages ${tx(pk.map((p) => ({ id: sid(p.id), ingredientId: sid(p.ingredientId), parentPackageId: u(p.parentPackageId), count: p.count, quantityBase: p.quantityBase, label: p.label })))}`;
    await tx`insert into stock_items ${tx(d.stockItems.map((s) => ({ id: sid(s.id), libraryId: lib, ingredientId: sid(s.ingredientId), supplierId: u(s.supplierId), packageId: sid(s.packageId), name: s.name, priceType: s.priceType, priceCents: s.priceCents, priceUnit: s.priceUnit, priceUnitQuantity: s.priceUnitQuantity, isPreferred: s.isPreferred, weighted: s.weighted })))}`;
    const al = Object.entries(d.allergens).flatMap(([ing, map]) => Object.entries(map).map(([allergen, status]) => ({ ingredientId: sid(ing), allergen, status })));
    await tx`insert into ingredient_allergens ${tx(al)}`;
    await tx`insert into outlet_ingredients ${tx(d.outletIngredients.map((o) => ({ outletId: sid(o.outletId), ingredientId: sid(o.ingredientId), parLevelBase: o.parLevelBase, minLevelBase: o.minLevelBase })))}`;
    await tx`insert into recipes ${tx(d.recipes.map((r) => ({ id: sid(r.id), libraryId: lib, name: r.name, categoryId: u(r.categoryId), productType: r.productType, portions: r.portions, netQuantityBase: r.netQuantityBase, netUnit: r.netUnit, sellPriceCents: r.sellPriceCents, sellPriceIncludesVat: r.sellPriceIncludesVat, vatBp: r.vatBp, targetFoodCostBp: r.targetFoodCostBp, prepMinutes: r.prepMinutes, instructions: r.instructions })))}`;
    await tx`insert into recipe_lines ${tx(d.recipes.flatMap((r) => r.lines.map((l) => ({ recipeId: sid(r.id), ingredientId: u(l.ingredientId), subRecipeId: u(l.subRecipeId), quantity: l.quantity, unit: l.unit, position: l.position }))))}`;
    for (const m of d.menus) {
      await tx`insert into menus ${tx({ id: sid(m.id), libraryId: lib, name: m.name, categoryId: u(m.categoryId), priceCents: m.priceCents, priceIncludesVat: m.priceIncludesVat, vatBp: m.vatBp, targetMarginBp: m.targetMarginBp })}`;
      await tx`insert into menu_courses ${tx(m.courses.map((c) => ({ id: sid(`${m.id}:${c.id}`), menuId: sid(m.id), name: c.name, position: c.position })))}`;
      await tx`insert into menu_items ${tx(m.courses.flatMap((c) => c.items.map((it) => ({ courseId: sid(`${m.id}:${c.id}`), recipeId: sid(it.recipeId), portions: it.portions, position: it.position }))))}`;
    }
    for (const o of d.orders) {
      await tx`insert into purchase_orders ${tx({ id: sid(o.id), libraryId: lib, outletId: sid(o.outletId), supplierId: sid(o.supplierId), orderNumber: o.orderNumber, status: o.status, orderedAt: o.orderedAt, expectedDeliveryDate: o.expectedDeliveryDate, note: o.note, createdAt: o.createdAt })}`;
      await tx`insert into purchase_order_lines ${tx(o.lines.map((l) => ({ id: sid(l.id), purchaseOrderId: sid(o.id), stockItemId: sid(l.stockItemId), quantityPacks: l.quantityPacks, unitPriceCents: l.unitPriceCents, receivedPacks: o.received[l.id] ?? 0 })))}`;
    }
    await tx`insert into order_counters (library_id, last_number) values (${lib}, ${d.seq}) on conflict (library_id) do update set last_number = excluded.last_number`;
    // Events in time order; the trigger recomputes stock levels and average costs exactly as in the app.
    for (const e of [...d.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
      await tx`insert into stock_events ${tx({ id: sid(e.id), libraryId: lib, outletId: sid(e.outletId), type: e.type, status: e.status, occurredAt: e.occurredAt, purchaseOrderId: u(e.purchaseOrderId), note: e.note, createdBy: u(e.createdBy), closedAt: e.closedAt })}`;
      for (const m of d.movements.filter((x) => x.eventId === e.id)) {
        await tx`insert into stock_movements ${tx({ stockEventId: sid(e.id), outletId: sid(m.outletId), ingredientId: sid(m.ingredientId), deltaBase: m.deltaBase, unitCostCents: m.unitCostCents, reason: m.reason })}`;
      }
    }
  });
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from ingredients`;
  console.log(`seeded demo library: ${n} ingredients, ${d.recipes.length} recipes, ${d.orders.length} orders, ${d.members.length} demo users`);
} finally {
  await sql.end();
}
