import { expect, test, type Page } from "./fixtures";

// Menu import: VAT presets from settings, rows to review, photos and scans explained, save only after confirmation.
async function open(page: Page, view: string) {
  await page.evaluate((v) => (document.querySelector(`#sidebar .glb08-nav-link[data-view="${v}"]`) as HTMLElement).click(), view);
}

test.describe("SM Speisekartenimport", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/suite");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("SM-1 USt-Voreinstellung aus Einstellungen, unsichere Zeilen markiert, Speichern mit Rückfrage", async ({ page }) => {
    await open(page, "settings");
    await page.getByLabel("Getränke").selectOption("19");
    await page.getByLabel("Speisen").selectOption("7");
    await page.locator('[data-action="save-settings"]').click();
    expect(await page.evaluate(() => window.GLBAppSync.snapshot().vatDrinks)).toBe(19);

    await open(page, "menuimport");
    await page.locator("#v08-menu-text").fill("BURGER\nSmoky Testburger 18,40 €\nGRILL\nTest-Rinderfilet\n41,90 €\nGETRÄNKE\nTestlimo 4,20 €");
    await page.getByRole("button", { name: "Text erkennen" }).click();
    const items = page.locator(".v08-review-item");
    await expect(items).toHaveCount(3);
    const burger = items.filter({ has: page.locator('input[value="Smoky Testburger"]') });
    await expect(burger.locator("select")).toHaveValue("7");
    await expect(burger).toContainText("Voreinstellung Speisen");
    const limo = items.filter({ has: page.locator('input[value="Testlimo"]') });
    await expect(limo.locator("select")).toHaveValue("19");
    const filet = items.filter({ has: page.locator('input[value="Test-Rinderfilet"]') });
    await expect(filet).toHaveClass(/is-flagged/);
    await expect(filet).toContainText("zwei Zeilen");
    await expect(page.locator(".v08-review")).toContainText("1 von 3 Positionen bitte prüfen");

    // only flagged rows; editing survives the toggle
    await filet.locator("[data-v08-price]").fill("42,50");
    await page.getByLabel("Nur zu prüfende anzeigen").check();
    await expect(items).toHaveCount(1);
    await expect(items.locator("[data-v08-price]")).toHaveValue("42,5");
    await page.getByLabel("Nur zu prüfende anzeigen").uncheck();
    await expect(items).toHaveCount(3);

    // declining the confirmation saves nothing
    page.once("dialog", (d) => void d.dismiss());
    await page.getByRole("button", { name: /Angehakte Artikel speichern/ }).click();
    expect(await page.evaluate(() => window.GLBAppSync.snapshot().items.some((x: { name: string }) => x.name === "Testlimo"))).toBe(false);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: /Angehakte Artikel speichern/ }).click();
    const items2 = await page.evaluate(() => window.GLBAppSync.snapshot().items);
    const byName = (n: string) => items2.find((x: { name: string }) => x.name === n);
    expect(byName("Testlimo").vat).toBe(19);
    expect(byName("Smoky Testburger").vat).toBe(7);
    expect(byName("Test-Rinderfilet").grossPrice).toBe(42.5);
  });

  test("SM-2 Foto und Scan: verständliche Meldung, keine Vorschau, Hinweis auf Alternativen", async ({ page }) => {
    await open(page, "menuimport");
    await page.locator("#v08-menu-file").setInputFiles({ name: "karte.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) });
    await expect(page.locator(".v08-review")).toContainText("Fotos kann die Suite nicht auslesen");
    await expect(page.locator(".v08-review-item")).toHaveCount(0);
    await page.locator("#v08-menu-file").setInputFiles({ name: "notizen.docx", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    await expect(page.locator(".v08-review")).toContainText("nicht unterstützt");
  });
});

declare global {
  interface Window {
    GLBAppSync: { snapshot: () => any };
  }
}
