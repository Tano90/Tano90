import { expect, expectNoHorizontalScroll, test } from "./fixtures";

const PAGES = [
  ["/legal/imprint", "Impressum"],
  ["/legal/privacy", "Datenschutzerklärung"],
  ["/legal/terms", "Nutzungsbedingungen"],
  ["/legal/dpa", "Vertrag zur Auftragsverarbeitung"],
] as const;

test.describe("L02 Rechtsseiten", () => {
  for (const [path, title] of PAGES) {
    test(`L02 ${title}: erreichbar, barrierefrei, 390 px`, async ({ page, axe }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await axe();
      await page.setViewportSize({ width: 390, height: 844 });
      await expectNoHorizontalScroll(page);
    });
  }

  test("L02-E1 Impressum vollständig, keine Lücke markiert", async ({ page }) => {
    await page.goto("/legal/imprint");
    await expect(page.getByRole("note")).toHaveCount(0); // all operator details are filled in
    await expect(page.locator("main")).not.toContainText("[fehlt");
    await expect(page.locator("main")).toContainText("mattiassegato1990@gmail.com");
    await expect(page.locator("main")).toContainText("0178 2498827");
    await expect(page.locator("main")).toContainText("Mattias Segato Consulting (Einzelunternehmen)");
    await expect(page.locator("main")).toContainText("Inhaber: Mattias Segato");
    await expect(page.locator("main")).toContainText("Hohenzollernstraße 12");
  });

  test("L02-E2 Datenschutz nennt jeden Dienstleister und die Cookies, AVV dieselben", async ({ page }) => {
    for (const path of ["/legal/privacy", "/legal/dpa"]) {
      await page.goto(path);
      for (const name of ["Supabase Inc.", "Vercel Inc.", "Stripe Payments Europe Ltd.", "Resend Inc."]) await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
    }
    await page.goto("/legal/privacy");
    await expect(page.getByText("kl_outlet")).toBeVisible();
    await expect(page.locator("main")).toContainText(/die dein Betrieb in \S+ eingetragen hat/); // no word glued to the app name
    await expect(page.getByRole("link", { name: "Auftragsverarbeitung" })).toHaveAttribute("href", "/legal/dpa");
  });

  test("L02-E3 Preise in den Bedingungen kommen aus derselben Quelle wie die Preisseite", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByText(/derzeit 49\s€ im Monat für den ersten Standort und 39\s€ für jeden weiteren/)).toBeVisible();
    await expect(page.locator("main")).toContainText("Als Kleinunternehmer nach § 19 UStG berechnen wir keine Umsatzsteuer");
    await page.goto("/#preise");
    await expect(page.getByRole("region", { name: "Preise" })).toContainText("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");
    await expect(page.getByRole("region", { name: "Preise" })).not.toContainText("MwSt");
  });
});
