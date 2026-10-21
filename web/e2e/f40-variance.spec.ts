import { expect, reseed, stockQuantity, test } from "./fixtures";

test.describe("Soll-Ist-Vergleich", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("SI-H1 Inventur mit Fehlmenge erscheint als Verlust in Euro, größter zuerst", async ({ page, axe }) => {
    const before = await stockQuantity("Speisequark 20 %");
    expect(before).toBeGreaterThan(1000);
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await page.getByRole("textbox", { name: /Speisequark/ }).fill("1");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await page.getByRole("button", { name: "Inventur abschließen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Abschließen" }).click();
    await page.waitForURL("/stock");
    await page.goto("/stock/variance");
    await expect(page.getByText(/keine Inventur abgeschlossen/)).toHaveCount(0);
    const first = page.getByRole("region", { name: /Je Zutat/ }).getByRole("row").nth(1);
    await expect(first).toContainText("Speisequark 20 %");
    await expect(first).toContainText("−");
    await expect(page.getByRole("region", { name: "Summen" })).toContainText("Zutaten mit Fehlmenge");
    await axe();
  });

  test("SI-H2 Seite erreichbar, Hinweis ohne Inventur, verlinkt aus Lager und Bericht", async ({ page, axe }) => {
    await page.goto("/stock");
    await page.getByRole("link", { name: "Soll-Ist" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Soll-Ist-Vergleich");
    await expect(page.getByRole("region", { name: "Summen" })).toContainText("Soll-Verbrauch");
    await axe();
    await page.goto("/stock/report");
    await page.getByRole("link", { name: "Soll-Ist-Vergleich" }).click();
    await expect(page).toHaveURL(/\/stock\/variance\?from=/);
  });
});
