// Runs against a real Postgres with the migrations and the demo seed applied:
//   TEST_DATABASE_URL=postgres://... npm test
// Skipped when TEST_DATABASE_URL is not set.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import postgres from "postgres";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const sid = (x: string) => {
  const h = createHash("md5").update(`kitchen-ledger:${x}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

describe.skipIf(!url)("backend against Postgres", () => {
  let repo: typeof import("../src/data/pg/repo-pg");
  let admin: postgres.Sql;
  const owner = { userId: sid("usr-owner"), name: "Demo Nutzer", email: "inhaber@example.com", role: "owner" as const, libraryId: sid("lib-demo"), outletIds: "all" as const };
  const staff = { ...owner, userId: sid("usr-staff"), role: "outlet_staff" as const, outletIds: [sid("out-mitte")] };
  const strangerId = "00000000-0000-4000-8000-00000000beef";
  let stranger: typeof owner;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execSync("npm run -s db:seed", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
    repo = await import("../src/data/pg/repo-pg");
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin`delete from memberships where user_id = ${strangerId}`;
    await admin`select delete_library(id) from libraries where name = 'Fremder Betrieb'`;
    await admin`insert into auth.users (id, email) values (${strangerId}, 'fremd-it@example.com') on conflict do nothing`;
    const libId = await repo.createLibrary(strangerId, { libraryName: "Fremder Betrieb", outletName: "Fremde Küche", ownerName: "Fremd" });
    stranger = { ...owner, userId: strangerId, email: "fremd-it@example.com", libraryId: libId };
  });
  afterAll(async () => {
    await admin`select delete_library(id) from libraries where name = 'Fremder Betrieb'`;
    await admin`delete from auth.users where id = ${strangerId}`;
    await admin.end();
    const { sql } = await import("../src/data/pg/client");
    await sql().end();
  });

  describe("row level security", () => {
    it("owner sees the demo data", async () => {
      expect((await repo.listIngredients(owner)).length).toBe(17);
      expect((await repo.getRecipe(owner, sid("rec-linsensuppe")))?.recipe.name).toBe("Linsensuppe mit Kreuzkümmel");
    });
    it("a user of another library gets nothing back, even when pointing at the demo library's ids", async () => {
      const asDemoLib = { ...stranger, libraryId: owner.libraryId }; // a forged session must not help either
      expect(await repo.listIngredients(asDemoLib)).toEqual([]);
      expect(await repo.getRecipe(asDemoLib, sid("rec-linsensuppe"))).toBeNull();
      expect(await repo.getIngredient(asDemoLib, sid("ing-zwiebeln"))).toBeNull();
      expect(await repo.getOrder(asDemoLib, sid("po-2"))).toBeNull();
      expect(await repo.getStock(asDemoLib, sid("out-mitte"))).toEqual([]);
      expect(await repo.listSuppliers(asDemoLib)).toEqual([]);
    });
    it("a user of another library cannot write into it", async () => {
      const asDemoLib = { ...stranger, libraryId: owner.libraryId };
      await expect(repo.saveIngredient(asDemoLib, { name: "Eindringling", shortName: null, internalUid: null, categoryId: null, baseUnit: "g", gramsPerPiece: null, mlPerGram: null })).rejects.toThrow(/Berechtigung/);
      await expect(repo.recordWaste(asDemoLib, sid("out-mitte"), [{ ingredientId: sid("ing-sahne"), quantityBase: 100, reason: "x" }])).rejects.toThrow(/Berechtigung/);
    });
    it("outlet staff cannot edit the library, even bypassing the role check", async () => {
      await expect(repo.saveRecipe(staff, { name: "x", categoryId: null, productType: "finished", portions: 1, netQuantityBase: null, netUnit: "g", sellPriceCents: null, sellPriceIncludesVat: true, vatBp: null, targetFoodCostBp: null, prepMinutes: null, instructions: null, extraAllergens: {}, lines: [] })).rejects.toThrow(/Berechtigung/);
      const { asUser } = await import("../src/data/pg/client");
      await expect(asUser(staff.userId, (tx) => tx`update recipes set name = 'gehackt' where id = ${sid("rec-linsensuppe")} returning id`)).resolves.toHaveLength(0);
      await expect(asUser(staff.userId, (tx) => tx`insert into recipes (library_id, name) values (${owner.libraryId}, 'gehackt')`)).rejects.toThrow(/row-level security/);
    });
    it("outlet staff's session, loaded like at sign-in, lists their outlet", async () => {
      const m = (await repo.getMembership(staff.userId))!;
      expect(m.role).toBe("outlet_staff");
      expect(m.outletIds).toEqual([sid("out-mitte")]);
    });
    it("outlet staff sees only their own outlet", async () => {
      expect((await repo.listOutlets(staff)).map((o) => o.name)).toEqual(["Küche Mitte"]);
      expect(await repo.getStock(staff, sid("out-zentral"))).toEqual([]);
    });
    it("members cannot change their own plan", async () => {
      const { asUser } = await import("../src/data/pg/client");
      await expect(asUser(owner.userId, (tx) => tx`update libraries set plan = 'active' where id = ${owner.libraryId}`)).rejects.toThrow(/permission denied/);
    });
  });

  describe("purchasing and stock", () => {
    it("orders, receives in parts, refuses over-delivery and books stock at the right cost", async () => {
      const before = (await repo.getStock(owner, sid("out-mitte"))).find((r) => r.name.startsWith("Speisequark"))!;
      const id = await repo.saveOrderDraft(owner, { outletId: sid("out-mitte"), supplierId: sid("sup-molkerei"), expectedDeliveryDate: null, note: null, lines: [{ stockItemId: sid("ing-quark-si"), quantityPacks: 2 }] });
      expect((await repo.sendOrder(owner, id)).alreadySent).toBe(false);
      expect((await repo.sendOrder(owner, id)).alreadySent).toBe(true);
      const order = (await repo.getOrder(owner, id))!;
      expect(order.order.orderNumber).toMatch(/^B-\d{4}$/);
      const lineId = order.lines[0].id;
      expect((await repo.receiveDelivery(owner, id, { lines: [{ lineId, packs: 1 }], addToStock: true })).status).toBe("partially_delivered");
      await expect(repo.receiveDelivery(owner, id, { lines: [{ lineId, packs: 5 }], addToStock: true })).rejects.toThrow(/offen sind nur 1/);
      expect((await repo.receiveDelivery(owner, id, { lines: [{ lineId, packs: 1 }], addToStock: true })).status).toBe("delivered");
      const after = (await repo.getStock(owner, sid("out-mitte"))).find((r) => r.name.startsWith("Speisequark"))!;
      expect(after.quantityBase - before.quantityBase).toBe(10000);
      expect(after.avgCostCents).toBeCloseTo(0.218); // same price as before: average unchanged
    });
    it("counts: only counted items change, the draft survives, closing books the difference", async () => {
      const level = async (name: string) => (await repo.getStock(staff, sid("out-mitte"))).find((r) => r.name === name)!.quantityBase;
      const [butter, sugar] = [await level("Butter"), await level("Zucker")];
      const ev = await repo.startCount(staff, sid("out-mitte"));
      await expect(repo.startCount(staff, sid("out-mitte"))).rejects.toThrow(/schon eine Inventur/);
      await repo.saveCountLines(staff, ev, { [sid("ing-butter")]: butter + 500 });
      expect((await repo.getOpenCount(staff, sid("out-mitte")))!.draft).toEqual({ [sid("ing-butter")]: butter + 500 });
      expect(await repo.closeCount(staff, ev)).toEqual({ counted: 1, changed: 1 });
      expect(await level("Butter")).toBe(butter + 500);
      expect(await level("Zucker")).toBe(sugar);
    });
  });

  describe("second build pass: team, package counts, menus", () => {
    const chef = { ...owner, userId: sid("usr-chef"), role: "chef" as const };
    it("team rules hold in the repo and in the database", async () => {
      const { asUser } = await import("../src/data/pg/client");
      await expect(repo.updateMember(chef, sid("mem-3"), { role: "admin", outletIds: [] })).rejects.toThrow(/Berechtigung/);
      await expect(repo.removeMember(owner, sid("mem-1"))).rejects.toThrow(/mindestens einen Inhaber/);
      await expect(repo.transferOwnership(chef, sid("mem-3"))).rejects.toThrow(/Nur der Inhaber/);
      // Bypassing the app: staff cannot promote themselves, a chef cannot touch the owner.
      await asUser(staff.userId, (tx) => tx`update memberships set role = 'owner' where user_id = ${staff.userId}`).catch(() => {});
      await asUser(chef.userId, (tx) => tx`update memberships set role = 'outlet_staff' where id = ${sid("mem-1")}`).catch(() => {});
      await asUser(chef.userId, (tx) => tx`delete from memberships where id = ${sid("mem-1")}`).catch(() => {});
      const roles = await admin`select id, role from memberships where library_id = ${owner.libraryId} order by id`;
      expect(Object.fromEntries(roles.map((r) => [r.id, r.role]))).toMatchObject({ [sid("mem-1")]: "owner", [sid("mem-3")]: "outlet_staff" });
    });
    it("a package count only accepts the item's own packages and stores the breakdown", async () => {
      const ev = await repo.startCount(staff, sid("out-mitte"));
      await expect(repo.saveCountLines(staff, ev, { [sid("ing-butter")]: { packs: { [sid("ing-quark-pk1")]: 1 }, looseBase: 0 } })).rejects.toThrow(/Gebinde/);
      await repo.saveCountLines(staff, ev, { [sid("ing-butter")]: { packs: { [sid("ing-butter-pk1")]: 2, [sid("ing-butter-pk0")]: 1 }, looseBase: 10 } });
      const open = (await repo.getOpenCount(staff, sid("out-mitte")))!;
      expect(open.draft[sid("ing-butter")]).toBe(2 * 2500 + 250 + 10);
      expect(open.breakdown[sid("ing-butter")].packs[sid("ing-butter-pk1")]).toBe(2);
      await repo.closeCount(staff, ev);
    });
    it("menus: same numbers as in memory, invisible and unwritable for other libraries", async () => {
      const m = (await repo.getMenu(owner, sid("menu-mittag")))!;
      expect(m.summary.courses.map((c) => c.name)).toEqual(["Vorspeise", "Hauptgang", "Dessert"]);
      expect(m.bom.lines.reduce((s, l) => s + (l.costCents ?? 0), 0)).toBeCloseTo(m.summary.costCents, 6);
      const asDemoLib = { ...stranger, libraryId: owner.libraryId };
      expect(await repo.getMenu(asDemoLib, sid("menu-mittag"))).toBeNull();
      expect(await repo.listMenus(asDemoLib)).toEqual([]);
      await expect(repo.saveMenu(stranger, { name: "Fremd", categoryId: null, priceCents: null, priceIncludesVat: true, vatBp: null, targetMarginBp: null, validFrom: null, validTo: null, courses: [{ name: "G", items: [{ recipeId: sid("rec-linsensuppe"), portions: 1 }] }] })).rejects.toThrow(/gibt es nicht mehr/);
      await expect(repo.saveMenu(staff, { name: "x", categoryId: null, priceCents: null, priceIncludesVat: true, vatBp: null, targetMarginBp: null, validFrom: null, validTo: null, courses: [] })).rejects.toThrow(/Berechtigung/);
      const { asUser } = await import("../src/data/pg/client");
      await expect(asUser(staff.userId, (tx) => tx`insert into menus (library_id, name) values (${owner.libraryId}, 'gehackt')`)).rejects.toThrow(/row-level security/);
    });
  });

  describe("labels and outlet prices", () => {
    it("label: allergens and nutrition through sub-recipes, same as in memory", async () => {
      const l = (await repo.getRecipeLabel(owner, sid("rec-linsensuppe")))!;
      expect(l.allergens.celery).toBe("contains"); // from the vegetable stock
      expect(l.nutrition.missing).toEqual(["Kreuzkümmel gemahlen"]);
      expect(l.nutrition.perPortion.energyKcal).toBeGreaterThan(400);
      expect(l.nutrition.per100!.energyKcal).toBeCloseTo(l.nutrition.perBatch.energyKcal * 100 / 4080, 0);
      expect(await repo.getRecipeLabel({ ...stranger, libraryId: owner.libraryId }, sid("rec-linsensuppe"))).toBeNull();
    });
    it("outlet price: only editors, only own outlets, list uses it", async () => {
      await expect(repo.setRecipeOutletPrice(staff, sid("rec-linsensuppe"), sid("out-mitte"), 500)).rejects.toThrow(/Berechtigung/);
      await expect(repo.setRecipeOutletPrice(owner, sid("rec-linsensuppe"), stranger.libraryId, 500)).rejects.toThrow(/Outlet nicht gefunden/);
      await repo.setRecipeOutletPrice(owner, sid("rec-linsensuppe"), sid("out-zentral"), 990);
      const row = (await repo.listRecipes(owner, { outletId: sid("out-zentral") })).find((r) => r.name.startsWith("Linsensuppe"))!;
      expect([row.sellPriceCents, row.outletPrice]).toEqual([990, true]);
      await repo.setRecipeOutletPrice(owner, sid("rec-linsensuppe"), sid("out-zentral"), null);
    });
  });

  describe("haccp", () => {
    it("staff record for their outlet only; nobody records against another library's points", async () => {
      const day = new Date().toISOString().slice(0, 10);
      expect(await repo.saveHaccpRecords(staff, sid("out-mitte"), "2026-01-05", [{ itemId: sid("hi-1"), value: "-20", action: null }])).toBe(1);
      await expect(repo.saveHaccpRecords(staff, sid("out-mitte"), "2026-01-05", [{ itemId: sid("hi-0"), value: "9", action: null }])).rejects.toThrow(/Korrekturmaßnahme/);
      await expect(repo.saveHaccpRecords(staff, sid("out-zentral"), day, [{ itemId: sid("hi-1"), value: "-20", action: null }])).rejects.toThrow();
      await expect(repo.saveHaccpRecords(staff, sid("out-mitte"), "2099-01-01", [{ itemId: sid("hi-1"), value: "-20", action: null }])).rejects.toThrow(/künftige/);
      await expect(repo.saveChecklist(staff, { name: "x", items: [{ label: "y", kind: "check", minValue: null, maxValue: null }] })).rejects.toThrow(/Berechtigung/);
      const { asUser } = await import("../src/data/pg/client");
      const strangerOutlet = (await repo.listOutlets(stranger))[0].id;
      await expect(asUser(stranger.userId, (tx) => tx`insert into haccp_records (item_id, outlet_id, day, ok) values (${sid("hi-1")}, ${strangerOutlet}, ${day}, true)`)).rejects.toThrow(/row-level security/);
    });
  });

  describe("production", () => {
    it("outlets request, the central kitchen produces from its own stock; staff without access and other libraries cannot", async () => {
      const id = await repo.requestProduction(staff, sid("out-mitte"), { recipeId: sid("rec-quark"), portions: 1, neededOn: "2099-01-01", note: null });
      await expect(repo.produce(staff, sid("out-zentral"), [id])).rejects.toThrow();
      await expect(repo.produce(owner, sid("out-mitte"), [id])).rejects.toThrow(/Nichts mehr/);
      const quark = async () => (await repo.getStock(owner, sid("out-zentral"))).find((r) => r.name.startsWith("Speisequark"))!.quantityBase;
      const before = await quark();
      expect(await repo.produce(owner, sid("out-zentral"), [id])).toBe(1);
      expect(await quark()).toBeLessThan(before);
      await expect(repo.cancelProductionRequest(owner, id)).rejects.toThrow(/Schon produziert/);
      expect(await repo.deliverProduction(owner, sid("out-zentral"), [id])).toBe(1);
      const strangerOutlet = (await repo.listOutlets(stranger))[0].id;
      await expect(repo.requestProduction(stranger, strangerOutlet, { recipeId: sid("rec-quark"), portions: 1, neededOn: "2099-01-01", note: null })).rejects.toThrow();
    });
  });

  describe("barcodes", () => {
    it("one GTIN cannot point at two different packages; the same package from two suppliers may share it", async () => {
      const quark = (await repo.getIngredient(owner, sid("ing-quark")))!.stockItems[0];
      const { supplier: _s, packageLabel: _p, id, name: _n, archivedAt: _a, libraryId: _l, ...rest } = quark as typeof quark & { libraryId?: string };
      await expect(repo.saveStockItem(owner, { ...rest, id, gtin: "02000000000015" })).rejects.toThrow(/GTIN .* gehört schon zu Butter/);
      await expect(repo.saveStockItem(owner, { ...rest, gtin: "2000000000022" })).resolves.toBeTruthy();
    });
  });

  it("two kitchen tabs producing the same request book the raw goods once", async () => {
    const id = await repo.requestProduction(owner, sid("out-mitte"), { recipeId: sid("rec-quark"), portions: 2, neededOn: "2099-01-02", note: null });
    const res = await Promise.allSettled([repo.produce(owner, sid("out-zentral"), [id]), repo.produce(owner, sid("out-zentral"), [id])]);
    expect(res.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const { asService } = await import("../src/data/pg/client");
    const events = await asService((tx) => tx`select count(*)::int as n from production_requests where id = ${id} and production_event_id is not null`);
    expect(events[0].n).toBe(1);
  });

  describe("trial end, outlet archive, export", () => {
    it("after the trial a POS key books nothing, owners get one reminder before and one after", async () => {
      const { trialReminders } = await import("../src/lib/jobs");
      const { key } = await repo.createApiKey(owner, sid("out-mitte"), "Testkasse");
      const sale = [{ externalId: "T-1", plu: "1001", name: "Linsensuppe", quantity: 1, revenueNetCents: 739, soldAt: "2026-10-20T10:00:00.000Z" }];
      await admin`update libraries set trial_ends_at = now() + interval '2 days' where id = ${owner.libraryId}`;
      expect(await trialReminders()).toMatchObject({ ok: 1 });
      expect(await trialReminders()).toMatchObject({ ok: 0, skipped: 1 });
      expect(await repo.importSalesWithKey(key, sale)).toMatchObject({ imported: 1 });
      await admin`update libraries set trial_ends_at = now() - interval '1 hour' where id = ${owner.libraryId}`;
      expect(await trialReminders()).toMatchObject({ ok: 1 });
      expect(await repo.importSalesWithKey(key, [{ ...sale[0], externalId: "T-2" }])).toBe("read_only");
      await admin`update libraries set plan = 'active' where id = ${owner.libraryId}`;
      expect(await repo.importSalesWithKey(key, [{ ...sale[0], externalId: "T-3" }])).toMatchObject({ imported: 1 });
      await admin`update libraries set plan = 'trial', trial_ends_at = now() + interval '14 days' where id = ${owner.libraryId}`;
      await admin`delete from job_runs where job = 'trial'`;
    });

    it("an outlet is archived only without open work or stranded staff; its POS keys are revoked", async () => {
      await expect(repo.archiveOutlet(staff, sid("out-mitte"))).rejects.toThrow(/Berechtigung/);
      await expect(repo.archiveOutlet(owner, sid("out-zentral"))).rejects.toThrow(/Anforderungen der Zentralküche/);
      await expect(repo.archiveOutlet(owner, sid("out-mitte"))).rejects.toThrow(/noch offen|Inventur|Nur diesem Outlet zugeordnet/);
      const popup = await repo.createOutlet(owner, "Pop-up Test", false);
      const { key } = await repo.createApiKey(owner, popup, "Pop-up-Kasse");
      await repo.archiveOutlet(owner, popup);
      expect((await repo.listOutlets(owner)).some((o) => o.id === popup)).toBe(false);
      expect(await repo.importSalesWithKey(key, [{ externalId: "P-1", plu: "1", name: "x", quantity: 1, revenueNetCents: 1, soldAt: "2026-10-20T10:00:00.000Z" }])).toBeNull();
      await expect(repo.archiveOutlet({ ...stranger, libraryId: owner.libraryId }, sid("out-zentral"))).rejects.toThrow();
      const strangerOnly = (await repo.listOutlets(stranger))[0].id;
      await expect(repo.archiveOutlet(stranger, strangerOnly)).rejects.toThrow(/letzte Outlet/);
    });

    it("the export holds the library's data and nothing secret, and nothing of another library", async () => {
      const data = await repo.exportLibrary(owner);
      expect(data.libraries.map((l) => l.id)).toEqual([owner.libraryId]);
      expect(data.recipes.length).toBeGreaterThan(0);
      expect(data.haccp_records.length).toBeGreaterThan(0);
      const text = JSON.stringify(data);
      expect(text).not.toMatch(/keyHash|tokenHash|key_hash|token_hash|stripeCustomerId/);
      const theirs = JSON.stringify(await repo.exportLibrary(stranger));
      expect(theirs).not.toContain(owner.libraryId);
      expect(theirs).not.toContain(sid("rec-linsensuppe"));
      await expect(repo.exportLibrary(staff)).rejects.toThrow(/Berechtigung/);
    });
  });

  describe("demand", () => {
    it("inquiries and cookie-free views add up per week and source; stale inquiries go after 12 months", async () => {
      const leads = await import("../src/data/leads");
      await admin`delete from leads where email like '%@it-demand.example'`;
      await admin`delete from page_views where source in ('it-a', 'it-b')`;
      const base = { phone: null, outlets: null, message: null, medium: null, campaign: null, referrer: null };
      await leads.createLead({ ...base, name: "A", company: "A", email: "a@it-demand.example", source: "it-a" });
      await leads.createLead({ ...base, name: "B", company: "B", email: "b@it-demand.example", source: "it-b" });
      for (let i = 0; i < 4; i++) await leads.countView("/", "it-a");
      const stats = await leads.demandStats(12);
      expect(stats.sources.find((x) => x.source === "it-a")).toEqual({ source: "it-a", views: 4, leads: 1 });
      expect(stats.sources.find((x) => x.source === "it-b")).toEqual({ source: "it-b", views: 0, leads: 1 });
      expect(stats.weeks.at(-1)!.leads).toBeGreaterThanOrEqual(2);
      await admin`update leads set updated_at = now() - interval '13 months' where email = 'a@it-demand.example'`;
      expect(await leads.deleteStaleLeads()).toBeGreaterThanOrEqual(1);
      expect(await admin`select 1 from leads where email like '%@it-demand.example'`).toHaveLength(1);
      await admin`delete from leads where email like '%@it-demand.example'`;
      await admin`delete from page_views where source in ('it-a', 'it-b')`;
    });
  });

  describe("internal tables", () => {
    it("signed-in users cannot read or change the migration log (Supabase exposes public tables over its REST API)", async () => {
      const { asUser } = await import("../src/data/pg/client");
      await expect(asUser(owner.userId, (tx) => tx`delete from schema_migrations`)).rejects.toThrow(/permission denied/);
      await expect(asUser(owner.userId, (tx) => tx`select name from schema_migrations`)).rejects.toThrow(/permission denied/);
      await expect(asUser(owner.userId, (tx) => tx`select id from leads`)).resolves.toHaveLength(0);
      await expect(asUser(owner.userId, (tx) => tx`insert into page_views (day, path, views) values (current_date, '/', 999)`)).rejects.toThrow();
    });
  });

  describe("invoices", () => {
    it("editors match and approve; staff and other libraries cannot", async () => {
      const order = (await repo.getOrder(owner, sid("po-1")))!;
      const lines = order.lines.map((l) => ({ lineId: l.id, quantityPacks: l.receivedPacks, unitPriceCents: l.unitPriceCents + 10 }));
      await expect(repo.saveInvoice(staff, sid("po-1"), { invoiceNumber: "IT-1", invoiceDate: "2026-10-20", lines })).rejects.toThrow(/Berechtigung/);
      expect(await repo.saveInvoice(owner, sid("po-1"), { invoiceNumber: "IT-1", invoiceDate: "2026-10-20", lines })).toBe("mismatch");
      await expect(repo.approveInvoice(owner, sid("po-1"), null)).rejects.toThrow(/begründen/);
      await repo.approveInvoice(owner, sid("po-1"), "Preiserhöhung akzeptiert");
      expect((await repo.getInvoice(owner, sid("po-1")))!.status).toBe("approved");
      expect(await repo.getInvoice({ ...stranger, libraryId: owner.libraryId }, sid("po-1"))).toBeNull();
      await expect(repo.saveInvoice(owner, sid("po-2"), { invoiceNumber: "IT-2", invoiceDate: "2026-10-20", lines: [] })).rejects.toThrow(/Wareneingang/);
    });
  });

  describe("point of sale", () => {
    it("two imports at the same time book each sale once", async () => {
      const rows = (tag: string) => Array.from({ length: 5 }, (_, i) => ({ externalId: `${tag}-${i}`, plu: "1001", name: "Linsensuppe", quantity: 1, revenueNetCents: 739, soldAt: "2026-10-20T10:00:00.000Z" }));
      const before = (await repo.getStock(owner, sid("out-mitte"))).find((r) => r.name === "Rote Linsen")!.quantityBase;
      const [a, b] = await Promise.all([repo.importSales(owner, sid("out-mitte"), rows("P")), repo.importSales(owner, sid("out-mitte"), [...rows("P"), ...rows("Q")])]);
      expect(a.imported + b.imported).toBe(10);
      expect(a.depleted + b.depleted).toBe(10);
      const after = (await repo.getStock(owner, sid("out-mitte"))).find((r) => r.name === "Rote Linsen")!.quantityBase;
      expect(before - after).toBeCloseTo(10 * 80, 6); // 10 portions of a 10-portion soup with 800 g lentils
    });
    it("staff cannot import into an outlet they are not assigned to", async () => {
      await expect(repo.importSales(staff, sid("out-zentral"), [{ externalId: "Z-1", plu: "1", name: "x", quantity: 1, revenueNetCents: 0, soldAt: "2026-10-20T10:00:00.000Z" }])).rejects.toThrow(/Berechtigung/);
      expect(await repo.importSalesWithKey("mirepa_unbekannt", [])).toBeNull();
    });
  });

  describe("prices", () => {
    it("BUG-001: an editor can save and change a supplier price (with price history)", async () => {
      const ing = await repo.saveIngredient(owner, { name: `Preis-Test ${Date.now()}`, shortName: null, internalUid: null, categoryId: null, baseUnit: "g", gramsPerPiece: null, mlPerGram: null });
      const pack = await repo.savePackage(owner, { ingredientId: ing, parentPackageId: null, count: 1, quantityBase: 5000, label: "5 kg" });
      const si = await repo.saveStockItem(owner, { ingredientId: ing, supplierId: sid("sup-frische"), packageId: pack, priceType: "per_unit", priceCents: 320, priceUnit: "g", priceUnitQuantity: 1000, isPreferred: true, supplierSku: null, gtin: null, weighted: false });
      await repo.saveStockItem(owner, { id: si, ingredientId: ing, supplierId: sid("sup-frische"), packageId: pack, priceType: "per_unit", priceCents: 350, priceUnit: "g", priceUnitQuantity: 1000, isPreferred: true, supplierSku: null, gtin: null, weighted: false });
      expect((await repo.getIngredient(owner, ing))!.costPerBaseCents).toBeCloseTo(0.35);
      const history = await admin`select price_cents from stock_item_price_history where stock_item_id = ${si} order by valid_from`;
      expect(history.map((h) => h.price_cents)).toEqual([320, 350]);
    });
  });

  describe("recipes", () => {
    it("costs the soup through the sub-recipe like the in-memory version", async () => {
      const soup = (await repo.listRecipes(owner)).find((r) => r.name.startsWith("Linsensuppe"))!;
      expect(soup.perPortionCents).toBeCloseTo(62.6, 0);
      expect(soup.missing).toBe(0);
    });
    it("rejects a sub-recipe cycle with a readable message", async () => {
      const fond = (await repo.getRecipe(owner, sid("rec-fond")))!.recipe;
      await expect(repo.saveRecipe(owner, { ...fond, id: fond.id, lines: [...fond.lines, { ingredientId: null, subRecipeId: sid("rec-fond"), quantity: 1, unit: "l", position: 9 }] }))
        .rejects.toThrow();
      const parent = await repo.saveRecipe(owner, { ...fond, id: undefined, name: "Testsuppe", productType: "semi_finished", lines: [{ ingredientId: null, subRecipeId: sid("rec-fond"), quantity: 1, unit: "l", position: 0 }] });
      await expect(repo.saveRecipe(owner, { ...fond, id: fond.id, lines: [...fond.lines, { ingredientId: null, subRecipeId: parent, quantity: 1, unit: "l", position: 9 }] }))
        .rejects.toThrow(/Endlosschleife/);
      await repo.archiveRecipe(owner, parent);
    });
  });

  describe("accounts", () => {
    it("invitations: wrong email is refused, right email joins with the invited role and outlets", async () => {
      const { token } = await repo.inviteMember(owner, { name: "Neu", email: "neu@example.com", role: "outlet_staff", outletIds: [sid("out-mitte")] });
      expect((await repo.invitationPreview(token!))?.libraryName).toBe("Demo Bistro");
      await expect(repo.acceptInvitation(strangerId, token!, "Fremd")).rejects.toThrow(/andere E-Mail/);
      const newId = "00000000-0000-4000-8000-0000000000aa";
      await admin`insert into auth.users (id, email) values (${newId}, 'NEU@example.com') on conflict do nothing`;
      expect(await repo.acceptInvitation(newId, token!, "Neu")).toBe(owner.libraryId);
      const m = (await repo.getMembership(newId))!;
      expect(m.role).toBe("outlet_staff");
      expect(m.outletIds).toEqual([sid("out-mitte")]);
      await expect(repo.acceptInvitation(newId, token!, "Neu")).rejects.toThrow(/ungültig oder abgelaufen/);
      await admin`delete from memberships where user_id = ${newId}`;
      await admin`delete from auth.users where id = ${newId}`;
    });
    it("account deletion: owner with a team is stopped, a sole member takes the library with them", async () => {
      expect((await repo.deleteAccountData(owner.userId)).ok).toBe(false);
      const loneId = "00000000-0000-4000-8000-0000000000bb";
      await admin`insert into auth.users (id, email) values (${loneId}, 'allein@example.com') on conflict do nothing`;
      const lib = await repo.createLibrary(loneId, { libraryName: "Einzelbetrieb", outletName: "Küche", ownerName: "Allein" });
      const s = (await repo.getMembership(loneId))!;
      const ing = await repo.saveIngredient(s, { name: "Mehl", shortName: null, internalUid: null, categoryId: null, baseUnit: "g", gramsPerPiece: null, mlPerGram: null });
      await repo.recordWaste(s, (await repo.listOutlets(s))[0].id, [{ ingredientId: ing, quantityBase: 10, reason: "x" }]);
      expect((await repo.deleteAccountData(loneId)).ok).toBe(true);
      expect(await admin`select 1 from libraries where id = ${lib}`).toHaveLength(0);
      expect(await admin`select 1 from ingredients where library_id = ${lib}`).toHaveLength(0);
      await admin`delete from auth.users where id = ${loneId}`;
    });
  });

  describe("jobs", () => {
    it("low-stock alert mails each outlet once per day and records the run", async () => {
      const { lowStockAlerts } = await import("../src/lib/jobs");
      const day = new Date("2031-01-15T04:00:00Z");
      await admin`delete from job_runs where job = 'low-stock' and item_key like ${"%:2031-01-15"}`;
      await admin`delete from stock_alerts_sent where day = '2031-01-15'`;
      const first = await lowStockAlerts(day);
      expect(first.ok).toBeGreaterThan(0);
      expect(first.failed).toBe(0);
      const second = await lowStockAlerts(day);
      expect(second.ok).toBe(0); // already done today: skipped, no second email
      const [sent] = await admin`select count(*)::int as n from stock_alerts_sent where day = '2031-01-15'`;
      expect(sent.n).toBeGreaterThan(0);
    });
  });

  describe("stripe webhook", () => {
    const stripe = new Stripe("sk_test_dummy");
    const secret = "whsec_test_secret";
    const event = (id: string, type: string, object: object) => JSON.stringify({ id, object: "event", type, data: { object }, api_version: "2025-01-01", created: 0, livemode: false, pending_webhooks: 0, request: null });

    it("rejects a payload with a wrong signature", () => {
      const body = event("evt_1", "checkout.session.completed", {});
      const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_other" });
      expect(() => stripe.webhooks.constructEvent(body, header, secret)).toThrow();
    });
    it("applies checkout once, ignores the retried delivery, follows subscription changes", async () => {
      const { handleStripeEvent } = await import("../src/lib/billing");
      await admin`delete from processed_webhooks where event_id like 'evt_test_%'`;
      const body = event("evt_test_1", "checkout.session.completed", { object: "checkout.session", client_reference_id: stranger.libraryId, customer: "cus_test", subscription: "sub_test" });
      const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
      const verified = stripe.webhooks.constructEvent(body, header, secret);
      expect(await handleStripeEvent(verified)).toBe("applied");
      expect(await handleStripeEvent(verified)).toBe("duplicate");
      let [lib] = await admin`select plan, stripe_customer_id from libraries where id = ${stranger.libraryId}`;
      expect(lib).toMatchObject({ plan: "active", stripe_customer_id: "cus_test" });

      const failed = JSON.parse(event("evt_test_2", "invoice.payment_failed", { object: "invoice", customer: "cus_test" }));
      expect(await handleStripeEvent(failed)).toBe("applied");
      [lib] = await admin`select plan from libraries where id = ${stranger.libraryId}`;
      expect(lib.plan).toBe("past_due");

      const deleted = JSON.parse(event("evt_test_3", "customer.subscription.deleted", { object: "subscription", id: "sub_test", status: "canceled", metadata: {}, items: { data: [{ current_period_end: 1893456000 }] } }));
      expect(await handleStripeEvent(deleted)).toBe("applied");
      [lib] = await admin`select plan, stripe_subscription_id from libraries where id = ${stranger.libraryId}`;
      expect(lib).toMatchObject({ plan: "cancelled", stripe_subscription_id: null });
    });
  });
});
