import { expect, expectNoHorizontalScroll, test } from "./fixtures";

test.describe("L01 Landingpage", () => {
  test("L01-H1 erreichbar ohne Anmeldung, barrierefrei, führt in die Suite", async ({ page, axe }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gastro führen mit echten Zahlen.");
    await expect(page.getByRole("img", { name: /Dashboard der GLB AI Suite/ })).toBeVisible();
    await axe();
    await expect(page.getByRole("link", { name: /Live ausprobieren/ }).first()).toHaveAttribute("href", "/suite");
    await expect(page.getByRole("link", { name: "Anmelden" })).toHaveAttribute("href", "/suite");
  });

  test("L01-E1 Preise stimmen mit den Tarifen überein", async ({ page }) => {
    await page.goto("/#preise");
    const pricing = page.getByRole("region", { name: "Preise" });
    await expect(pricing).toContainText("49 €");
    await expect(pricing).toContainText("+ 39 €");
  });

  test("L01-E2 Handybreite, FAQ per Tastatur", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expectNoHorizontalScroll(page);
    const q = page.getByText("Wer sieht welche Zahlen?");
    await q.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Es gibt sieben Rollen/)).toBeVisible();
  });

  test("L01-E3 nur Module von v0.8, jedes mit Bild; Video mit Untertiteln", async ({ page }) => {
    await page.goto("/");
    const features = page.getByRole("region", { name: "Vom Service bis zum Ergebnis." });
    for (const h of ["GLB Report Studio", "Service Funnel & Sales Forecast", "Deckungsbeiträge & Zielpreise", "Renner-Penner & Aktionsplan"]) await expect(features.getByRole("heading", { name: h })).toBeVisible();
    await expect(features.getByRole("img")).toHaveCount(4);
    await expect(page.getByRole("region", { name: "Ein Board statt zehn Listen" }).getByRole("img")).toHaveCount(8);
    const video = page.locator("video");
    await expect(video).toHaveAttribute("poster", "/landing/suite-reports.png");
    await expect(video.locator("track[kind=captions]")).toHaveAttribute("src", "/landing/suite-rundgang.vtt");
    expect((await page.request.get("/landing/suite-rundgang.mp4")).status()).toBe(200);
    for (const old of ["HACCP", "Zentralküche", "DATEV", "Barcode", "Allergene"]) await expect(page.locator("body")).not.toContainText(old);
  });

  test("L01-N1 Rechtsseiten verlinkt", async ({ page }) => {
    await page.goto("/");
    for (const name of ["Datenschutz", "Nutzungsbedingungen", "Impressum"]) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", /\/legal\//);
    }
  });
});
