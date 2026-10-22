// Tenant separation and role rights of the GLB AI Suite SQL (suite-sql/001 + 002), against a fresh local Postgres
// database with a stand-in for Supabase auth (auth.users, auth.uid() from the JWT claim, roles anon/authenticated).
//   TEST_DATABASE_URL=postgres://postgres@localhost:54329/kitchen node --test suite-tests/rls.test.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";

const base = process.env.TEST_DATABASE_URL;
const sqlDir = new URL("../suite-sql/", import.meta.url);
const dbName = `glb_rls_${process.pid}`;
let admin, db;

const OWNER_A = randomUUID(), OWNER_B = randomUUID(), SERVICE = randomUUID(), KITCHEN = randomUUID(), GM = randomUUID(), STRANGER = randomUUID();
const EMAIL = { [OWNER_A]: "a@example.com", [OWNER_B]: "b@example.com", [SERVICE]: "service@example.com", [KITCHEN]: "kueche@example.com", [GM]: "gf@example.com", [STRANGER]: "fremd@example.com" };

/** Runs fn as a signed-in Supabase user (role authenticated, auth.uid() = uid), or as anon without uid. */
async function as(uid, fn) {
  return db.begin(async (tx) => {
    await tx.unsafe(uid ? "set local role authenticated" : "set local role anon");
    await tx`select set_config('request.jwt.claim.sub', ${uid ?? ""}, true)`;
    return fn(tx);
  });
}
const rejects = async (p, code) => assert.rejects(p, (e) => (code instanceof RegExp ? code.test(e.message) : String(e.message).includes(code)), `expected ${code}`);
// Supabase grants new functions to anon by default; then the function's own AUTH_REQUIRED check is the barrier.
const ANON_BLOCKED = /AUTH_REQUIRED|permission denied/;

describe("GLB SQL: Mandanten und Rollen", { skip: !base && "TEST_DATABASE_URL fehlt" }, () => {
  let orgA, orgB;
  const snapshot = {
    business: "Betrieb A",
    items: [{ id: "p1", name: "Burger", category: "Burger", grossPrice: 14.9, costNet: 4.2, costDetail: { ingredientsNet: 4.2 }, vat: 19 }],
    ingredients: [{ id: "i1", name: "Patty", packCostNet: 58, supplierPriceNet: 58, costNet: 2.4 }],
    sales: [{ productId: "p1", outletId: "restaurant", month: "2026-09", quantity: 10, grossPrice: 14.9 }],
    funnel: [{ id: "f1", date: "2026-09-21", outletId: "restaurant", covers: 80, desserts: 12 }],
    monthlyCosts: { "2026-09": { payroll: 18000, energy: 2100 } },
    recipes: [{ productId: "p1", lines: [{ ingredientId: "i1", quantity: 1 }] }],
  };

  before(async () => {
    admin = postgres(base, { onnotice: () => {} });
    await admin.unsafe(`create database ${dbName}`);
    const url = new URL(base);
    url.pathname = `/${dbName}`;
    db = postgres(url.toString(), { onnotice: () => {}, max: 1 }); // 002 has its own begin/commit
    await db.unsafe(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      end $$;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      grant usage on schema public to anon, authenticated;
    `);
    for (const [id, email] of Object.entries(EMAIL)) await db`insert into auth.users values (${id}, ${email}, now())`;
    await db.unsafe(readFileSync(new URL("001_cloud_pilot.sql", sqlDir), "utf8"));
    await db.unsafe(readFileSync(new URL("002_roles_and_security.sql", sqlDir), "utf8"));
    orgA = (await as(OWNER_A, (tx) => tx`select public.glb_create_workspace('Betrieb A') as id`))[0].id;
    orgB = (await as(OWNER_B, (tx) => tx`select public.glb_create_workspace('Betrieb B') as id`))[0].id;
    await as(OWNER_A, (tx) => tx`select public.glb_save_snapshot(${orgA}, 0, ${tx.json(snapshot)})`);
    await as(OWNER_B, (tx) => tx`select public.glb_save_snapshot(${orgB}, 0, ${tx.json({ business: "Betrieb B", items: [] })})`);
  });

  after(async () => {
    await db?.end();
    await admin?.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  it("ein Betrieb sieht und ändert die Daten eines anderen nicht", async () => {
    assert.equal((await as(OWNER_B, (tx) => tx`select 1 from public.glb_snapshots where organization_id = ${orgA}`)).length, 0);
    assert.equal((await as(OWNER_B, (tx) => tx`select 1 from public.glb_organizations where id = ${orgA}`)).length, 0);
    await rejects(as(OWNER_B, (tx) => tx`select public.glb_read_workspace(${orgA})`), "ACCESS_DENIED");
    await rejects(as(OWNER_B, (tx) => tx`select public.glb_save_snapshot(${orgA}, 1, ${tx.json({ items: [] })})`), "WRITE_NOT_ALLOWED");
    await rejects(as(OWNER_B, (tx) => tx`select public.glb_save_limited(${orgA}, 1, ${tx.json({ funnel: [] })})`), "ACCESS_DENIED");
    const [{ data }] = await as(OWNER_A, (tx) => tx`select data from public.glb_snapshots where organization_id = ${orgA}`);
    assert.equal(data.business, "Betrieb A");
  });

  it("ohne Anmeldung kein Lesen und kein Schreiben", async () => {
    await rejects(as(null, (tx) => tx`select * from public.glb_snapshots`), "permission denied");
    await rejects(as(null, (tx) => tx`select public.glb_read_workspace(${orgA})`), "permission denied");
    await rejects(as(null, (tx) => tx`select public.glb_save_snapshot(${orgA}, 1, ${tx.json({})})`), ANON_BLOCKED);
    await rejects(as(null, (tx) => tx`select public.glb_create_workspace('X')`), ANON_BLOCKED);
    // and with execute granted, as on Supabase: the functions refuse without a signed-in user
    await db.unsafe("grant execute on all functions in schema public to anon");
    await rejects(as(null, (tx) => tx`select public.glb_save_snapshot(${orgA}, 1, ${tx.json({})})`), "AUTH_REQUIRED");
    await rejects(as(null, (tx) => tx`select public.glb_create_workspace('X')`), "AUTH_REQUIRED");
    await rejects(as(null, (tx) => tx`select public.glb_save_limited(${orgA}, 1, ${tx.json({ funnel: [] })})`), "ACCESS_DENIED");
    await rejects(as(null, (tx) => tx`select public.glb_read_workspace(${orgA})`), "ACCESS_DENIED");
    await rejects(as(null, (tx) => tx`select * from public.glb_list_members(${orgA})`), "NOT_AUTHORIZED");
    await db.unsafe("revoke execute on all functions in schema public from anon");
  });

  it("keine direkten Schreibzugriffe auf die Tabellen, auch nicht für den Inhaber", async () => {
    await rejects(as(OWNER_A, (tx) => tx`update public.glb_snapshots set data = '{}' where organization_id = ${orgA}`), "permission denied");
    await rejects(as(OWNER_A, (tx) => tx`insert into public.glb_memberships values (${orgA}, ${STRANGER}, 'owner')`), "permission denied");
  });

  it("Service-Mitarbeiter: liest ohne Kosten, schreibt nur den Funnel", async () => {
    await as(OWNER_A, (tx) => tx`select public.glb_invite_member_v08(${orgA}, ${EMAIL[SERVICE]}, 'service_staff')`);
    assert.equal((await as(SERVICE, (tx) => tx`select public.glb_accept_invitations() as n`))[0].n, 1);
    assert.equal((await as(SERVICE, (tx) => tx`select 1 from public.glb_snapshots`)).length, 0, "kein Direktzugriff auf den ganzen Stand");
    const [{ glb_read_workspace: ws }] = await as(SERVICE, (tx) => tx`select public.glb_read_workspace(${orgA})`);
    assert.equal(ws.role, "service_staff");
    assert.equal(ws.data.items[0].costNet, 0);
    assert.equal(ws.data.items[0].costDetail, undefined);
    assert.equal(ws.data.ingredients, undefined);
    assert.equal(ws.data.monthlyCosts, undefined);
    assert.deepEqual(ws.data.sales, []);
    assert.equal(ws.data.funnel.length, 1);
    await rejects(as(SERVICE, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${ws.revision}, ${tx.json({ items: [] })})`), "WRITE_NOT_ALLOWED");
    const patch = { funnel: [...snapshot.funnel, { id: "f2", date: "2026-09-22", outletId: "restaurant", covers: 70 }], items: [], monthlyCosts: {} };
    await as(SERVICE, (tx) => tx`select public.glb_save_limited(${orgA}, ${ws.revision}, ${tx.json(patch)})`);
    const [{ data }] = await as(OWNER_A, (tx) => tx`select data from public.glb_snapshots where organization_id = ${orgA}`);
    assert.equal(data.funnel.length, 2, "Funnel übernommen");
    assert.equal(data.items.length, 1, "Artikel nicht überschrieben");
    assert.equal(data.monthlyCosts["2026-09"].payroll, 18000, "Fixkosten nicht überschrieben");
  });

  it("Küchen-Mitarbeiter: Rohwaren ohne Einkaufspreise, schreibt nur Zählungen", async () => {
    await as(OWNER_A, (tx) => tx`select public.glb_invite_member_v08(${orgA}, ${EMAIL[KITCHEN]}, 'kitchen_staff')`);
    await as(KITCHEN, (tx) => tx`select public.glb_accept_invitations()`);
    const [{ glb_read_workspace: ws }] = await as(KITCHEN, (tx) => tx`select public.glb_read_workspace(${orgA})`);
    assert.equal(ws.data.ingredients[0].packCostNet, 0);
    assert.equal(ws.data.ingredients[0].supplierPriceNet, undefined);
    assert.equal(ws.data.ingredients[0].costNet, undefined);
    assert.equal(ws.data.items[0].costNet, 0);
    await rejects(as(KITCHEN, (tx) => tx`select public.glb_save_limited(${orgA}, ${ws.revision}, ${tx.json({ funnel: [] })})`), "NO_PERMITTED_CHANGES");
  });

  it("Geschäftsführung verwaltet Team, aber nicht Inhaber oder weitere Geschäftsführer", async () => {
    await as(OWNER_A, (tx) => tx`select public.glb_invite_member_v08(${orgA}, ${EMAIL[GM]}, 'general_manager')`);
    await as(GM, (tx) => tx`select public.glb_accept_invitations()`);
    await rejects(as(GM, (tx) => tx`select public.glb_invite_member_v08(${orgA}, 'neu@example.com', 'general_manager')`), "OWNER_ONLY");
    await rejects(as(GM, (tx) => tx`select public.glb_set_member_role_v08(${orgA}, ${OWNER_A}, 'sales')`), "CANNOT_MODIFY_OWNER_OR_SELF");
    await as(GM, (tx) => tx`select public.glb_set_member_role_v08(${orgA}, ${SERVICE}, 'service_lead')`);
    await rejects(as(SERVICE, (tx) => tx`select public.glb_list_members(${orgA})`), "NOT_AUTHORIZED");
    const members = await as(GM, (tx) => tx`select * from public.glb_list_members(${orgA})`);
    assert.equal(members.find((m) => m.user_id === SERVICE).role, "service_lead");
    assert.equal(members.some((m) => m.user_id === OWNER_B), false, "keine Mitglieder anderer Betriebe");
  });

  it("gleichzeitiges Speichern: der zweite Stand wird abgelehnt, nicht still überschrieben", async () => {
    const [{ revision }] = await as(OWNER_A, (tx) => tx`select revision from public.glb_snapshots where organization_id = ${orgA}`);
    await as(OWNER_A, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${revision}, ${tx.json({ ...snapshot, business: "Sitzung 1" })})`);
    await rejects(as(GM, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${revision}, ${tx.json({ ...snapshot, business: "Sitzung 2" })})`), "REVISION_CONFLICT");
    const [{ data }] = await as(OWNER_A, (tx) => tx`select data from public.glb_snapshots where organization_id = ${orgA}`);
    assert.equal(data.business, "Sitzung 1");
  });

  it("Einladung nur mit bestätigter E-Mail-Adresse", async () => {
    const uid = randomUUID();
    await db`insert into auth.users values (${uid}, 'offen@example.com', null)`;
    await as(OWNER_A, (tx) => tx`select public.glb_invite_member_v08(${orgA}, 'offen@example.com', 'sales')`);
    assert.equal((await as(uid, (tx) => tx`select public.glb_accept_invitations() as n`))[0].n, 0);
    await rejects(as(uid, (tx) => tx`select public.glb_read_workspace(${orgA})`), "ACCESS_DENIED");
  });
});
