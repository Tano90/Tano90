// Sales from a point-of-sale system. One line per receipt line; the receipt line id makes imports repeatable.

export type SaleInput = { externalId: string; plu: string; name: string; quantity: number; revenueNetCents: number; soldAt: string };
export type RowError = { row: number; message: string };

// Header names people export from their tills, lower-cased, without spaces or punctuation.
const ALIASES: Record<keyof SaleInput, string[]> = {
  externalId: ["belegposition", "positionsid", "belegid", "beleg", "id", "lineid", "receiptline"],
  plu: ["plu", "artikelnummer", "artikelnr", "sku"],
  name: ["artikel", "bezeichnung", "name", "artikelname", "item"],
  quantity: ["menge", "anzahl", "quantity", "qty"],
  revenueNetCents: ["umsatznetto", "nettoumsatz", "netto", "umsatz", "revenue", "net"],
  soldAt: ["zeitpunkt", "datum", "verkauftam", "zeit", "soldat", "date", "timestamp"],
};
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9äöüß]/g, "").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue");

/** Splits one CSV line, honouring quotes. */
function cells(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** "1.234,50" or "1234.50" -> 1234.5; null when not a number. */
export function parseNumber(raw: string): number | null {
  let v = raw.replace(/\s|€/g, "");
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Minutes the zone is ahead of UTC at (about) a UTC instant. */
export type OffsetFor = (utcMs: number) => number;

/** "20.10.2026 12:30", "2026-10-20 12:30" or ISO. Times without a zone are local wall time of the outlet. */
export function parseWhen(raw: string, offsetFor: OffsetFor): string | null {
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const m = de ? [de[3], de[2], de[1], de[4], de[5], de[6]] : iso ? [iso[1], iso[2], iso[3], iso[4], iso[5], iso[6]] : null;
  if (!m) {
    const t = Date.parse(raw);
    return /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) && !Number.isNaN(t) ? new Date(t).toISOString() : null;
  }
  const [y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const check = new Date(utc);
  if (check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d) return null;
  // Wall time -> instant: take the offset at the wall time read as UTC, then once more at the result (DST edges).
  const first = utc - offsetFor(utc) * 60_000;
  return new Date(utc - offsetFor(first) * 60_000).toISOString();
}

/**
 * Parses a sales export. Needs columns for receipt line id, PLU, quantity and time; name and net revenue are optional.
 * `offsetFor` gives the outlet's UTC offset, for times written without a zone.
 */
export function parseSalesCsv(text: string, offsetFor: OffsetFor = () => 0): { rows: SaleInput[]; errors: RowError[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (!lines[0]?.trim()) return { rows: [], errors: [{ row: 1, message: "Die Datei ist leer." }] };
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const head = cells(lines[0], sep).map(norm);
  const col = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, head.findIndex((h) => names.includes(h))])) as Record<keyof SaleInput, number>;
  const missing = (["externalId", "plu", "quantity", "soldAt"] as const).filter((k) => col[k] < 0);
  if (missing.length) {
    const label = { externalId: "Belegposition", plu: "PLU", quantity: "Menge", soldAt: "Zeitpunkt" };
    return { rows: [], errors: [{ row: 1, message: `Spalte fehlt: ${missing.map((k) => label[k]).join(", ")}. Erwartet wird eine Kopfzeile wie „Belegposition;PLU;Artikel;Menge;Umsatz netto;Zeitpunkt“.` }] };
  }
  const rows: SaleInput[] = [];
  const errors: RowError[] = [];
  lines.slice(1).forEach((line, i) => {
    const row = i + 2; // the line number in the file, also when blank lines are skipped
    if (!line.trim()) return;
    const c = cells(line, sep);
    const get = (k: keyof SaleInput) => (col[k] >= 0 ? c[col[k]] ?? "" : "");
    const quantity = parseNumber(get("quantity"));
    const revenue = col.revenueNetCents >= 0 ? parseNumber(get("revenueNetCents")) : 0;
    const soldAt = parseWhen(get("soldAt"), offsetFor);
    const problem =
      !get("externalId") ? "Belegposition fehlt." :
      !get("plu") ? "PLU fehlt." :
      quantity === null ? `Menge „${get("quantity")}“ ist keine Zahl.` :
      quantity === 0 ? "Menge 0 ergibt keinen Verkauf. Stornos bitte mit negativer Menge." :
      revenue === null ? `Umsatz „${get("revenueNetCents")}“ ist keine Zahl.` :
      !soldAt ? `Zeitpunkt „${get("soldAt")}“ nicht erkannt (z. B. 20.10.2026 12:30).` : null;
    if (problem) return void errors.push({ row, message: problem });
    rows.push({ externalId: get("externalId"), plu: get("plu"), name: get("name") || get("plu"), quantity: quantity!, revenueNetCents: Math.round(revenue! * 100), soldAt: soldAt! });
  });
  return { rows, errors };
}
