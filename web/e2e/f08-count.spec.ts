import { expect, expectNoHorizontalScroll, reseed, stockQuantity, test } from "./fixtures";

test.describe("F08 Inventur", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("F08-H1 + E1 zählen, Zwischenstand übersteht Neuladen, Abschluss bucht nur Gezähltes", async ({ page, axe }) => {
    const butter = await stockQuantity("Butter");
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await page.getByRole("textbox", { name: /Speisequark/ }).fill("3");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await axe();
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Speisequark/ })).toHaveValue("3");
    await page.getByRole("button", { name: "Inventur abschließen" }).click();
    await expect(page.getByRole("dialog")).toContainText("1 Artikel gezählt");
    await page.getByRole("dialog").getByRole("button", { name: "Abschließen" }).click();
    await page.waitForURL("/stock");
    expect(await stockQuantity("Speisequark 20 %")).toBe(3000);
    expect(await stockQuantity("Butter")).toBe(butter);
  });

  test("F08-E2 offline zählen, wieder online speichern", async ({ page, context }) => {
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await expect(page.getByRole("textbox", { name: /Speisequark/ })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole("textbox", { name: /Speisequark/ }).fill("4");
    await expect(page.getByText(/Speichern fehlgeschlagen/)).toBeVisible();
    await context.setOffline(false);
    await page.getByRole("textbox", { name: /Speisequark/ }).press("Tab");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Speisequark/ })).toHaveValue("4");
  });

  test("F08-E3 zweiter Tab kann keine zweite Inventur starten", async ({ page, context }) => {
    const second = await context.newPage();
    await page.goto("/stock/count");
    await second.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await expect(page.getByRole("textbox", { name: /Speisequark/ })).toBeVisible();
    await second.getByRole("button", { name: "Inventur starten" }).click();
    await expect(second.getByText("Für dieses Outlet läuft schon eine Inventur.")).toBeVisible();
  });

  test("F08-E4 Zählliste bei 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    const input = page.getByRole("textbox", { name: /Speisequark/ });
    await expect(input).toBeVisible();
    expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);
  });
});

test.describe("S17 Inventur in Gebinden", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("S17-H1 Kartons, Stücke und Loses ergeben den Bestand, auch nach Neuladen", async ({ page, axe }) => {
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await page.getByRole("button", { name: "Butter in Gebinden zählen" }).click();
    await page.getByLabel("Butter: Karton 10 × 250 g").fill("2");
    await page.getByLabel("Butter: Stück 250 g").fill("3");
    await page.getByLabel("Butter: lose (kg)").fill("0,1");
    const total = page.getByRole("textbox", { name: /^Butter/ }).first();
    await expect(total).toHaveValue("5,85");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await axe();
    await page.reload();
    await expect(page.getByLabel("Butter: Karton 10 × 250 g")).toHaveValue("2");
    await expect(page.getByLabel("Butter: lose (kg)")).toHaveValue("0,1");
    await page.getByRole("button", { name: "Inventur abschließen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Abschließen" }).click();
    await page.waitForURL("/stock");
    expect(await stockQuantity("Butter")).toBe(5850);
  });

  test("S17-E1 zurück zur Gesamtmenge behält die Summe", async ({ page }) => {
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await page.getByRole("button", { name: "Butter in Gebinden zählen" }).click();
    await page.getByLabel("Butter: Karton 10 × 250 g").fill("1");
    await page.getByRole("button", { name: "Butter in Gebinden zählen" }).click();
    await expect(page.getByLabel("Butter: Karton 10 × 250 g")).toHaveCount(0);
    const total = page.getByRole("textbox", { name: /^Butter/ });
    await expect(total).toHaveValue("2,5");
    await expect(total).toBeEditable();
  });
});

test.describe("S17 Barcode", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("B-H1 Scanner tippt den Code: ein Karton mehr, mehrfach, unbekannter Code", async ({ page, axe }) => {
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    const field = page.getByLabel("Barcode scannen oder eintippen");
    await field.fill("2000000000015");
    await field.press("Enter");
    await expect(page.getByText("Butter: Karton 10 × 250 g +1, jetzt 1")).toBeVisible();
    await field.fill("2000000000015");
    await field.press("Enter");
    await expect(page.getByLabel("Butter: Karton 10 × 250 g")).toHaveValue("2");
    await expect(page.getByRole("textbox", { name: /^Butter/ }).first()).toHaveValue("5");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await axe();
    await field.fill("4000000000000");
    await field.press("Enter");
    await expect(page.getByText(/Barcode 4000000000000 ist keinem Artikel zugeordnet/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Butter: Karton 10 × 250 g")).toHaveValue("2");
  });

  test("B-E1 derselbe Code in GTIN-14- oder UPC-Schreibweise mit führenden Nullen", async ({ page }) => {
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    const field = page.getByLabel("Barcode scannen oder eintippen");
    await field.fill("02000000000015"); // GTIN-14 of 2000000000015, as many scanners and GS1-128 labels send it
    await field.press("Enter");
    await expect(page.getByText("Butter: Karton 10 × 250 g +1, jetzt 1")).toBeVisible();
  });
});
