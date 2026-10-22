import { expect, test, type BrowserContext, type Page } from "./fixtures";

// The GLB AI Suite in cloud mode against a stand-in for Supabase that lives in this test process, so two browser
// sessions share one "server". It implements exactly the calls cloud.js makes (auth, glb_* RPCs, two table reads)
// with the same rules as suite-sql/002 for revisions and restricted roles. The real SQL is tested in
// suite-tests/rls.test.mjs; a real Supabase project is not reachable from this environment.

type Role = "owner" | "service_staff";
type Snapshot = { data: Record<string, unknown>; revision: number };
function fakeServer() {
  const users = new Map<string, { id: string; password: string }>([
    ["inhaber@betrieb.example", { id: "u-owner", password: "geheim-123" }],
    ["service@betrieb.example", { id: "u-service", password: "geheim-456" }],
  ]);
  // v1.1 (SQL 006): POS lines and training results live in their own tables; answers are scored by the server
  const pos: Record<string, unknown>[] = [];
  const training: {
    org: string;
    user: string;
    stage: string;
    answer: number;
    correct: boolean;
    points: number;
    day: string;
    created_at: string;
  }[] = [];
  const KEY: Record<string, number> = {
    aperitif: 0,
    water: 1,
    upgrade: 1,
    dessert: 0,
    coffee: 1,
    afterglow: 0,
  };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const members: { org: string; user: string; role: Role }[] = [
    { org: "org-1", user: "u-owner", role: "owner" },
    { org: "org-1", user: "u-service", role: "service_staff" },
    { org: "org-2", user: "u-owner", role: "owner" },
  ];
  const orgs = [
    { id: "org-1", name: "Testbetrieb Nord", created_at: "2026-10-01" },
    { id: "org-2", name: "Zweitbetrieb Süd", created_at: "2026-10-02" },
  ];
  const snaps: Record<string, Snapshot> = {
    "org-1": { data: {}, revision: 0 },
    "org-2": {
      data: {
        business: "Zweitbetrieb Süd",
        version: 6,
        mode: "own",
        sales: [],
        market: [],
        items: [],
        outlets: [{ id: "restaurant", name: "Restaurant" }],
      },
      revision: 1,
    },
  };
  const state = { saves: 0, delayMs: 0, failNextSave: false };
  const err = (message: string) => ({ data: null, error: { message } });
  async function handle(call: {
    kind: string;
    name?: string;
    args?: Record<string, unknown>;
    uid?: string | null;
    table?: string;
  }) {
    const uid = call.uid ?? null;
    const role = (org: string) =>
      members.find((m) => m.org === org && m.user === uid)?.role;
    if (call.kind === "signIn") {
      const u = users.get(String(call.args!.email));
      return u && u.password === call.args!.password
        ? {
            data: { session: { user: { id: u.id, email: call.args!.email } } },
            error: null,
          }
        : err("Invalid login credentials");
    }
    if (call.kind === "from") {
      const f =
        (call as { filters?: [string, string, unknown][] }).filters || [];
      const val = (col: string) => f.find((x) => x[1] === col)?.[2];
      if (call.table === "glb_pos_lines") {
        const org = String(val("organization_id"));
        if (!["owner"].includes(role(org) || ""))
          return { data: [], error: null }; // RLS: management only
        return {
          data: pos.filter(
            (l) =>
              l.organization_id === org &&
              String(l.service_date) >= String(val("service_date") ?? ""),
          ),
          error: null,
        };
      }
      if (call.table === "glb_training_results")
        return {
          data: training
            .filter((t) => t.org === val("organization_id") && t.user === uid)
            .map((t) => ({
              stage: t.stage,
              correct: t.correct,
              points: t.points,
              created_at: t.created_at,
            })),
          error: null,
        };
      if (call.table === "glb_memberships")
        return {
          data: members
            .filter((m) => m.user === uid)
            .map((m) => ({ organization_id: m.org, role: m.role })),
          error: null,
        };
      return {
        data: orgs.filter((o) =>
          members.some((m) => m.org === o.id && m.user === uid),
        ),
        error: null,
      };
    }
    const a = call.args || {};
    const org = String(a.p_org ?? "");
    calls.push({ name: String(call.name), args: a });
    switch (call.name) {
      case "glb_pos_insert": {
        if (role(org) !== "owner") return err("ROLE_NOT_PERMITTED");
        let inserted = 0,
          duplicates = 0,
          review = 0;
        for (const l of a.p_lines as Record<string, unknown>[]) {
          if (
            !((snaps[org].data.outlets as { id: string }[]) || []).some(
              (o) => o.id === l.outlet_id,
            )
          )
            return err("UNKNOWN_OUTLET");
          if (
            pos.some(
              (p) =>
                p.organization_id === org &&
                ((p.source_hash === l.source_hash && p.line_no === l.line_no) ||
                  (l.external_line_id &&
                    p.external_line_id === l.external_line_id)),
            )
          ) {
            duplicates++;
            continue;
          }
          const overlap = pos.some(
            (p) =>
              p.organization_id === org &&
              p.service_date === l.service_date &&
              p.check_id === l.check_id &&
              String(p.product_name).toLowerCase() ===
                String(l.product_name).toLowerCase() &&
              p.quantity === l.quantity &&
              p.unit_price_gross === l.unit_price_gross &&
              p.source_hash !== l.source_hash,
          );
          if (overlap && a.p_overlap === "skip") {
            duplicates++;
            continue;
          }
          const pending = overlap && a.p_overlap === "review";
          if (pending) review++;
          pos.push({
            ...l,
            id: "pos-" + pos.length,
            organization_id: org,
            review_status: pending ? "pending" : null,
          });
          inserted++;
        }
        return { data: { inserted, duplicates, review }, error: null };
      }
      case "glb_submit_training": {
        const r = role(org);
        if (!r || r === ("viewer" as Role)) return err("ROLE_NOT_PERMITTED");
        const day = new Date().toISOString().slice(0, 10);
        if (
          training.some(
            (t) =>
              t.org === org &&
              t.user === uid &&
              t.stage === a.p_stage &&
              t.day === day,
          )
        )
          return err("TRAINING_ALREADY_TODAY");
        const correct = Number(a.p_answer) === KEY[String(a.p_stage)];
        training.push({
          org,
          user: uid!,
          stage: String(a.p_stage),
          answer: Number(a.p_answer),
          correct,
          points: correct ? 100 : 0,
          day,
          created_at: new Date().toISOString(),
        });
        return {
          data: { correct, points: correct ? 100 : 0, tip: "Tipp vom Server" },
          error: null,
        };
      }
      case "glb_accept_invitations":
        return { data: 0, error: null };
      case "glb_read_workspace": {
        const r = role(org);
        if (!r) return err("ACCESS_DENIED");
        const s = snaps[org];
        if (r === "owner")
          return {
            data: { data: s.data, revision: s.revision, role: r },
            error: null,
          };
        const items = ((s.data.items as Record<string, unknown>[]) || []).map(
          ({ costNet: _c, costDetail: _d, ...x }) => ({ ...x, costNet: 0 }),
        );
        // same shape as glb_read_workspace for service_staff in suite-sql/002
        const data = {
          version: 4,
          mode: "own",
          business: s.data.business ?? "Betrieb",
          targetPct: 30,
          items,
          recipe: {},
          outlets: s.data.outlets ?? [],
          sales: [],
          market: [],
          tasks: s.data.tasks ?? [],
          funnel: s.data.funnel ?? [],
          funnelGoals: s.data.funnelGoals ?? {},
          funnelProjectedDays: s.data.funnelProjectedDays ?? 30,
        };
        return { data: { data, revision: s.revision, role: r }, error: null };
      }
      case "glb_save_snapshot":
      case "glb_save_limited": {
        const r = role(org);
        if (!r) return err("ACCESS_DENIED");
        if (call.name === "glb_save_snapshot" && r !== "owner")
          return err("WRITE_NOT_ALLOWED");
        if (state.delayMs)
          await new Promise((res) => setTimeout(res, state.delayMs));
        if (state.failNextSave) {
          state.failNextSave = false;
          return err("Netzwerkfehler beim Speichern (Test)");
        }
        const s = snaps[org];
        if (s.revision !== a.p_expected_revision)
          return err("REVISION_CONFLICT");
        const d = a.p_data as Record<string, unknown>;
        s.data =
          call.name === "glb_save_snapshot"
            ? d
            : {
                ...s.data,
                funnel: d.funnel ?? s.data.funnel,
                tasks: d.tasks ?? s.data.tasks,
              };
        s.revision++;
        state.saves++;
        return { data: s.revision, error: null };
      }
      case "glb_list_members":
        return role(org) === "owner"
          ? {
              data: members
                .filter((m) => m.org === org)
                .map((m) => ({
                  user_id: m.user,
                  email: [...users].find(([, u]) => u.id === m.user)![0],
                  role: m.role,
                })),
              error: null,
            }
          : err("NOT_AUTHORIZED");
      default:
        return err("NOT_IMPLEMENTED " + call.name);
    }
  }
  return { handle, snaps, state, pos, training, calls };
}

// Browser side: a supabase-js shaped client that forwards to the test server. The session sits in localStorage
// like the real client's, so reloading keeps the user signed in and signing out removes it.
const CLIENT = `window.supabase = { createClient: () => {
  const KEY = "sb-test-session";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } };
  const uid = () => read()?.user?.id ?? null;
  return {
    auth: {
      getSession: async () => ({ data: { session: read() }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async (args) => { const r = await window.__glbServer({ kind: "signIn", args }); if (r.data?.session) localStorage.setItem(KEY, JSON.stringify(r.data.session)); return r; },
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => { localStorage.removeItem(KEY); return { error: null }; },
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
    rpc: (name, args) => window.__glbServer({ kind: "rpc", name, args, uid: uid() }),
    from: (table) => {
      const filters = [];
      const b = {
        select: () => b, order: () => b, range: () => b,
        eq: (c, v) => (filters.push(["eq", c, v]), b), gte: (c, v) => (filters.push(["gte", c, v]), b), in: (c, v) => (filters.push(["in", c, v]), b),
        then: (ok, fail) => window.__glbServer({ kind: "from", table, filters, uid: uid() }).then(ok, fail),
      };
      return b;
    },
  };
} };`;

async function cloudPage(
  context: BrowserContext,
  server: ReturnType<typeof fakeServer>,
) {
  await context.exposeBinding("__glbServer", (_src, call) =>
    server.handle(call),
  );
  await context.route("**/suite/config.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: 'window.GLB_CLOUD_CONFIG = { url: "https://test.supabase.invalid", publishableKey: "sb_publishable_test" };',
    }),
  );
  await context.route("**/suite/vendor/supabase.min.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: CLIENT }),
  );
  return context.newPage();
}
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/suite");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: /Einloggen/ }).click();
  await page.getByRole("button", { name: /Testbetrieb Nord/ }).click();
  await expect(page.locator("#cloud-sync-status")).toHaveText(
    "In der Cloud gespeichert",
  );
}
async function addFunnelDay(page: Page, date: string, covers: string) {
  await page.evaluate(() =>
    (
      document.querySelector(
        '#sidebar .glb08-nav-link[data-view="funnel"]',
      ) as HTMLElement
    ).click(),
  );
  await page.locator('[data-action="new-funnel"]').first().click();
  await page.locator('#modal-layer input[name="date"]').fill(date);
  await page.locator('#modal-layer input[name="covers"]').fill(covers);
  await page
    .locator(
      "#modal-layer .modal-footer button[type=submit], #modal-layer .modal-footer .btn-primary",
    )
    .first()
    .click();
}

test.describe("SC Suite im Cloud-Betrieb (Test-Server)", () => {
  test("SC-1 Anmelden, erst nach Bestätigung gespeichert, Neuladen, Konto, Abmelden", async ({
    browser,
  }) => {
    const server = fakeServer();
    const context = await browser.newContext();
    const page = await cloudPage(context, server);
    await page.goto("/suite");
    await expect(
      page.getByRole("heading", { name: "Willkommen zurück" }),
    ).toBeVisible();
    await page.getByLabel("E-Mail").fill("inhaber@betrieb.example");
    await page.getByLabel("Passwort").fill("falsch-123");
    await page.getByRole("button", { name: /Einloggen/ }).click();
    await expect(page.locator("#cloud-layer")).toContainText(
      "Anmeldung fehlgeschlagen",
    );
    await signIn(page, "inhaber@betrieb.example", "geheim-123");
    await expect(page.locator(".side-status")).toContainText(
      "Testbetrieb Nord",
    );

    // opening a still empty business saves its starting state once; count from here
    const before = server.state.saves;
    server.state.delayMs = 1500;
    await addFunnelDay(page, "2026-10-05", "64");
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      /Änderungen werden gespeichert|Speichern …/,
    );
    expect(server.state.saves).toBe(before);
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "In der Cloud gespeichert",
      { timeout: 8000 },
    );
    expect(server.state.saves).toBe(before + 1);
    expect(
      (server.snaps["org-1"].data.funnel as { date: string }[]).some(
        (r) => r.date === "2026-10-05",
      ),
    ).toBe(true);
    server.state.delayMs = 0;

    await page.reload();
    await page.getByRole("button", { name: /Testbetrieb Nord/ }).click();
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar .glb08-nav-link[data-view="funnel"]',
        ) as HTMLElement
      ).click(),
    );
    await expect(page.locator("#main")).toContainText("2026-10-05");

    await page.locator("#cloud-account").click();
    await expect(page.locator("#cloud-layer")).toContainText(
      "Angemeldet als inhaber@betrieb.example",
    );
    await expect(page.locator("#cloud-layer")).toContainText(
      "service@betrieb.example",
    );
    await page.getByRole("button", { name: "Ausloggen" }).click();
    await expect(
      page.getByRole("heading", { name: "Willkommen zurück" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Willkommen zurück" }),
    ).toBeVisible();
    await context.close();
  });

  test("SC-2 Zwei Sitzungen: der ältere Stand überschreibt nicht still, Konflikt wird gezeigt", async ({
    browser,
  }) => {
    const server = fakeServer();
    const c1 = await browser.newContext(),
      c2 = await browser.newContext();
    const p1 = await cloudPage(c1, server),
      p2 = await cloudPage(c2, server);
    await signIn(p1, "inhaber@betrieb.example", "geheim-123");
    await signIn(p2, "inhaber@betrieb.example", "geheim-123");
    await addFunnelDay(p1, "2026-10-06", "50");
    await expect(p1.locator("#cloud-sync-status")).toHaveText(
      "In der Cloud gespeichert",
      { timeout: 8000 },
    );
    const savedRevision = server.snaps["org-1"].revision;
    await addFunnelDay(p2, "2026-10-07", "70");
    await expect(p2.locator("#cloud-sync-status")).toHaveText(
      "Bearbeitungskonflikt",
      { timeout: 8000 },
    );
    await expect(p2.locator("#cloud-warning")).toContainText(
      "Ein anderer Benutzer hat Daten gespeichert",
    );
    await expect(
      p2
        .locator("#cloud-warning")
        .getByRole("button", { name: "Ungesicherte Änderungen herunterladen" }),
    ).toBeVisible();
    expect(server.snaps["org-1"].revision).toBe(savedRevision);
    expect(
      (server.snaps["org-1"].data.funnel as { date: string }[]).some(
        (r) => r.date === "2026-10-06",
      ),
    ).toBe(true);
    await c1.close();
    await c2.close();
  });

  test("SC-3 Offline: Änderung wartet sichtbar und wird nach Rückkehr gespeichert", async ({
    browser,
  }) => {
    const server = fakeServer();
    const context = await browser.newContext();
    const page = await cloudPage(context, server);
    await signIn(page, "inhaber@betrieb.example", "geheim-123");
    const before = server.state.saves;
    await context.setOffline(true);
    await addFunnelDay(page, "2026-10-08", "33");
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "Offline · Änderungen warten",
    );
    await page.waitForTimeout(1500);
    expect(server.state.saves).toBe(before);
    await context.setOffline(false);
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "In der Cloud gespeichert",
      { timeout: 8000 },
    );
    expect(
      (server.snaps["org-1"].data.funnel as { date: string }[]).some(
        (r) => r.date === "2026-10-08",
      ),
    ).toBe(true);
    await context.close();
  });

  test("SC-4 Speicherfehler: bleibt sichtbar, nichts als gespeichert gemeldet, erneut speichern geht", async ({
    browser,
  }) => {
    const server = fakeServer();
    const context = await browser.newContext();
    const page = await cloudPage(context, server);
    await signIn(page, "inhaber@betrieb.example", "geheim-123");
    server.state.failNextSave = true;
    await addFunnelDay(page, "2026-10-09", "41");
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "Nicht gespeichert",
      { timeout: 8000 },
    );
    await expect(page.locator("#cloud-warning")).toContainText(
      "Netzwerkfehler beim Speichern (Test)",
    );
    await page
      .locator("#cloud-warning")
      .getByRole("button", { name: "Erneut speichern" })
      .click();
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "In der Cloud gespeichert",
      { timeout: 8000 },
    );
    await context.close();
  });

  test("SC-5 Service-Mitarbeiter: Arbeitsplatz, Funnel, Aufgaben, Training – keine Finanzen, speichert eingeschränkt", async ({
    browser,
  }) => {
    const server = fakeServer();
    server.snaps["org-1"] = {
      data: {
        business: "Testbetrieb Nord",
        items: [
          {
            id: "p1",
            name: "Burger",
            category: "Burger",
            quantity: 0,
            grossPrice: 14.9,
            costNet: 4.2,
            vat: 19,
            unit: "Portion",
          },
        ],
        outlets: [{ id: "restaurant", name: "Restaurant" }],
        funnel: [],
      },
      revision: 1,
    };
    const context = await browser.newContext();
    const page = await cloudPage(context, server);
    await signIn(page, "service@betrieb.example", "geheim-456");
    const views = await page
      .locator("#sidebar .glb08-nav-link")
      .evaluateAll((b) => b.map((x) => (x as HTMLElement).dataset.view));
    // v1.1: Cockpit (ohne Umsätze), Team & Aufgaben und Funnel Quest gelten für alle Rollen (wie RC1); nichts Finanzielles
    expect(views.sort()).toEqual([
      "funnel",
      "myday",
      "v11cockpit",
      "v11tasks",
      "v11training",
    ]);
    await addFunnelDay(page, "2026-10-10", "55");
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "In der Cloud gespeichert",
      { timeout: 8000 },
    );
    expect(
      (server.snaps["org-1"].data.items as { costNet: number }[])[0].costNet,
    ).toBe(4.2);
    await context.close();
  });

  test("SC-6 v1.1 in der Cloud: Kassenbons in eigener Tabelle, Training vom Server bewertet, nichts davon im Arbeitsbereich", async ({
    browser,
  }) => {
    const server = fakeServer();
    server.snaps["org-1"] = {
      data: {
        business: "Testbetrieb Nord",
        items: [
          {
            id: "p1",
            name: "Burger",
            category: "Burger",
            quantity: 0,
            grossPrice: 14.9,
            costNet: 4.2,
            vat: 7,
            unit: "Portion",
          },
        ],
        outlets: [{ id: "restaurant", name: "Restaurant" }],
        sales: [],
        market: [],
        funnel: [],
        mode: "own",
        version: 6,
      },
      revision: 1,
    };
    const context = await browser.newContext();
    const page = await cloudPage(context, server);
    await signIn(page, "inhaber@betrieb.example", "geheim-123");
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar [data-view="v11funnel"]',
        ) as HTMLElement
      ).click(),
    );
    await expect(page.locator("#main")).toContainText("Cloud, ab");
    await expect(page.locator("#main")).toContainText(
      "Keine Kassenbons in dieser Auswahl",
    );
    const today = new Date().toISOString().slice(0, 10);
    const file = `Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;Gaeste;FunnelStufe;USt\n${today};A1;Restaurant;Burger;2;14,90;2;none;7\n${today};A1;Restaurant;Espresso;2;2,90;2;coffee;19\n`;
    await page
      .locator("#v11-pos-file")
      .setInputFiles({
        name: "kasse.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(file),
      });
    await page.getByRole("button", { name: "CSV prüfen" }).click();
    await page.getByRole("button", { name: "Import bestätigen" }).click();
    await expect(
      page.locator(".v6-stat", { hasText: "Bons" }).locator("b"),
    ).toHaveText("1");
    expect(server.pos.length).toBe(2);
    // reload: lines come back from the table
    await page.reload();
    await page.getByRole("button", { name: /Testbetrieb Nord/ }).click();
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar [data-view="v11funnel"]',
        ) as HTMLElement
      ).click(),
    );
    await expect(
      page.locator(".v11-funnel-line", { hasText: "Kaffee" }),
    ).toContainText("100,0 %");
    // training: the browser sends the answer, never points; the server decides
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar [data-view="v11training"]',
        ) as HTMLElement
      ).click(),
    );
    await page.getByRole("button", { name: /^Kaffee/ }).click();
    await page
      .getByLabel("Darf es zum Abschluss Espresso oder Cappuccino sein?")
      .check();
    await page.getByRole("button", { name: /Antwort prüfen/ }).click();
    await expect(page.locator("#main")).toContainText(
      "Richtig! +100 XP. Tipp vom Server",
    );
    const call = server.calls.find((c) => c.name === "glb_submit_training")!;
    expect(Object.keys(call.args).sort()).toEqual([
      "p_answer",
      "p_org",
      "p_stage",
    ]);
    await expect(
      page.getByRole("button", { name: "Heute bereits beantwortet" }),
    ).toBeDisabled();
    // workspace document holds neither POS lines nor training
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "In der Cloud gespeichert",
      { timeout: 8000 },
    );
    const intel = server.snaps["org-1"].data.intelligence as
      | { pos: unknown[]; training: unknown[] }
      | undefined;
    expect(intel?.pos ?? []).toEqual([]);
    expect(intel?.training ?? []).toEqual([]);
    await context.close();
  });

  test("SC-7 Service-Mitarbeiter: Aufgabe anlegen speichert eingeschränkt, Training nur eigene Ergebnisse, keine Kassenbons", async ({
    browser,
  }) => {
    const server = fakeServer();
    server.snaps["org-1"] = {
      data: {
        business: "Testbetrieb Nord",
        items: [],
        outlets: [{ id: "restaurant", name: "Restaurant" }],
        funnel: [],
        tasks: [
          {
            id: "t1",
            title: "Tische eindecken",
            priority: "normal",
            status: "open",
            due_on: null,
            version: 1,
          },
        ],
      },
      revision: 1,
    };
    server.pos.push({
      id: "x",
      organization_id: "org-1",
      service_date: "2026-10-20",
      check_id: "A",
      outlet_id: "restaurant",
      product_name: "Burger",
      quantity: 1,
      unit_price_gross: 10,
      vat_percent: 7,
      stage: "none",
    });
    const context = await browser.newContext();
    const page = await cloudPage(context, server);
    await signIn(page, "service@betrieb.example", "geheim-456");
    await page.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="v11tasks"]') as HTMLElement
      ).click(),
    );
    await expect(
      page.locator(".v11-task", { hasText: "Tische eindecken" }),
    ).toBeVisible();
    await page.getByLabel("Beschreibung").fill("Gläser polieren");
    await page.getByRole("button", { name: "Aufgabe erstellen" }).click();
    await expect(page.locator("#cloud-sync-status")).toHaveText(
      "In der Cloud gespeichert",
      { timeout: 8000 },
    );
    expect(
      (server.snaps["org-1"].data.tasks as { title: string }[]).map(
        (t) => t.title,
      ),
    ).toContain("Gläser polieren");
    expect(server.calls.some((c) => c.name === "glb_save_snapshot")).toBe(
      false,
    );
    expect(
      await page.evaluate(() => (window as any).GLBV11.cloud.pos.length),
    ).toBe(0);
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar [data-view="v11cockpit"]',
        ) as HTMLElement
      ).click(),
    );
    await expect(page.locator("#main")).toContainText("Offene Aufgaben");
    await expect(page.locator("#main")).not.toContainText("Bruttoumsatz");
    await context.close();
  });

  test("SC-8 Abmelden und Betriebswechsel: keine Daten des vorherigen Betriebs sichtbar", async ({
    browser,
  }) => {
    const server = fakeServer();
    server.snaps["org-1"] = {
      data: {
        business: "Testbetrieb Nord",
        version: 6,
        mode: "own",
        sales: [],
        market: [],
        items: [],
        outlets: [{ id: "restaurant", name: "Restaurant" }],
        tasks: [
          {
            id: "t9",
            title: "Geheime Nord-Aufgabe",
            priority: "high",
            status: "open",
            version: 1,
          },
        ],
      },
      revision: 1,
    };
    server.pos.push({
      id: "n1",
      organization_id: "org-1",
      service_date: new Date().toISOString().slice(0, 10),
      check_id: "N",
      outlet_id: "restaurant",
      product_name: "Nord-Burger",
      quantity: 1,
      unit_price_gross: 10,
      vat_percent: 7,
      stage: "none",
    });
    const context = await browser.newContext();
    const page = await cloudPage(context, server);
    await signIn(page, "inhaber@betrieb.example", "geheim-123");
    await page.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="v11tasks"]') as HTMLElement
      ).click(),
    );
    await expect(page.locator("#main")).toContainText("Geheime Nord-Aufgabe");
    await expect
      .poll(() => page.evaluate(() => (window as any).GLBV11.cloud.pos.length))
      .toBe(1);
    // switch business
    await page.locator("#cloud-account").click();
    await page.getByRole("button", { name: "Betrieb wechseln" }).click();
    await page.getByRole("button", { name: /Zweitbetrieb Süd/ }).click();
    await page.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="v11tasks"]') as HTMLElement
      ).click(),
    );
    await expect(page.locator("#main")).not.toContainText(
      "Geheime Nord-Aufgabe",
    );
    await expect
      .poll(() => page.evaluate(() => (window as any).GLBV11.cloud.pos.length))
      .toBe(0);
    // sign out: the app behind the login holds nothing of either business
    await page.locator("#cloud-account").click();
    await page.getByRole("button", { name: "Ausloggen" }).click();
    await expect(
      page.getByRole("heading", { name: "Willkommen zurück" }),
    ).toBeVisible();
    const left = await page.evaluate(
      () =>
        JSON.stringify((window as any).GLBAppSync.snapshot()) +
        JSON.stringify((window as any).GLBV11.cloud),
    );
    expect(left).not.toContain("Nord");
    expect(left).not.toContain("Zweitbetrieb");
    await context.close();
  });
});
