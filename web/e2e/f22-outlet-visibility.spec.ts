import { db, expect, reseed, sid, test } from "./fixtures";

test.describe("Sichtbarkeit pro Outlet", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("V-H1 in einem Outlet ausblenden und wieder führen", async ({ page, axe }) => {
    await page.goto(`/ingredients/${sid("ing-butter")}?tab=outlets`);
    await axe();
    await page.getByRole("checkbox", { name: "Zentralküche" }).click();
    await expect(page.getByText("In Zentralküche ausgeblendet")).toBeVisible();
    const [{ n }] = await db()`select count(*)::int as n from outlet_ingredients where outlet_id = ${sid("out-zentral")} and ingredient_id = ${sid("ing-butter")}`;
    expect(n).toBe(0);
    await page.goto("/stock");
    await page.getByLabel("Outlet").selectOption({ label: "Zentralküche" });
    await expect(page.getByText("Bestand in Zentralküche")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Butter" })).toHaveCount(0);
    await page.goto(`/ingredients/${sid("ing-butter")}?tab=outlets`);
    await page.getByRole("checkbox", { name: "Zentralküche" }).click();
    await expect(page.getByText("Wird in Zentralküche geführt")).toBeVisible();
  });

  test("V-N1 mit Bestand nicht ausblendbar, Team-Konto nur lesend", async ({ page, login }) => {
    await page.goto(`/ingredients/${sid("ing-butter")}?tab=outlets`);
    await page.getByRole("checkbox", { name: "Küche Mitte" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "noch Bestand" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Küche Mitte" })).toBeChecked();
    await login("staff");
    await page.goto(`/ingredients/${sid("ing-butter")}`);
    await expect(page.getByRole("tab", { name: "Outlets" })).toHaveCount(0); // staff sees one outlet only
  });
});
