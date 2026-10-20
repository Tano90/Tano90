import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";

const euro = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));

test.describe("S07/S08 Menüs", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("S07-H1 Liste zeigt Wareneinsatz und Marge, Stückliste rechnet für Gäste hoch", async ({ page, axe }) => {
    await page.goto("/menus");
    const row = page.getByRole("row").filter({ hasText: "Mittagsmenü" });
    await expect(row).toContainText("3 · 3 Gerichte");
    await expect(row).toContainText("24,00");
    await axe();
    await row.getByRole("link", { name: "Mittagsmenü" }).click();
    await expect(page.getByRole("heading", { name: "Mittagsmenü", level: 1 })).toBeVisible();
    const bom = page.getByRole("table", { name: "Stückliste" });
    // Sub-recipes are exploded: the stock in the lentil soup brings in celery, the herb quark brings quark.
    await expect(bom.getByRole("row").filter({ hasText: "Knollensellerie" })).toHaveCount(1);
    await expect(bom.getByRole("row").filter({ hasText: "Speisequark" })).toBeVisible();
    const one = euro(await bom.locator("tfoot").innerText());
    await page.getByLabel("Gäste").fill("10");
    await page.getByRole("button", { name: "Hochrechnen" }).click();
    await page.waitForURL(/servings=10/);
    await expect(page.getByText("für 10 Gäste")).toBeVisible();
    const ten = euro(await bom.locator("tfoot").innerText());
    expect(ten).toBeCloseTo(one * 10, 1);
    await axe();
  });

  test("S08-H1 Menü anlegen: Gänge, Gericht, Preis, Marge", async ({ page }) => {
    await page.goto("/menus/new");
    await page.getByLabel("Name").fill("Abendmenü");
    await page.getByLabel("Menüpreis pro Gast").fill("39");
    await page.getByRole("button", { name: "Gericht zu Vorspeise" }).click();
    await page.getByLabel("Gericht 1 in Vorspeise", { exact: true }).selectOption({ label: "Linsensuppe mit Kreuzkümmel" });
    await page.getByRole("button", { name: "Gericht zu Hauptgang" }).click();
    await page.getByLabel("Gericht 1 in Hauptgang", { exact: true }).selectOption({ label: "Ofengemüse mit Kräuterquark" });
    await page.getByLabel("Portionen für Gericht 1 in Hauptgang").fill("2");
    await page.getByRole("button", { name: "Dessert entfernen" }).click();
    await expect(page.getByRole("complementary", { name: "Kalkulation" })).toContainText("Marge");
    await page.getByRole("button", { name: "Menü anlegen" }).click();
    await page.waitForURL(/\/menus\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Menü gespeichert")).toBeVisible();
    const [m] = await db()`select id, price_cents from menus where name = 'Abendmenü'`;
    expect(m.price_cents).toBe(3900);
    const items = await db()`select c.name, mi.portions from menu_items mi join menu_courses c on c.id = mi.course_id where c.menu_id = ${m.id} order by c.position`;
    expect(items.map((i) => `${i.name}:${Number(i.portions)}`)).toEqual(["Vorspeise:1", "Hauptgang:2"]);
    await page.goto("/menus");
    await expect(page.getByRole("row").filter({ hasText: "Abendmenü" })).toContainText("2 · 2 Gerichte");
  });

  test("S08-H2 Preisänderung beim Lieferanten rechnet das Menü neu", async ({ page }) => {
    await page.goto("/menus");
    const cost = async () => euro(await page.getByRole("row").filter({ hasText: "Mittagsmenü" }).getByRole("cell").nth(3).innerText());
    const before = await cost();
    await db()`update stock_items set price_cents = price_cents * 3 where id = ${sid("ing-linsen-si")}`;
    await page.reload();
    expect(await cost()).toBeGreaterThan(before);
  });

  test("S08-N1 Pflichtfelder und gelöschte Rezepte", async ({ page }) => {
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await page.getByLabel("Name").fill("");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Bitte einen Namen angeben." })).toBeVisible();
    // A recipe on a menu cannot be archived out from under it.
    await page.goto(`/recipes/${sid("rec-apfelkuchen")}`);
    await page.getByRole("button", { name: "Archivieren" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
    await expect(page.getByText(/Menü „Mittagsmenü“/)).toBeVisible();
  });

  test("S08-N2 Team sieht Menüs nur lesend", async ({ page, login }) => {
    await login("staff");
    await page.goto("/menus");
    await expect(page.getByRole("link", { name: "Menü anlegen" })).toHaveCount(0);
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await expect(page.getByLabel("Name")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Speichern" })).toHaveCount(0);
  });

  test("S08-E1 390 px ohne Querscrollen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await expect(page.getByRole("heading", { name: "Mittagsmenü", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
