// SQL 006 (v1.1 integrated): POS lines, training scored on the server, tasks/parStock in the workspace, audit,
// rate limit – with two organisations and separate accounts per role, against a fresh local Postgres
// with a stand-in for Supabase auth (same harness as rls.test.mjs).
//   TEST_DATABASE_URL=postgres://postgres@localhost:54329/kitchen node --test suite-tests/rls-v11.test.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";

const base = process.env.TEST_DATABASE_URL;
const sqlDir = new URL("../suite-sql/", import.meta.url);
const dbName = `glb_v11_${process.pid}`;
let admin, db;
const U = Object.fromEntries(["ownerA", "ownerB", "service", "serviceLead", "kitchen", "kitchenLead", "viewer"].map((k) => [k, randomUUID()]));
const HASH = (c) => c.repeat(64);

async function as(uid, fn, role = uid ? "authenticated" : "anon") {
  return db.begin(async (tx) => {
    await tx.unsafe(`set local role ${role}`);
    await tx`select set_config('request.jwt.claim.sub', ${uid ?? ""}, true)`;
    return fn(tx);
  });
}
const rejects = (p, code) => assert.rejects(p, (e) => String(e.message).includes(code), `expected ${code}`);
const line = (o = {}) => ({
  service_date: "2026-10-20", check_id: "A1", outlet_id: "restaurant", product_name: "Burger", quantity: 1, unit_price_gross: 10,
  unit_cost_net: 3, vat_percent: 7, guests: 2, stage: "none", source_hash: HASH("a"), line_no: 2, file_name: "a.csv", ...o,
});

describe("GLB SQL 006: v1.1 integriert", { skip: !base && "TEST_DATABASE_URL fehlt" }, () => {
  let orgA, orgB;
  before(async () => {
    admin = postgres(base, { onnotice: () => {} });
    await admin.unsafe(`create database ${dbName}`);
    const url = new URL(base);
    url.pathname = `/${dbName}`;
    db = postgres(url.toString(), { onnotice: () => {}, max: 1 });
    await db.unsafe(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      grant usage on schema public to anon, authenticated, service_role;
    `);
    for (const [k, id] of Object.entries(U)) await db`insert into auth.users values (${id}, ${k + "@example.com"}, now())`;
    for (const f of ["001_cloud_pilot.sql", "002_roles_and_security.sql", "006_glb_v11_integrated.sql", "006_glb_v11_integrated.sql"])
      await db.unsafe(readFileSync(new URL(f, sqlDir), "utf8")); // 006 twice: must be repeatable
    orgA = (await as(U.ownerA, (tx) => tx`select public.glb_create_workspace('A') as id`))[0].id;
    orgB = (await as(U.ownerB, (tx) => tx`select public.glb_create_workspace('B') as id`))[0].id;
    const ws = {
      business: "A",
      outlets: [{ id: "restaurant", name: "Restaurant" }, { id: "bar", name: "Bar" }],
      items: [{ id: "p1", name: "Burger", costNet: 3, costHistory: [{ validFrom: "2026-01-01", costNet: 3 }], vat: 7 }],
      sales: [{ id: "s1", productId: "p1", outletId: "restaurant", month: "2026-09", quantity: 10, grossPrice: 10, unitCostNet: 3, vatPercent: 7 }],
      tasks: [{ id: "t1", title: "Kühlhaus", status: "open", priority: "high" }],
      parStock: [{ id: "k1", name: "Gin", stock: 3, reorder_point: 5, par_level: 12 }],
      intelligence: { tags: [{ product_name: "Espresso", stage: "coffee" }], targets: [], markets: [], pos: [], training: [] },
    };
    await as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, 0, ${tx.json(ws)})`);
    await as(U.ownerB, (tx) => tx`select public.glb_save_snapshot(${orgB}, 0, ${tx.json({ business: "B", items: [], outlets: [{ id: "restaurant", name: "R" }] })})`);
    for (const [k, r] of [["service", "service_staff"], ["serviceLead", "service_lead"], ["kitchen", "kitchen_staff"], ["kitchenLead", "kitchen_lead"]]) {
      await as(U.ownerA, (tx) => tx`select public.glb_invite_member_v08(${orgA}, ${k + "@example.com"}, ${r})`);
      await as(U[k], (tx) => tx`select public.glb_accept_invitations()`);
    }
    await db`insert into public.glb_memberships values (${orgA}, ${U.viewer}, 'viewer')`;
  });
  after(async () => {
    await db?.end();
    await admin?.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  it("Kassenbons: Duplikate sicher erkannt, Überschneidung zur Prüfung, unbekanntes Outlet abgelehnt", async () => {
    const ins = (lines, overlap = "review") => as(U.ownerA, (tx) => tx`select public.glb_pos_insert(${orgA}, ${tx.json(lines)}, ${overlap}) as r`).then((x) => x[0].r);
    let r = await ins([line(), line({ line_no: 3, check_id: "A2", product_name: "Espresso", unit_price_gross: 3, external_line_id: "E1" })]);
    assert.deepEqual([r.inserted, r.duplicates, r.review], [2, 0, 0]);
    r = await ins([line()]); // same file line
    assert.deepEqual([r.inserted, r.duplicates], [0, 1]);
    r = await ins([line({ source_hash: HASH("b"), line_no: 9, check_id: "Z9", external_line_id: "E1" })]); // same position id
    assert.equal(r.duplicates, 1);
    r = await ins([line({ source_hash: HASH("c"), line_no: 2 })]); // same check/article/qty/price from another file
    assert.deepEqual([r.inserted, r.review], [1, 1]);
    r = await ins([line({ source_hash: HASH("d"), line_no: 2, check_id: "B7" })]); // same amount, other check: not a duplicate
    assert.deepEqual([r.inserted, r.review], [1, 0]);
    await rejects(ins([line({ outlet_id: "fremd", source_hash: HASH("e") })]), "UNKNOWN_OUTLET");
    const pending = await as(U.ownerA, (tx) => tx`select id from public.glb_pos_lines where review_status = 'pending'`);
    assert.equal(pending.length, 1);
    const sum = (await as(U.ownerA, (tx) => tx`select public.glb_pos_summary(${orgA}, '2026-10-01', '2026-10-31', null) as s`))[0].s;
    assert.equal(sum.checks, 3); // A1, A2, B7 – the pending line is not counted
    assert.equal(sum.stages.coffee, 1); // Espresso mapped via workspace tags
    assert.equal(sum.covers, 6);
    assert.equal(await as(U.ownerA, (tx) => tx`select public.glb_pos_review(${orgA}, ${pending.map((x) => x.id)}, 'reject') as n`).then((x) => x[0].n), 1);
  });

  it("Storno netto, ungültige Zeile abgelehnt", async () => {
    const ins = (lines) => as(U.ownerA, (tx) => tx`select public.glb_pos_insert(${orgA}, ${tx.json(lines)}, 'review') as r`);
    await ins([
      line({ source_hash: HASH("f"), line_no: 2, check_id: "C1", product_name: "Espresso", unit_price_gross: 3, external_line_id: "S1" }),
      line({ source_hash: HASH("f"), line_no: 3, check_id: "C1", product_name: "Espresso", unit_price_gross: 3, quantity: -1, line_type: "void", corrects_external_line_id: "S1", external_line_id: "S2" }),
    ]);
    const sum = (await as(U.ownerA, (tx) => tx`select public.glb_pos_summary(${orgA}, '2026-10-20', '2026-10-20', 'restaurant') as s`))[0].s;
    assert.equal(sum.stages.coffee, 1); // only A2; C1 was voided
    await rejects(ins([line({ source_hash: HASH("1"), quantity: -1 })]), "glb_pos_lines_check");
  });

  it("Mandanten und Rollen: fremder Betrieb, Service, Küche, ohne Anmeldung, keine direkten Schreibrechte", async () => {
    assert.equal((await as(U.ownerB, (tx) => tx`select 1 from public.glb_pos_lines where organization_id = ${orgA}`)).length, 0);
    await rejects(as(U.ownerB, (tx) => tx`select public.glb_pos_insert(${orgA}, ${tx.json([line({ source_hash: HASH("2") })])}, 'review')`), "ROLE_NOT_PERMITTED");
    await rejects(as(U.ownerB, (tx) => tx`select public.glb_pos_summary(${orgA}, '2026-10-01', '2026-10-31', null)`), "ROLE_NOT_PERMITTED");
    assert.equal((await as(U.service, (tx) => tx`select 1 from public.glb_pos_lines`)).length, 0);
    await rejects(as(U.service, (tx) => tx`select public.glb_pos_insert(${orgA}, ${tx.json([line({ source_hash: HASH("3") })])}, 'review')`), "ROLE_NOT_PERMITTED");
    await rejects(as(U.ownerA, (tx) => tx`insert into public.glb_pos_lines (organization_id, service_date, check_id, outlet_id, product_name, quantity, unit_price_gross, vat_percent, source_hash, line_no, file_name) values (${orgA}, '2026-10-20', 'X', 'restaurant', 'Y', 1, 1, 7, ${HASH("4")}, 2, 'x')`), "permission denied");
    await rejects(as(null, (tx) => tx`select * from public.glb_pos_lines`), "permission denied");
    await rejects(as(U.ownerA, (tx) => tx`select public.glb_pos_insert_system(${orgA}, 'kasse', ${tx.json([line({ source_hash: HASH("5") })])})`), "permission denied");
    const r = (await as(null, (tx) => tx`select public.glb_pos_insert_system(${orgA}, 'kasse', ${tx.json([line({ source_hash: HASH("5"), check_id: "W1", external_line_id: "K-1" })])}) as r`, "service_role"))[0].r;
    assert.equal(r.inserted, 1);
    await rejects(as(null, (tx) => tx`select public.glb_pos_insert_system(${orgA}, 'csv', ${tx.json([line({ source_hash: HASH("6") })])})`, "service_role"), "INVALID_SOURCE");
  });

  it("Training: Bewertung auf dem Server, 100 XP, ein Versuch je Thema und Tag, nur eigene Ergebnisse", async () => {
    const submit = (uid, stage, answer) => as(uid, (tx) => tx`select public.glb_submit_training(${orgA}, ${stage}, ${answer}) as r`).then((x) => x[0].r);
    assert.deepEqual(await submit(U.service, "water", 1).then((r) => [r.correct, r.points]), [true, 100]);
    assert.deepEqual(await submit(U.service, "aperitif", 2).then((r) => [r.correct, r.points]), [false, 0]);
    await rejects(submit(U.service, "water", 1), "TRAINING_ALREADY_TODAY");
    await rejects(submit(U.viewer, "water", 1), "ROLE_NOT_PERMITTED");
    await rejects(submit(U.ownerB, "water", 1), "ROLE_NOT_PERMITTED");
    // a manipulated request cannot store points: no insert right, answer key not readable
    await rejects(as(U.kitchen, (tx) => tx`insert into public.glb_training_results (organization_id, user_id, stage, answer, correct, points) values (${orgA}, ${U.kitchen}, 'dessert', 9, true, 100)`), "permission denied");
    await rejects(as(U.kitchen, (tx) => tx`select * from public.glb_training_questions`), "permission denied");
    assert.equal((await as(U.service, (tx) => tx`select * from public.glb_training_results`)).length, 2);
    assert.equal((await as(U.ownerA, (tx) => tx`select * from public.glb_training_results`)).length, 0, "keine Einsicht in fremde Lernergebnisse, auch nicht als Inhaber");
    assert.equal((await as(U.kitchen, (tx) => tx`select * from public.glb_training_results`)).length, 0);
  });

  it("Arbeitsbereich: Aufgaben für alle, Mindestbestände für Küche, keine Kosten an eingeschränkte Rollen", async () => {
    const read = (uid) => as(uid, (tx) => tx`select public.glb_read_workspace(${orgA}) as w`).then((x) => x[0].w);
    const s = await read(U.service);
    assert.equal(s.data.tasks.length, 1);
    assert.equal(s.data.parStock, undefined);
    assert.equal(s.data.items[0].costHistory, undefined, "Kostenstände nicht an Service");
    assert.equal(s.data.intelligence, undefined);
    const k = await read(U.kitchen);
    assert.equal(k.data.parStock.length, 1);
    const sl = await read(U.serviceLead);
    assert.equal(sl.data.sales[0].unitCostNet, undefined, "Kosten-Snapshot nicht an Serviceleitung");
    // limited writes: service writes tasks; kitchen staff cannot write parStock; service lead keeps hidden snapshots
    await as(U.service, (tx) => tx`select public.glb_save_limited(${orgA}, ${s.revision}, ${tx.json({ tasks: [...s.data.tasks, { id: "t2", title: "Neu", status: "open" }], parStock: [] })})`);
    const k2 = await read(U.kitchen);
    await rejects(as(U.kitchen, (tx) => tx`select public.glb_save_limited(${orgA}, ${k2.revision}, ${tx.json({ parStock: [] })})`), "NO_PERMITTED_CHANGES");
    const sl2 = await read(U.serviceLead);
    await as(U.serviceLead, (tx) => tx`select public.glb_save_limited(${orgA}, ${sl2.revision}, ${tx.json({ sales: [...sl2.data.sales, { id: "s2", productId: "p1", outletId: "bar", month: "2026-10", quantity: 2, grossPrice: 10, unitCostNet: 0.01 }] })})`);
    const [{ data }] = await as(U.ownerA, (tx) => tx`select data from public.glb_snapshots where organization_id = ${orgA}`);
    assert.equal(data.tasks.length, 2);
    assert.equal(data.parStock.length, 1, "Mindestbestände vom Service nicht überschreibbar");
    assert.equal(data.sales.find((x) => x.id === "s1").unitCostNet, 3, "vorhandener Snapshot bleibt");
    assert.equal("unitCostNet" in data.sales.find((x) => x.id === "s2"), false, "Serviceleitung setzt keine Kosten");
    const kl = await read(U.kitchenLead);
    await as(U.kitchenLead, (tx) => tx`select public.glb_save_limited(${orgA}, ${kl.revision}, ${tx.json({ parStock: [{ id: "k1", name: "Gin", stock: 9, reorder_point: 5, par_level: 12, version: 2 }] })})`);
  });

  it("Audit: Speicherungen protokolliert, nur Inhaber/GF lesen, nur eigener Betrieb", async () => {
    const own = await as(U.ownerA, (tx) => tx`select entity, operation, detail from public.glb_audit_events where organization_id = ${orgA} order by id`);
    assert.ok(own.some((e) => e.entity === "workspace" && e.detail.changed.tasks !== undefined));
    assert.ok(own.some((e) => e.entity === "glb_pos_lines" && e.operation === "INSERT"));
    assert.ok(own.some((e) => e.entity === "glb_training_results" && e.detail === null), "Training: nur dass gespeichert wurde");
    assert.equal((await as(U.service, (tx) => tx`select 1 from public.glb_audit_events`)).length, 0);
    assert.equal((await as(U.ownerB, (tx) => tx`select 1 from public.glb_audit_events where organization_id = ${orgA}`)).length, 0);
  });

  it("Ratenbegrenzung je Betrieb und Tag, nur Management", async () => {
    const take = (uid) => as(uid, (tx) => tx`select public.glb_api_take(${orgA}, 'market_ai', 2) as ok`).then((x) => x[0].ok);
    assert.equal(await take(U.ownerA), true);
    assert.equal(await take(U.ownerA), true);
    assert.equal(await take(U.ownerA), false);
    await rejects(take(U.service), "ROLE_NOT_PERMITTED");
    assert.equal(await as(U.ownerA, (tx) => tx`select public.glb_v11_can_manage(${orgA}) as ok`).then((x) => x[0].ok), true);
    assert.equal(await as(U.service, (tx) => tx`select public.glb_v11_can_manage(${orgA}) as ok`).then((x) => x[0].ok), false);
  });
});
