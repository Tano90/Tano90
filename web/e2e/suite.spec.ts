import { expect, test } from "./fixtures";

// The GLB AI Suite v0.8 dashboard (public/suite). Without GLB_SUPABASE_* it runs as a demo in the browser.
test.describe("SU GLB AI Suite", () => {
  test("SU-H1 startet als Demo, jedes Modul öffnet ohne Fehler", async ({ page }) => {
    await page.goto("/suite");
    await expect(page.locator("#cloud-sync-status")).toHaveText("Demo · Daten nur in diesem Browser");
    await expect(page.locator("#main")).toContainText("Beispieldaten");
    const views = await page.locator("#sidebar [data-view]").evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset.view!));
    expect(views.length).toBeGreaterThanOrEqual(20);
    for (const v of views) {
      await page.locator(`#sidebar [data-view="${v}"]`).click();
      await expect(page.locator("#main")).not.toBeEmpty();
    }
  });

  test("SU-E1 Konfiguration kommt aus der Umgebung, nie aus einer Datei im Code", async ({ page }) => {
    const res = await page.request.get("/suite/config.js");
    expect(res.headers()["content-type"]).toContain("javascript");
    expect(res.headers()["cache-control"]).toBe("no-store");
    expect(await res.text()).toContain("window.GLB_CLOUD_ENABLED = false;");
    const html = await (await page.request.get("/suite")).text();
    expect(html).toContain('<base href="/suite/">');
    expect(html).not.toContain("cdn.jsdelivr.net");
  });
});
