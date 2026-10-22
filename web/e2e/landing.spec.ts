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
    for (const h of ["GLB Report Studio", "Service Funnel & Sales Forecast", "Deckungsbeiträge & Zielpreise", "Renner-Penner & Aktionsplan", "Tagesfunnel aus Kassendaten", "Funnel Quest – Training"]) await expect(features.getByRole("heading", { name: h })).toBeVisible();
    await expect(features.getByRole("img")).toHaveCount(6);
    const board = page.getByRole("region", { name: "Ein Board statt zehn Listen" });
    for (const h of ["Management-Cockpit", "Menu Engineering", "Team & Aufgaben, Mindestbestände", "KI-Marktcheck"]) await expect(board.getByRole("heading", { name: h })).toBeVisible();
    await expect(board.getByRole("img")).toHaveCount(12);
    const video = page.locator("video");
    await expect(video).toHaveAttribute("poster", "/landing/suite-reports.png");
    await expect(video.locator("track[kind=captions]")).toHaveAttribute("src", "/landing/suite-rundgang.vtt");
    expect((await page.request.get("/landing/suite-rundgang.mp4")).status()).toBe(200);
    for (const old of ["HACCP", "Zentralküche", "DATEV", "Barcode", "Allergene"]) await expect(page.locator("body")).not.toContainText(old);
  });

  test("L01-E4 Startseite beige, dunkle Schrift, Grün als Akzent; Suite und Rechtsseiten behalten ihr Design", async ({ page }) => {
    await page.goto("/");
    const look = await page.evaluate(() => {
      const root = document.querySelector(".landing-beige") as HTMLElement;
      const cta = [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("Live ausprobieren")) as HTMLElement;
      return { bg: getComputedStyle(root).backgroundColor, text: getComputedStyle(root).color, cta: getComputedStyle(cta).backgroundColor, h1: getComputedStyle(document.querySelector("h1")!).fontFamily };
    });
    expect(look.bg).toBe("rgb(247, 242, 232)");
    expect(look.text).toBe("rgb(34, 28, 21)");
    expect(look.cta).toBe("rgb(15, 106, 100)");
    expect(look.h1).toContain("Fraunces");
    // no moving ticker, no glow on the start page
    expect(await page.locator(".animate-marquee, .shadow-glow").count()).toBe(0);
    // real views of the application for concrete use cases
    const cases = page.getByRole("region", { name: "Vier Fragen, die jede Woche kommen." });
    await expect(cases.getByRole("img")).toHaveCount(4);
    for (const h of ["Wie lief der Monat, und wo fehlen noch Kosten?", "Welcher Artikel wächst, welcher verliert?", "Was verlangen andere für Vergleichbares?", "Was ist in welchem Outlet offen?"]) await expect(cases.getByRole("heading", { name: h })).toBeVisible();
    // every in-page link has its target
    const anchors = await page.locator('a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const h of anchors) expect(await page.locator(h).count(), h).toBe(1);
    // the legal pages keep the app colours
    await page.goto("/legal/imprint");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");
  });

  test("L01-N1 Rechtsseiten verlinkt", async ({ page }) => {
    await page.goto("/");
    for (const name of ["Datenschutz", "Nutzungsbedingungen", "Impressum"]) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", /\/legal\//);
    }
  });
});
