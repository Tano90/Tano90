import { expect, test } from "./fixtures";

// The GLB AI Suite v0.8 dashboard (public/suite). Without GLB_SUPABASE_* it runs as a demo in the browser.
test.describe("SU GLB AI Suite", () => {
  test("SU-H1 startet als Demo, jedes Modul öffnet ohne Fehler", async ({ page }) => {
    await page.goto("/suite");
    await expect(page.locator("#cloud-sync-status")).toHaveText("Demo · Daten nur in diesem Browser");
    await expect(page.locator("#main")).toContainText("Beispieldaten");
    const views = [...new Set(await page.locator("#sidebar .glb08-nav-link[data-view]").evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset.view!)))];
    expect(views.length).toBeGreaterThanOrEqual(20);
    for (const v of views) {
      await page.locator(`#sidebar .glb08-nav-link[data-view="${v}"]`).click();
      await expect(page.locator("#main")).not.toBeEmpty();
    }
  });

  test("SU-E1 Konfiguration kommt aus der Umgebung, nie aus einer Datei im Code", async ({ page }) => {
    const res = await page.request.get("/suite/config.js");
    expect(res.headers()["content-type"]).toContain("javascript");
    expect(res.headers()["cache-control"]).toBe("no-store");
    expect(await res.text()).toContain("window.GLB_CLOUD_ENABLED = false;");
    const html = await (await page.request.get("/suite")).text();
    expect(html).toMatch(/<base href="\/suite\/"\s*\/?>/);
    expect(html).not.toContain("cdn.jsdelivr.net");
  });
});

test.describe("SU GLB AI Suite auf dem Handy", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("SU-M1 kein Modul ist breiter als der Bildschirm, Kopfzeile in einer Zeile, Aktionen im Blatt", async ({ page }) => {
    await page.goto("/suite");
    const views = [...new Set(await page.locator("#sidebar [data-view]").evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset.view!)))];
    for (const v of views) {
      await page.evaluate((v) => (document.querySelector(`#sidebar [data-view="${v}"]`) as HTMLElement).click(), v);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${v} breiter als 390 px`).toBeLessThanOrEqual(390);
    }
    expect((await page.locator(".topbar").boundingBox())!.height).toBeLessThanOrEqual(64);
    await page.getByRole("button", { name: "Konto, Backup und mehr" }).click();
    const sheet = page.getByRole("dialog", { name: "Weitere Aktionen" });
    await expect(sheet).toContainText("Demo · Daten nur in diesem Browser");
    await expect(sheet.getByRole("button", { name: /Backup herunterladen/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("SU-M2 Eingabe als Blatt: Speichern liegt über der unteren Leiste", async ({ page }) => {
    await page.goto("/suite#funnel");
    await page.locator("#glb08-bottomnav").getByRole("button", { name: "Service Funnel" }).click();
    await page.getByRole("button", { name: "Tageserfassung" }).first().click();
    const save = page.locator("#modal-layer .modal-footer").getByRole("button", { name: /Speichern/ });
    await expect(save).toBeInViewport();
    const nav = (await page.locator("#glb08-bottomnav").boundingBox())!;
    const btn = (await save.boundingBox())!;
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".modal-footer") !== null, [btn.x + btn.width / 2, btn.y + btn.height / 2])).toBe(true);
    expect(nav.height).toBeGreaterThan(0);
  });
});

test.describe("SU Mein Markt", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("SU-MK1 Ort per Adresse, Suche unter den Feldern, Ersatzserver, Ergebnisse sichtbar", async ({ page, problems }) => {
    await page.route("https://nominatim.openstreetmap.org/**", (r) => r.fulfill({ json: [
      { display_name: "Marktplatz 1, 52349 Düren, Deutschland", lat: "50.8037", lon: "6.4820" },
      { display_name: "Marktplatz, Aachen, Deutschland", lat: "50.7762", lon: "6.0838" },
    ] }));
    await page.route("https://overpass.private.coffee/**", (r) => r.fulfill({ status: 503, body: "busy" }));
    await page.route("https://overpass-api.de/**", (r) => r.fulfill({ json: { elements: [
      { type: "node", id: 1, lat: 50.805, lon: 6.483, tags: { name: "Trattoria Beispiel", amenity: "restaurant" } },
      { type: "node", id: 2, lat: 50.81, lon: 6.49, tags: { name: "Café Beispiel", amenity: "cafe" } },
    ] } }));
    await page.goto("/suite#market");
    await page.evaluate(() => (document.querySelector('#sidebar [data-view="market"]') as HTMLElement).click());
    await page.getByLabel("Adresse oder Ort deines Betriebs").fill("Marktplatz 1 Düren");
    await page.getByRole("button", { name: "Suchen", exact: true }).click();
    await page.getByRole("button", { name: /Marktplatz 1, 52349 Düren/ }).click();
    await expect(page.locator("#market-lat")).toHaveValue("50.80370");
    await expect(page.locator("#market-label")).toHaveValue("Marktplatz 1 Düren");
    const go = page.getByRole("button", { name: "Umkreis jetzt durchsuchen (20 km)" });
    await expect(go).toBeVisible();
    await go.click();
    await expect(page.getByText("Trattoria Beispiel")).toBeInViewport();
    await expect(page.getByText(/Letzte manuelle Suche .* 2 Treffer/)).toBeVisible();
    // The simulated outage of the first server shows up as a browser error; that one is expected.
    problems.splice(0, problems.length, ...problems.filter((p) => !p.includes("503 (Service Unavailable)") && !p.includes("overpass.private.coffee")));
  });

  test("SU-MK2 Ortssuche nicht erreichbar: Hinweis, Koordinaten bleiben nutzbar", async ({ page, problems }) => {
    await page.route("https://nominatim.openstreetmap.org/**", (r) => r.abort());
    await page.goto("/suite#market");
    await page.evaluate(() => (document.querySelector('#sidebar [data-view="market"]') as HTMLElement).click());
    await page.getByLabel("Adresse oder Ort deines Betriebs").fill("Irgendwo 5");
    await page.getByRole("button", { name: "Suchen", exact: true }).click();
    await expect(page.getByText(/Ortssuche gerade nicht erreichbar/)).toBeVisible();
    await expect(page.locator("#market-lat")).toBeEditable();
    problems.splice(0, problems.length, ...problems.filter((p) => !p.includes("net::ERR_FAILED")));
  });
});
