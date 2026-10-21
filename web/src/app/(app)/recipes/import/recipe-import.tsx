"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { importRecipes, previewRecipeImport } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload, type RowError } from "@/components/ui/file-upload";
import { toast } from "@/components/ui/toast";
import { csvTable } from "@/domain/csv";
import type { Cell } from "@/domain/price-list";
import { type ImportRecipe, type PlannedRecipe, parseRecipeTable } from "@/domain/recipe-import";
import { countOf } from "@/lib/format";

const TEMPLATE = [
  "Rezept;Portionen;Kategorie;Art;Zutat;Menge;Einheit;Verkaufspreis;Zubereitung",
  "Tomatensauce;10;Grundrezepte;Grundrezept;Tomaten;2;kg;;Zwiebeln anschwitzen, Tomaten 40 Minuten einkochen.",
  ";;;;Zwiebeln;300;g;;",
  ";;;;Olivenöl nativ extra;5;cl;;",
  "Pasta Pomodoro;1;Hauptgerichte;;Spaghetti;120;g;12,90;",
  ";;;;Tomatensauce;1;Portion;;",
].join("\r\n");

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([`﻿${TEMPLATE}\r\n`], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "rezepte-vorlage.csv" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function readTable(file: File): Promise<Cell[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Cell[][];
  }
  return csvTable(await file.text());
}
const STATUS = { new: { label: "wird angelegt", tone: "success" }, exists: { label: "gibt es schon", tone: "neutral" }, error: { label: "Fehler", tone: "danger" } } as const;
const KIND = { ingredient: "Zutat", recipe: "Rezept", file_recipe: "Rezept aus der Datei", new_ingredient: "neue Zutat" } as const;

export function RecipeImport() {
  const [state, setState] = useState<"idle" | "uploading" | "done">("idle");
  const [errors, setErrors] = useState<RowError[]>([]);
  const [recipes, setRecipes] = useState<ImportRecipe[]>([]);
  const [plan, setPlan] = useState<PlannedRecipe[] | null>(null);
  const [create, setCreate] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const preview = (r: ImportRecipe[], c: boolean) => start(async () => {
    const res = await previewRecipeImport(r, c);
    if (res.ok) setPlan(res.data); else toast.error(res.error);
  });
  const onFile = async (file: File) => {
    setState("uploading"); setPlan(null); setResult(null);
    try {
      const parsed = parseRecipeTable(await readTable(file));
      setErrors(parsed.errors);
      setRecipes(parsed.recipes);
      if (parsed.recipes.length) preview(parsed.recipes, create);
    } catch {
      setErrors([{ row: 1, message: "Die Datei lässt sich nicht lesen. Bitte als .xlsx oder .csv speichern." }]);
    }
    setState("done");
  };
  const apply = () => start(async () => {
    const res = await importRecipes(recipes, create);
    if (!res.ok) return void toast.error(res.error);
    const d = res.data;
    setResult(`${countOf(d.recipes, "Rezept", "Rezepte")} angelegt${d.ingredients ? `, ${countOf(d.ingredients, "neue Zutat", "neue Zutaten")} (ohne Preis)` : ""}${d.skipped ? `, ${d.skipped} gab es schon` : ""}${d.errors.length ? `, ${countOf(d.errors.length, "Rezept", "Rezepte")} mit Fehlern` : ""}.`);
    setErrors(d.errors);
    preview(recipes, create);
  });
  const n = (st: PlannedRecipe["status"]) => plan?.filter((p) => p.status === st).length ?? 0;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={downloadTemplate}><Download aria-hidden className="size-4" /> Vorlage herunterladen</Button>
        <p className="text-sm text-text-muted">Eine Zeile pro Zutat. Spalten <strong>Rezept, Zutat, Menge, Einheit</strong>, optional Portionen, Kategorie, Art (Grundrezept), Verkaufspreis (brutto), Zubereitung. Ist der Rezeptname leer, gehört die Zeile zum Rezept darüber.</p>
      </div>
      <FileUpload label="Rezepte hochladen" accept=".xlsx,.csv" formats="Excel (.xlsx) oder CSV" maxBytes={5 * 1024 * 1024} state={state} errors={errors} doneText="Datei gelesen. Prüfe die Vorschau." onFile={onFile} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-6 accent-accent" checked={create} onChange={(e) => { setCreate(e.target.checked); if (recipes.length) preview(recipes, e.target.checked); }} />
        Unbekannte Zutaten anlegen (ohne Preis; den trägst du danach nach oder importierst die Preisliste)
      </label>

      {plan && (
        <section aria-labelledby="rp" className="flex flex-col gap-3">
          <h2 id="rp" className="text-lg">Vorschau: {countOf(n("new"), "Rezept wird", "Rezepte werden")} angelegt{n("exists") ? `, ${n("exists")} gibt es schon` : ""}{n("error") ? `, ${n("error")} mit Fehlern` : ""}</h2>
          <ul className="flex flex-col gap-2">
            {plan.map((p) => (
              <li key={p.row} className="rounded-md border border-border bg-bg p-3">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{p.name} <span className="font-normal text-text-muted">· {p.portions} {p.portions === 1 ? "Portion" : "Portionen"}{p.semiFinished ? " · Grundrezept" : ""}</span> <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge></p>
                {p.message && <p className={p.status === "error" ? "text-sm text-danger" : "text-sm text-text-muted"}>{p.message}</p>}
                {p.lines.length > 0 && <p className="mt-1 text-sm text-text-muted">{p.lines.map((l) => `${l.quantity.toLocaleString("de-DE")} ${l.unit === "piece" ? "Stk" : l.unit === "portion" ? "Port." : l.unit} ${l.name}${l.kind === "ingredient" ? "" : ` (${KIND[l.kind]})`}`).join(" · ")}</p>}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <Button disabled={!n("new")} loading={pending} onClick={apply}>{countOf(n("new"), "Rezept", "Rezepte")} anlegen</Button>
            {result && <p role="status" className="text-sm">{result} <Link href="/recipes" className="font-semibold text-accent hover:underline">Zu den Rezepten</Link></p>}
          </div>
        </section>
      )}
    </div>
  );
}
