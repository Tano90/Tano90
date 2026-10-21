import { expect, expectNoHorizontalScroll, reseed, stockQuantity, test } from "./fixtures";

test.describe("S23 Zentralküche", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("Z-H1 Outlet fordert an und storniert", async ({ page, axe }) => {
    await page.goto("/production");
    await expect(page.getByRole("heading", { name: "Bei Zentralküche anfordern" })).toBeVisible();
    const mine = page.getByRole("region", { name: "Eigene Anforderungen" });
    await expect(mine).toContainText("2 × Kräuterquark");
    await page.getByLabel("Rezept").selectOption({ label: "Linsensuppe mit Kreuzkümmel" });
    await page.getByLabel("Portionen").fill("12.5");
    await expect(page.getByLabel("Portionen")).toHaveValue("12,5");
    await page.getByLabel("Hinweis (optional)").fill("Für das Catering 🎉");
    await axe();
    await page.getByRole("button", { name: "Anfordern" }).click();
    await expect(page.getByText("Bei Zentralküche angefordert")).toBeVisible();
    await expect(mine).toContainText("12,5 × Linsensuppe");
    await expect(mine.getByRole("listitem")).toHaveCount(3);
    await mine.getByRole("button", { name: /^Kräuterquark für .* stornieren$/ }).click();
    await expect(mine.getByRole("listitem").filter({ hasText: "Kräuterquark" })).toContainText("storniert");
  });

  test("Z-N1 ohne Rezept und ohne Portionen geht nichts raus", async ({ page }) => {
    await page.goto("/production");
    await page.getByRole("button", { name: "Anfordern" }).click();
    await expect(page.getByText("Bitte ein Rezept wählen.")).toBeVisible();
    await page.getByLabel("Rezept").selectOption({ label: "Linsensuppe mit Kreuzkümmel" });
    await page.getByRole("button", { name: "Anfordern" }).click();
    await expect(page.getByText("Die Menge muss größer als 0 sein.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Eigene Anforderungen" }).getByRole("listitem")).toHaveCount(2);
  });

  test("Z-H2 Zentralküche sieht den Bedarf, produziert und liefert", async ({ page, axe }) => {
    await page.goto("/production");
    await page.getByLabel("Outlet").selectOption({ label: "Zentralküche" });
    const plan = page.getByRole("region", { name: "Produktionsplan" });
    await expect(plan).toContainText("2 × Kräuterquark");
    await expect(plan).toContainText("für Küche Mitte");
    await expect(plan).toContainText("20 × Linsensuppe");
    await expect(plan.getByText(/Rohware für die angeforderten Rezepte/).first()).toBeVisible();
    await axe();
    const before = await stockQuantity("Speisequark 20 %", "out-zentral");
    await plan.getByRole("checkbox", { name: /Kräuterquark/ }).check();
    await plan.getByRole("button", { name: "Produzieren (1)" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Produzieren" }).click();
    await expect(page.getByText("1 Anforderungen produziert")).toBeVisible();
    const row = plan.getByRole("listitem").filter({ hasText: "Kräuterquark" });
    await expect(row).toContainText("produziert");
    await expect(row).toContainText("€");
    expect(await stockQuantity("Speisequark 20 %", "out-zentral")).toBeLessThan(before);
    await row.getByRole("checkbox").check();
    await plan.getByRole("button", { name: "Geliefert (1)" }).click();
    await expect(page.getByText("1 als geliefert markiert")).toBeVisible();
    await expect(plan).not.toContainText("Kräuterquark");
  });

  test("Z-E1 mobile Breite", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/production");
    await expect(page.getByRole("heading", { name: "Eigene Anforderungen" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
