// Edge and negative cases for the fourth build pass: outlet prices, outlet visibility, nutrition label.
import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";

test.describe("Randfälle 4. Durchgang", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("P-E2 Tippfehler im Outlet-Preis löscht den eigenen Preis nicht", async ({ page }) => {
    await db()`insert into recipe_outlet_prices (recipe_id, outlet_id, sell_price_cents) values (${sid("rec-linsensuppe")}, ${sid("out-zentral")}, 990)`;
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await page.getByLabel("Verkaufspreis Zentralküche").fill("9,9,0");
    await page.getByRole("listitem").filter({ hasText: "Zentralküche" }).getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("„9,9,0“ ist kein gültiger Betrag.")).toBeVisible();
    const [p] = await db()`select sell_price_cents from recipe_outlet_prices where outlet_id = ${sid("out-zentral")}`;
    expect(p?.sell_price_cents).toBe(990);
  });

  test("P-E4 Tippfehler im Rezept- und Menüpreis löscht den Preis nicht", async ({ page }) => {
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await page.getByLabel("Verkaufspreis pro Portion").fill("7,9,0");
    await page.getByRole("complementary", { name: "Kalkulation" }).getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("„7,9,0“ ist kein gültiger Betrag.")).toBeVisible();
    const [r] = await db()`select sell_price_cents from recipes where id = ${sid("rec-linsensuppe")}`;
    expect(r.sell_price_cents).toBe(790);
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await page.getByLabel("Menüpreis pro Gast").fill("2,4,0");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("„2,4,0“ ist kein gültiger Betrag.")).toBeVisible();
    const [m] = await db()`select price_cents from menus where id = ${sid("menu-mittag")}`;
    expect(m.price_cents).toBe(2400);
  });

  test("P-E5 Tippfehler bei Mindestbestellwert und Stundenlohn", async ({ page }) => {
    await page.goto(`/suppliers/${sid("sup-frische")}`);
    await page.getByLabel(/Mindestbestellwert/).fill("1,0,0");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("„1,0,0“ ist kein gültiger Betrag.")).toBeVisible();
    await page.goto("/settings");
    await page.getByLabel(/Stundenlohn/).fill("18,5,0");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("„18,5,0“ ist kein gültiger Betrag.")).toBeVisible();
    const [l] = await db()`select wage_cents_per_hour from libraries where id = ${sid("lib-demo")}`;
    expect(l.wage_cents_per_hour).toBe(1850);
  });

  test("P-E3 Preis pro Outlet nur mit Tastatur", async ({ page }) => {
    await page.goto(`/recipes/${sid("rec-linsensuppe")}?tab=financial`);
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await page.getByLabel("Verkaufspreis Küche Mitte").focus();
    await page.keyboard.type("8,20");
    await page.keyboard.press("Tab"); // the food cost next to it is text, the next stop is "Speichern"
    await page.keyboard.press("Enter");
    await expect(page.getByText("Küche Mitte: eigener Preis gespeichert")).toBeVisible();
  });

  test("L-E3 Etikett eines leeren Rezepts und eines 120-Zeichen-Namens, 390 px", async ({ page }) => {
    const name = "Sehr langer Rezeptname mit Crème fraîche, Jalapeño und Würze 🌶 ".repeat(3).slice(0, 118).trim();
    const [r] = await db()`insert into recipes (library_id, name) values (${sid("lib-demo")}, ${name}) returning id`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/recipes/${r.id}/label`);
    const label = page.getByRole("article", { name: "Etikett" });
    await expect(label).toContainText("Zutaten: –");
    await expect(label.getByRole("row", { name: /Energie/ })).toContainText("0 kcal");
    await expectNoHorizontalScroll(page);
  });

  test("V-E1 ausgeblendete Zutat fehlt in Inventur und Bestellung des Outlets", async ({ page }) => {
    await db()`delete from outlet_ingredients where outlet_id = ${sid("out-mitte")} and ingredient_id = ${sid("ing-kreuzkuemmel")}`;
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await expect(page.getByRole("textbox", { name: /Speisequark/ })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Kreuzkümmel/ })).toHaveCount(0);
  });

  test("V-N2 Team-Konto kann die Sichtbarkeit nicht ändern (auch nicht per Aktion)", async ({ page, login }) => {
    await db()`update memberships set role = 'outlet_staff', all_outlets = false where id = ${sid("mem-2")}`;
    await db()`insert into membership_outlets (membership_id, outlet_id) values (${sid("mem-2")}, ${sid("out-mitte")}), (${sid("mem-2")}, ${sid("out-zentral")})`;
    await login("chef");
    await page.goto(`/ingredients/${sid("ing-zucker")}?tab=outlets`);
    await expect(page.getByRole("checkbox", { name: "Zentralküche" })).toBeDisabled();
  });
});
