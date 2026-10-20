import { db, expect, reseed, sid, test } from "./fixtures";

test.describe("S06 Verkaufspreis pro Outlet", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("P-H1 eigener Preis für ein Outlet, Liste zeigt ihn dort", async ({ page, axe }) => {
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await axe();
    await page.getByLabel("Verkaufspreis Zentralküche").fill("9,50");
    await expect(page.getByLabel("Wareneinsatz Zentralküche")).not.toHaveText("–");
    await page.getByRole("listitem").filter({ hasText: "Zentralküche" }).getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Zentralküche: eigener Preis gespeichert")).toBeVisible();
    const [p] = await db()`select sell_price_cents from recipe_outlet_prices where recipe_id = ${sid("rec-linsensuppe")} and outlet_id = ${sid("out-zentral")}`;
    expect(p.sell_price_cents).toBe(950);

    await page.goto("/recipes");
    const row = page.getByRole("row").filter({ hasText: "Linsensuppe" });
    await expect(row).toContainText("7,90");
    await page.getByLabel("Outlet").selectOption({ label: "Zentralküche" });
    await expect(row).toContainText("Outlet");
    await expect(row).toContainText("9,50");
  });

  test("P-E1 leeren setzt auf den Standardpreis zurück", async ({ page }) => {
    await db()`insert into recipe_outlet_prices (recipe_id, outlet_id, sell_price_cents) values (${sid("rec-linsensuppe")}, ${sid("out-zentral")}, 990)`;
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await expect(page.getByLabel("Verkaufspreis Zentralküche")).toHaveValue("9,9");
    await page.getByLabel("Verkaufspreis Zentralküche").fill("");
    await page.getByRole("listitem").filter({ hasText: "Zentralküche" }).getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Zentralküche: Standardpreis")).toBeVisible();
    const rows = await db()`select 1 from recipe_outlet_prices`;
    expect(rows).toHaveLength(0);
  });

  test("P-N1 Team-Konto sieht Preise nur lesend", async ({ page, login }) => {
    await login("chef");
    await db()`update memberships set role = 'outlet_staff', all_outlets = false where id = ${sid("mem-2")}`;
    await db()`insert into membership_outlets (membership_id, outlet_id) values (${sid("mem-2")}, ${sid("out-mitte")}), (${sid("mem-2")}, ${sid("out-zentral")})`;
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await expect(page.getByLabel("Verkaufspreis Zentralküche")).toBeDisabled();
    await expect(page.getByRole("listitem").filter({ hasText: "Zentralküche" }).getByRole("button", { name: "Speichern" })).toHaveCount(0);
  });
});
