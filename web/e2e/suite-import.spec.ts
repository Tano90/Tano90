import { expect, test, type Page } from "./fixtures";

// Imports without silent double counting, and a backup restored into a separate browser session.
async function open(page: Page, view: string) {
  await page.evaluate((v) => (document.querySelector(`#sidebar .glb08-nav-link[data-view="${v}"]`) as HTMLElement).click(), view);
}
async function fresh(page: Page) {
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("glb-ai-suite-v01") || "{}"));
const csv = (name: string, text: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf8") });

const SALES = "﻿Produkt;Outlet;Monat;Menge;Bruttopreis\r\nClassic Cheeseburger;Restaurant;2026-10;40;17,90\r\nTrüffel Fries;Bar;2026-10;12;8,90\r\nTrüffel Fries;Bar;2026-10;-2;8,90\r\nGibt es nicht;Bar;2026-10;3;5,00\r\n";

test.describe("SI Importe und Backup", () => {
  test("SI-1 Verkäufe: Vorschau, gleiche Datei zweimal ohne Doppelzählung, Korrekturzeile, Aktualisieren", async ({ page }) => {
    await fresh(page);
    await open(page, "import");
    await page.locator("#sales-csv-file").setInputFiles(csv("verkauf-oktober.csv", SALES));
    const dlg = page.getByRole("dialog", { name: "Verkäufe importieren" });
    await expect(dlg).toContainText("verkauf-oktober.csv");
    await expect(dlg.locator(".import-counts")).toContainText("3gültige Zeilen");
    await expect(dlg.locator(".import-counts")).toContainText("1fehlerhaft");
    await dlg.getByText("Fehlerhafte Zeilen anzeigen").click();
    await expect(dlg).toContainText("Zeile 5");
    await dlg.getByRole("button", { name: /Übernehmen/ }).click();
    const s1 = await state(page);
    const oct = (s: { sales: { month: string; quantity: number }[] }) => s.sales.filter((x) => x.month === "2026-10");
    expect(oct(s1).reduce((a, x) => a + x.quantity, 0)).toBe(50); // 40 + 12 − 2 (Korrektur)
    expect(oct(s1).every((x: { importId?: string }) => x.importId)).toBe(true);

    // same file again (other name): recognised, "Ergänzen" adds nothing
    await page.locator("#sales-csv-file").setInputFiles(csv("kopie.csv", SALES.replace(/\r\n/g, "\n")));
    await expect(dlg.getByRole("alert")).toContainText("bereits importiert");
    await expect(dlg.locator(".import-mode", { hasText: "Ergänzen" })).toContainText("0 übernehmen");
    await dlg.getByRole("button", { name: /Übernehmen/ }).click();
    expect(oct(await state(page)).reduce((a, x) => a + x.quantity, 0)).toBe(50);

    // a corrected file in "Aktualisieren" replaces the same article/outlet/month, nothing else
    await page.locator("#sales-csv-file").setInputFiles(csv("korrigiert.csv", "Produkt;Outlet;Monat;Menge;Bruttopreis\nClassic Cheeseburger;Restaurant;2026-10;44;17,90\n"));
    await dlg.getByText("Aktualisieren", { exact: true }).click();
    await dlg.getByRole("button", { name: /Übernehmen/ }).click();
    const s3 = await state(page);
    expect(oct(s3).reduce((a, x) => a + x.quantity, 0)).toBe(54);
    expect(s3.sales.filter((x: { month: string }) => x.month === "2026-09").length).toBe(s1.sales.filter((x: { month: string }) => x.month === "2026-09").length);
    // the month appears in the report filter
    await open(page, "reports");
    await expect(page.locator('#v6-filter-month option[value="2026-10"]')).toHaveCount(1);
  });

  test("SI-2 Tagesverkäufe: zweimal dieselbe Datei zählt einmal", async ({ page }) => {
    await fresh(page);
    await open(page, "purchasing");
    const before = await page.evaluate(() => window.GLBAppSync.snapshot().dailySales.length);
    const file = csv("tag.csv", "Datum;Produkt;Outlet;Menge\n2026-08-03;Classic Cheeseburger;Restaurant;30\n2026-08-04;Classic Cheeseburger;Restaurant;0\n");
    await page.locator("#v4-daily-file").setInputFiles(file);
    const dlg = page.getByRole("dialog", { name: "Tagesverkäufe importieren" });
    await dlg.getByRole("button", { name: /Übernehmen/ }).click();
    const after1 = (await state(page)).dailySales.length;
    await page.locator("#v4-daily-file").setInputFiles(file);
    await expect(dlg.getByRole("alert")).toContainText("bereits importiert");
    await dlg.getByRole("button", { name: /Übernehmen/ }).click();
    const after2 = (await state(page)).dailySales.length;
    expect(after2).toBe(after1);
    expect(after1 - before).toBe(2); // a day with 0 sold is recorded, not missing
  });

  test("SI-3 Artikel aktualisieren: gleiche ID, Rezept bleibt verknüpft, Kostenstand protokolliert", async ({ page }) => {
    await fresh(page);
    await open(page, "import");
    const s0 = await state(page);
    // demo data is only written on the first change; read ids from the app instead
    const ids = await page.evaluate(() => window.GLBAppSync.snapshot().items.map((x: { id: string; name: string }) => [x.id, x.name]));
    const burgerId = ids.find(([, n]: string[]) => n === "Classic Cheeseburger")[0];
    await page.locator("#csv-file").setInputFiles(csv("artikel.csv", "Produkt;Kategorie;Menge;Bruttopreis;Wareneinsatz netto;USt\nClassic Cheeseburger;Burger;0;18,90;4,80;7\nNeuer Wrap;Bowl & Salat;0;12,50;3,10;7\n"));
    const dlg = page.getByRole("dialog", { name: "Artikel importieren" });
    await expect(dlg.locator(".import-counts")).toContainText("1bereits vorhanden");
    await dlg.getByText("Aktualisieren", { exact: true }).click();
    await dlg.getByRole("button", { name: /Übernehmen/ }).click();
    const s = await state(page);
    const burger = s.items.find((x: { id: string }) => x.id === burgerId);
    expect(burger.grossPrice).toBe(18.9);
    expect(burger.costHistory.at(-1).source).toBe("Artikelimport");
    expect(s.items.filter((x: { name: string }) => x.name === "Classic Cheeseburger").length).toBe(1);
    expect(s.items.some((x: { name: string }) => x.name === "Neuer Wrap")).toBe(true);
    expect(s.recipes.some((r: { productId: string }) => r.productId === burgerId)).toBe(true);
    expect(s0).toBeDefined();
  });

  test("SI-4 Backup: Herunterladen und in getrennter Sitzung wiederherstellen, Daten und Verknüpfungen gleich", async ({ page, browser }) => {
    await fresh(page);
    await open(page, "funnel");
    await page.locator('[data-action="new-funnel"]').first().click();
    await page.locator('#modal-layer input[name="date"]').fill("2026-10-02");
    await page.locator('#modal-layer input[name="covers"]').fill("77");
    await page.locator("#modal-layer .modal-footer .btn-primary").click();
    const original = await page.evaluate(() => window.GLBAppSync.snapshot());
    await open(page, "settings");
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator('#main [data-action="export-json"]').first().click()]);
    const path = await download.path();

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto("/suite");
    await p2.evaluate(() => (document.querySelector('#sidebar .glb08-nav-link[data-view="settings"]') as HTMLElement).click());
    p2.on("dialog", (d) => void d.accept());
    await p2.locator("#json-file").setInputFiles(path!);
    await expect.poll(() => p2.evaluate(() => window.GLBAppSync.snapshot().funnel.some((r: { date: string }) => r.date === "2026-10-02"))).toBe(true);
    const restored = await p2.evaluate(() => window.GLBAppSync.snapshot());
    for (const key of ["items", "sales", "recipes", "ingredients", "warehouses", "inventoryCounts", "stockMovements", "purchaseOrders", "funnel", "dailySales", "outlets"]) {
      expect(restored[key], key).toEqual(original[key]);
    }
    const itemIds = new Set(restored.items.map((x: { id: string }) => x.id));
    expect(restored.sales.every((x: { productId: string }) => itemIds.has(x.productId))).toBe(true);
    expect(restored.recipes.every((x: { productId: string }) => itemIds.has(x.productId))).toBe(true);
    const ingIds = new Set(restored.ingredients.map((x: { id: string }) => x.id));
    expect(restored.recipes.every((r: { lines: { ingredientId: string }[] }) => r.lines.every((l) => ingIds.has(l.ingredientId)))).toBe(true);
    await other.close();
  });
});

declare global {
  interface Window {
    GLBAppSync: { snapshot: () => Record<string, never> & { [k: string]: unknown } & any };
  }
}
