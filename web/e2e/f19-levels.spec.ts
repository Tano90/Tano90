import { db, expect, reseed, sid, test } from "./fixtures";

test.describe("S16 Mindest- und Zielbestand", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("S16-H1 setzen: Markierung und Bestellvorschlag folgen", async ({ page, axe }) => {
    await page.goto("/stock");
    const row = page.getByRole("row").filter({ hasText: "Butter" });
    await row.getByRole("button", { name: "Butter: Mindest- und Zielbestand" }).click();
    const d = page.getByRole("dialog", { name: "Butter" });
    await axe();
    await d.getByLabel("Mindestbestand (kg)").fill("3");
    await d.getByLabel("Zielbestand (kg)").fill("7,5");
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Bestände gespeichert")).toBeVisible();
    await expect(row).toContainText("3 kg / 7,5 kg");
    await expect(row).toContainText("unter Minimum"); // 2,5 kg on hand
    const [oi] = await db()`select min_level_base, par_level_base from outlet_ingredients where outlet_id = ${sid("out-mitte")} and ingredient_id = ${sid("ing-butter")}`;
    expect([Number(oi.min_level_base), Number(oi.par_level_base)]).toEqual([3000, 7500]);
  });

  test("S16-E1 leeren entfernt Markierung", async ({ page }) => {
    await page.goto("/stock");
    const row = page.getByRole("row").filter({ hasText: "Lauch" });
    await expect(row).toContainText("unter Minimum");
    await row.getByRole("button", { name: /Mindest- und Zielbestand/ }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel(/Mindestbestand/).fill("");
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Bestände gespeichert")).toBeVisible();
    await expect(row).not.toContainText("unter Minimum");
  });

  test("S16-N1 Minimum über Ziel wird abgelehnt", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("button", { name: "Butter: Mindest- und Zielbestand" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel(/Mindestbestand/).fill("9");
    await d.getByLabel(/Zielbestand/).fill("5");
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(d.getByRole("alert")).toHaveText("Der Mindestbestand liegt über dem Zielbestand.");
  });
});
