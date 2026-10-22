// SQL 007 (Aufgaben nach Outlet): migration keeps old tasks, outlet ids are checked on the server for every save path,
// an outlet of another organisation cannot be assigned – also not by a manipulated request. Two organisations, same
// harness as rls-v11.test.mjs (local Postgres with a stand-in for Supabase auth).
//   TEST_DATABASE_URL=postgres://postgres@localhost:54329/kitchen node --test suite-tests/rls-v12.test.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";

const base = process.env.TEST_DATABASE_URL;
const sqlDir = new URL("../suite-sql/", import.meta.url);
const dbName = `glb_v12_${process.pid}`;
let admin, db;
const U = Object.fromEntries(["ownerA", "ownerB", "service", "kitchen"].map((k) => [k, randomUUID()]));

async function as(uid, fn) {
  return db.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    await tx`select set_config('request.jwt.claim.sub', ${uid ?? ""}, true)`;
    return fn(tx);
  });
}
const rejects = (p, code) => assert.rejects(p, (e) => String(e.message).includes(code), `expected ${code}`);
const read = (uid, org) => as(uid, (tx) => tx`select public.glb_read_workspace(${org}) as w`).then((x) => x[0].w);
const rev = async (org) => Number((await db`select revision from public.glb_snapshots where organization_id = ${org}`)[0].revision);

describe("GLB SQL 007: Aufgaben nach Outlet", { skip: !base && "TEST_DATABASE_URL fehlt" }, () => {
  let orgA, orgB;
  const OLD_TASKS = [
    { id: "t1", title: "Kühlhaus", status: "open", priority: "high", version: 1 },
    { id: "t2", title: "Terrasse", status: "done", priority: "normal", due_on: "2026-10-01", version: 3 },
  ];
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
    for (const f of ["001_cloud_pilot.sql", "002_roles_and_security.sql", "006_glb_v11_integrated.sql"])
      await db.unsafe(readFileSync(new URL(f, sqlDir), "utf8"));
    orgA = (await as(U.ownerA, (tx) => tx`select public.glb_create_workspace('A') as id`))[0].id;
    orgB = (await as(U.ownerB, (tx) => tx`select public.glb_create_workspace('B') as id`))[0].id;
    // state BEFORE 007: tasks without outlet, as saved by the v1.1 version
    const ws = { business: "A", outlets: [{ id: "restaurant", name: "Restaurant" }, { id: "bar", name: "Bar" }], items: [], tasks: OLD_TASKS };
    await as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, 0, ${tx.json(ws)})`);
    await as(U.ownerB, (tx) => tx`select public.glb_save_snapshot(${orgB}, 0, ${tx.json({ business: "B", outlets: [{ id: "nord-b", name: "Nord" }], tasks: [] })})`);
    for (const [k, r] of [["service", "service_staff"], ["kitchen", "kitchen_staff"]]) {
      await as(U.ownerA, (tx) => tx`select public.glb_invite_member_v08(${orgA}, ${k + "@example.com"}, ${r})`);
      await as(U[k], (tx) => tx`select public.glb_accept_invitations()`);
    }
    for (const f of ["007_glb_task_outlets.sql", "007_glb_task_outlets.sql"]) await db.unsafe(readFileSync(new URL(f, sqlDir), "utf8")); // repeatable
  });
  after(async () => {
    await db?.end();
    await admin?.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  it("Migration: bestehende Aufgaben bleiben unverändert und ohne Outlet (keine geratene Zuordnung)", async () => {
    const w = await read(U.ownerA, orgA);
    assert.deepEqual(w.data.tasks, OLD_TASKS);
    // a later save of the unchanged old tasks is still accepted
    const r = await rev(orgA);
    await as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${r}, ${tx.json({ ...w.data })})`);
  });

  it("Inhaber: eigenes Outlet und „Allgemein“ (null) werden gespeichert, fremdes oder erfundenes Outlet abgelehnt", async () => {
    const w = (await read(U.ownerA, orgA)).data;
    let r = await rev(orgA);
    const tasks = [...w.tasks, { id: "t3", title: "Bar-Inventur", status: "open", priority: "normal", outlet_id: "bar", version: 1 }, { id: "t4", title: "Alle", status: "open", priority: "normal", outlet_id: null, version: 1 }];
    await as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${r}, ${tx.json({ ...w, tasks })})`);
    const saved = (await read(U.ownerA, orgA)).data.tasks;
    assert.equal(saved.find((t) => t.id === "t3").outlet_id, "bar");
    assert.equal(saved.find((t) => t.id === "t4").outlet_id, null);
    r = await rev(orgA);
    await rejects(as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${r}, ${tx.json({ ...w, tasks: [...tasks, { id: "t5", title: "x", status: "open", outlet_id: "nord-b" }] })})`), "TASK_OUTLET_INVALID");
    await rejects(as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${r}, ${tx.json({ ...w, tasks: [...tasks, { id: "t5", title: "x", status: "open", outlet_id: 7 }] })})`), "TASK_OUTLET_INVALID");
    assert.equal(await rev(orgA), r, "abgelehnte Speicherung ändert nichts");
  });

  it("Service (eingeschränkte Speicherung): fremdes Outlet per manipuliertem Request abgelehnt, eigenes erlaubt", async () => {
    const tasks = (await read(U.service, orgA)).data.tasks;
    let r = await rev(orgA);
    await rejects(
      as(U.service, (tx) => tx`select public.glb_save_limited(${orgA}, ${r}, ${tx.json({ tasks: [...tasks, { id: "t6", title: "x", status: "open", outlet_id: "nord-b" }] })})`),
      "TASK_OUTLET_INVALID",
    );
    // umhängen einer bestehenden Aufgabe auf ein fremdes Outlet ebenfalls abgelehnt
    await rejects(
      as(U.service, (tx) => tx`select public.glb_save_limited(${orgA}, ${r}, ${tx.json({ tasks: tasks.map((t) => (t.id === "t1" ? { ...t, outlet_id: "nord-b" } : t)) })})`),
      "TASK_OUTLET_INVALID",
    );
    // the limited role cannot sneak the foreign outlet into the outlet list either (key not writable)
    await as(U.service, (tx) => tx`select public.glb_save_limited(${orgA}, ${r}, ${tx.json({ outlets: [{ id: "nord-b" }], tasks: [...tasks, { id: "t7", title: "Service", status: "open", outlet_id: "restaurant" }] })})`);
    const w = (await read(U.ownerA, orgA)).data;
    assert.deepEqual(w.outlets.map((o) => o.id), ["restaurant", "bar"]);
    assert.equal(w.tasks.find((t) => t.id === "t7").outlet_id, "restaurant");
    r = await rev(orgA);
    await rejects(
      as(U.kitchen, (tx) => tx`select public.glb_save_limited(${orgA}, ${r}, ${tx.json({ tasks: [...w.tasks, { id: "t8", title: "x", status: "open", outlet_id: "fremd" }] })})`),
      "TASK_OUTLET_INVALID",
    );
  });

  it("Fremder Betrieb liest weder Aufgaben noch Outlets von A", async () => {
    await rejects(read(U.ownerB, orgA), "");
    const b = (await read(U.ownerB, orgB)).data;
    assert.deepEqual(b.outlets.map((o) => o.id), ["nord-b"]);
    assert.equal(b.tasks.length, 0);
  });

  it("Outlet später entfernt: Aufgabe behält ihre Zuordnung, ein neues Setzen dieser ID wird abgelehnt", async () => {
    const w = (await read(U.ownerA, orgA)).data;
    let r = await rev(orgA);
    await as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${r}, ${tx.json({ ...w, outlets: w.outlets.filter((o) => o.id !== "bar") })})`);
    const after = (await read(U.ownerA, orgA)).data;
    assert.equal(after.tasks.find((t) => t.id === "t3").outlet_id, "bar");
    r = await rev(orgA);
    await rejects(
      as(U.ownerA, (tx) => tx`select public.glb_save_snapshot(${orgA}, ${r}, ${tx.json({ ...after, tasks: after.tasks.map((t) => (t.id === "t4" ? { ...t, outlet_id: "bar" } : t)) })})`),
      "TASK_OUTLET_INVALID",
    );
  });
});
