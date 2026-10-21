import { describe, expect, it } from "vitest";
import { parseRecipeTable, planRecipeImport, saveOrder } from "./recipe-import";

const table = [
  ["Rezept", "Portionen", "Kategorie", "Art", "Zutat", "Menge", "Einheit", "Verkaufspreis", "Zubereitung"],
  ["Tomatensauce", "10", "Grundrezepte", "Grundrezept", "Tomaten", "2", "kg", "", "Einkochen."],
  ["", "", "", "", "Olivenöl", "5", "cl", "", ""],
  ["Pasta Pomodoro", "1", "Hauptgerichte", "", "Spaghetti", "120", "g", "12,90", ""],
  ["Pasta Pomodoro", "", "", "", "Tomatensauce", "1", "Portion", "", ""],
  ["Pasta Pomodoro", "", "", "", "Parmesan", "15", "Gramm", "", ""],
  ["Kaputt", "x", "", "", "Salz", "1", "g", "", ""],
  ["Leer", "1", "", "", "Wasser", "1", "Becher", "", ""],
];

describe("parseRecipeTable", () => {
  it("groups lines by recipe, also when the name is left empty below", () => {
    const { recipes, errors } = parseRecipeTable(table);
    expect(recipes.map((r) => [r.name, r.portions, r.lines.length, r.semiFinished, r.sellPriceCents])).toEqual([["Tomatensauce", 10, 2, true, null], ["Pasta Pomodoro", 1, 3, false, 1290]]);
    expect(recipes[0].lines[1]).toEqual({ row: 3, name: "Olivenöl", quantity: 5, unit: "cl" });
    expect(recipes[1].lines[1].unit).toBe("portion");
    expect(recipes[0].instructions).toBe("Einkochen.");
    expect(errors).toEqual([
      { row: 7, message: "Portionen „x“ sind keine Zahl über 0." },
      { row: 8, message: "Einheit „Becher“ unbekannt. Möglich: g, kg, mg, ml, cl, l, Stk, Portion." },
      { row: 8, message: "„Leer“ hat keine Zutaten." },
    ]);
  });
  it("names missing columns", () => {
    expect(parseRecipeTable([["Name", "Menge"]]).errors[0].message).toMatch(/Spalten fehlen: Rezept, Zutat, Einheit/);
  });
});

describe("planRecipeImport", () => {
  const snap = { ingredients: [{ id: "i-tom", name: "Tomaten", baseUnit: "g" as const }, { id: "i-oil", name: "olivenöl", baseUnit: "ml" as const }, { id: "i-spa", name: "Spaghetti", baseUnit: "g" as const }], recipes: [{ id: "r-old", name: "Alt" }] };
  it("matches ingredients and file recipes, refuses unknown ingredients unless allowed, saves sub-recipes first", () => {
    const { recipes } = parseRecipeTable(table);
    const strict = planRecipeImport(recipes, snap, false);
    expect(strict.map((p) => [p.name, p.status])).toEqual([["Tomatensauce", "new"], ["Pasta Pomodoro", "error"]]);
    expect(strict[1].message).toBe("Zutat „Parmesan“ unbekannt");
    const loose = planRecipeImport(recipes, snap, true);
    expect(loose[1].status).toBe("new");
    expect(loose[1].lines.map((l) => l.kind)).toEqual(["ingredient", "file_recipe", "new_ingredient"]);
    expect(saveOrder([...loose].reverse()).map((p) => p.name)).toEqual(["Tomatensauce", "Pasta Pomodoro"]);
  });
  it("leaves existing recipes alone and passes errors on to recipes that use them", () => {
    const planned = planRecipeImport([
      { row: 2, name: "Alt", portions: 1, category: null, semiFinished: false, sellPriceCents: null, instructions: null, lines: [{ row: 2, name: "Tomaten", quantity: 1, unit: "g" }] },
      { row: 3, name: "Basis", portions: 1, category: null, semiFinished: true, sellPriceCents: null, instructions: null, lines: [{ row: 3, name: "Unbekannt", quantity: 1, unit: "g" }] },
      { row: 4, name: "Gericht", portions: 1, category: null, semiFinished: false, sellPriceCents: null, instructions: null, lines: [{ row: 4, name: "Basis", quantity: 1, unit: "portion" }] },
    ], snap, false);
    expect(planned.map((p) => p.status)).toEqual(["exists", "error", "error"]);
    expect(planned[2].message).toBe("Grundrezept „Basis“ hat Fehler");
  });
});
