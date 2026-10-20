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
    await page.getByLabel(/Speisequark/).fill("3");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await axe();
    await page.reload();
    await expect(page.getByLabel(/Speisequark/)).toHaveValue("3");
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
    await expect(page.getByLabel(/Speisequark/)).toBeVisible();
    await context.setOffline(true);
    await page.getByLabel(/Speisequark/).fill("4");
    await expect(page.getByText(/Speichern fehlgeschlagen/)).toBeVisible();
    await context.setOffline(false);
    await page.getByLabel(/Speisequark/).press("Tab");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/Speisequark/)).toHaveValue("4");
  });

  test("F08-E3 zweiter Tab kann keine zweite Inventur starten", async ({ page, context }) => {
    const second = await context.newPage();
    await page.goto("/stock/count");
    await second.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await expect(page.getByLabel(/Speisequark/)).toBeVisible();
    await second.getByRole("button", { name: "Inventur starten" }).click();
    await expect(second.getByText("Für dieses Outlet läuft schon eine Inventur.")).toBeVisible();
  });

  test("F08-E4 Zählliste bei 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    const input = page.getByLabel(/Speisequark/);
    await expect(input).toBeVisible();
    expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);
  });
});
