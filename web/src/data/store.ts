// In-memory store with seed data. Stands in for Supabase until /replica-backend runs.
// Lives on globalThis so dev hot reloads keep the data; a server restart resets it.
import "server-only";
import type { CostContext } from "@/domain/costing";
import { billOfMaterials } from "@/domain/menus";
import { type CountBreakdown, applyMovement } from "@/domain/stock";
import type {
  AllergenRow, ApiKey, Category, CountDraft, HaccpChecklist, HaccpRecord, ProductionRequest, Ingredient, Library, Member, Menu, Nutrition, Outlet, OutletIngredient, Package,
  PosItem, PurchaseOrder, Recipe, RecipeLine, Sale, StockEvent, StockItem, StockLevel, StockMovement, Supplier,
} from "./types";

export type Db = {
  library: Library;
  outlets: Outlet[];
  members: Member[];
  categories: Category[];
  ingredients: Ingredient[];
  packages: Package[];
  suppliers: Supplier[];
  stockItems: StockItem[];
  allergens: Record<string, AllergenRow>;
  verified: Record<string, boolean>;
  nutrition: Record<string, Nutrition>;
  recipes: Recipe[];
  menus: Menu[];
  outletPrices: { recipeId: string; outletId: string; sellPriceCents: number }[];
  haccpChecklists: HaccpChecklist[];
  production: ProductionRequest[];
  haccpRecords: HaccpRecord[];
  invoices: {
    id: string; orderId: string; supplierId: string; invoiceNumber: string; invoiceDate: string; status: "matched" | "mismatch" | "approved";
    totalNetCents: number; note: string | null; approvedAt: string | null; approvedBy: string | null;
    lines: Record<string, { quantityPacks: number; unitPriceCents: number }>;
  }[];
  posItems: PosItem[];
  sales: Sale[];
  apiKeys: ApiKey[];
  outletIngredients: OutletIngredient[];
  orders: PurchaseOrder[];
  events: StockEvent[];
  movements: StockMovement[];
  levels: StockLevel[];
  countDrafts: Record<string, CountDraft>;
  countBreakdowns?: Record<string, Record<string, CountBreakdown>>;
  seq: number;
};

const g = globalThis as unknown as { __kitchenDb?: Db };

export function db(): Db {
  g.__kitchenDb ??= seed();
  return g.__kitchenDb;
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export const now = () => new Date().toISOString();

/** Append a movement and update the level, like the database trigger. */
export function addMovement(d: Db, m: Omit<StockMovement, "id" | "unitCostCents"> & { unitCostCents?: number }): StockMovement {
  let level = d.levels.find((l) => l.outletId === m.outletId && l.ingredientId === m.ingredientId);
  if (!level) {
    level = { outletId: m.outletId, ingredientId: m.ingredientId, quantityBase: 0, avgCostCents: 0 };
    d.levels.push(level);
  }
  const { level: next, bookedCost } = applyMovement(level, m.deltaBase, m.unitCostCents ?? 0);
  level.quantityBase = next.quantityBase;
  level.avgCostCents = next.avgCostCents;
  const row: StockMovement = { ...m, id: newId("mov"), unitCostCents: bookedCost };
  d.movements.push(row);
  return row;
}

// ---------------------------------------------------------------- seed
// Fictional demo data for a small bistro. Names, suppliers and prices are made up.

export function seed(): Db {
  const t = now();
  const d: Db = {
    library: { id: "lib-demo", name: "Demo Bistro", currency: "EUR", defaultVatBp: 700, wageCentsPerHour: 1850 },
    outlets: [
      { id: "out-mitte", libraryId: "lib-demo", name: "Küche Mitte", isCentralKitchen: false, timezone: "Europe/Berlin", archivedAt: null },
      { id: "out-zentral", libraryId: "lib-demo", name: "Zentralküche", isCentralKitchen: true, timezone: "Europe/Berlin", archivedAt: null },
    ],
    members: [
      { id: "mem-1", userId: "usr-owner", name: "Demo Nutzer", email: "inhaber@example.com", role: "owner", allOutlets: true, outletIds: [] },
      { id: "mem-2", userId: "usr-chef", name: "Sam Berger", email: "kueche@example.com", role: "chef", allOutlets: true, outletIds: [] },
      { id: "mem-3", userId: "usr-staff", name: "Alex Wolf", email: "team@example.com", role: "outlet_staff", allOutlets: false, outletIds: ["out-mitte"] },
    ],
    categories: [
      ...["Gemüse", "Obst", "Trockenware", "Molkereiprodukte", "Gewürze & Öle", "Backzutaten"].map((name, i) => ({ id: `cat-i${i}`, kind: "ingredient" as const, name })),
      ...["Grundrezepte", "Suppen", "Hauptgerichte", "Desserts"].map((name, i) => ({ id: `cat-r${i}`, kind: "recipe" as const, name })),
      ...["Mittagstisch", "Abendkarte"].map((name, i) => ({ id: `cat-m${i}`, kind: "menu" as const, name })),
    ],
    ingredients: [], packages: [], suppliers: [], stockItems: [], allergens: {}, verified: {}, nutrition: {},
    recipes: [], menus: [], outletPrices: [], invoices: [], haccpChecklists: [], haccpRecords: [], production: [], posItems: [], sales: [], apiKeys: [], outletIngredients: [], orders: [], events: [], movements: [], levels: [], countDrafts: {}, seq: 3,
  };

  const sup = (id: string, companyName: string, orderEmail: string, leadTimeDays: number) =>
    d.suppliers.push({ id, libraryId: d.library.id, companyName, email: orderEmail, orderEmail, phone: null, customerNumber: null, leadTimeDays, minOrderCents: null, archivedAt: null });
  sup("sup-frische", "Frischehof Lindner", "bestellung@frischehof.example", 1);
  sup("sup-gross", "Großhandel Ostring", "auftrag@ostring.example", 2);
  sup("sup-molkerei", "Molkerei Talblick", "order@talblick.example", 1);

  type Seed = {
    id: string; name: string; cat: number; base?: "g" | "ml" | "piece"; gpp?: number; density?: number;
    pack: [string, number, number?]; // label, quantityBase, count of inner pack (nested)
    inner?: [string, number];
    supplier: string; price: number; perUnitKg?: boolean;
    allergens?: AllergenRow; verified?: boolean; par?: number;
  };
  const items: Seed[] = [
    { id: "ing-zwiebeln", name: "Zwiebeln", cat: 0, gpp: 120, pack: ["Sack 10 kg", 10000], supplier: "sup-frische", price: 1450, par: 15000 },
    { id: "ing-karotten", name: "Karotten", cat: 0, pack: ["Kiste 10 kg", 10000], supplier: "sup-frische", price: 1290, par: 12000 },
    { id: "ing-sellerie", name: "Knollensellerie", cat: 0, gpp: 800, pack: ["1 kg", 1000], supplier: "sup-frische", price: 220, perUnitKg: true, allergens: { celery: "contains" }, par: 4000 },
    { id: "ing-lauch", name: "Lauch", cat: 0, gpp: 300, pack: ["Kiste 5 kg", 5000], supplier: "sup-frische", price: 990, par: 5000 },
    { id: "ing-kartoffeln", name: "Kartoffeln festkochend", cat: 0, pack: ["Sack 25 kg", 25000], supplier: "sup-frische", price: 2250, par: 30000 },
    { id: "ing-petersilie", name: "Petersilie glatt", cat: 0, pack: ["1 kg", 1000], supplier: "sup-frische", price: 1200, perUnitKg: true, par: 500 },
    { id: "ing-aepfel", name: "Äpfel Boskoop", cat: 1, gpp: 180, pack: ["Kiste 10 kg", 10000], supplier: "sup-frische", price: 1990, par: 10000 },
    { id: "ing-linsen", name: "Rote Linsen", cat: 2, pack: ["Sack 5 kg", 5000], supplier: "sup-gross", price: 1180, allergens: { gluten: "may_contain" }, par: 8000 },
    { id: "ing-mehl", name: "Weizenmehl Type 550", cat: 5, pack: ["Sack 25 kg", 25000], supplier: "sup-gross", price: 1650, allergens: { gluten: "contains" }, par: 20000 },
    { id: "ing-zucker", name: "Zucker", cat: 5, pack: ["Sack 10 kg", 10000], supplier: "sup-gross", price: 1150, par: 8000 },
    { id: "ing-kreuzkuemmel", name: "Kreuzkümmel gemahlen", cat: 4, pack: ["Dose 500 g", 500], supplier: "sup-gross", price: 790, allergens: { mustard: "may_contain" }, verified: false },
    { id: "ing-olivenoel", name: "Olivenöl nativ extra", cat: 4, base: "ml", density: 1.09, inner: ["Flasche 1 l", 1000], pack: ["Karton 6 × 1 l", 6000, 6], supplier: "sup-gross", price: 5400, par: 6000 },
    { id: "ing-salz", name: "Meersalz fein", cat: 4, pack: ["Packung 1 kg", 1000], supplier: "sup-gross", price: -1 },
    { id: "ing-quark", name: "Speisequark 20 %", cat: 3, pack: ["Eimer 5 kg", 5000], supplier: "sup-molkerei", price: 1090, allergens: { milk: "contains" }, par: 5000 },
    { id: "ing-sahne", name: "Schlagsahne 30 %", cat: 3, base: "ml", density: 1.02, pack: ["Packung 1 l", 1000], supplier: "sup-molkerei", price: 349, allergens: { milk: "contains" }, par: 4000 },
    { id: "ing-butter", name: "Butter", cat: 3, inner: ["Stück 250 g", 250], pack: ["Karton 10 × 250 g", 2500, 10], supplier: "sup-molkerei", price: 2290, allergens: { milk: "contains" }, par: 5000 },
    { id: "ing-eier", name: "Eier Größe M", cat: 3, base: "piece", gpp: 60, pack: ["Palette 180 Stk.", 180], supplier: "sup-molkerei", price: 3780, allergens: { eggs: "contains" }, par: 180 },
  ];

  for (const s of items) {
    const base = s.base ?? "g";
    d.ingredients.push({
      id: s.id, libraryId: d.library.id, name: s.name, shortName: null, internalUid: null, categoryId: `cat-i${s.cat}`,
      baseUnit: base, gramsPerPiece: s.gpp ?? null, mlPerGram: s.density ?? null,
      allergensVerified: s.verified ?? true, archivedAt: null, updatedAt: t,
    });
    let parent: string | null = null;
    if (s.inner) {
      parent = `${s.id}-pk0`;
      d.packages.push({ id: parent, ingredientId: s.id, parentPackageId: null, count: 1, quantityBase: s.inner[1], label: s.inner[0] });
    }
    const packId = `${s.id}-pk1`;
    d.packages.push({ id: packId, ingredientId: s.id, parentPackageId: parent, count: s.pack[2] ?? 1, quantityBase: s.pack[1], label: s.pack[0] });
    if (s.price >= 0) {
      d.stockItems.push({
        id: `${s.id}-si`, ingredientId: s.id, supplierId: s.supplier, packageId: packId, name: `${s.name}, ${s.pack[0]}`,
        // Demo barcodes from the in-store range (prefix 2), so they never match a real product.
        supplierSku: null, gtin: ({ "ing-butter": "2000000000015", "ing-quark": "2000000000022" } as Record<string, string>)[s.id] ?? null,
        priceType: s.perUnitKg ? "per_unit" : "per_pack", priceCents: s.price,
        priceUnit: s.perUnitKg ? "g" : null, priceUnitQuantity: s.perUnitKg ? 1000 : null,
        isPreferred: true, weighted: !!s.perUnitKg, archivedAt: null,
      });
    }
    // Everything not listed as contained is free, except for unverified ingredients, which stay unknown.
    d.allergens[s.id] = s.verified === false
      ? { ...s.allergens }
      : { ...Object.fromEntries(["gluten", "crustaceans", "eggs", "fish", "peanuts", "soybeans", "milk", "nuts", "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs"].map((a) => [a, "free"])), ...s.allergens };
    d.verified[s.id] = s.verified ?? true;
    for (const outletId of ["out-mitte", "out-zentral"]) {
      d.outletIngredients.push({ outletId, ingredientId: s.id, parLevelBase: s.par ?? null, minLevelBase: s.par ? Math.round(s.par / 4) : null });
    }
  }

  const line = (p: number, ref: string, quantity: number, unit: RecipeLine["unit"]): RecipeLine => ({
    id: newId("rl"), ingredientId: ref.startsWith("ing-") ? ref : null, subRecipeId: ref.startsWith("rec-") ? ref : null,
    quantity, unit, position: p, note: null,
  });
  const recipe = (r: Partial<Recipe> & Pick<Recipe, "id" | "name" | "lines">): Recipe => ({
    libraryId: d.library.id, categoryId: null, productType: "finished", portions: 1, netQuantityBase: null, netUnit: "g",
    sellPriceCents: null, sellPriceIncludesVat: true, vatBp: 700, targetFoodCostBp: 3000, prepMinutes: null, instructions: null,
    extraAllergens: {}, archivedAt: null, updatedAt: t, ...r,
  });
  d.recipes.push(
    recipe({
      id: "rec-fond", name: "Gemüsefond", categoryId: "cat-r0", productType: "semi_finished", netQuantityBase: 4000, netUnit: "ml", prepMinutes: 20,
      instructions: "Gemüse grob schneiden, kalt aufsetzen, 90 Minuten leise köcheln, passieren.",
      lines: [line(0, "ing-zwiebeln", 500, "g"), line(1, "ing-karotten", 500, "g"), line(2, "ing-sellerie", 1, "piece"), line(3, "ing-lauch", 1, "piece")],
    }),
    recipe({
      id: "rec-quark", name: "Kräuterquark", categoryId: "cat-r0", productType: "semi_finished", prepMinutes: 10,
      instructions: "Petersilie fein hacken, mit Quark, Öl und Salz glatt rühren.",
      lines: [line(0, "ing-quark", 1, "kg"), line(1, "ing-petersilie", 50, "g"), line(2, "ing-olivenoel", 30, "ml"), line(3, "ing-salz", 10, "g")],
    }),
    recipe({
      id: "rec-linsensuppe", name: "Linsensuppe mit Kreuzkümmel", categoryId: "cat-r1", portions: 10, sellPriceCents: 790, prepMinutes: 25,
      instructions: "Zwiebeln und Karotten anschwitzen, Linsen und Kreuzkümmel zugeben, mit Fond auffüllen, weich kochen, mit Sahne vollenden.",
      lines: [line(0, "ing-linsen", 800, "g"), line(1, "ing-zwiebeln", 2, "piece"), line(2, "ing-karotten", 300, "g"), line(3, "rec-fond", 2.5, "l"), line(4, "ing-kreuzkuemmel", 10, "g"), line(5, "ing-olivenoel", 50, "ml"), line(6, "ing-sahne", 200, "ml")],
    }),
    recipe({
      id: "rec-ofengemuese", name: "Ofengemüse mit Kräuterquark", categoryId: "cat-r2", sellPriceCents: 1450, prepMinutes: 8,
      lines: [line(0, "ing-kartoffeln", 250, "g"), line(1, "ing-karotten", 120, "g"), line(2, "ing-zwiebeln", 1, "piece"), line(3, "ing-olivenoel", 20, "ml"), line(4, "rec-quark", 120, "g")],
    }),
    recipe({
      id: "rec-apfelkuchen", name: "Apfelkuchen vom Blech", categoryId: "cat-r3", portions: 12, sellPriceCents: 450, targetFoodCostBp: 2500, prepMinutes: 40,
      lines: [line(0, "ing-mehl", 300, "g"), line(1, "ing-butter", 200, "g"), line(2, "ing-zucker", 150, "g"), line(3, "ing-eier", 3, "piece"), line(4, "ing-aepfel", 1.2, "kg")],
    }),
  );

  // Demo nutrition per 100 g (per 100 ml for oil and cream): rounded textbook values, not for real labels.
  // Cumin is left empty on purpose, so the label shows how missing data is reported.
  const N: Record<string, number[]> = {
    "ing-zwiebeln": [40, 0.1, 0, 9, 4.2, 1.1, 0], "ing-karotten": [41, 0.2, 0, 9.6, 4.7, 0.9, 0.2], "ing-sellerie": [42, 0.3, 0.1, 9.2, 1.6, 1.5, 0.3],
    "ing-lauch": [61, 0.3, 0, 14, 3.9, 1.5, 0.1], "ing-kartoffeln": [77, 0.1, 0, 17, 0.8, 2, 0], "ing-petersilie": [36, 0.8, 0.1, 6.3, 0.9, 3, 0.1],
    "ing-aepfel": [52, 0.2, 0, 14, 10, 0.3, 0], "ing-linsen": [352, 1.1, 0.2, 63, 2, 24, 0], "ing-mehl": [340, 1, 0.2, 71, 0.7, 10, 0],
    "ing-zucker": [400, 0, 0, 100, 100, 0, 0], "ing-olivenoel": [820, 91, 13, 0, 0, 0, 0], "ing-salz": [0, 0, 0, 0, 0, 0, 99],
    "ing-quark": [109, 5, 3, 2.7, 2.7, 12.6, 0.1], "ing-sahne": [292, 30, 19, 3.2, 3.2, 2.4, 0.1], "ing-butter": [741, 82, 52, 0.6, 0.6, 0.7, 0],
    "ing-eier": [137, 9.3, 2.7, 1.1, 0.7, 12.9, 0.4],
  };
  for (const [id, [energyKcal, fatG, saturatedFatG, carbohydrateG, sugarsG, proteinG, saltG]] of Object.entries(N)) {
    d.nutrition[id] = { energyKcal, fatG, saturatedFatG, carbohydrateG, sugarsG, proteinG, saltG };
  }

  const course = (p: number, name: string, recipeId: string) => ({ id: `mc-${p}`, name, position: p, items: [{ id: `mi-${p}`, recipeId, portions: 1, position: 0 }] });
  d.menus.push({
    id: "menu-mittag", libraryId: d.library.id, name: "Mittagsmenü", categoryId: "cat-m0", priceCents: 2400, priceIncludesVat: true, vatBp: 700,
    targetMarginBp: 7000, validFrom: null, validTo: null, archivedAt: null, updatedAt: t,
    courses: [course(0, "Vorspeise", "rec-linsensuppe"), course(1, "Hauptgang", "rec-ofengemuese"), course(2, "Dessert", "rec-apfelkuchen")],
  });

  // Till items of Küche Mitte: two linked, the cake not yet (its sales wait), espresso has no recipe, water is ignored.
  const pos = (plu: string, name: string, recipeId: string | null, ignored = false): PosItem => ({ id: `pos-${plu}`, outletId: "out-mitte", plu, name, recipeId, ignored });
  d.posItems.push(pos("1001", "Linsensuppe", "rec-linsensuppe"), pos("1002", "Ofengemüse", "rec-ofengemuese"), pos("1003", "Apfelkuchen Stück", null), pos("9001", "Espresso", null), pos("9002", "Leitungswasser", null, true));
  for (let i = 0; i < 8; i++) {
    d.sales.push({ id: `sale-k${i}`, outletId: "out-mitte", posItemId: "pos-1003", externalId: `K-${100 + i}`, quantity: 1, revenueNetCents: 421, soldAt: daysAgo(1), depletedEventId: null });
  }
  for (let i = 0; i < 20; i++) {
    d.sales.push({ id: `sale-e${i}`, outletId: "out-mitte", posItemId: "pos-9001", externalId: `E-${100 + i}`, quantity: 1, revenueNetCents: 220, soldAt: daysAgo(1), depletedEventId: null });
  }

  // Stock history for Küche Mitte: one delivered order, a waste event, an open order and a draft.
  const priceOf = (id: string) => d.stockItems.find((s) => s.ingredientId === id)!;
  const packOf = (si: StockItem) => d.packages.find((p) => p.id === si.packageId)!;
  const unitCost = (si: StockItem) => (si.priceType === "per_pack" ? si.priceCents / packOf(si).quantityBase : si.priceCents / si.priceUnitQuantity!);

  const delivered: PurchaseOrder = {
    id: "po-1", outletId: "out-mitte", supplierId: "sup-frische", orderNumber: "B-0001", status: "delivered",
    orderedAt: daysAgo(3), expectedDeliveryDate: daysAgo(2).slice(0, 10), note: null, createdAt: daysAgo(3),
    lines: ["ing-zwiebeln", "ing-karotten", "ing-kartoffeln", "ing-aepfel"].map((ing, i) => {
      const si = priceOf(ing);
      return { id: `pol-1-${i}`, stockItemId: si.id, quantityPacks: 1, unitPriceCents: si.priceCents };
    }),
    received: {},
  };
  delivered.lines.forEach((l) => (delivered.received[l.id] = l.quantityPacks));
  d.orders.push(delivered);
  const evDelivery: StockEvent = { id: "ev-1", outletId: "out-mitte", type: "delivery", status: "closed", occurredAt: daysAgo(2), counterpartOutletId: null, purchaseOrderId: "po-1", note: null, createdBy: "usr-staff", closedAt: daysAgo(2) };
  d.events.push(evDelivery);
  for (const l of delivered.lines) {
    const si = d.stockItems.find((s) => s.id === l.stockItemId)!;
    addMovement(d, { eventId: evDelivery.id, outletId: "out-mitte", ingredientId: si.ingredientId, deltaBase: packOf(si).quantityBase, unitCostCents: unitCost(si), countedBase: null, reason: null });
  }
  // Opening stock for the rest, booked as one correction so the ledger stays complete.
  const evOpen: StockEvent = { id: "ev-0", outletId: "out-mitte", type: "correction", status: "closed", occurredAt: daysAgo(10), counterpartOutletId: null, purchaseOrderId: null, note: "Anfangsbestand", createdBy: "usr-owner", closedAt: daysAgo(10) };
  d.events.unshift(evOpen);
  for (const [ing, qty] of [["ing-linsen", 3500], ["ing-mehl", 12000], ["ing-zucker", 6000], ["ing-olivenoel", 4000], ["ing-quark", 2000], ["ing-sahne", 1500], ["ing-butter", 2500], ["ing-eier", 90], ["ing-sellerie", 1600], ["ing-lauch", 900], ["ing-kreuzkuemmel", 500], ["ing-petersilie", 500], ["ing-salz", 1000]] as const) {
    const si = d.stockItems.find((x) => x.ingredientId === ing); // sea salt has no price on purpose
    addMovement(d, { eventId: evOpen.id, outletId: "out-mitte", ingredientId: ing, deltaBase: qty, unitCostCents: si ? unitCost(si) : 0, countedBase: null, reason: null });
  }
  const evWaste: StockEvent = { id: "ev-2", outletId: "out-mitte", type: "waste", status: "closed", occurredAt: daysAgo(1), counterpartOutletId: null, purchaseOrderId: null, note: null, createdBy: "usr-staff", closedAt: daysAgo(1) };
  d.events.push(evWaste);
  addMovement(d, { eventId: evWaste.id, outletId: "out-mitte", ingredientId: "ing-sahne", deltaBase: -500, countedBase: null, reason: "Abgelaufen" });

  // Küche Mitte asks the central kitchen for herb quark tomorrow and lentil soup the day after.
  const ask = (id: string, recipeId: string, portions: number, inDays: number, note: string | null = null): ProductionRequest => ({
    id, fromOutletId: "out-mitte", kitchenOutletId: "out-zentral", recipeId, portions, neededOn: daysAgo(-inDays).slice(0, 10), note,
    status: "requested", productionEventId: null, costCents: null, createdBy: "usr-staff", createdAt: daysAgo(0.5), producedAt: null, deliveredAt: null,
  });
  d.production.push(ask("pr-1", "rec-quark", 2, 1), ask("pr-2", "rec-linsensuppe", 20, 2, "Für das Mittagsmenü"));

  // Daily HACCP checks for Küche Mitte, filled in for the last three days; one fridge reading was too warm.
  const point = (i: number, label: string, kind: "check" | "temperature" | "text", min: number | null = null, max: number | null = null) =>
    ({ id: `hi-${i}`, position: i, label, kind, minValue: min, maxValue: max });
  d.haccpChecklists.push({
    id: "hc-daily", name: "Tägliche Kontrollen", archivedAt: null,
    items: [point(0, "Kühlraum", "temperature", 0, 4), point(1, "Tiefkühler", "temperature", -25, -18), point(2, "Arbeitsflächen gereinigt und desinfiziert", "check"), point(3, "Bemerkungen", "text")],
  });
  for (const n of [3, 2, 1]) {
    const day = daysAgo(n).slice(0, 10);
    const at = daysAgo(n - 0.3);
    const warm = n === 2;
    d.haccpRecords.push(
      { itemId: "hi-0", outletId: "out-mitte", day, valueText: null, valueNumber: warm ? 6.5 : 3, ok: !warm, action: warm ? "Tür stand offen. Ware geprüft, nach 30 Minuten wieder 3 °C." : null, recordedBy: "usr-staff", recordedAt: at },
      { itemId: "hi-1", outletId: "out-mitte", day, valueText: null, valueNumber: -20, ok: true, action: null, recordedBy: "usr-staff", recordedAt: at },
      { itemId: "hi-2", outletId: "out-mitte", day, valueText: "ok", valueNumber: null, ok: true, action: null, recordedBy: "usr-staff", recordedAt: at },
    );
  }

  // Yesterday's sales of the two linked dishes, booked out through their recipes like the till import does.
  // They come after every other seed booking, so Postgres (which replays by time) ends with the same averages.
  const sold: [string, string, number, number][] = [["pos-1001", "rec-linsensuppe", 14, 738], ["pos-1002", "rec-ofengemuese", 5, 1355]];
  const sales: Sale[] = sold.flatMap(([posItemId, , n, net], k) => Array.from({ length: n }, (_, i) => ({
    id: `sale-s${k}-${i}`, outletId: "out-mitte", posItemId, externalId: `S-${k}${String(i).padStart(2, "0")}`, quantity: 1,
    revenueNetCents: net, soldAt: daysAgo(0.875 - (0.6 * i) / n), depletedEventId: "ev-sale",
  })));
  d.sales.push(...sales);
  const ctx: CostContext = {
    ingredient: (id) => {
      const i = d.ingredients.find((x) => x.id === id);
      return i && { id: i.id, name: i.name, baseUnit: i.baseUnit, gramsPerPiece: i.gramsPerPiece, mlPerGram: i.mlPerGram, price: null };
    },
    recipe: (id) => {
      const r = d.recipes.find((x) => x.id === id);
      return r && { id: r.id, name: r.name, portions: r.portions, netQuantityBase: r.netQuantityBase, netUnit: r.netUnit, lines: r.lines.map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: l.quantity, unit: l.unit })) };
    },
  };
  const evSale: StockEvent = {
    id: "ev-sale", outletId: "out-mitte", type: "sale", status: "closed", occurredAt: sales.map((x) => x.soldAt).sort().at(-1)!,
    counterpartOutletId: null, purchaseOrderId: null, note: `${sales.length} Verkäufe`, createdBy: null, closedAt: daysAgo(0.25),
  };
  d.events.push(evSale);
  for (const l of billOfMaterials({ courses: [{ name: "", items: sold.map(([, recipeId, n]) => ({ recipeId, portions: n })) }] }, ctx).lines) {
    addMovement(d, { eventId: evSale.id, outletId: "out-mitte", ingredientId: l.ingredientId, deltaBase: -l.quantityBase, countedBase: null, reason: null });
  }

  d.orders.push(
    {
      id: "po-2", outletId: "out-mitte", supplierId: "sup-gross", orderNumber: "B-0002", status: "ordered", orderedAt: daysAgo(1),
      expectedDeliveryDate: daysAgo(-1).slice(0, 10), note: "Bitte bis 10 Uhr liefern.", createdAt: daysAgo(1), received: {},
      lines: [
        { id: "pol-2-0", stockItemId: "ing-linsen-si", quantityPacks: 2, unitPriceCents: 1180 },
        { id: "pol-2-1", stockItemId: "ing-olivenoel-si", quantityPacks: 1, unitPriceCents: 5400 },
      ],
    },
    {
      id: "po-3", outletId: "out-mitte", supplierId: "sup-molkerei", orderNumber: "B-0003", status: "draft", orderedAt: null,
      expectedDeliveryDate: null, note: null, createdAt: t, received: {},
      lines: [{ id: "pol-3-0", stockItemId: "ing-quark-si", quantityPacks: 1, unitPriceCents: 1090 }],
    },
  );
  return d;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}
