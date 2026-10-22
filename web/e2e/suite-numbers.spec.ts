import { expect, test, type Page } from "./fixtures";

// Number consistency in the GLB AI Suite (public/suite, demo data in the browser).
async function open(page: Page, view: string) {
  await page.evaluate(
    (v) =>
      (
        document.querySelector(
          `#sidebar .glb08-nav-link[data-view="${v}"]`,
        ) as HTMLElement
      ).click(),
    view,
  );
}
const kpi = (page: Page, label: string) =>
  page
    .locator(".v6-stat", {
      has: page.locator("small", { hasText: new RegExp(`^${label}$`) }),
    })
    .locator("b")
    .first();

test.describe("SN Zahlen und Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/suite");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("SN-1 Report Studio · Service: Monatsfilter wirkt, August zeigt keine Septemberwerte", async ({
    page,
  }) => {
    await open(page, "reports");
    await page.getByRole("tab", { name: "Service & Conversion" }).click();
    const month = page.locator("#v6-filter-month");
    const months = await month
      .locator("option")
      .evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    expect(months).toContain("2026-09");
    expect(months).toContain("2026-08");
    await month.selectOption("2026-09");
    const sept = await kpi(page, "Erfasste Gäste").textContent();
    expect(Number(sept!.replace(/\D/g, ""))).toBeGreaterThan(0);
    await month.selectOption("2026-08");
    await expect(page.locator("#v6-report-content")).toContainText(
      "Keine Serviceerfassungen",
    );
    await expect(kpi(page, "Erfasste Gäste")).toHaveCount(0);
    await month.selectOption("2026-09");
    await expect(kpi(page, "Erfasste Gäste")).toHaveText(sept!);
  });

  test("SN-2 Service: Outlet und Monat kombiniert, Warengruppe gesperrt mit Erklärung, Export = Anzeige", async ({
    page,
  }) => {
    await open(page, "reports");
    await page.getByRole("tab", { name: "Service & Conversion" }).click();
    await expect(page.locator("#v6-filter-category")).toBeDisabled();
    await expect(page.locator(".v6-filter-note")).toContainText(
      "Warengruppe wirkt nicht auf Service-Kennzahlen",
    );
    await page.locator("#v6-filter-month").selectOption("2026-09");
    const all = Number(
      (await kpi(page, "Erfasste Gäste").textContent())!.replace(/\D/g, ""),
    );
    const outlets = await page
      .locator("#v6-filter-outlet option")
      .evaluateAll((o) =>
        o.map((x) => (x as HTMLOptionElement).value).filter((v) => v !== "all"),
      );
    let sum = 0;
    for (const o of outlets) {
      await page.locator("#v6-filter-outlet").selectOption(o);
      const box = page.locator("#v6-report-content");
      if (await box.getByText("Keine Serviceerfassungen").count()) continue;
      sum += Number(
        (await kpi(page, "Erfasste Gäste").textContent())!.replace(/\D/g, ""),
      );
    }
    expect(sum).toBe(all);
    await page.locator("#v6-filter-outlet").selectOption("all");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "CSV", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^GLB_Service_Funnel_September_2026_alle_Outlets_\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const csv = (await (await download.createReadStream()).toArray()).join("");
    const counts = csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => Number(l.split(";")[1].replace(/"/g, "")));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(
      Number(
        (await kpi(page, "Zusatzartikel").textContent())!.replace(/\D/g, ""),
      ),
    );
  });

  test("SN-3 Lager-Reiter: nicht anwendbare Filter gesperrt und erklärt", async ({
    page,
  }) => {
    await open(page, "reports");
    await page.getByRole("tab", { name: "Lager & Einkauf" }).click();
    for (const id of [
      "#v6-filter-month",
      "#v6-filter-outlet",
      "#v6-filter-category",
    ])
      await expect(page.locator(id)).toBeDisabled();
    await expect(page.locator(".v6-filter-note")).toContainText(
      "aktuellen Bestand",
    );
  });

  test("SN-4 Übersicht: Summe und Monatsvergleich klar getrennt beschriftet", async ({
    page,
  }) => {
    await open(page, "overview");
    const tile = page.locator(".v6-stat", {
      has: page.locator("small", { hasText: /^Netto-Umsatz · alle Monate$/ }),
    });
    // the total of all months names its range and shows no single-month comparison (Oct 2026)
    await expect(tile).toContainText("Summe April 2026 bis September 2026 (6 Monate)");
    await expect(tile).not.toContainText("ggü.");
    await page.locator("#v6-filter-month").selectOption("2026-09");
    await expect(
      page.locator(".v6-stat", {
        has: page.locator("small", {
          hasText: /^Netto-Umsatz · September 2026$/,
        }),
      }),
    ).toContainText("ggü. August 2026");
  });

  test("SN-5 Deckungsbeiträge: oberer Block und Bericht beziehen sich auf denselben Monat", async ({
    page,
  }) => {
    await open(page, "costs");
    await expect(page.locator(".v6-module-report")).toContainText(
      "DB I · September 2026",
    );
    await expect(page.locator(".v6-module-report")).toContainText(
      "DB II · September 2026",
    );
  });

  test("SN-6 Modulberichte zeigen den gemeinsamen Filter sichtbar an", async ({
    page,
  }) => {
    await open(page, "reports");
    await page.locator("#v6-filter-month").selectOption("2026-08");
    await open(page, "products");
    await expect(page.locator(".v6-module-report .v6-scope")).toContainText(
      "August 2026",
    );
    await expect(
      page.locator(".v6-module-report #v6-filter-month"),
    ).toHaveValue("2026-08");
  });

  test("SN-7 Auswahl ohne Verkäufe: Leerzustand statt 0,00 €, überall gleich", async ({
    page,
  }) => {
    await open(page, "reports");
    await page.locator("#v6-filter-outlet").selectOption("bar");
    await page.locator("#v6-filter-category").selectOption("Burger");
    await expect(page.locator("#v6-report-content")).toContainText(
      "Keine Verkaufszeilen in dieser Auswahl",
    );
    await expect(page.locator("#v6-report-content")).toContainText(
      "alle Monate · Bar · Burger",
    );
    await expect(page.locator("#v6-report-content .v6-stat")).toHaveCount(0);
    await open(page, "overview");
    await expect(page.locator("#main")).toContainText(
      "Keine Verkaufszeilen in dieser Auswahl",
    );
    await page.locator("#v6-filter-category").selectOption("Getränke");
    await expect(page.locator("#main .v6-stat").first()).toBeVisible();
  });

  test("SN-8 Excel-Export: gleiche Zahlen wie CSV, nennt Zeitraum, Outlet, Einheiten und Grundlage", async ({
    page,
  }) => {
    await open(page, "reports");
    await page.locator("#v6-filter-month").selectOption("2026-09");
    const get = async (name: string) => {
      const [d] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name, exact: true }).click(),
      ]);
      return {
        name: d.suggestedFilename(),
        buf: Buffer.concat(await (await d.createReadStream()).toArray()),
      };
    };
    const csv = await get("CSV");
    const xlsx = await get("Excel");
    expect(xlsx.name.replace(/xlsx$/, "csv")).toBe(csv.name);
    // the .xlsx is stored uncompressed: the sheet XML can be read straight from the bytes
    const sheets = xlsx.buf
      .toString("utf8")
      .match(/<worksheet[\s\S]*?<\/worksheet>/g)!;
    expect(sheets).toHaveLength(2);
    const [bericht, daten] = sheets;
    for (const t of [
      "September 2026",
      "alle Outlets",
      "Kostenstand",
      "Euro netto",
      "Beispieldaten",
    ])
      expect(bericht).toContain(t);
    expect(daten).toContain("Nettoumsatz (€)");
    const csvRevenue = csv.buf
      .toString("utf8")
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => Number(l.split(";")[2].replace(/"/g, "")));
    const xlsxRevenue = [
      ...daten.matchAll(/<c r="C(\d+)" s="\d+"><v>([^<]+)<\/v>/g),
    ].map((m) => Number(m[2]));
    expect(xlsxRevenue).toEqual(csvRevenue);
  });
});
