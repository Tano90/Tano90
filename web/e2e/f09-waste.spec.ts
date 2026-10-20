import { expect, reseed, stockQuantity, test } from "./fixtures";
import type { Page } from "@playwright/test";

const fill = async (page: Page, reason: string | null) => {
  await page.goto("/stock/waste");
  await page.getByRole("combobox", { name: "Zutat" }).click();
  await page.getByPlaceholder("Suchen …").fill("Quark");
  await page.getByRole("option", { name: /Speisequark/ }).click();
  await page.getByRole("textbox", { name: "Menge" }).fill("1,5");
  await page.getByLabel("Einheit").selectOption("kg");
  if (reason) await page.getByLabel("Grund").selectOption(reason);
  await page.getByRole("button", { name: "Schwund buchen" }).click();
};

test.describe("F09 Schwund", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("F09-H1 Schwund mit Grund", async ({ page, axe }) => {
    const before = await stockQuantity("Speisequark 20 %");
    await fill(page, "Verdorben");
    await expect(page.getByText(/1,5 kg Speisequark 20 % · Verdorben/)).toBeVisible();
    expect(before - (await stockQuantity("Speisequark 20 %"))).toBe(1500);
    await axe();
  });

  test("F09-N1 ohne Grund wird nichts gebucht", async ({ page }) => {
    const before = await stockQuantity("Speisequark 20 %");
    await fill(page, null);
    await expect(page.getByText("Bitte einen Grund wählen.")).toBeVisible();
    expect(await stockQuantity("Speisequark 20 %")).toBe(before);
  });
});
