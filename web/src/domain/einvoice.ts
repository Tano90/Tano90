// German e-invoices (EN 16931): XRechnung in UBL or CII syntax, and the CII XML inside a ZUGFeRD/Factur-X PDF.
// A small namespace-agnostic XML reader is enough here: both syntaxes are plain element trees with a few attributes.
// Pure, so the browser, the server and the tests read an invoice the same way.
import type { PriceRow } from "./price-list";

type El = { name: string; attrs: Record<string, string>; children: El[]; text: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m);
const local = (n: string) => n.slice(n.indexOf(":") + 1);

/** Parses XML into elements with local names (prefixes dropped). Throws on input that is not XML. */
export function parseXml(xml: string): El {
  const root: El = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (let m: RegExpExecArray | null; (m = re.exec(xml)); ) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) {
      if (stack.length < 2 || top.name !== local(m[2])) throw new Error("Die Datei ist kein gültiges XML.");
      stack.pop();
    } else if (m[3]) {
      const attrs: Record<string, string> = {};
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[local(a[1])] = decode(a[2] ?? a[3] ?? "");
      const el: El = { name: local(m[3]), attrs, children: [], text: "" };
      top.children.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] !== undefined) top.text += decode(m[6]);
  }
  if (stack.length !== 1) throw new Error("Die Datei ist kein gültiges XML.");
  return root;
}

const kids = (e: El | undefined, name: string) => e?.children.filter((c) => c.name === name) ?? [];
/** First element along a path of local names. */
const at = (e: El | undefined, ...path: string[]): El | undefined => path.reduce<El | undefined>((cur, n) => kids(cur, n)[0], e);
const txt = (e: El | undefined, ...path: string[]) => at(e, ...path)?.text.trim() ?? "";
const cents = (v: string) => (v === "" ? null : Math.round(Number(v) * 100));

export type EInvoiceLine = { name: string; sku: string | null; gtin: string | null; quantity: number; unitCode: string; unitPriceCents: number; basisQuantity: number; lineNetCents: number };
export type EInvoice = {
  syntax: "CII" | "UBL";
  number: string; date: string; currency: string;
  seller: { name: string; vatId: string | null };
  netCents: number; taxCents: number; grossCents: number;
  /** One entry per VAT rate (basis points: 700 = 7 %). */
  taxes: { rateBp: number; netCents: number; taxCents: number }[];
  lines: EInvoiceLine[];
};

const isoDate = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v.slice(0, 10));
const rateBp = (v: string) => Math.round(Number(v || "0") * 100);

function fromCii(doc: El): EInvoice {
  const tx = at(doc, "SupplyChainTradeTransaction");
  const agreement = at(tx, "ApplicableHeaderTradeAgreement");
  const settlement = at(tx, "ApplicableHeaderTradeSettlement");
  const sum = at(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const seller = at(agreement, "SellerTradeParty");
  const lines = kids(tx, "IncludedSupplyChainTradeLineItem").map((li): EInvoiceLine => {
    const product = at(li, "SpecifiedTradeProduct");
    const price = at(li, "SpecifiedLineTradeAgreement", "NetPriceProductTradePrice");
    const qty = at(li, "SpecifiedLineTradeDelivery", "BilledQuantity");
    const basis = at(price, "BasisQuantity");
    return {
      name: txt(product, "Name"), sku: txt(product, "SellerAssignedID") || null, gtin: txt(product, "GlobalID") || null,
      quantity: Number(qty?.text.trim() || "0"), unitCode: qty?.attrs.unitCode ?? basis?.attrs.unitCode ?? "C62",
      unitPriceCents: cents(txt(price, "ChargeAmount")) ?? 0, basisQuantity: Number(basis?.text.trim() || "1") || 1,
      lineNetCents: cents(txt(li, "SpecifiedLineTradeSettlement", "SpecifiedTradeSettlementLineMonetarySummation", "LineTotalAmount")) ?? 0,
    };
  });
  const taxCents = kids(sum, "TaxTotalAmount").map((t) => cents(t.text.trim()) ?? 0).reduce((a, b) => a + b, 0);
  return {
    syntax: "CII",
    number: txt(doc, "ExchangedDocument", "ID"),
    date: isoDate(txt(doc, "ExchangedDocument", "IssueDateTime", "DateTimeString")),
    currency: txt(settlement, "InvoiceCurrencyCode") || "EUR",
    seller: { name: txt(seller, "Name"), vatId: kids(seller, "SpecifiedTaxRegistration").map((r) => txt(r, "ID")).find((v) => /^[A-Z]{2}/.test(v)) ?? null },
    netCents: cents(txt(sum, "TaxBasisTotalAmount")) ?? 0, taxCents, grossCents: cents(txt(sum, "GrandTotalAmount")) ?? 0,
    taxes: kids(settlement, "ApplicableTradeTax").map((t) => ({ rateBp: rateBp(txt(t, "RateApplicablePercent")), netCents: cents(txt(t, "BasisAmount")) ?? 0, taxCents: cents(txt(t, "CalculatedAmount")) ?? 0 })),
    lines,
  };
}

function fromUbl(doc: El): EInvoice {
  const party = at(doc, "AccountingSupplierParty", "Party");
  const total = at(doc, "LegalMonetaryTotal");
  const lines = [...kids(doc, "InvoiceLine"), ...kids(doc, "CreditNoteLine")].map((li): EInvoiceLine => {
    const qty = at(li, "InvoicedQuantity") ?? at(li, "CreditedQuantity");
    const basis = at(li, "Price", "BaseQuantity");
    return {
      name: txt(li, "Item", "Name"), sku: txt(li, "Item", "SellersItemIdentification", "ID") || null, gtin: txt(li, "Item", "StandardItemIdentification", "ID") || null,
      quantity: Number(qty?.text.trim() || "0"), unitCode: qty?.attrs.unitCode ?? "C62",
      unitPriceCents: cents(txt(li, "Price", "PriceAmount")) ?? 0, basisQuantity: Number(basis?.text.trim() || "1") || 1,
      lineNetCents: cents(txt(li, "LineExtensionAmount")) ?? 0,
    };
  });
  const tax = at(doc, "TaxTotal");
  return {
    syntax: "UBL",
    number: txt(doc, "ID"), date: isoDate(txt(doc, "IssueDate")), currency: txt(doc, "DocumentCurrencyCode") || "EUR",
    seller: { name: txt(party, "PartyName", "Name") || txt(party, "PartyLegalEntity", "RegistrationName"), vatId: txt(party, "PartyTaxScheme", "CompanyID") || null },
    netCents: cents(txt(total, "TaxExclusiveAmount")) ?? 0, taxCents: cents(txt(tax, "TaxAmount")) ?? 0,
    grossCents: cents(txt(total, "TaxInclusiveAmount")) ?? cents(txt(total, "PayableAmount")) ?? 0,
    taxes: kids(tax, "TaxSubtotal").map((t) => ({ rateBp: rateBp(txt(t, "TaxCategory", "Percent")), netCents: cents(txt(t, "TaxableAmount")) ?? 0, taxCents: cents(txt(t, "TaxAmount")) ?? 0 })),
    lines,
  };
}

/** Reads an XRechnung/ZUGFeRD XML. Throws a message for the person uploading when it is something else. */
export function parseEInvoice(xml: string): EInvoice {
  const doc = parseXml(xml).children[0];
  let inv: EInvoice;
  if (doc?.name === "CrossIndustryInvoice") inv = fromCii(doc);
  else if (doc?.name === "Invoice" || doc?.name === "CreditNote") inv = fromUbl(doc);
  else throw new Error("Keine E-Rechnung erkannt. Erwartet wird XRechnung (UBL oder CII) oder ZUGFeRD/Factur-X.");
  if (!inv.number) throw new Error("Die E-Rechnung hat keine Rechnungsnummer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.date)) throw new Error("Das Rechnungsdatum fehlt oder ist nicht lesbar.");
  if (inv.currency !== "EUR") throw new Error(`Rechnungen in ${inv.currency} werden noch nicht unterstützt.`);
  if (!inv.taxes.length && inv.netCents) inv.taxes = [{ rateBp: 0, netCents: inv.netCents, taxCents: inv.taxCents }];
  return inv;
}

// UN/ECE Rec. 20 unit codes as they appear on food invoices.
const MEASURE: Record<string, { unit: PriceRow["baseUnit"]; base: number; label: string }> = {
  KGM: { unit: "g", base: 1000, label: "kg" }, GRM: { unit: "g", base: 1, label: "g" },
  LTR: { unit: "ml", base: 1000, label: "l" }, MLT: { unit: "ml", base: 1, label: "ml" }, CLT: { unit: "ml", base: 10, label: "cl" },
};
const PACK_LABEL: Record<string, string> = {
  H87: "Stück", C62: "Stück", EA: "Stück", PCE: "Stück", XPP: "Stück", XCT: "Karton", CT: "Karton", XBX: "Kiste", BX: "Kiste",
  XCR: "Kiste", XPK: "Packung", PK: "Packung", XBO: "Flasche", XBG: "Beutel", XSA: "Sack", XCA: "Dose", XTN: "Dose", XBA: "Fass", XPA: "Paket",
};

/**
 * Invoice lines as price-list rows, so the price import can plan and apply them. Weight and volume lines become
 * prices per kg or litre; everything else a price per package (one invoice unit = one package).
 */
export function einvoicePriceRows(inv: EInvoice): PriceRow[] {
  return inv.lines.filter((l) => l.name && l.unitPriceCents > 0).map((l, i): PriceRow => {
    const m = MEASURE[l.unitCode];
    const perOne = l.unitPriceCents / (l.basisQuantity || 1);
    if (m) {
      const perBase = m.base === 1000 ? 1000 : m.base; // per kg / l, or per g / ml / cl
      return { row: i + 1, ingredient: l.name, packLabel: m.label, packBase: m.base, baseUnit: m.unit, priceCents: Math.round(perOne), perUnitBase: perBase, sku: l.sku, category: null };
    }
    return { row: i + 1, ingredient: l.name, packLabel: PACK_LABEL[l.unitCode] ?? "Gebinde", packBase: 1, baseUnit: "piece", priceCents: Math.round(perOne), perUnitBase: null, sku: l.sku, category: null };
  });
}

/** Price change in percent, one decimal (positive = dearer). */
export const priceChangePct = (oldCents: number, newCents: number) => (oldCents > 0 ? Math.round(((newCents - oldCents) / oldCents) * 1000) / 10 : null);
