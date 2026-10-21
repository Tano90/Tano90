import { expect, expectNoHorizontalScroll, test } from "./fixtures";

test.describe("L01 Landingpage", () => {
  test("L01-H1 erreichbar ohne Anmeldung, barrierefrei, führt zur Registrierung", async ({ page, axe }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Was jeder Teller kostet. Live.");
    await expect(page.getByRole("img", { name: /Rezept „Linsensuppe“ in Mirepa/ })).toBeVisible();
    await axe();
    await page.getByRole("link", { name: /14 Tage kostenlos testen/ }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("L01-E1 Preisbeispiel stimmt mit den Tarifen überein", async ({ page }) => {
    await page.goto("/#preise");
    const pricing = page.getByRole("region", { name: "Preise" });
    await expect(pricing).toContainText("49 €");
    await expect(pricing).toContainText("+ 39 €");
    await expect(pricing).toContainText("drei Standorte = 127 € pro Monat");
  });

  test("L01-E2 Handybreite, FAQ per Tastatur", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expectNoHorizontalScroll(page);
    const q = page.getByText("Wie kündige ich?");
    await q.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Mit einem Klick unter Einstellungen/)).toBeVisible();
  });

  test("L01-E3 Funktionen und FAQ nennen, was gebaut ist", async ({ page }) => {
    await page.goto("/");
    const features = page.getByRole("region", { name: /Gebaut für die Momente/ });
    for (const title of ["Zentralküche mit Plan", "Rechnung gegen Lieferung", "HACCP im Grundpreis"]) await expect(features.getByRole("heading", { name: title })).toBeVisible();
    await page.getByText("Kann ich meine Zutaten und Preise importieren?").click();
    await expect(page.getByText(/^Ja\. Die Preisliste deines Lieferanten/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Noch nicht.");
  });

  test("L01-N1 Rechtsseiten verlinkt", async ({ page }) => {
    await page.goto("/");
    for (const name of ["Datenschutz", "Nutzungsbedingungen", "Impressum"]) {
      await expect(page.getByRole("link", { name })).toHaveAttribute("href", /\/legal\//);
    }
  });
});
