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
    // Oct 2026 plan model, published as preliminary until the plan details are decided
    for (const x of ["Standard", "89,00 €", "Premium", "109,99 €", "zuzüglich 2,99 € pro Nutzer und Monat", "Individuelle Lösungen", "29,99 €", "Vorläufige Preise"])
      await expect(pricing).toContainText(x);
    for (const old of ["49 €", "39 €", "490 €", "2 Monate geschenkt", "§ 19"]) await expect(pricing).not.toContainText(old);
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

  test("L01-E3 kurze Antworten zuerst, vier Abläufe mit Bild, Bereiche als kurzer Index; Video mit Untertiteln", async ({ page }) => {
    await page.goto("/");
    const answers = page.getByRole("region", { name: "Kurz beantwortet" });
    for (const q of ["Welche Entscheidung erleichtert die Suite?", "Wie kommen meine Daten hinein?", "Wie viel laufende Arbeit entsteht?", "Was kostet das?", "Wie teste ich mit eigenen Daten?"])
      await expect(answers.getByText(q)).toBeVisible();
    const features = page.getByRole("region", { name: "Vom Service bis zum Ergebnis." });
    for (const h of ["Report Studio", "Deckungsbeiträge & Zielpreise", "Bestell-Forecast", "Service Funnel"]) await expect(features.getByRole("heading", { name: h })).toBeVisible();
    await expect(features.getByRole("img")).toHaveCount(4);
    const board = page.getByRole("region", { name: "Ein Board statt zehn Listen" });
    for (const a of ["Übersicht", "Verkauf & Preise", "Einkauf & Lager", "Service & Team", "Einrichtung & Daten"]) await expect(board.getByText(a, { exact: true })).toBeVisible();
    await expect(board.getByRole("img")).toHaveCount(0);
    // the demo appointment stays visible: header and hero lead to it
    await expect(page.getByRole("link", { name: "Vorführung anfragen" })).toHaveAttribute("href", "#anfrage");
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
