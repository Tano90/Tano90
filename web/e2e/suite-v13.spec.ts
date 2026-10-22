import { expect, expectNoHorizontalScroll, test, type Page } from "./fixtures";

// Oct 2026 customer-flow revision: navigation in five areas, overview with action items, one cost basis, one set of
// forecast definitions, guided first steps, own data without demo values. Demo mode in the browser.
const snap = (page: Page) => page.evaluate(() => (window as any).GLBAppSync.snapshot());
async function fresh(page: Page, hash = "") {
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/suite" + hash);
  await page.waitForFunction(() => (window as any).GLBV11 && (window as any).GLBSuite);
}
const mutate = (page: Page, fn: string) =>
  page.evaluate((src) => {
    const S = (window as any).GLBSuite.S;
    new Function("S", src)(S);
    (window as any).GLBSuite.persist();
    (window as any).GLBSuite.render();
  }, fn);
const state = (page: Page) =>
  page.evaluate(() => ({
    hash: location.hash,
    crumb: document.querySelector("#breadcrumb-current")?.textContent,
    active: [...document.querySelectorAll("#sidebar .glb08-nav-link.active")].map((x) => (x as HTMLElement).dataset.view),
  }));

test.describe("S15 Navigation", () => {
  test("S15-1 Start → Übersicht; Adresse, Seitenname und Menüpunkt stimmen; Direktlinks und Zurück", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Demo ohne Anmeldung öffnen/ }).first().click();
    await page.waitForFunction(() => (window as any).GLBV11);
    await expect(page.getByRole("heading", { level: 1, name: "Wie läuft der Betrieb?" })).toBeVisible();
    expect(await state(page)).toEqual({ hash: "#overview", crumb: "Übersicht", active: ["overview"] });
    // five areas, every former page still reachable
    const titles = await page.locator("#sidebar .glb08-nav-title").allInnerTexts();
    expect(titles).toEqual(["ÜBERSICHT", "VERKAUF & PREISE", "EINKAUF & LAGER", "SERVICE & TEAM", "EINRICHTUNG & DATEN"]);
    const views = await page.locator("#sidebar .glb08-nav-link").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.view));
    for (const v of ["overview", "myday", "operations", "v11cockpit", "reports", "insights", "funnel", "lifecycle", "v11market", "market", "v11tasks", "costs", "purchasing", "menuimport", "setup", "import", "settings"])
      expect(views, v).toContain(v);
    // clicking, back and forward keep everything in step
    await page.locator('#sidebar .glb08-nav-link[data-view="lifecycle"]').click();
    expect(await state(page)).toEqual({ hash: "#lifecycle", crumb: "Lebenszyklen", active: ["lifecycle"] });
    await page.locator('#sidebar .glb08-nav-link[data-view="v11tasks"]').click();
    await page.goBack();
    await expect.poll(() => state(page)).toEqual({ hash: "#lifecycle", crumb: "Lebenszyklen", active: ["lifecycle"] });
    await page.goForward();
    await expect.poll(() => state(page)).toEqual({ hash: "#v11tasks", crumb: "Team & Aufgaben", active: ["v11tasks"] });
  });

  test("S15-2 Direktlink auf ein später geladenes Modul und unbekannte Adresse", async ({ page }) => {
    await fresh(page, "#v11market");
    await expect(page.getByRole("heading", { level: 1, name: "Wettbewerbspreise" })).toBeVisible();
    expect(await state(page)).toEqual({ hash: "#v11market", crumb: "Wettbewerbspreise", active: ["v11market"] });
    await page.goto("/suite#gibt-es-nicht");
    await page.waitForFunction(() => (window as any).GLBV11);
    await expect.poll(() => state(page)).toEqual({ hash: "#overview", crumb: "Übersicht", active: ["overview"] });
  });
});

test.describe("S15 mobil", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("S15-M Untere Leiste beginnt mit der Übersicht, Menü erreicht alle Bereiche, kein Überlauf", async ({ page }) => {
    await fresh(page);
    const bottom = page.locator("#glb08-bottomnav [data-view]");
    await expect(bottom.first()).toHaveAttribute("data-view", "overview");
    await expect(bottom.first()).toContainText("Übersicht");
    await expectNoHorizontalScroll(page);
    for (const v of ["setup", "purchasing", "v11market"]) {
      await page.locator("#glb08-more").click();
      const link = page.locator(`#sidebar .glb08-nav-link[data-view="${v}"]`);
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect.poll(() => state(page).then((s) => s.active)).toEqual([v]);
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe("S16 Übersicht und Zahlen", () => {
  test.beforeEach(async ({ page }) => fresh(page));

  test("S16-1 Handlungsbedarf nennt Artikel, Grundlage und führt zur Detailseite; ohne Ziel keine Bewertung", async ({ page }) => {
    const actions = page.locator(".v6-actions");
    await expect(actions).toContainText("Auswahl: alle Monate · alle Outlets · alle Warengruppen");
    const item = actions.locator(".v6-action", { hasText: "Rumpsteak 250 g: Warenquote" });
    await expect(item).toContainText("über deinem Ziel von 30,0 %");
    await expect(item).toContainText(/Wareneinsatz .* ÷ Netto-Umsatz/);
    await item.getByRole("button", { name: /Zielpreis ansehen/ }).click();
    await expect.poll(() => state(page).then((s) => s.hash)).toBe("#costs");
    // a business without its own target gets no good/bad judgement
    await mutate(page, `S.mode = "own"; S.targetSet = false;`);
    await page.locator('#sidebar .glb08-nav-link[data-view="overview"]').click();
    await expect(actions).toContainText("Kein Ziel für die Warenquote hinterlegt");
    await expect(actions).not.toContainText("über deinem Ziel");
  });

  test("S16-2 Filter: Outlet und Monat wirken auf Kennzahlen und Hinweise; Übersicht = Berichte", async ({ page }) => {
    await page.locator("#v6-filter-outlet").selectOption("bar");
    await page.locator("#v6-filter-month").selectOption("2026-09");
    const tile = page.locator(".v6-stat", { has: page.locator("small", { hasText: /^Netto-Umsatz · September 2026$/ }) });
    await expect(tile).toContainText("ggü. August 2026");
    const overviewValue = await tile.locator("b").innerText();
    await expect(page.locator(".v6-actions")).toContainText("Auswahl: September 2026 · Bar");
    await page.locator('#sidebar .glb08-nav-link[data-view="reports"]').click();
    const reportValue = await page.locator(".v6-stat", { has: page.locator("small", { hasText: /^Netto-Umsatz$/ }) }).locator("b").innerText();
    expect(reportValue).toBe(overviewValue);
  });

  test("S16-3 Kostenbasis: Auswahl, Kachel und Tabellenhinweis sagen dasselbe", async ({ page }) => {
    await page.locator('#sidebar .glb08-nav-link[data-view="reports"]').click();
    const main = page.locator("#main");
    await expect(page.locator(".v6-stat", { hasText: "Wareneinsatzquote" })).toContainText("Kostenstand im Verkaufsmonat");
    await expect(main).not.toContainText("nicht historisiert");
    await expect(main).not.toContainText("Aktuelle Produktkosten");
    await page.locator("#v6-filter-costbasis").selectOption("current");
    await expect(page.locator(".v6-stat", { hasText: "Wareneinsatzquote" })).toContainText("Szenario: heutige Kosten");
    await expect(main).toContainText("Kostenbasis: Szenario, heutige Produktkosten für alle Monate");
    await expect(main).toContainText("bewertet nach der gewählten Kostenbasis (Szenario: heutige Produktkosten)");
    await expect(main).not.toContainText("aktuelle variable Produktkosten");
    await expect(page.getByRole("heading", { level: 1, name: "Berichte & Export" })).toBeVisible();
  });

  test("S16-4 Forecast: fehlender Bestand, Bestand 0 und fehlender Verbrauch getrennt und überall gleich gezählt", async ({ page }) => {
    // no count at all for the burger buns (used in a recipe), a real zero for cheddar
    await mutate(page, `S.inventoryCounts = S.inventoryCounts.filter((c) => c.ingredientId !== "ing-bun");
      S.inventoryCounts.filter((c) => c.ingredientId === "ing-cheese").forEach((c) => (c.baseQty = 0));`);
    await page.locator('#sidebar .glb08-nav-link[data-view="purchasing"]').click();
    const card = page.locator(".v4-top-card, .v4-grid3 > *", { hasText: "Rohwaren ohne Bestellvorschlag" }).first();
    // headline counts what the breakdown lists: missing stock + not in any recipe (stock 0 is computable)
    await expect(card).not.toContainText("Bedarf nicht berechenbar");
    await expect(card.locator("strong")).toHaveText("2");
    await expect(card).toContainText("1 ohne gezählten Bestand");
    await expect(card).toContainText("1 gezählt mit Bestand 0");
    await expect(card).toContainText("1 in keinem Rezept (kein Verbrauch ableitbar)");
    const row = page.locator("table.data-table tr", { hasText: "Cheddar" });
    await expect(row).toContainText("0 g");
    await expect(page.locator("table.data-table tr", { hasText: "Kartoffeln" })).toContainText(/\d+,\d kg/);
    // the report counts the same
    await page.locator('#sidebar .glb08-nav-link[data-view="reports"]').click();
    await page.getByRole("tab", { name: "Lager & Einkauf" }).click();
    await expect(page.locator(".v6-stat", { hasText: "Rohwaren ohne Bestellvorschlag" })).toContainText("1 ohne gezählten Bestand");
  });

  test("S16-5 Datenqualität und Hinweise widersprechen der Übersicht nicht; deutsches Zahlenformat", async ({ page }) => {
    await page.locator('#sidebar .glb08-nav-link[data-view="operations"]').click();
    await expect(page.locator("#main")).toContainText("Offene Daten- und Lagerprobleme");
    await expect(page.locator("#main")).not.toContainText("Wie läuft der Betrieb?");
    await page.locator('#sidebar .glb08-nav-link[data-view="insights"]').click();
    await expect(page.locator("#main")).toContainText(/Wareneinsatz: \d+,\d %/);
    await expect(page.locator("#main")).not.toContainText(/\d\.\d+ €/);
  });
});

test.describe("S17 Einrichtung, Demo und eigene Daten", () => {
  test.beforeEach(async ({ page }) => fresh(page));

  test("S17-1 Erste Schritte: fünf Schritte mit Bedarf, Format, Vorlage und Ziel", async ({ page }) => {
    await page.locator('#sidebar .glb08-nav-link[data-view="setup"]').click();
    const steps = page.locator(".v12-step");
    await expect(steps).toHaveCount(5);
    for (const [i, t] of ["Betrieb und Outlets", "Speisekarte", "Verkäufe", "Kosten", "Erste Auswertung"].entries()) await expect(steps.nth(i)).toContainText(t);
    await expect(steps.nth(1)).toContainText("Fotos und gescannte PDFs werden nicht gelesen");
    const [dl] = await Promise.all([page.waitForEvent("download"), steps.nth(2).getByRole("button", { name: /Verkaufs-Vorlage/ }).click()]);
    expect(dl.suggestedFilename()).toMatch(/Verkauf/);
    await steps.nth(1).getByRole("button", { name: /Speisekarte importieren/ }).click();
    await expect.poll(() => state(page).then((s) => s.hash)).toBe("#menuimport");
    // no duplicated overview under the onboarding
    await page.locator('#sidebar .glb08-nav-link[data-view="setup"]').click();
    await expect(page.locator("#main")).not.toContainText("Wie läuft der Betrieb?");
  });

  test("S17-2 Demo vollständig: Fixkosten ergeben Zielpreise, als Beispielwerte markiert", async ({ page }) => {
    await page.locator('#sidebar .glb08-nav-link[data-view="costs"]').click();
    await expect(page.locator("#main")).toContainText("Fixkosten: fiktive Beispielwerte der Demo");
    await expect(page.locator("#main")).not.toContainText("Kostenquoten noch nicht berechenbar");
    const s = await snap(page);
    const m = s.monthlyCosts["2026-09"];
    expect(m.energy + m.payroll + m.overhead).toBe(1850);
    expect(s.intelligence.markets.every((x: { example: boolean }) => x.example)).toBe(true);
  });

  test("S17-3 Eigene Daten starten: keine Demo-Werte übernommen, fehlende Werte bleiben fehlend", async ({ page }) => {
    // a new business starts with the standard outlets, so the next step is the menu
    await page.evaluate(() => (window as any).GLBAppSync.startBlank("Testbetrieb"));
    const s = await snap(page);
    expect(s.mode).not.toBe("demo");
    expect(s.marketLocation).toBeNull();
    expect(s.monthlyCosts).toEqual({});
    expect(s.intelligence.markets).toEqual([]);
    expect(s.tasks).toEqual([]);
    await page.locator('#sidebar .glb08-nav-link[data-view="setup"]').click();
    await expect(page.locator(".v12-step.next")).toContainText("Speisekarte");
    await expect(page.locator(".v12-step").nth(3)).toContainText("Ziel-Warenquote nicht festgelegt");
  });
});

test.describe("S18 Wettbewerbspreise", () => {
  test("S18-1 automatische und manuelle Schritte getrennt, KI-Status ohne Schlüssel", async ({ page }) => {
    await fresh(page, "#v11market");
    const steps = page.getByRole("list", { name: "So funktioniert der Preisvergleich" });
    await expect(steps.locator("li").nth(0)).toContainText("automatisch");
    await expect(steps.locator("li").nth(1)).toContainText("manuell");
    await expect(steps.locator("li").nth(1)).toContainText("keinen automatischen Speisekartenabruf");
    await expect(steps.locator("li").nth(3)).toContainText("optional");
    const status = await page.request.get("/api/suite/market/status");
    const body = await status.json();
    expect(Object.keys(body).sort()).toEqual(["ai_configured", "discover", "price_lookup"]);
    expect(JSON.stringify(body)).not.toMatch(/sk-|key/i);
  });
});
