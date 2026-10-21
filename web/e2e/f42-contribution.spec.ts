import { db, expect, reseed, test } from "./fixtures";

test.describe("Deckungsbeitragsrechnung", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("DB-H1 variable Kosten, Fixkosten, Ergebnis und Zielpreis", async ({ page, axe }) => {
    await page.goto("/analytics/menu-engineering");
    await page.getByRole("link", { name: "Deckungsbeitrag" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deckungsbeitrag");
    const items = page.getByRole("region", { name: /Je Artikel/ });
    await expect(items.getByRole("row").nth(1)).toContainText("Linsensuppe");
    await expect(items.getByRole("row").nth(2)).toContainText("Ofengemüse");

    await page.getByLabel("Anteil vom Umsatz (%)").fill("2,5");
    await page.getByLabel("Pro Artikel (€)").fill("0,10");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Variable Kosten gespeichert")).toBeVisible();
    const [st] = await db()`select variable_revenue_pct::float as pct, per_item_cents from cost_settings`;
    expect(st).toEqual({ pct: 2.5, per_item_cents: 10 });

    await page.getByRole("button", { name: "Fixkosten", exact: true }).click();
    const d = page.getByRole("dialog", { name: "Fixkosten anlegen" });
    await d.getByLabel("Bezeichnung").fill("Miete");
    await d.getByLabel("Betrag pro Monat (€, netto)").fill("3.100,00");
    await axe();
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Fixkosten gespeichert")).toBeVisible();
    const result = page.getByRole("region", { name: "Ergebnis" });
    await expect(result).toContainText("Fixkosten nicht gedeckt");
    await expect(page.getByRole("region", { name: "Kosten" })).toContainText("3.100,00 €");

    const target = page.getByRole("region", { name: "Zielpreis berechnen" });
    await target.getByLabel("Wareneinsatz pro Portion (€)").fill("2,80");
    await target.getByLabel("MwSt.").selectOption("700");
    await target.getByLabel("Ziel-Wareneinsatz (%)").fill("28");
    // 2,80 / 28 % = 10,00 net + 0,10 / 97,5 % ≈ 10,10 net → 10,81 gross → 10,90
    await expect(target.getByRole("status")).toContainText("10,90 €");
    await axe();
  });

  test("DB-N1 Team-Konto sieht keine Kosten", async ({ page, login }) => {
    await login("staff");
    await page.goto("/analytics/contribution");
    await expect(page.getByText(/Den Deckungsbeitrag sehen Inhaber/)).toBeVisible();
  });
});
