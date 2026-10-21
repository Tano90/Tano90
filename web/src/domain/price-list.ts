// Supplier price lists: one row per item (ingredient, package, price). Parsing is separate from planning,
// so the browser can read the file and the server can plan against the current data.
import { parseNumber } from "./pos";
import type { BaseUnit } from "./units";

export type PriceRow = {
  row: number;
  ingredient: string;
  packLabel: string;
  packBase: number;
  baseUnit: BaseUnit;
  priceCents: number;
  /** null: price per package; otherwise per this many base units (1000 g = per kg). */
  perUnitBase: number | null;
  sku: string | null;
  category: string | null;
};
export type Cell = string | number | boolean | null | undefined | object;
export type RowError = { row: number; message: string };

const ALIASES = {
  ingredient: ["zutat", "zutatname", "produkt", "bezeichnung", "artikelbezeichnung", "name", "artikel", "ingredient"],
  packLabel: ["gebinde", "verpackung", "packung", "gebindebezeichnung", "package"],
  content: ["inhalt", "menge", "packungsinhalt", "gebindegroesse", "gebindeinhalt", "content", "size"],
  unit: ["einheit", "mengeneinheit", "unit"],
  price: ["preis", "einkaufspreis", "ekpreis", "nettopreis", "preisnetto", "price"],
  per: ["preisje", "preispro", "preisbasis", "per"],
  sku: ["artikelnummer", "artikelnr", "lieferantenartikelnummer", "bestellnummer", "sku"],
  category: ["kategorie", "warengruppe", "category"],
} as const;
const norm = (h: string) => h.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-z0-9]/g, "");
const UNITS: Record<string, [BaseUnit, number]> = {
  kg: ["g", 1000], g: ["g", 1], gramm: ["g", 1], l: ["ml", 1000], liter: ["ml", 1000], ml: ["ml", 1], cl: ["ml", 10],
  stk: ["piece", 1], st: ["piece", 1], stueck: ["piece", 1], piece: ["piece", 1], pcs: ["piece", 1],
};
const UNIT_NAME: Record<BaseUnit, string> = { g: "g/kg", ml: "ml/l", piece: "Stück" };

const text = (c: Cell) => (c === null || c === undefined ? "" : typeof c === "object" ? "" : String(c).trim());
const number = (c: Cell) => (typeof c === "number" ? c : parseNumber(text(c)));

/** Reads a table (first row = headers) into price rows; every unreadable row is named. */
export function parsePriceList(table: Cell[][]): { rows: PriceRow[]; errors: RowError[] } {
  const head = (table[0] ?? []).map((c) => norm(text(c)));
  const col = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, head.findIndex((h) => (names as readonly string[]).includes(h))])) as Record<keyof typeof ALIASES, number>;
  const missing = (["ingredient", "content", "unit", "price"] as const).filter((k) => col[k] < 0);
  if (missing.length) {
    const label = { ingredient: "Zutat", content: "Inhalt", unit: "Einheit", price: "Preis" };
    return { rows: [], errors: [{ row: 1, message: `Spalte fehlt: ${missing.map((k) => label[k]).join(", ")}. Am einfachsten die Vorlage herunterladen und ausfüllen.` }] };
  }
  const rows: PriceRow[] = [];
  const errors: RowError[] = [];
  table.slice(1).forEach((cells, i) => {
    const row = i + 2;
    const get = (k: keyof typeof ALIASES) => (col[k] >= 0 ? cells[col[k]] : null);
    if (cells.every((c) => !text(c))) return;
    const ingredient = text(get("ingredient"));
    const content = number(get("content"));
    const unit = UNITS[norm(text(get("unit")))];
    const price = number(get("price"));
    const perRaw = norm(text(get("per")));
    const per = !perRaw || ["gebinde", "packung", "pack", "stueckpreis"].includes(perRaw) ? null : UNITS[perRaw];
    const problem =
      !ingredient ? "Zutat fehlt." :
      ingredient.length > 120 ? "Der Name der Zutat ist zu lang (max. 120 Zeichen)." :
      content === null || content <= 0 ? `Inhalt „${text(get("content"))}“ ist keine positive Zahl.` :
      !unit ? `Einheit „${text(get("unit"))}“ unbekannt (kg, g, l, ml, cl, Stk).` :
      price === null || price < 0 ? `Preis „${text(get("price"))}“ ist kein Betrag.` :
      per === undefined ? `„Preis je“ „${text(get("per"))}“ unbekannt (Gebinde, kg, l, Stk).` :
      per && per[0] !== unit[0] ? `Preis je ${text(get("per"))} passt nicht zur Einheit ${text(get("unit"))}.` : null;
    if (problem) return void errors.push({ row, message: problem });
    const packBase = Math.round(content! * unit![1] * 10000) / 10000;
    rows.push({
      row, ingredient, packBase, baseUnit: unit![0],
      packLabel: text(get("packLabel")) || `${text(get("content"))} ${text(get("unit"))}`,
      priceCents: Math.round(price! * 100),
      perUnitBase: per ? per[1] : null,
      sku: text(get("sku")) || null,
      category: text(get("category")) || null,
    });
  });
  return { rows, errors };
}

export type Snapshot = {
  ingredients: { id: string; name: string; baseUnit: BaseUnit }[];
  packages: Map<string, { id: string; label: string; quantityBase: number }[]>;
  items: Map<string, { id: string; supplierId: string | null; packageId: string; priceType: "per_pack" | "per_unit"; priceCents: number; priceUnitQuantity: number | null }[]>;
};
export type PlanRow = PriceRow & {
  kind: "new_ingredient" | "new_price" | "changed" | "same" | "error";
  message?: string;
  ingredientId?: string;
  packageId?: string;
  itemId?: string;
  oldPriceCents?: number;
  oldPerUnitBase?: number | null;
};

const lower = (s: string) => s.toLocaleLowerCase("de");

/** What importing each row would do for one supplier. Rows are matched by ingredient name and package size. */
export function planPriceList(rows: PriceRow[], supplierId: string, snap: Snapshot): PlanRow[] {
  const seen = new Map<string, number>();
  return rows.map((r): PlanRow => {
    const key = `${lower(r.ingredient)}|${r.packBase}|${r.baseUnit}`;
    if (seen.has(key)) return { ...r, kind: "error", message: `Doppelt in der Datei (wie Zeile ${seen.get(key)}).` };
    seen.set(key, r.row);
    const ing = snap.ingredients.find((i) => lower(i.name) === lower(r.ingredient));
    if (!ing) return { ...r, kind: "new_ingredient" };
    if (ing.baseUnit !== r.baseUnit) {
      return { ...r, kind: "error", message: `„${ing.name}“ wird in ${UNIT_NAME[ing.baseUnit]} geführt, die Zeile nennt ${UNIT_NAME[r.baseUnit]}.` };
    }
    const packs = snap.packages.get(ing.id) ?? [];
    // Same size counts as the same package, whatever the label says ("10x250g" vs "Karton 10 × 250 g").
    const pack = packs.find((p) => Math.abs(p.quantityBase - r.packBase) < 1e-6 && lower(p.label) === lower(r.packLabel))
      ?? packs.find((p) => Math.abs(p.quantityBase - r.packBase) < 1e-6);
    const item = pack && (snap.items.get(ing.id) ?? []).find((x) => x.supplierId === supplierId && x.packageId === pack.id);
    const base = { ...r, ingredientId: ing.id, packageId: pack?.id };
    if (!item) return { ...base, kind: "new_price" };
    const oldPer = item.priceType === "per_unit" ? item.priceUnitQuantity : null;
    const same = item.priceCents === r.priceCents && oldPer === r.perUnitBase;
    return { ...base, itemId: item.id, kind: same ? "same" : "changed", oldPriceCents: item.priceCents, oldPerUnitBase: oldPer };
  });
}
