import { expect, expectNoHorizontalScroll, test } from "./fixtures";

test.describe("L01 Landingpage", () => {
  test("L01-H1 erreichbar ohne Anmeldung, barrierefrei, führt in die Suite", async ({ page, axe }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gastro führen mit echten Zahlen.");
    // the dashboard preview is there before the 3D scene takes over (and stays as fallback)
    await expect(page.locator("#geschichte img[alt^=\"Dashboard der GLB AI Suite\"]").first()).toBeAttached();
    await axe();
    await expect(page.getByRole("link", { name: /Demo ohne Anmeldung öffnen/ }).first()).toHaveAttribute("href", "/suite");
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
    await expect(page.getByRole("link", { name: /Mit eigenen Daten vorführen lassen/ }).first()).toHaveAttribute("href", "#anfrage");
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
      const cta = [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("Demo ohne Anmeldung öffnen")) as HTMLElement;
      return { bg: getComputedStyle(root).backgroundColor, text: getComputedStyle(root).color, cta: getComputedStyle(cta).backgroundColor, h1: getComputedStyle(document.querySelector("h1")!).fontFamily };
    });
    expect(look.bg).toBe("rgb(245, 240, 230)");
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

test.describe("L02 Tarife, Rechner und Ansprache", () => {
  test("L02-1 Standard als Einstieg, Premium hervorgehoben mit Begründung, Individuell als eigener Weg", async ({ page }) => {
    await page.goto("/#preise");
    const pricing = page.getByRole("region", { name: "Preise" });
    const cards = pricing.locator("[data-plan-card]");
    await expect(cards).toHaveCount(3);
    expect(await cards.evaluateAll((c) => c.map((x) => (x as HTMLElement).dataset.planCard))).toEqual(["standard", "premium", "individual"]);
    const premium = pricing.locator('[data-plan-card="premium"]');
    await expect(premium).toContainText("Empfehlung für aktive Betriebssteuerung");
    await expect(premium).toContainText("20,99 € mehr als Standard");
    await expect(pricing).not.toContainText(/Am beliebtesten|Bestseller|nur noch|Rabatt|sparen Sie/i);
    for (const plan of ["standard", "premium"])
      for (const t of ["Für wen", "Welches Problem", "Vorgeschlagener Umfang", "Zum Start nötig", "Nicht automatisch angebunden"])
        await expect(pricing.locator(`[data-plan-card="${plan}"]`)).toContainText(t);
    const ind = pricing.locator('[data-plan-card="individual"]');
    const text = (await ind.innerText()).replace(/\s/g, " ");
    expect(text.indexOf("29,99 €")).toBeGreaterThan(-1);
    expect(text.indexOf("Entwicklungsgebühr")).toBeLessThan(text.indexOf("29,99 €"));
    await expect(ind).toContainText("unbegrenzte Weiterentwicklung ist nicht enthalten");
  });

  test("L02-2 Rechner: 5 Nutzer ergeben 103,95 € und 124,94 €; Grundpreis und Nutzerpreis getrennt; Annahmen genannt", async ({ page }) => {
    await page.goto("/#preise");
    const input = page.getByLabel("Anzahl Nutzer");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await input.fill("5");
    const std = page.locator('dl[data-plan="standard"]');
    const prem = page.locator('dl[data-plan="premium"]');
    await expect(std).toContainText("89,00 €");
    await expect(std).toContainText("14,95 €");
    await expect(std.locator("[data-total]")).toHaveText("103,95 €");
    await expect(prem).toContainText("109,99 €");
    await expect(prem.locator("[data-total]")).toHaveText("124,94 €");
    await expect(page.getByText(/Annahmen bis zur Bestätigung/)).toBeVisible();
    await input.fill("0");
    await expect(page.getByRole("alert").filter({ hasText: "ganze Zahl" })).toContainText("ganze Zahl von 1 bis 500");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(std.locator("[data-total]")).toHaveText("–");
  });

  test("L02-3 Ansprache ohne Druck: Hauptaktion Demo ohne Anmeldung, daneben Vorführung mit eigenen Daten; kein Countdown", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("#geschichte");
    await expect(hero.getByRole("link").filter({ hasText: "Mit eigenen Daten vorführen lassen" })).toHaveAttribute("href", "#anfrage");
    await expect(hero.getByRole("link").filter({ hasText: "Demo ohne Anmeldung öffnen" })).toHaveAttribute("href", "/suite");
    await expect(page.locator("body")).not.toContainText(/Nur noch \d|Angebot endet|Countdown|Plätze frei|Kundenstimmen|Sterne/i);
  });

  test("L02-4 Handy: Tarifkarten untereinander, gleich aufgebaut, Standard zuerst; Rechner bedienbar", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/#preise");
    await expectNoHorizontalScroll(page);
    const boxes = await page.locator("[data-plan-card]").evaluateAll((c) => c.map((x) => x.getBoundingClientRect().top));
    expect(boxes[0]).toBeLessThan(boxes[1]);
    expect(boxes[1]).toBeLessThan(boxes[2]);
    const input = page.getByLabel("Anzahl Nutzer");
    expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await input.fill("12");
    await expect(page.locator('dl[data-plan="standard"] [data-total]')).toHaveText("124,88 €");
  });
});

test.describe("L03 Produktgeschichte", () => {
  test("L03-1 Überschrift und Aktionen sofort als HTML; überspringen führt hinter die Geschichte", async ({ page }) => {
    await page.goto("/");
    const story = page.locator("#geschichte");
    await expect(story.getByRole("heading", { level: 1 })).toHaveText("Gastro führen mit echten Zahlen.");
    await expect(story.getByRole("link", { name: /Mit eigenen Daten vorführen lassen/ }).first()).toBeVisible();
    await page.getByRole("link", { name: /Animation überspringen|Zu den Inhalten springen/ }).click();
    await expect.poll(() => page.evaluate(() => document.querySelector("#geschichte")!.getBoundingClientRect().bottom <= innerHeight + 2)).toBe(true);
  });

  test("L03-2 reduzierte Bewegung: dieselbe Geschichte als Standbilder, Animation auf Wunsch", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("[data-story-mode]")).toHaveAttribute("data-story-mode", "static");
    const story = page.locator("#geschichte");
    await expect(story.locator("canvas")).toHaveCount(0);
    for (const t of ["Hinter jeder Zahl steht dein Betrieb.", "Auch dort, wo gearbeitet wird.", "Restaurant. Bar. Bankett. Zusammen im Blick.", "Dein Betrieb. Alle Bereiche. Eine Übersicht."])
      await expect(story.getByRole("heading", { name: t })).toBeVisible();
    await expect(page.getByRole("link", { name: "Animation trotzdem abspielen" })).toHaveAttribute("href", "?story=anim");
    await expectNoHorizontalScroll(page);
    await ctx.close();
  });

  test("L03-4 normale Besucher bekommen die Kamerafahrt; Scrollen wechselt die Bilder vorwärts und rückwärts", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-story-mode]")).toHaveAttribute("data-story-mode", "anim");
    await expect(page.locator("#geschichte canvas")).toHaveCount(1);
    const pixel = () => page.evaluate(() => {
      const c = document.querySelector("#geschichte canvas") as HTMLCanvasElement;
      const d = c.getContext("2d")!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 3), 1, 1).data;
      return [d[0], d[1], d[2]].join(",");
    });
    const scrollTo = (t: number) => page.evaluate((t) => {
      const s = document.querySelector("#geschichte") as HTMLElement;
      window.scrollTo(0, s.getBoundingClientRect().top + scrollY + t * (s.offsetHeight - innerHeight));
    }, t);
    await scrollTo(0.2);
    await expect(page.getByRole("heading", { name: "Dein Betrieb beginnt mit einem Überblick." })).toBeVisible();
    await page.waitForTimeout(1500);
    const office = await pixel();
    await scrollTo(0.42);
    await expect(page.getByRole("heading", { name: "Hinter jeder Zahl steht dein Betrieb." })).toBeVisible();
    await expect.poll(pixel).not.toBe(office);
    await scrollTo(0.2);
    await expect.poll(pixel, { timeout: 10000 }).toBe(office);
    await scrollTo(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("L03-5 Filmbilder werden nach Bedarf geladen, nicht alle beim Aufruf", async ({ page }) => {
    const frames: string[] = [];
    page.on("request", (r) => { if (/\/story\/film\/[dm]\/\d+\.webp/.test(r.url())) frames.push(r.url()); });
    await page.goto("/");
    await page.waitForTimeout(2500);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.length).toBeLessThan(40);
  });

  test("L03-6 Telefon: die echte mobile Ansicht liegt über dem Telefon und wird lesbar groß", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const s = document.querySelector("#geschichte") as HTMLElement;
      window.scrollTo(0, s.getBoundingClientRect().top + scrollY + 0.69 * (s.offsetHeight - innerHeight));
    });
    const img = page.getByRole("img", { name: /Handy-Ansicht der Suite/ });
    await expect(img).toBeVisible();
    await expect.poll(async () => (await img.boundingBox())?.height ?? 0).toBeGreaterThan(400);
    await expect(page.getByRole("heading", { name: "Auch dort, wo gearbeitet wird." })).toBeVisible();
  });

  test("L03-7 ohne Film bleiben Überschrift, Dashboard und Aktionen nutzbar", async ({ page }) => {
    // the film data cannot be used (a broken manifest), without network errors in the console
    await page.route("**/story/film/manifest.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "kein Film" }));
    await page.goto("/");
    await expect(page.locator("#geschichte")).toHaveAttribute("data-film", "failed");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#geschichte").getByRole("link", { name: /Demo ohne Anmeldung öffnen/ }).first()).toBeVisible();
    await expect(page.locator("#geschichte img[alt^=\"Dashboard der GLB AI Suite\"]")).toBeVisible();
  });

  test("L03-3 die Suite lädt kein 3D-Paket", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "script") scripts.push(await r.text().catch(() => ""));
    });
    await page.goto("/suite");
    await page.waitForLoadState("networkidle");
    expect(scripts.some((s) => s.includes("WebGLRenderer"))).toBe(false);
  });
});
