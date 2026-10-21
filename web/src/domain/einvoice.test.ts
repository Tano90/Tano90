import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { einvoicePriceRows, parseEInvoice, parseXml, priceChangePct } from "./einvoice";

const fixture = (f: string) => readFileSync(join(__dirname, "fixtures", f), "utf8");

describe("parseEInvoice", () => {
  it("reads XRechnung / ZUGFeRD in CII syntax", () => {
    const inv = parseEInvoice(fixture("einvoice-cii.xml"));
    expect(inv).toMatchObject({ syntax: "CII", number: "RE-2026-1042", date: "2026-10-20", seller: { name: "Frischehof Lindner GmbH", vatId: "DE123456789" }, netCents: 7480, taxCents: 668, grossCents: 8148 });
    expect(inv.taxes).toEqual([{ rateBp: 700, netCents: 6280, taxCents: 440 }, { rateBp: 1900, netCents: 1200, taxCents: 228 }]);
    expect(inv.lines[0]).toEqual({ name: "Butter 82 % & Süßrahm, Karton", sku: "B-1001", gtin: "4012345000017", quantity: 2, unitCode: "XCT", unitPriceCents: 2490, basisQuantity: 1, lineNetCents: 4980 });
    expect(inv.lines[1]).toMatchObject({ name: "Knollensellerie", sku: null, unitCode: "KGM", quantity: 5, unitPriceCents: 260 });
  });

  it("reads XRechnung in UBL syntax", () => {
    const inv = parseEInvoice(fixture("einvoice-ubl.xml"));
    expect(inv).toMatchObject({ syntax: "UBL", number: "4711", date: "2026-10-19", seller: { name: "Molkerei Talblick", vatId: "DE987654321" }, netCents: 2100, taxCents: 147, grossCents: 2247 });
    expect(inv.taxes).toEqual([{ rateBp: 700, netCents: 2100, taxCents: 147 }]);
    expect(inv.lines).toEqual([{ name: "Sahne 30 %", sku: "S-30", gtin: null, quantity: 10, unitCode: "LTR", unitPriceCents: 210, basisQuantity: 1, lineNetCents: 2100 }]);
  });

  it("explains files that are not e-invoices", () => {
    expect(() => parseEInvoice("<html><body/></html>")).toThrow(/Keine E-Rechnung erkannt/);
    expect(() => parseEInvoice("<a><b></a>")).toThrow(/kein gültiges XML/);
    expect(() => parseEInvoice(fixture("einvoice-ubl.xml").replace("<cbc:ID>4711</cbc:ID>", ""))).toThrow(/keine Rechnungsnummer/);
  });

  it("keeps entities and CDATA", () => {
    expect(parseXml("<a><![CDATA[x < y]]> &amp; &#228;</a>").children[0].text).toBe("x < y & ä");
  });
});

describe("einvoicePriceRows", () => {
  it("turns weight and volume into per-kg / per-litre prices, everything else into package prices", () => {
    const rows = einvoicePriceRows(parseEInvoice(fixture("einvoice-cii.xml")));
    expect(rows[0]).toMatchObject({ ingredient: "Butter 82 % & Süßrahm, Karton", packLabel: "Karton", baseUnit: "piece", priceCents: 2490, perUnitBase: null, sku: "B-1001" });
    expect(rows[1]).toMatchObject({ ingredient: "Knollensellerie", packLabel: "kg", packBase: 1000, baseUnit: "g", priceCents: 260, perUnitBase: 1000 });
    const ubl = einvoicePriceRows(parseEInvoice(fixture("einvoice-ubl.xml")));
    expect(ubl[0]).toMatchObject({ baseUnit: "ml", packBase: 1000, perUnitBase: 1000, priceCents: 210 });
  });
  it("price change in percent", () => {
    expect(priceChangePct(2390, 2490)).toBe(4.2);
    expect(priceChangePct(0, 100)).toBeNull();
  });
});
