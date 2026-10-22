import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

// v1.1 Intelligence Center inside the suite (demo mode in the browser). Every module of the ZIP is opened and used.
const open = (page: Page, view: string) =>
  page.evaluate(
    (v) =>
      (
        document.querySelector(
          `#sidebar .glb08-nav-link[data-view="${v}"]`,
        ) as HTMLElement
      ).click(),
    view,
  );
const snap = (page: Page) =>
  page.evaluate(() => (window as any).GLBAppSync.snapshot());
const csv = (name: string, text: string) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(text, "utf8"),
});
async function fresh(page: Page) {
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as any).GLBV11);
}
async function download(page: Page, button: ReturnType<Page["locator"]>) {
  const [d] = await Promise.all([
    page.waitForEvent("download"),
    button.click(),
  ]);
  return {
    name: d.suggestedFilename(),
    text: Buffer.concat(await (await d.createReadStream()).toArray()).toString(
      "utf8",
    ),
  };
}
const V11 = [
  "v11cockpit",
  "v11tasks",
  "v11training",
  "v11sales",
  "v11menu",
  "v11funnel",
  "v11market",
  "v11stock",
  "v11legacy",
];

test.describe("SV v1.1-Module in der Suite", () => {
  test.beforeEach(async ({ page }) => fresh(page));

  test("SV-1 alle neun ZIP-Module und alle bisherigen Module erreichbar, Beschriftungen eindeutig", async ({
    page,
  }) => {
    const nav = await page
      .locator("#sidebar .glb08-nav-link[data-view]")
      .evaluateAll((els) =>
        els.map((e) => [
          (e as HTMLElement).dataset.view!,
          (e.textContent || "").trim(),
        ]),
      );
    const views = nav.map((x) => x[0]);
    for (const v of V11) expect(views, v).toContain(v);
    for (const v of [
      "myday",
      "operations",
      "overview",
      "funnel",
      "products",
      "outlets",
      "portfolio",
      "lifecycle",
      "market",
      "menuimport",
      "recipes",
      "costs",
      "calculator",
      "groups",
      "inventory",
      "stockledger",
      "purchasing",
      "orders",
      "reports",
      "insights",
      "import",
      "setup",
      "settings",
    ])
      expect(views, v).toContain(v);
    expect(new Set(nav.map((x) => x[1])).size).toBe(nav.length);
    for (const [v, label] of nav) {
      await open(page, v);
      await expect(
        page.locator("#main").getByRole("heading").first(),
        label,
      ).toBeVisible();
    }
  });

  test("SV-2 Cockpit: Kennzahlen wie ZIP-Logik, Filter, Hinweise, Beispieldaten markiert", async ({
    page,
  }) => {
    await open(page, "v11cockpit");
    await expect(page.locator("#main")).toContainText("Beispieldaten");
    const s = await page.evaluate(() => (window as any).GLBV11.stats());
    const eur = (n: number) =>
      n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    await expect(
      page.locator(".v6-stat", { hasText: "Bruttoumsatz" }),
    ).toContainText(eur(s.gross));
    await expect(
      page.locator(".v6-stat", { hasText: "Nettoumsatz" }),
    ).toContainText(eur(s.net));
    await page.locator('[data-v11-filter="outlet"]').selectOption("bar");
    const bar = await page.evaluate(() => (window as any).GLBV11.stats());
    expect(bar.gross).toBeLessThan(s.gross);
    await expect(
      page.locator(".v6-stat", { hasText: "Bruttoumsatz" }),
    ).toContainText(eur(bar.gross));
    await expect(page.locator(".v11-note").first()).toBeVisible();
    await expect(page.locator(".v11-chart")).toBeVisible();
  });

  test("SV-3 Monatsimport: Fehlerdiagnose, Snapshot, Wiederholung, Export Auswahl und alles", async ({
    page,
  }) => {
    await open(page, "v11sales");
    // the ZIP sample uses article names that are not in this master: clear diagnosis, nothing imported
    const sample = readFileSync("suite-v11-original/sample-sales.csv", "utf8");
    await page
      .locator("#v11-sales-file")
      .setInputFiles(csv("sample-sales.csv", sample));
    await page.getByRole("button", { name: "Datei prüfen" }).click();
    await expect(page.locator(".v11-errors")).toContainText(
      "„Cheeseburger“ nicht im Artikelstamm",
    );
    await expect(
      page.getByRole("button", { name: /Zeilen importieren/ }),
    ).toBeDisabled();
    const before = (await snap(page)).sales.length;
    const good =
      "Produkt;Outlet;Monat;Menge;Bruttopreis\nClassic Cheeseburger;Restaurant;2026-10;30;17,90\nSignature Cocktail;Bar;2026-10;16;9,50\n";
    await page.locator("#v11-sales-file").setInputFiles(csv("okt.csv", good));
    await page.getByRole("button", { name: "Datei prüfen" }).click();
    await page.getByRole("button", { name: "2 Zeilen importieren" }).click();
    const s1 = await snap(page);
    expect(s1.sales.length).toBe(before + 2);
    const burger = s1.items.find(
      (x: { name: string }) => x.name === "Classic Cheeseburger",
    );
    const line = s1.sales.find(
      (x: { productId: string; month: string; sourceHash?: string }) =>
        x.productId === burger.id && x.month === "2026-10" && x.sourceHash,
    );
    expect(line.unitCostNet).toBe(burger.costNet);
    expect(line.vatPercent).toBe(7);
    // same file again: recognised by content + line, nothing added
    await page.locator("#v11-sales-file").setInputFiles(csv("kopie.csv", good));
    await page.getByRole("button", { name: "Datei prüfen" }).click();
    await expect(page.locator(".v11-preview")).toContainText(
      "davon 2 bereits importiert",
    );
    await page.getByRole("button", { name: "0 Zeilen importieren" }).click();
    expect((await snap(page)).sales.length).toBe(before + 2);
    // exports: current selection vs all data, same import format
    await page.locator('[data-v11-filter="month"]').selectOption("2026-10");
    await page.locator('[data-v11-filter="outlet"]').selectOption("bar");
    const sel = await download(
      page,
      page.getByRole("button", { name: "Aktuelle Auswahl exportieren" }),
    );
    expect(sel.name).toBe("GLB_Verkaufsdaten_Oktober_2026_Bar.csv");
    const selRows = sel.text.trim().split(/\r?\n/);
    expect(selRows[0]).toContain(
      '"Produkt";"Outlet";"Monat";"Menge";"Bruttopreis"',
    );
    expect(selRows.slice(1).every((r) => r.includes('"Bar";"2026-10"'))).toBe(
      true,
    );
    const all = await download(
      page,
      page.getByRole("button", { name: "Alle Verkaufsdaten exportieren" }),
    );
    expect(all.name).toBe("GLB_Verkaufsdaten_alle.csv");
    expect(all.text.trim().split(/\r?\n/).length - 1).toBe(
      await page.evaluate(() => (window as any).GLBV11.sales().length),
    );
    expect(all.text.trim().split(/\r?\n/).length).toBeGreaterThan(
      selRows.length,
    );
  });

  test("SV-4 Menu Engineering: Klassen, Suche, „WE fehlt“ bewusst nachtragen ohne Snapshots zu überschreiben", async ({
    page,
  }) => {
    // an article without cost and two imported lines; a second article keeps its snapshot
    await page.evaluate(() => {
      const S = (window as any).GLBSuite.S;
      S.items.push({
        id: "nocost",
        name: "Probierteller",
        category: "Sides",
        quantity: 0,
        grossPrice: 9.9,
        costNet: 0,
        vat: 7,
      });
      S.sales.push({
        id: "n1",
        productId: "nocost",
        outletId: "restaurant",
        month: "2026-09",
        quantity: 12,
        grossPrice: 9.9,
        unitCostNet: null,
        vatPercent: 7,
      });
      S.sales.push({
        id: "n2",
        productId: "d1",
        outletId: "restaurant",
        month: "2026-09",
        quantity: 1,
        grossPrice: 17.9,
        unitCostNet: 3.33,
        vatPercent: 7,
      });
      (window as any).GLBSuite.persist();
    });
    await open(page, "v11menu");
    const row = page.locator("tr", { hasText: "Probierteller" });
    await expect(row).toContainText("WE fehlt");
    await page.locator("#v11-article-search").fill("probier");
    await expect(page.locator("#main tbody tr")).toHaveCount(1);
    await row.getByRole("button", { name: "WE nachtragen" }).click();
    const dlg = page.getByRole("dialog", { name: /Wareneinsatz nachtragen/ });
    await expect(dlg).toContainText("1 Verkaufszeile ohne Wareneinsatz");
    await dlg.getByLabel(/Wareneinsatz netto je Einheit/).fill("2,40");
    await dlg
      .getByRole("button", { name: "Kosten bestätigt nachtragen" })
      .click();
    const s = await snap(page);
    expect(s.sales.find((x: { id: string }) => x.id === "n1").unitCostNet).toBe(
      2.4,
    );
    expect(s.sales.find((x: { id: string }) => x.id === "n2").unitCostNet).toBe(
      3.33,
    );
    expect(
      s.items.find((x: { id: string }) => x.id === "nocost").costHistory.at(-1)
        .source,
    ).toContain("WE nachgetragen");
    await page.locator("#v11-article-search").fill("");
    const st = await page.evaluate(() => (window as any).GLBV11.stats());
    for (const c of ["Star", "Renner", "Puzzle", "Penner"])
      await expect(
        page.locator(".v6-stat", { hasText: new RegExp(`^${c}`) }).locator("b"),
      ).toHaveText(
        String(
          st.products.filter(
            (x: { classification: string }) => x.classification === c,
          ).length,
        ),
      );
  });

  test("SV-5 Tagesfunnel: Bons, Gäste, sechs Themen, Tagesfilter, Import mit Überschneidung, Storno, Zuordnung", async ({
    page,
  }) => {
    await open(page, "v11funnel");
    await expect(
      page.locator(".v6-stat", { hasText: "Bons" }).locator("b"),
    ).toHaveText("12");
    await expect(
      page.locator(".v6-stat", { hasText: "Gäste" }).locator("b"),
    ).toHaveText("26");
    for (const t of [
      "Aperitif",
      "Wasser",
      "Upgrade",
      "Dessert",
      "Kaffee",
      "After Glow",
    ])
      await expect(
        page.locator(".v11-funnel-line", { hasText: t }),
      ).toBeVisible();
    await page
      .locator('[data-v11-filter="funnelDate"]')
      .selectOption("2026-10-21");
    await expect(
      page.locator(".v6-stat", { hasText: "Bons" }).locator("b"),
    ).toHaveText("4");
    await page.locator('[data-v11-filter="funnelDate"]').selectOption("all");
    // import: one check overlaps the demo (same check, article, quantity, price from another file), one new check with a void
    const file =
      "Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;Gaeste;FunnelStufe;USt;WareneinsatzNetto;PositionID;Typ;BezugsPosition\n" +
      "2026-10-21;T008;Restaurant;Rumpsteak 250 g;2;29,50;2;none;7;11,65;X1;Verkauf;\n" +
      "2026-10-23;T100;Restaurant;Classic Cheeseburger;1;17,90;1;none;7;4,55;X2;Verkauf;\n" +
      "2026-10-23;T100;Restaurant;ESPRESSO;1;2,90;1;;19;0,35;X3;Verkauf;\n" +
      "2026-10-23;T100;Restaurant;ESPRESSO;-1;2,90;1;;19;0,35;X4;Storno;X3\n";
    await page.locator("#v11-pos-file").setInputFiles(csv("tag.csv", file));
    await page.getByRole("button", { name: "CSV prüfen" }).click();
    await expect(page.locator(".v11-preview")).toContainText(
      "1 mögliche Überschneidungen",
    );
    await page.getByRole("button", { name: "Import bestätigen" }).click();
    await expect(page.locator("#main")).toContainText(
      "Zur Prüfung: mögliche Überschneidungen",
    );
    await expect(
      page.locator(".v6-stat", { hasText: "Bons" }).locator("b"),
    ).toHaveText("13"); // pending line not counted
    await page.getByRole("button", { name: "Als Duplikate verwerfen" }).click();
    await expect(page.locator("#main")).not.toContainText(
      "Zur Prüfung: mögliche Überschneidungen",
    );
    // mapping in another spelling applies retroactively; the voided espresso does not count as coffee purchase
    const coffeeBefore = await page.evaluate(
      () =>
        (window as any).GLBV11.funnel().stages.find(
          (s: { id: string }) => s.id === "coffee",
        ).checks,
    );
    await page.getByLabel("Artikelname wie in der Kasse").fill("Espresso");
    await page.locator("#v11-tag-stage").selectOption("coffee");
    await page
      .getByRole("button", { name: "Artikel dauerhaft zuordnen" })
      .click();
    const coffee = await page.evaluate(() =>
      (window as any).GLBV11.funnel().stages.find(
        (s: { id: string }) => s.id === "coffee",
      ),
    );
    expect(coffee.checks).toBe(coffeeBefore);
    // target and scenario
    await page.locator("#v11-tg-stage").selectOption("dessert");
    await page.locator("#v11-tg-target").fill("60");
    await page.getByRole("button", { name: "Zielwert setzen" }).click();
    await expect(
      page.locator(".v11-funnel-line", { hasText: "Dessert" }),
    ).toContainText("Ziel 60,0 %");
    await expect(
      page.locator(".v11-lesson", { hasText: "Dessert" }),
    ).toContainText("zusätzliche Bons");
    // training task from potential
    await page
      .locator(".v11-lesson", { hasText: "Dessert" })
      .getByRole("button", { name: "Schulung als Aufgabe anlegen" })
      .click();
    expect(
      (await snap(page)).tasks.some((t: { title: string }) =>
        t.title.startsWith("Training Dessert"),
      ),
    ).toBe(true);
  });

  test("SV-6 Funnel Quest: Antwort, Rückmeldung, 100 XP, ein Versuch je Thema und Tag", async ({
    page,
  }) => {
    await open(page, "v11training");
    await page.getByRole("button", { name: /^Aperitif/ }).click();
    await page.getByLabel("Erst nach dem Dessert").check();
    await page.getByRole("button", { name: /Antwort prüfen/ }).click();
    await expect(page.locator("#main")).toContainText("Nicht ganz.");
    await expect(
      page.getByRole("button", { name: "Heute bereits beantwortet" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: /^Wasser/ }).click();
    await page.getByLabel("Still oder sprudelnd aktiv anbieten").check();
    await page.getByRole("button", { name: /Antwort prüfen/ }).click();
    await expect(page.locator("#main")).toContainText("Richtig! +100 XP");
    await expect(
      page.locator(".v6-stat", { hasText: "Deine Punkte" }).locator("b"),
    ).toHaveText("100 XP");
    await expect(
      page.locator(".v6-stat", { hasText: "Stufe" }).locator("b"),
    ).toHaveText("Einsteiger");
    await expect(
      page.locator(".v6-stat", { hasText: "Missionen" }),
    ).toContainText("1 richtig gelöst");
    expect((await snap(page)).intelligence.training.length).toBe(2);
  });

  test("SV-7 Mindestbestände: anlegen, Vorschlag Ziel − Ist, Export, Korrektur mit Version; Forecast bleibt", async ({
    page,
  }) => {
    await open(page, "v11stock");
    await page.getByLabel("Name").fill("Kaffeebohnen Test");
    await page.getByLabel("Einheit").fill("kg");
    await page.getByLabel("Ist-Bestand").fill("0.5");
    await page.getByLabel("Mindestbestand").fill("2");
    await page.getByLabel("Zielbestand").fill("6.25");
    await page.getByRole("button", { name: "Position speichern" }).click();
    const item = page.locator(".v11-list > div", {
      hasText: "Kaffeebohnen Test",
    });
    await expect(item).toContainText("0,5 kg");
    await expect(item).toContainText("Bestellen: 5,75 kg");
    const exp = await download(
      page,
      page.getByRole("button", { name: /Bestellvorschläge exportieren/ }),
    );
    expect(exp.text).toContain(
      '"Kaffeebohnen Test";"kg";"0.5";"2";"6.25";"5.75"',
    );
    await item
      .getByRole("button", { name: /Bestand Kaffeebohnen Test ändern/ })
      .click();
    await page.getByLabel("Neuer Ist-Bestand in kg").fill("7");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Speichern" })
      .click();
    await expect(item).toContainText("Ausreichend");
    const x = (await snap(page)).parStock.find(
      (i: { name: string }) => i.name === "Kaffeebohnen Test",
    );
    expect(x.version).toBe(2);
    await page.getByRole("button", { name: "Bestell-Forecast öffnen" }).click();
    await expect(page.locator("#main")).toContainText(
      "Bestellvorschlag je Rohware",
    );
  });

  test("SV-8 Team & Aufgaben: anlegen mit Priorität und Fälligkeit, erledigen, wieder öffnen", async ({
    page,
  }) => {
    await open(page, "v11tasks");
    await page.getByLabel("Beschreibung").fill("Kühlhaus prüfen");
    await page.getByLabel("Priorität").selectOption("high");
    await page.getByLabel("Fälligkeit").fill("2026-10-30");
    await page.getByRole("button", { name: "Aufgabe erstellen" }).click();
    const task = page.locator(".v11-task", { hasText: "Kühlhaus prüfen" });
    await expect(task).toContainText("30.10.2026");
    await expect(task).toContainText("Hoch");
    await task.getByRole("checkbox").check();
    await expect(task).toContainText("Erledigt");
    await page
      .locator(".v11-task", { hasText: "Kühlhaus prüfen" })
      .getByRole("checkbox")
      .uncheck();
    await expect(
      page.locator(".v11-task", { hasText: "Kühlhaus prüfen" }),
    ).toContainText("Offen");
  });

  test("SV-9 KI-Marktcheck: Beobachtung nur mit https-Quelle, Abweichung, Umfeldsuche, KI ohne Cloud gesperrt", async ({
    page,
    problems,
  }) => {
    await page.route("https://overpass-api.de/**", (r) =>
      r.fulfill({
        json: {
          elements: [
            {
              type: "node",
              id: 7,
              tags: {
                name: "Bistro Nachbar",
                cuisine: "regional",
                "addr:street": "Markt",
                "addr:housenumber": "2",
                "addr:city": "Düren",
              },
            },
          ],
        },
      }),
    );
    await open(page, "v11market");
    const f = page.locator("#v11-market-form");
    await f.getByLabel("Wettbewerber").fill("Bistro Nachbar");
    await f.getByLabel("Eigenes Produkt").fill("Classic Cheeseburger");
    await f
      .getByLabel("Vergleichbares Konkurrenzprodukt")
      .fill("Burger Classic");
    await f.getByLabel("Konkurrenzpreis brutto (€)").fill("16");
    await f.getByLabel("Unser Bruttopreis (€)").fill("17.9");
    await f.getByLabel("Quelle (https-Link)").fill("http://example.com/karte");
    await f.getByLabel("Prüfdatum").fill("2026-10-20");
    await f.getByRole("button", { name: "Beobachtung speichern" }).click();
    await expect(page.locator(".toast.error")).toContainText("https");
    await f.getByLabel("Quelle (https-Link)").fill("https://example.com/karte");
    await f.getByRole("button", { name: "Beobachtung speichern" }).click();
    await expect(
      page.locator("#main tbody tr", { hasText: "Bistro Nachbar" }),
    ).toContainText("+11,9 %");
    await expect(
      page.getByRole("button", { name: "KI-Einordnung erstellen" }),
    ).toBeDisabled();
    await page
      .locator("#v11-discover-form")
      .getByLabel("Breitengrad")
      .fill("50.8");
    await page
      .locator("#v11-discover-form")
      .getByLabel("Längengrad")
      .fill("6.48");
    await page
      .locator("#v11-discover-form")
      .getByLabel("Umkreis")
      .selectOption("1000");
    await page.getByRole("button", { name: "Gastronomie suchen" }).click();
    await expect(page.locator("#main")).toContainText("Bistro Nachbar");
    await expect(page.locator("#main")).toContainText(
      "regional · Markt 2 Düren",
    );
    problems.splice(
      0,
      problems.length,
      ...problems.filter((p) => !p.includes("overpass")),
    );
  });

  test("SV-10 Demo zurücksetzen: alle v1.1-Bereiche sofort wieder da; Backup enthält sie und stellt sie wieder her", async ({
    page,
    browser,
  }) => {
    await open(page, "v11training");
    await page.getByRole("button", { name: /^Kaffee/ }).click();
    await page
      .getByLabel("Darf es zum Abschluss Espresso oder Cappuccino sein?")
      .check();
    await page.getByRole("button", { name: /Antwort prüfen/ }).click();
    await open(page, "settings");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('#main [data-action="export-json"]').first().click(),
    ]);
    const backup = JSON.parse(readFileSync((await dl.path())!, "utf8"));
    expect(backup.intelligence.training.length).toBe(1);
    expect(backup.tasks.length).toBe(3);
    expect(backup.parStock.length).toBe(3);
    page.once("dialog", (d) => void d.accept());
    await page.locator('[data-action="reset-demo"]').first().click();
    const s = await snap(page);
    expect(s.intelligence.pos.length).toBe(23);
    expect(s.intelligence.training.length).toBe(0);
    expect(s.tasks.length).toBe(3);
    await open(page, "v11funnel");
    await expect(
      page.locator(".v6-stat", { hasText: "Bons" }).locator("b"),
    ).toHaveText("12");
    // restore into a separate session
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto("/suite");
    await p2.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="settings"]') as HTMLElement
      ).click(),
    );
    p2.on("dialog", (d) => void d.accept());
    await p2.locator("#json-file").setInputFiles((await dl.path())!);
    await expect
      .poll(() =>
        p2.evaluate(
          () =>
            (window as any).GLBAppSync.snapshot().intelligence.training.length,
        ),
      )
      .toBe(1);
    await other.close();
  });

  test("SV-11 Strukturcheck liest nur", async ({ page }) => {
    await open(page, "v11legacy");
    const before = JSON.stringify(await snap(page));
    await page
      .getByRole("button", { name: "Struktur einlesen (nur lesen)" })
      .click();
    await expect(page.locator("#main tbody")).toContainText("items");
    await expect(page.locator("#main tbody")).toContainText("intelligence.pos");
    expect(JSON.stringify(await snap(page))).toBe(before);
  });
});

test.describe("SV mobil", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("SV-M1 alle neuen Module über „Mehr“ erreichbar, eindeutige Namen, kein Überlauf", async ({
    page,
  }) => {
    await fresh(page);
    for (const v of V11) {
      await page.locator("#glb08-more").click();
      const link = page.locator(`#sidebar .glb08-nav-link[data-view="${v}"]`);
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page.locator("#main h1").first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        v,
      ).toBeLessThanOrEqual(390);
    }
  });
});
