import { expect, expectNoHorizontalScroll, test } from "./fixtures";

const PAGES = [
  ["hotel", "F&B und Housekeeping für Hotels. In einem Werkzeug."],
  ["restaurant", "Der echte Wareneinsatz, bevor die Karte gedruckt ist."],
  ["catering", "Vom Angebot bis zur Rohware: jedes Menü durchgerechnet."],
  ["kantine", /verpflegung mit festen Budgets\./],
] as const;

test.describe("L02 Branchenseiten", () => {
  test("L02-H1 Startseite verlinkt alle vier Branchen", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Vom Bistro bis zum Hotel mit Bankett" });
    for (const name of ["Hotel", "Restaurant", "Catering", "Kantine"]) await expect(section.getByRole("link", { name: new RegExp(`Mirepa für ${name}`) })).toBeVisible();
    await section.getByRole("link", { name: /Mirepa für Hotel/ }).click();
    await expect(page).toHaveURL(/\/branchen\/hotel$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PAGES[0][1]);
  });

  for (const [slug, title] of PAGES) {
    test(`L02-H2 ${slug}: erreichbar, barrierefrei, mit Anmeldung`, async ({ page, axe }) => {
      await page.goto(`/branchen/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await axe();
      await page.getByRole("main").getByRole("link", { name: /14 Tage kostenlos testen/ }).click();
      await expect(page).toHaveURL(/\/signup$/);
    });
  }

  test("L02-E1 Hotel nennt Controlling, Housekeeping und die Grenzen", async ({ page }) => {
    await page.goto("/branchen/hotel");
    for (const h of ["F&B-Controlling je Kostenstelle", "Housekeeping"]) await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    await expect(page.getByText(/Noch keine Anbindung an das Hotelprogramm/)).toBeVisible();
    await expect(page.getByText(/keine Finanzbuchhaltung/)).toBeVisible();
  });

  test("L02-E2 Handybreite ohne seitliches Scrollen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [slug] of PAGES) {
      await page.goto(`/branchen/${slug}`);
      await expectNoHorizontalScroll(page);
    }
  });

  test("L02-N1 unbekannte Branche gibt 404", async ({ request }) => {
    expect((await request.get("/branchen/zahnarzt")).status()).toBe(404);
  });
});
