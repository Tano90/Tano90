import { expect, expectNoHorizontalScroll, test, type Page } from "./fixtures";

// Oct 2026: lifecycle chart, KI-Marktcheck in two views, team tasks by outlet (suite in demo mode in the browser).
// Expected values are derived from the suite's own example data, not typed in.
const open = (page: Page, view: string) =>
  page.evaluate((v) => (window as any).GLBSuite.navigate(v), view);
const snap = (page: Page) => page.evaluate(() => (window as any).GLBAppSync.snapshot());
async function fresh(page: Page) {
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as any).GLBV11 && (window as any).GLBSuite);
}
/** change the in-memory state like an import would, then draw again */
const mutate = (page: Page, fn: string) =>
  page.evaluate((src) => {
    const S = (window as any).GLBSuite.S;
    new Function("S", src)(S);
    (window as any).GLBSuite.persist();
    (window as any).GLBSuite.render();
  }, fn);
const monthsOf = (sales: { productId: string; outletId: string; month: string; quantity: number }[], id: string, outlet?: string) => {
  const m = new Map<string, number>();
  for (const s of sales) if (s.productId === id && (!outlet || s.outletId === outlet)) m.set(s.month, (m.get(s.month) || 0) + Number(s.quantity));
  return [...m.entries()].sort();
};

test.describe("S12 Produktlebenszyklus als Graph", () => {
  test.beforeEach(async ({ page }) => fresh(page));

  test("S12-1 Punkte = tatsächliche Monatswerte; Tooltip per Maus und Tastatur; Produktsuche wechselt das Produkt", async ({ page }) => {
    await open(page, "lifecycle");
    const s = await snap(page);
    const first = s.items[0];
    const months = monthsOf(s.sales, first.id);
    const chart = page.locator("#lc-chart");
    await expect(chart.locator(".lc-point")).toHaveCount(months.length);
    await expect(page.locator(".lc-axis-title")).toContainText(`Einheit: ${first.unit || "Portion"}`);
    // keyboard: first month, then arrow right
    await chart.locator(".lc-key-btn").first().focus();
    const tip = page.locator("#lc-tip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(`Absatz: ${months[0][1]} ${first.unit || "Portion"}`);
    await page.keyboard.press("ArrowRight");
    await expect(tip).toContainText(`Absatz: ${months[1][1]}`);
    await expect(tip).toContainText("Netto-Umsatz");
    // mouse
    await chart.locator(".lc-hit").nth(2).hover();
    await expect(tip).toContainText(`Absatz: ${months[2][1]}`);
    // search switches the product
    await page.getByLabel("Produkt suchen").fill("Apfel");
    const apfel = s.items.find((p: { name: string }) => p.name === "Apfelstrudel");
    await expect(page.locator("#life-product")).toHaveValue(apfel.id);
    await expect(page.locator(".lc-panel")).toContainText("Apfelstrudel");
    await expect(chart.locator(".lc-point")).toHaveCount(monthsOf(s.sales, apfel.id).length);
    // existing table and recommendations are still there
    await expect(page.getByRole("heading", { name: "Lebenszyklus des gesamten Sortiments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Phasen & Handlung" })).toBeVisible();
  });

  test("S12-2 Outlet-Filter: echte Null statt Lücke, kein Outlet ohne Daten erfunden; Zeitraum begrenzt Punkte und Einordnung", async ({ page }) => {
    await open(page, "lifecycle");
    const s = await snap(page);
    const id = s.items[0].id;
    // Cheeseburger additionally sold at the bar in May and July; the bar also sold in June (other articles) → real zero
    await mutate(page, `S.sales.push({ id: "x1", productId: "${id}", outletId: "bar", month: "2026-05", quantity: 4, grossPrice: 17.9 }, { id: "x2", productId: "${id}", outletId: "bar", month: "2026-07", quantity: 6, grossPrice: 17.9 });`);
    await page.locator("#lc-outlet").selectOption("bar");
    const chart = page.locator("#lc-chart");
    // May 4, June 0, July 6, August 0, September 0: the bar recorded sales in every month, this article only twice
    await expect(chart.locator(".lc-point")).toHaveCount(5);
    await expect(chart.locator(".lc-point.zero")).toHaveCount(3);
    await expect(chart.locator(".lc-gap")).toHaveCount(0);
    await chart.locator(".lc-key-btn").nth(1).focus();
    await expect(page.locator("#lc-tip")).toContainText("Absatz: 0 Portion (nicht verkauft)");
    await expect(page.locator(".lc-explain")).toContainText("Rückgang");
    await expect(page.locator(".lc-explain")).toContainText("Ø 3 Portion");
    // an outlet without any sale of this article: no points, a clear message
    await page.locator("#lc-outlet").selectOption("events");
    await expect(page.locator(".lc-empty")).toContainText("keine Monatswerte");
    // period: all outlets, from July
    await page.locator("#lc-outlet").selectOption("all");
    await page.locator("#lc-from").selectOption("2026-07");
    await expect(chart.locator(".lc-point")).toHaveCount(3);
    await expect(page.locator(".lc-panel")).toContainText("Juli 2026 bis letzter Monat");
    // the sortiment table follows the same scope
    await expect(page.locator("#main tbody tr").first()).toContainText("Nicht belastbar");
    await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
    await expect(chart.locator(".lc-point")).toHaveCount(6);
  });

  test("S12-3 fehlender Monat ist eine Lücke, nicht 0, und verhindert die Einordnung", async ({ page }) => {
    await open(page, "lifecycle");
    await mutate(page, `S.sales = S.sales.filter((x) => x.month !== "2026-07");`);
    const chart = page.locator("#lc-chart");
    await expect(chart.locator(".lc-gap")).toHaveCount(1);
    await expect(chart.locator(".lc-point")).toHaveCount(5);
    await expect(page.locator(".lc-explain")).toContainText("Datenlücke im Vergleichsfenster");
    await expect(page.locator(".lc-explain")).toContainText("Juli 2026");
    await chart.locator(".lc-key-btn").nth(3).focus();
    await expect(page.locator("#lc-tip")).toContainText("Keine Verkaufsdaten");
    // no line across the gap: the path is split into two pieces
    const d = await chart.locator(".lc-line").getAttribute("d");
    expect((d?.match(/M/g) || []).length).toBe(2);
  });
});

test.describe("S12 Graph mobil", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("S12-M Graph lesbar und per Antippen bedienbar, kein Überlauf", async ({ page }) => {
    await fresh(page);
    await open(page, "lifecycle");
    const chart = page.locator("#lc-chart");
    await chart.scrollIntoViewIfNeeded();
    await chart.locator(".lc-hit").nth(1).tap();
    await expect(page.locator("#lc-tip")).toBeVisible();
    await expect(page.locator("#lc-tip")).toHaveClass(/lc-tip-below/);
    await expectNoHorizontalScroll(page);
  });
});

test.describe("S13 Team & Aufgaben nach Outlet", () => {
  test.beforeEach(async ({ page }) => fresh(page));

  test("S13-1 anlegen mit Outlet, speichern, filtern, gruppieren, sortieren; offen und überfällig je Outlet", async ({ page }) => {
    await open(page, "v11tasks");
    const form = page.locator("#v11-task-form");
    await form.getByLabel("Beschreibung").fill("Bar-Inventur Spirituosen");
    await form.getByLabel("Outlet").selectOption({ label: "Bar" });
    await form.getByLabel("Priorität").selectOption("high");
    await form.getByLabel("Fälligkeit").fill("2020-01-15");
    await page.getByRole("button", { name: "Aufgabe erstellen" }).click();
    await expect(page.locator(".toast").last()).toContainText("Bar");
    const t = page.locator(".v11-task", { hasText: "Bar-Inventur Spirituosen" });
    await expect(t).toContainText("Bar");
    await expect(t).toContainText("Überfällig");
    const saved = (await snap(page)).tasks.find((x: { title: string }) => x.title === "Bar-Inventur Spirituosen");
    expect(saved.outlet_id).toBe("bar");
    // per outlet: open and overdue
    const chip = page.locator(".v11-outlet-chip", { hasText: "Bar" }).first();
    await expect(chip).toContainText("1 offen");
    await expect(chip).toContainText("1 überfällig");
    // grouped by outlet (all outlets)
    await expect(page.locator(".v11-task-group", { hasText: "Bar" })).toBeVisible();
    await expect(page.locator(".v11-task-group", { hasText: "Restaurant" })).toBeVisible();
    // filter: one outlet
    await page.locator('[data-v11-filter="taskOutlet"]').selectOption("bar");
    await expect(page.locator(".v11-task")).toHaveCount(1);
    await page.locator('[data-v11-filter="taskOutlet"]').selectOption("restaurant");
    await expect(page.locator(".v11-task")).toHaveCount(2);
    for (const x of await page.locator(".v11-task .v11-task-outlet").allInnerTexts()) expect(x).toBe("Restaurant");
    // within an outlet: status and priority
    await page.locator('[data-v11-filter="taskOutlet"]').selectOption("all");
    await page.locator('[data-v11-filter="taskStatus"]').selectOption("overdue");
    await expect(page.locator(".v11-task")).toHaveCount(1);
    await page.locator('[data-v11-filter="taskStatus"]').selectOption("all");
    await page.locator("[data-v11-task-group]").uncheck();
    await page.locator('[data-v11-filter="taskSort"]').selectOption("priority");
    await expect(page.locator(".v11-task").first()).toContainText("Hoch");
    await page.locator('[data-v11-filter="taskSort"]').selectOption("outlet");
    const order = await page.locator(".v11-task .v11-task-outlet").allInnerTexts();
    expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b, "de")));
    // chip click filters
    await page.locator(".v11-outlet-chip", { hasText: "Betriebsübergreifend" }).click();
    await expect(page.locator('[data-v11-filter="taskOutlet"]')).toHaveValue("general");
  });

  test("S13-2 bestehende Aufgaben ohne Outlet bleiben erhalten, stehen unter Allgemein und werden nur bewusst zugeordnet", async ({ page }) => {
    await open(page, "v11tasks");
    await mutate(page, `S.tasks.push({ id: "alt-1", title: "Alte Aufgabe ohne Outlet", priority: "normal", status: "open", due_on: null, version: 2 });`);
    const t = page.locator(".v11-task", { hasText: "Alte Aufgabe ohne Outlet" });
    await expect(t).toContainText("Betriebsübergreifend / Allgemein");
    let old = (await snap(page)).tasks.find((x: { id: string }) => x.id === "alt-1");
    expect("outlet_id" in old).toBe(false); // nothing guessed or written
    await t.getByRole("button", { name: /Outlet von „Alte Aufgabe ohne Outlet“ ändern/ }).click();
    await page.locator("#v11-to-outlet").selectOption("restaurant");
    await page.locator("#v11-task-outlet-form").getByRole("button", { name: "Speichern" }).click();
    await expect(page.locator(".v11-task", { hasText: "Alte Aufgabe ohne Outlet" })).toContainText("Restaurant");
    old = (await snap(page)).tasks.find((x: { id: string }) => x.id === "alt-1");
    expect(old.outlet_id).toBe("restaurant");
    expect(old.version).toBe(3);
  });

  test("S13-3 manipuliertes Outlet im Formular wird abgelehnt", async ({ page }) => {
    await open(page, "v11tasks");
    const before = (await snap(page)).tasks.length;
    await page.evaluate(() => {
      const sel = document.querySelector("#v11-t-outlet") as HTMLSelectElement;
      sel.add(new Option("Fremder Betrieb", "outlet-of-another-company"));
      sel.value = "outlet-of-another-company";
    });
    await page.locator("#v11-task-form").getByLabel("Beschreibung").fill("Darf nicht gespeichert werden");
    await page.getByRole("button", { name: "Aufgabe erstellen" }).click();
    await expect(page.locator(".toast.error")).toContainText("Outlet dieses Betriebs");
    expect((await snap(page)).tasks.length).toBe(before);
  });

  test("S13-4 Schulungsaufgabe aus dem Tagesfunnel: gewähltes Outlet übernommen, bei „Alle Outlets“ Allgemein", async ({ page }) => {
    await open(page, "v11funnel");
    await page.locator('[data-v11-filter="outlet"]').first().selectOption("restaurant");
    await page.getByRole("button", { name: "Schulung als Aufgabe anlegen" }).first().click();
    await expect(page.locator(".toast").last()).toContainText("Restaurant");
    await page.locator('[data-v11-filter="outlet"]').first().selectOption("all");
    await page.getByRole("button", { name: "Schulung als Aufgabe anlegen" }).first().click();
    await expect(page.locator(".toast").last()).toContainText("kein einzelnes Outlet");
    const training = (await snap(page)).tasks.filter((x: { title: string }) => x.title.startsWith("Training "));
    expect(training.map((x: { outlet_id: string | null }) => x.outlet_id)).toEqual(["restaurant", null]);
  });
});

test.describe("S14 KI-Marktcheck: zwei Ansichten", () => {
  test.beforeEach(async ({ page }) => fresh(page));

  const add = async (page: Page, o: { article: string; comp: string; prod: string; portion: string; scope: "Vergleichbar" | "Unterschiedlich" | "Noch unklar"; price: string }) => {
    const f = page.locator("#v11-market-form");
    await f.getByLabel("Eigener Artikel").selectOption({ label: o.article });
    await f.getByLabel("Wettbewerber").fill(o.comp);
    await f.getByLabel("Konkurrenzprodukt", { exact: true }).fill(o.prod);
    await f.getByLabel("Menge / Portion bei der Konkurrenz").fill(o.portion);
    await f.getByLabel(o.scope, { exact: true }).check();
    await f.getByLabel("Konkurrenzpreis brutto (€)").fill(o.price);
    await f.getByLabel("Quelle (https-Link)").fill("https://example.com/karte");
    await f.getByLabel("Prüfdatum").fill("2026-10-20");
    await f.getByRole("button", { name: "Beobachtung speichern" }).click();
  };

  test("S14-1 Speisen und Getränke filtern, Warengruppen, Vergleichbarkeit, Prüfliste, Mein Markt bleibt erhalten", async ({ page }) => {
    await open(page, "v11market");
    await expect(page.getByRole("tab", { name: /Speisen- und Getränkevergleich/ })).toHaveAttribute("aria-selected", "true");
    await add(page, { article: "Classic Cheeseburger (Burger)", comp: "Bistro A", prod: "Cheeseburger", portion: "Portion", scope: "Vergleichbar", price: "16" });
    await add(page, { article: "Signature Cocktail (Getränke)", comp: "Bar B", prod: "Hauscocktail", portion: "Glas", scope: "Unterschiedlich", price: "11" });
    // an observation saved before (free-text article, no quantities) and one from Mein Markt
    await mutate(page, `S.intelligence.markets.push({ id: "old-1", competitor_name: "Altbeobachtung", own_product: "apfelstrudel", competitor_product: "Strudel", competitor_price_gross: 9, our_price_gross: 10.2, source_url: "https://example.com/alt", checked_on: "2026-09-01" });
      S.market.push({ id: "mm-1", productId: S.items.find((p) => p.name === "Caesar Salad").id, competitor: "Café Mein Markt", competitorProduct: "Caesar", unit: "Portion", grossPrice: 14.5, observedAt: "2026-10-01", sourceUrl: "" });`);
    const rows = page.locator(".v11-cmp tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: "Bistro A" })).toContainText("+11,9 %");
    await expect(rows.filter({ hasText: "Bar B" })).toContainText("Nicht vergleichbar");
    await expect(rows.filter({ hasText: "Bar B" })).toContainText("keine Abweichung berechnet");
    await expect(rows.filter({ hasText: "Altbeobachtung" })).toContainText("Zu prüfen");
    await expect(rows.filter({ hasText: "Café Mein Markt" })).toContainText("aus Mein Markt");
    // main filter and Warengruppe
    await page.getByRole("button", { name: /^Getränke/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Bar B");
    await page.getByRole("button", { name: /^Speisen/ }).click();
    await expect(rows).toHaveCount(3);
    const cats = await page.locator('[data-v11-filter="mCategory"] option').allInnerTexts();
    expect(cats).toEqual(expect.arrayContaining(["Alle Speisen", "Burger", "Dessert", "Bowl & Salat"]));
    expect(cats).not.toContain("Getränke");
    await page.locator('[data-v11-filter="mCategory"]').selectOption("Dessert");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Altbeobachtung");
    // the form only offers articles of the selection
    await expect(page.locator("#v11-m-own option")).toHaveCount(2); // Apfelstrudel, Dessertvariation
    // manual review: check the old observation
    await rows.first().getByRole("button", { name: /prüfen/ }).click();
    await page.locator("#v11-chk-op").fill("Portion");
    await page.locator("#v11-chk-cp").fill("Portion");
    await page.locator("#v11-market-check-form").getByLabel("Vergleichbar", { exact: true }).check();
    await page.locator("#v11-market-check-form").getByRole("button", { name: "Speichern" }).click();
    await expect(rows.first()).toContainText("+13,3 %");
    const old = (await snap(page)).intelligence.markets.find((x: { id: string }) => x.id === "old-1");
    expect([old.competitor_price_gross, old.our_price_gross, old.source_url]).toEqual([9, 10.2, "https://example.com/alt"]);
    // a Warengruppe without Speisen/Getränke is offered for review, not guessed
    await page.getByRole("button", { name: /^Alle/ }).click();
    const open_ = page.locator("[data-v11-section-for='Upgrades']");
    await expect(open_).toBeVisible();
    await open_.selectOption("food");
    await expect(page.locator("[data-v11-section-for='Upgrades']")).toHaveCount(0);
    expect((await snap(page)).intelligence.sections).toEqual({ Upgrades: "food" });
  });

  test("S14-2 Umgebung: Standort, Kategorien, Luftlinie, Sortierung, Übernahme ohne Preis; Fehler und keine Treffer verständlich", async ({ page, problems }) => {
    let mode: "ok" | "empty" | "error" = "ok";
    let lastQuery = "";
    await page.route("https://overpass-api.de/**", (r) => {
      lastQuery = decodeURIComponent(r.request().postData() || "");
      if (mode === "error") return r.fulfill({ status: 429, body: "{}" });
      return r.fulfill({
        json: {
          elements:
            mode === "empty"
              ? []
              : [
                  { type: "node", id: 11, lat: 50.8049, lon: 6.4851, tags: { name: "Bistro Nah", amenity: "restaurant", website: "https://bistro.example", "addr:street": "Markt", "addr:housenumber": "1" } },
                  { type: "node", id: 12, lat: 50.812, lon: 6.485, tags: { name: "Halle Weit", amenity: "events_venue" } },
                  { type: "node", id: 13, lat: 50.806, lon: 6.485, tags: { name: "Café Mitte", amenity: "cafe" } },
                ],
        },
      });
    });
    await open(page, "v11market");
    await page.getByRole("tab", { name: /Restaurants und Locations/ }).click();
    await expect(page.locator("#v11-mpanel-places")).toContainText("Düren (Beispiel-Standort)");
    await page.getByLabel("Radius").selectOption("1000");
    await page.getByLabel("Kneipe").uncheck();
    await page.getByRole("button", { name: "Umgebung durchsuchen" }).click();
    await expect(page.locator(".v11-place-list li")).toHaveCount(3);
    expect(lastQuery).toContain("around:1000,50.804,6.485");
    expect(lastQuery).not.toContain("pub");
    const names = () => page.locator(".v11-place-list li > div > b").allInnerTexts();
    expect(await names()).toEqual(["Bistro Nah", "Café Mitte", "Halle Weit"]);
    await expect(page.locator(".v11-place-list li").first()).toContainText("m Luftlinie");
    await expect(page.locator(".v11-place-list li", { hasText: "Café Mitte" })).toContainText("Unvollständig in OSM: Adresse, Website fehlt");
    await expect(page.locator(".v11-map svg")).toBeVisible();
    await page.locator('[data-v11-filter="pSort"]').selectOption("category");
    expect(await names()).toEqual(["Café Mitte", "Bistro Nah", "Halle Weit"]);
    await page.locator('[data-v11-show="cafe"]').uncheck();
    expect(await names()).toEqual(["Bistro Nah", "Halle Weit"]);
    // take over into view A: name and OSM link, no price
    await page.locator(".v11-place-list li", { hasText: "Bistro Nah" }).getByRole("button", { name: "In Preisvergleich übernehmen" }).click();
    await expect(page.getByRole("tab", { name: /Speisen- und Getränkevergleich/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#v11-m-comp")).toHaveValue("Bistro Nah");
    await expect(page.locator("#v11-m-cprice")).toHaveValue("");
    // no results and external error
    await page.getByRole("tab", { name: /Restaurants und Locations/ }).click();
    mode = "empty";
    await page.getByRole("button", { name: "Umgebung durchsuchen" }).click();
    await expect(page.locator("#v11-discover-status")).toContainText("Keine Einträge in OpenStreetMap");
    mode = "error";
    await page.getByRole("button", { name: "Umgebung durchsuchen" }).click();
    await expect(page.locator("#v11-discover-status")).toContainText("überlastet");
    await expect(page.locator("#v11-discover-status")).toContainText("manuelle Erfassung in Tab A funktioniert");
    problems.splice(0, problems.length, ...problems.filter((p) => !p.includes("overpass") && !p.includes("429")));
  });

  test("S14-3 Tastatur: Reiter mit Pfeiltasten", async ({ page }) => {
    await open(page, "v11market");
    await page.getByRole("tab", { name: /Speisen- und Getränkevergleich/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Restaurants und Locations/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("Umkreissuche");
  });
});

test.describe("S14 mobil", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("S14-M Marktcheck, Aufgaben und Lebenszyklus ohne Überlauf", async ({ page }) => {
    await fresh(page);
    for (const v of ["v11market", "v11tasks", "lifecycle"]) {
      await open(page, v);
      await expect(page.locator("#main h1").first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await open(page, "v11market");
    await page.getByRole("tab", { name: /Restaurants und Locations/ }).click();
    await expectNoHorizontalScroll(page);
  });
});
