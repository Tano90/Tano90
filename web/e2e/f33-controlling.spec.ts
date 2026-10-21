import { expect, reseed, test } from "./fixtures";

test.describe("F&B-Controlling", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("C-H1 Monat je Outlet, Kostenstelle eintragen, CSV für die Buchhaltung", async ({ page, axe }) => {
    await page.goto("/analytics/pos");
    await page.getByRole("link", { name: "F&B-Controlling" }).click();
    const table = page.getByRole("table", { name: /F&B-Controlling/ });
    await expect(table.getByRole("rowheader", { name: "Küche Mitte" })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Zentralküche" })).toBeVisible();
    await expect(table).toContainText(/Summe/);
    await axe();
    await page.getByLabel("Kostenstelle Küche Mitte").fill("4100");
    await page.getByLabel("Kostenstelle Küche Mitte").press("Enter");
    await expect(page.getByText("Kostenstelle für Küche Mitte gespeichert")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV für die Buchhaltung" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^fb-controlling-\d{4}-\d{2}\.csv$/);
    const csv = (await (await file.createReadStream()).toArray()).join("");
    expect(csv).toContain("Monat;Kostenstelle;Outlet;Anfangsbestand (EUR)");
    expect(csv).toMatch(/;4100;Küche Mitte;/);
    expect(csv).toContain(";Summe;");
  });

  test("C-N1 Team-Konto sieht kein Controlling", async ({ page, login }) => {
    await login("staff");
    await page.goto("/analytics/controlling");
    await expect(page.getByText(/Das Controlling sehen Inhaber, Admins und die Leitung/)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("C-E1 390 px: Tabelle scrollt in sich", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/analytics/controlling");
    await expect(page.getByRole("table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
