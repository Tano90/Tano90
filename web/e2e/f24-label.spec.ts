import { db, expect, reseed, sid, test } from "./fixtures";

test.describe("S09 Etikett", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("L-H1 Zutaten nach Gewicht, Allergene über Unterrezepte, Nährwerte, Hinweis auf Lücken", async ({ page, axe }) => {
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await page.getByRole("link", { name: "Etikett" }).click();
    await expect(page.getByRole("heading", { name: "Etikett: Linsensuppe mit Kreuzkümmel", level: 1 })).toBeVisible();
    const label = page.getByRole("article", { name: "Etikett" });
    await expect(label).toContainText("Zutaten: Rote Linsen,"); // 800 g, the heaviest
    await expect(label).toContainText("enthält Milch, Sellerie"); // cream; celery comes from the stock (sub-recipe)
    await expect(label).toContainText("Spuren enthalten von Gluten");
    await expect(label.getByRole("columnheader", { name: "je 100 g" })).toBeVisible();
    await expect(label.getByRole("row", { name: /Energie/ })).toContainText("kcal");
    await expect(page.getByText(/Ohne Nährwerte: Kreuzkümmel gemahlen/)).toBeVisible();
    await axe();
  });

  test("L-E1 beim Drucken nur das Etikett", async ({ page }) => {
    await page.goto(`/recipes/${sid("rec-apfelkuchen")}/label`);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("article", { name: "Etikett" })).toBeVisible();
    await expect(page.getByRole("navigation").first()).toBeHidden();
    await expect(page.getByText(/Ohne Nährwerte|Nicht geprüft/)).toBeHidden();
  });

  test("L-E2 ungeprüftes Allergen wird nicht als frei gedruckt", async ({ page }) => {
    await db()`update ingredient_allergens set status = 'unknown' where ingredient_id = ${sid("ing-sahne")} and allergen = 'milk'`;
    await db()`update ingredient_allergens set status = 'free' where ingredient_id = ${sid("ing-sellerie")}`;
    await page.goto(`/recipes/${sid("rec-linsensuppe")}/label`);
    await expect(page.getByText(/Nicht geprüft: .*Milch/)).toBeVisible();
    await expect(page.getByRole("article", { name: "Etikett" })).not.toContainText("keine der 14");
  });

  test("L-N1 archiviertes oder fremdes Rezept", async ({ page, login }) => {
    await login("stranger");
    await page.goto(`/recipes/${sid("rec-linsensuppe")}/label`);
    await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
  });
});
