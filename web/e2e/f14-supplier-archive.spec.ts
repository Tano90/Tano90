import { db, expect, reseed, sid, test } from "./fixtures";

test.describe("S10/S11 Lieferanten archivieren", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("chef");
  });

  test("S11-H1 archivieren entfernt Lieferant und seine Preise, Rezepte zeigen die Lücke", async ({ page }) => {
    await page.goto(`/suppliers/${sid("sup-frische")}`);
    await page.getByRole("button", { name: "Archivieren" }).click();
    await expect(page.getByRole("dialog")).toContainText("Die 7 Preise dieses Lieferanten werden mitarchiviert");
    await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
    await page.waitForURL("/suppliers");
    await expect(page.getByRole("link", { name: "Frischehof Lindner" })).toHaveCount(0);
    await page.goto(`/recipes/${sid("rec-fond")}`);
    await expect(page.getByText("Für „Zwiebeln“ ist kein Preis hinterlegt.")).toBeVisible();
    const [{ n }] = await db()`select count(*)::int as n from stock_items where supplier_id = ${sid("sup-frische")} and archived_at is null`;
    expect(n).toBe(0);
  });

  test("S11-N1 mit offener Bestellung wird nicht archiviert", async ({ page }) => {
    await page.goto(`/suppliers/${sid("sup-gross")}`);
    await page.getByRole("button", { name: "Archivieren" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
    await expect(page.getByText(/noch 1 offene Bestellung/)).toBeVisible();
    const [{ archived }] = await db()`select archived_at is not null as archived from suppliers where id = ${sid("sup-gross")}`;
    expect(archived).toBe(false);
  });

  test("S11-N2 Team-Konto kann nicht archivieren", async ({ page, login }) => {
    await login("staff");
    await page.goto(`/suppliers/${sid("sup-frische")}`);
    await expect(page.getByRole("button", { name: "Archivieren" })).toHaveCount(0);
  });
});
