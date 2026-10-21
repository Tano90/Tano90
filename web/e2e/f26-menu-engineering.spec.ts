import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";

test.describe("S22 Menu Engineering", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("ME-H1 Gerichte nach Beliebtheit und Deckungsbeitrag eingeordnet", async ({ page, axe }) => {
    await page.goto("/analytics/menu-engineering");
    const table = page.getByRole("table", { name: "Gerichte im Zeitraum" });
    // Seed: 14 lentil soups at 7,38 net (cost 0,63), 5 oven vegetables at 13,55 net (cost 1,07).
    await expect(table.getByRole("row").filter({ hasText: "Linsensuppe" })).toContainText("Arbeitspferde");
    await expect(table.getByRole("row").filter({ hasText: "Ofengemüse" })).toContainText("Rätsel");
    await expect(table.getByRole("row").filter({ hasText: "Linsensuppe" })).toContainText("73,7 %");
    await expect(page.getByText(/28 verkaufte Portionen gehören zu Kassenartikeln ohne Rezept/)).toBeVisible();
    await axe();
  });

  test("ME-E1 Punkt per Tastatur: Tooltip mit denselben Werten", async ({ page }) => {
    await page.goto("/analytics/menu-engineering");
    await page.getByRole("img", { name: /^Ofengemüse/ }).focus();
    await expect(page.getByRole("tooltip")).toContainText("5 Portionen");
    await expect(page.getByRole("tooltip")).toContainText("Rätsel");
  });

  test("ME-E2 Zeitraum ohne Verkäufe, 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/analytics/menu-engineering?from=2020-01-01&to=2020-01-31");
    await expect(page.getByText("Keine Verkäufe in diesem Zeitraum")).toBeVisible();
    await page.goto("/analytics/menu-engineering");
    await expectNoHorizontalScroll(page);
  });

  test("ME-E3 Verknüpfen ändert die Matrix, ignorierte Artikel zählen nicht als offen", async ({ page }) => {
    await db()`update pos_items set recipe_id = ${sid("rec-apfelkuchen")} where id = ${sid("pos-1003")}`;
    await db()`update pos_items set ignored = true where id = ${sid("pos-9001")}`;
    await page.goto("/analytics/menu-engineering");
    await expect(page.getByRole("table", { name: "Gerichte im Zeitraum" }).getByRole("row").filter({ hasText: "Apfelkuchen" })).toContainText("8");
    await expect(page.getByText(/ohne Rezept/)).toHaveCount(0);
  });
});
