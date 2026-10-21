import { db, expect, reseed, test } from "./fixtures";

const CSV = [
  "Rezept;Portionen;Kategorie;Art;Zutat;Menge;Einheit;Verkaufspreis;Zubereitung",
  "Linsenfond;10;Grundrezepte;Grundrezept;Karotten;500;g;;Gemüse 1 Stunde auskochen.",
  ";;;;Zwiebeln;300;g;;",
  ";;;;Lauch;0,2;kg;;",
  "Linsenteller;1;Hauptgerichte;;Rote Linsen;80;g;11,50;",
  ";;;;Linsenfond;1;Portion;;",
  ";;;;Parmesan;10;g;;",
  "Linsensuppe mit Kreuzkümmel;4;;;Rote Linsen;200;g;;",
].join("\r\n");

test.describe("Rezepte aus Excel/CSV", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("RI-H1 Vorschau, unbekannte Zutat, Grundrezept aus der Datei, Anlegen", async ({ page, axe }) => {
    await page.goto("/recipes");
    await page.getByRole("link", { name: "Aus Excel importieren" }).click();
    await page.getByLabel("Rezepte hochladen").setInputFiles({ name: "rezepte.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    const preview = page.getByRole("region", { name: /Vorschau/ });
    await expect(preview).toContainText("Zutat „Parmesan“ unbekannt");
    await expect(preview.getByRole("listitem").filter({ hasText: "Linsensuppe mit Kreuzkümmel" })).toContainText("gibt es schon");
    await expect(page.getByRole("button", { name: "1 Rezept anlegen" })).toBeVisible();
    await axe();
    await page.getByLabel(/Unbekannte Zutaten anlegen/).check();
    await page.getByRole("button", { name: "2 Rezepte anlegen" }).click();
    await expect(page.getByText(/2 Rezepte angelegt, 1 neue Zutat \(ohne Preis\), 1 gab es schon\./)).toBeVisible();

    const [plate] = await db()`select id, portions, sell_price_cents, product_type from recipes where name = 'Linsenteller'`;
    expect(plate).toMatchObject({ sell_price_cents: 1150, product_type: "finished" });
    const lines = await db()`select coalesce(i.name, r.name) as name, l.quantity::float as quantity, l.unit from recipe_lines l left join ingredients i on i.id = l.ingredient_id left join recipes r on r.id = l.sub_recipe_id where l.recipe_id = ${plate.id} order by l.position`;
    expect(lines).toEqual([{ name: "Rote Linsen", quantity: 80, unit: "g" }, { name: "Linsenfond", quantity: 1, unit: "portion" }, { name: "Parmesan", quantity: 10, unit: "g" }]);
    const [fond] = await db()`select product_type, instructions from recipes where name = 'Linsenfond'`;
    expect(fond).toMatchObject({ product_type: "semi_finished", instructions: "Gemüse 1 Stunde auskochen." });

    await page.getByRole("link", { name: "Zu den Rezepten" }).click();
    await expect(page.getByRole("link", { name: "Linsenteller" })).toBeVisible();
  });
});
