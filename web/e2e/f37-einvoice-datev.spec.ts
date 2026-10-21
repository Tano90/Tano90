import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { db, expect, reseed, sid, test } from "./fixtures";

const CII = readFileSync(new URL("../src/domain/fixtures/einvoice-cii.xml", import.meta.url), "utf8");
const UBL = readFileSync(new URL("../src/domain/fixtures/einvoice-ubl.xml", import.meta.url), "utf8");

/** A minimal ZUGFeRD-style PDF: the CII XML as a compressed embedded file. */
function zugferdPdf(xml: string) {
  const data = deflateSync(Buffer.from(xml, "utf8"));
  return Buffer.concat([
    Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Type /EmbeddedFile /Subtype /text#2Fxml /Filter /FlateDecode /Length ${data.length} >>\nstream\n`, "latin1"),
    data, Buffer.from("\nendstream\nendobj\ntrailer\n<< >>\n%%EOF\n", "latin1"),
  ]);
}

test.describe("Rechnungen: E-Rechnung und DATEV", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("ER-H1 XRechnung (CII): Lieferant erkannt, Preissprung, Artikelnummer, speichern übernimmt bekannte Preise", async ({ page, axe }) => {
    // The cleaning agent's article number is (for this test) the one of Lauch: matched by number, not by name.
    await db()`update stock_items set supplier_sku = 'SP-77' where ingredient_id = (select id from ingredients where name = 'Lauch')`;
    await page.goto("/invoices");
    await page.getByLabel("E-Rechnung hochladen").setInputFiles({ name: "RE-2026-1042.xml", mimeType: "application/xml", buffer: Buffer.from(CII) });
    await expect(page.getByLabel("Lieferant in der Suite")).toHaveValue(sid("sup-frische"));
    const table = page.getByRole("table", { name: "Positionen der Rechnung" });
    await expect(table.getByRole("row", { name: /Knollensellerie/ })).toContainText("+18,2 %");
    await expect(table.getByRole("row", { name: /Lauch/ })).toContainText("SP-77");
    await expect(table.getByRole("row", { name: /Butter 82 %/ })).toContainText("unbekannt");
    await expect(page.getByRole("alert").filter({ hasText: "Preissprung" })).toContainText("Knollensellerie +18,2 %");
    await axe();
    await page.getByRole("button", { name: "Rechnung speichern" }).click();
    await expect(page.getByText(/Rechnung gespeichert · 2 Preise geändert/)).toBeVisible();

    const [inv] = await db()`select total_net_cents, gross_cents, tax_lines, source, match_status from invoices where invoice_number = 'RE-2026-1042'`;
    expect(inv).toMatchObject({ total_net_cents: 7480, gross_cents: 8148, source: "einvoice", match_status: "unmatched" });
    expect(inv.tax_lines).toEqual([{ rateBp: 700, netCents: 6280, taxCents: 440 }, { rateBp: 1900, netCents: 1200, taxCents: 228 }]);
    const prices = await db()`select i.name, si.price_cents from stock_items si join ingredients i on i.id = si.ingredient_id where i.name in ('Knollensellerie', 'Lauch') order by i.name`;
    expect(prices).toEqual([{ name: "Knollensellerie", price_cents: 260 }, { name: "Lauch", price_cents: 1200 }]);
    expect(await db()`select 1 from ingredients where name like 'Butter 82%'`).toHaveLength(0);
    await expect(page.getByRole("region", { name: "Rechnungen im Zeitraum" })).toContainText("RE-2026-1042");

    // The same invoice twice is refused.
    await page.getByLabel("E-Rechnung hochladen").setInputFiles({ name: "RE-2026-1042.xml", mimeType: "application/xml", buffer: Buffer.from(CII) });
    await page.getByRole("button", { name: "Rechnung speichern" }).click();
    await expect(page.getByText("Rechnung RE-2026-1042 dieses Lieferanten ist schon erfasst.")).toBeVisible();
  });

  test("ER-H2 ZUGFeRD-PDF und XRechnung (UBL) werden gelesen; normale PDF wird erklärt", async ({ page }) => {
    await page.goto("/invoices");
    await page.getByLabel("E-Rechnung hochladen").setInputFiles({ name: "rechnung.pdf", mimeType: "application/pdf", buffer: zugferdPdf(CII) });
    await expect(page.getByText("RE-2026-1042")).toBeVisible();
    await page.getByRole("button", { name: "Verwerfen" }).click();
    await page.getByLabel("E-Rechnung hochladen").setInputFiles({ name: "4711.xml", mimeType: "application/xml", buffer: Buffer.from(UBL) });
    await expect(page.getByLabel("Lieferant in der Suite")).toHaveValue(sid("sup-molkerei"));
    await expect(page.getByRole("table", { name: "Positionen der Rechnung" })).toContainText("Sahne 30 %");
    await page.getByRole("button", { name: "Verwerfen" }).click();
    await page.getByLabel("E-Rechnung hochladen").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n%%EOF") });
    await expect(page.getByText(/In dieser PDF ist keine E-Rechnung eingebettet/)).toBeVisible();
  });

  test("ER-H3 DATEV: Einstellungen, Export mit einer Buchung je Steuersatz", async ({ page, axe }) => {
    await page.goto("/invoices");
    await page.getByLabel("E-Rechnung hochladen").setInputFiles({ name: "x.xml", mimeType: "application/xml", buffer: Buffer.from(CII.replace("20261020", new Date().toISOString().slice(0, 10).replace(/-/g, ""))) });
    await page.getByLabel("Preise bekannter Zutaten übernehmen").uncheck();
    await page.getByRole("button", { name: "Rechnung speichern" }).click();
    await expect(page.getByText("Rechnung gespeichert", { exact: true })).toBeVisible();

    const datev = page.getByRole("region", { name: "DATEV-Export" });
    await expect(datev).toContainText("Erst Berater- und Mandantennummer");
    await datev.getByRole("link", { name: "DATEV-Einstellungen" }).click();
    await page.getByLabel("Beraternummer").fill("29098");
    await page.getByLabel("Mandantennummer").fill("55003");
    await page.getByLabel("Kreditorenkonto Frischehof Lindner").fill("70001");
    await axe();
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("DATEV-Einstellungen gespeichert")).toBeVisible();

    await page.goto("/invoices");
    const href = await page.getByRole("link", { name: "DATEV-Datei herunterladen" }).getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toMatch(/EXTF_Buchungsstapel_/);
    const lines = (await res.body()).toString("latin1").split("\r\n");
    expect(lines[0]).toMatch(/^"EXTF";700;21;"Buchungsstapel";13;\d{17};;"RE";"GLB AI Suite";"";29098;55003;\d{8};4;/);
    expect(lines[2]).toMatch(/^67,20;"S";"EUR";;;"";3300;70001;"";\d{4};"RE-2026-1042";"";;"Frischehof Lindner"$/);
    expect(lines[3]).toMatch(/^14,28;"S";"EUR";;;"";3400;70001;/);
  });

  test("ER-N1 Team-Konto: kein Einlesen, kein DATEV", async ({ page, login }) => {
    await login("staff");
    await page.goto("/invoices");
    await expect(page.getByRole("region", { name: "E-Rechnung einlesen" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "DATEV-Export" })).toHaveCount(0);
    expect((await page.request.get("/api/datev?from=2026-01-01&to=2026-01-31")).status()).toBe(403);
  });
});
