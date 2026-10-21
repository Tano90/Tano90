// Recipes from a spreadsheet: one row per recipe line, recipe-level columns repeated or filled in the first row.
// Parsing runs in the browser; planning against the current ingredients and recipes runs on the server.
import { parseNumber } from "./pos";
import type { Cell } from "./price-list";
import type { BaseUnit } from "./units";

export type LineUnit = "g" | "kg" | "mg" | "ml" | "cl" | "l" | "piece" | "portion";
export type ImportLine = { row: number; name: string; quantity: number; unit: LineUnit };
export type ImportRecipe = {
  row: number; name: string; portions: number; category: string | null; semiFinished: boolean;
  sellPriceCents: number | null; instructions: string | null; lines: ImportLine[];
};
export type RowError = { row: number; message: string };

const ALIASES = {
  recipe: ["rezept", "rezeptname", "gericht", "recipe"],
  portions: ["portionen", "portion", "ausbeute", "portions", "yield"],
  category: ["kategorie", "warengruppe", "category"],
  kind: ["art", "typ", "rezeptart", "type"],
  ingredient: ["zutat", "zutaten", "grundrezept", "ingredient", "bestandteil"],
  quantity: ["menge", "anzahl", "quantity", "amount"],
  unit: ["einheit", "unit"],
  price: ["verkaufspreis", "vkpreis", "vk", "preis", "price"],
  instructions: ["zubereitung", "anleitung", "instructions", "method"],
} as const;
const norm = (h: string) => h.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
const UNITS: Record<string, LineUnit> = {
  g: "g", gr: "g", gramm: "g", kg: "kg", kilo: "kg", kilogramm: "kg", mg: "mg", ml: "ml", cl: "cl", l: "l", liter: "l", ltr: "l",
  stk: "piece", st: "piece", stueck: "piece", stuck: "piece", piece: "piece", pcs: "piece", portion: "portion", port: "portion", portionen: "portion",
};
const text = (c: Cell) => (c === null || c === undefined || typeof c === "object" ? "" : String(c).trim());
const number = (c: Cell) => (typeof c === "number" ? c : parseNumber(text(c)));

export function parseRecipeTable(table: Cell[][]): { recipes: ImportRecipe[]; errors: RowError[] } {
  const head = (table[0] ?? []).map((c) => norm(text(c)));
  const col = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, head.findIndex((h) => (names as readonly string[]).includes(h))])) as Record<keyof typeof ALIASES, number>;
  const missing = ([["recipe", "Rezept"], ["ingredient", "Zutat"], ["quantity", "Menge"], ["unit", "Einheit"]] as const).filter(([k]) => col[k] < 0).map(([, n]) => n);
  if (missing.length) return { recipes: [], errors: [{ row: 1, message: `Spalten fehlen: ${missing.join(", ")}. Erwartet: Rezept, Portionen, Zutat, Menge, Einheit.` }] };
  const byName = new Map<string, ImportRecipe>();
  const errors: RowError[] = [];
  let last: ImportRecipe | null = null;
  table.slice(1).forEach((cells, i) => {
    const row = i + 2;
    if (cells.every((c) => text(c) === "")) return;
    const name = text(cells[col.recipe]);
    const recipe: ImportRecipe | null = name ? byName.get(name.toLocaleLowerCase("de")) ?? null : last; // empty name: same recipe as above
    let r = recipe;
    if (!r) {
      if (!name) return void errors.push({ row, message: "Rezeptname fehlt." });
      const portions = col.portions >= 0 && text(cells[col.portions]) ? number(cells[col.portions]) : 1;
      if (portions === null || !(portions > 0)) return void errors.push({ row, message: `Portionen „${text(cells[col.portions])}“ sind keine Zahl über 0.` });
      const price = col.price >= 0 && text(cells[col.price]) ? number(cells[col.price]) : null;
      if (col.price >= 0 && text(cells[col.price]) && (price === null || price < 0)) return void errors.push({ row, message: `Verkaufspreis „${text(cells[col.price])}“ ist keine Zahl.` });
      r = {
        row, name: name.slice(0, 120), portions, category: col.category >= 0 ? text(cells[col.category]) || null : null,
        semiFinished: col.kind >= 0 && /grund|basis|semi|halb/i.test(text(cells[col.kind])),
        sellPriceCents: price === null ? null : Math.round(price * 100), instructions: col.instructions >= 0 ? text(cells[col.instructions]).slice(0, 10000) || null : null, lines: [],
      };
      byName.set(name.toLocaleLowerCase("de"), r);
    } else if (col.instructions >= 0 && text(cells[col.instructions]) && !r.instructions) {
      r.instructions = text(cells[col.instructions]).slice(0, 10000);
    }
    last = r;
    const ing = text(cells[col.ingredient]);
    if (!ing) return; // a row with only recipe data
    const qty = number(cells[col.quantity]);
    if (qty === null || !(qty > 0)) return void errors.push({ row, message: `Menge „${text(cells[col.quantity])}“ ist keine Zahl über 0.` });
    const unit = UNITS[norm(text(cells[col.unit]))];
    if (!unit) return void errors.push({ row, message: `Einheit „${text(cells[col.unit])}“ unbekannt. Möglich: g, kg, mg, ml, cl, l, Stk, Portion.` });
    r.lines.push({ row, name: ing.slice(0, 120), quantity: qty, unit });
  });
  for (const r of byName.values()) if (!r.lines.length) errors.push({ row: r.row, message: `„${r.name}“ hat keine Zutaten.` });
  return { recipes: [...byName.values()].filter((r) => r.lines.length), errors };
}

export type Snapshot = { ingredients: { id: string; name: string; baseUnit: BaseUnit }[]; recipes: { id: string; name: string }[] };
export type PlannedLine = ImportLine & ({ kind: "ingredient"; ingredientId: string } | { kind: "recipe"; recipeId: string } | { kind: "file_recipe"; recipeName: string } | { kind: "new_ingredient"; baseUnit: BaseUnit });
export type PlannedRecipe = Omit<ImportRecipe, "lines"> & { status: "new" | "exists" | "error"; message?: string; lines: PlannedLine[] };

const lower = (s: string) => s.toLocaleLowerCase("de");
const baseOf = (u: LineUnit): BaseUnit => (u === "g" || u === "kg" || u === "mg" ? "g" : u === "ml" || u === "cl" || u === "l" ? "ml" : "piece");

/**
 * Matches every line to an ingredient or a recipe (existing or in the same file), by name. Existing recipes are
 * left alone. Unknown ingredients are created only when allowed; sub-recipes from the file are saved first.
 */
export function planRecipeImport(recipes: ImportRecipe[], snap: Snapshot, createIngredients: boolean): PlannedRecipe[] {
  const inFile = new Set(recipes.map((r) => lower(r.name)));
  const planned = recipes.map((r): PlannedRecipe => {
    if (snap.recipes.some((x) => lower(x.name) === lower(r.name))) return { ...r, status: "exists", message: "Gibt es schon, wird nicht verändert.", lines: [] };
    const problems: string[] = [];
    const lines = r.lines.map((l): PlannedLine => {
      const ing = snap.ingredients.find((i) => lower(i.name) === lower(l.name));
      if (ing) return { ...l, kind: "ingredient", ingredientId: ing.id };
      const rec = snap.recipes.find((x) => lower(x.name) === lower(l.name));
      if (rec) return { ...l, kind: "recipe", recipeId: rec.id };
      if (inFile.has(lower(l.name)) && lower(l.name) !== lower(r.name)) return { ...l, kind: "file_recipe", recipeName: l.name };
      if (l.unit === "portion") problems.push(`„${l.name}“ in Portionen, aber kein Rezept dieses Namens`);
      else if (!createIngredients) problems.push(`Zutat „${l.name}“ unbekannt`);
      return { ...l, kind: "new_ingredient", baseUnit: baseOf(l.unit) };
    });
    return problems.length ? { ...r, status: "error", message: problems.join("; "), lines } : { ...r, status: "new", lines };
  });
  // A recipe that uses a file recipe with an error cannot be saved either.
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of planned.filter((x) => x.status === "new")) {
      const bad = p.lines.find((l) => l.kind === "file_recipe" && planned.find((x) => lower(x.name) === lower(l.recipeName))?.status === "error");
      if (bad) { p.status = "error"; p.message = `Grundrezept „${bad.name}“ hat Fehler`; changed = true; }
    }
  }
  return planned;
}

/** Save order: recipes from the file that others use come first. Throws on a cycle. */
export function saveOrder(planned: PlannedRecipe[]): PlannedRecipe[] {
  const todo = planned.filter((p) => p.status === "new");
  const done = new Set<string>();
  const out: PlannedRecipe[] = [];
  while (todo.length) {
    const i = todo.findIndex((p) => p.lines.every((l) => l.kind !== "file_recipe" || done.has(lower(l.recipeName)) || !todo.some((t) => lower(t.name) === lower(l.recipeName))));
    if (i < 0) throw new Error(`Rezepte verweisen im Kreis aufeinander: ${todo.map((t) => t.name).join(", ")}.`);
    const [p] = todo.splice(i, 1);
    done.add(lower(p.name));
    out.push(p);
  }
  return out;
}
