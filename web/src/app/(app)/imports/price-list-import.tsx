"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";
import { applyPriceList, previewPriceList } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { FileUpload, type RowError } from "@/components/ui/file-upload";
import { toast } from "@/components/ui/toast";
import { csvTable } from "@/domain/csv";
import { type Cell, type PlanRow, type PriceRow, parsePriceList } from "@/domain/price-list";
import { countOf, formatCents } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

type Opt = { value: string; label: string };
const PART = 300; // rows per server call: small enough for any host's request limits

const TEMPLATE = [
  "Zutat;Gebinde;Inhalt;Einheit;Preis;Preis je;Artikelnummer;Kategorie",
  "Butter;Karton 10 × 250 g;2,5;kg;23,90;Gebinde;B-1001;Molkereiprodukte",
  "Knollensellerie;Kiste;5;kg;2,40;kg;;Gemüse",
  "Olivenöl nativ extra;Kanister;5;l;42,00;Gebinde;OEL-5;Gewürze & Öle",
].join("\r\n");

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([`﻿${TEMPLATE}\r\n`], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "preisliste-vorlage.csv" });
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

const price = (cents: number, perUnitBase: number | null, unit: PriceRow["baseUnit"]) =>
  perUnitBase ? `${formatCents(cents)} / ${unit === "g" ? "kg" : unit === "ml" ? "l" : "Stk."}` : formatCents(cents);
const KIND: Record<PlanRow["kind"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  new_ingredient: { label: "neue Zutat", tone: "success" },
  new_price: { label: "neuer Preis", tone: "success" },
  changed: { label: "Preis geändert", tone: "warning" },
  same: { label: "unverändert", tone: "neutral" },
  error: { label: "Fehler", tone: "danger" },
};

export function PriceListImport({ suppliers, initialSupplierId }: { suppliers: Opt[]; initialSupplierId: string }) {
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [state, setState] = useState<"idle" | "uploading" | "done">("idle");
  const [parseErrors, setParseErrors] = useState<RowError[]>([]);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [applying, startApply] = useTransition();

  const preview = async (r: PriceRow[], supplier: string) => {
    const out: PlanRow[] = [];
    for (let i = 0; i < r.length; i += PART) {
      const res = await previewPriceList(supplier, r.slice(i, i + PART)).catch(() => ({ ok: false as const, error: "Verbindung unterbrochen." }));
      if (!res.ok) {
        toast.error("Vorschau fehlgeschlagen", { description: res.error });
        return null;
      }
      out.push(...res.data);
    }
    return out;
  };

  const onFile = async (file: File) => {
    setState("uploading");
    setPlan(null);
    setResult(null);
    let table: Cell[][];
    try {
      table = await readTable(file);
    } catch {
      setState("idle");
      setParseErrors([{ row: 1, message: "Die Datei lässt sich nicht lesen. Bitte als .xlsx oder .csv speichern." }]);
      return;
    }
    const parsed = parsePriceList(table);
    setParseErrors(parsed.errors);
    setRows(parsed.rows);
    setPlan(parsed.rows.length ? await preview(parsed.rows, supplierId) : []);
    setState("done");
  };

  const changeSupplier = async (v: string) => {
    setSupplierId(v);
    setResult(null);
    if (rows.length) setPlan(await preview(rows, v));
  };

  const apply = () =>
    startApply(async () => {
      const total = { ingredients: 0, prices: 0, changed: 0, same: 0, errors: [] as RowError[] };
      for (let i = 0; i < rows.length; i += PART) {
        const res = await applyPriceList(supplierId, rows.slice(i, i + PART)).catch(() => ({ ok: false as const, error: "Verbindung unterbrochen." }));
        if (!res.ok) {
          toast.error("Import abgebrochen", { description: `${res.error} Übernommenes bleibt; die Datei kann gefahrlos noch einmal importiert werden.` });
          break;
        }
        total.ingredients += res.data.ingredients;
        total.prices += res.data.prices;
        total.changed += res.data.changed;
        total.same += res.data.same;
        total.errors.push(...res.data.errors);
      }
      setResult(`${countOf(total.prices, "neuer Preis", "neue Preise")} (davon ${countOf(total.ingredients, "neue Zutat", "neue Zutaten")}), ${countOf(total.changed, "Preis", "Preise")} geändert, ${total.same} unverändert${total.errors.length ? `, ${countOf(total.errors.length, "Zeile", "Zeilen")} mit Fehlern` : ""}.`);
      setPlan(await preview(rows, supplierId));
    });

  const count = (k: PlanRow["kind"]) => plan?.filter((p) => p.kind === k).length ?? 0;
  const actionable = count("new_ingredient") + count("new_price") + count("changed");
  const allErrors = [...parseErrors, ...(plan ?? []).filter((p) => p.kind === "error").map((p) => ({ row: p.row, message: p.message! }))].sort((a, b) => a.row - b.row);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Lieferant" className="w-64">
          <Select value={supplierId} onChange={(e) => changeSupplier(e.target.value)}>
            {suppliers.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Button variant="secondary" onClick={downloadTemplate}><Download aria-hidden className="size-4" /> Vorlage herunterladen</Button>
      </div>
      <p className="text-text-muted">
        Eine Zeile pro Artikel mit den Spalten <strong>Zutat, Inhalt, Einheit, Preis</strong>; dazu optional Gebinde, Preis je (Gebinde, kg, l, Stk), Artikelnummer, Kategorie.
        Zutaten werden über den Namen gefunden, Gebinde über ihre Größe. Unbekannte Zutaten werden angelegt.
      </p>
      <FileUpload label="Preisliste hochladen" accept=".xlsx,.csv" formats="Excel (.xlsx) oder CSV" maxBytes={5 * 1024 * 1024} state={state} errors={allErrors} doneText="Datei gelesen, keine Fehler. Prüfe die Vorschau und übernimm dann." onFile={onFile} />

      {plan && plan.length > 0 && (
        <section aria-labelledby="preview" className="flex flex-col gap-3">
          <h2 id="preview" className="text-lg">Vorschau</h2>
          <p role="status">
            {count("new_ingredient") + count("new_price")} neu (davon {countOf(count("new_ingredient"), "neue Zutat", "neue Zutaten")}), {countOf(count("changed"), "Preis ändert", "Preise ändern")} sich, {count("same")} unverändert, {count("error")} mit Fehlern.
          </p>
          <div className="overflow-x-auto rounded-md border border-border bg-bg">
            <table className="w-full text-sm">
              <caption className="sr-only">Vorschau der Preisliste</caption>
              <thead className="bg-surface text-xs text-text-muted">
                <tr className="h-(--size-table-row)">
                  <th scope="col" className="px-3 text-right">Zeile</th>
                  <th scope="col" className="px-3 text-left">Zutat</th>
                  <th scope="col" className="px-3 text-left">Gebinde</th>
                  <th scope="col" className="px-3 text-right">Preis bisher</th>
                  <th scope="col" className="px-3 text-right">Preis neu</th>
                  <th scope="col" className="px-3 text-left">Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {plan.slice(0, 200).map((p) => (
                  <tr key={p.row} className="h-(--size-table-row) border-t border-border">
                    <td className="num px-3 text-right text-text-muted">{p.row}</td>
                    <td className="px-3">{p.ingredient}</td>
                    <td className="px-3">{p.packLabel} <span className="text-text-muted">({formatBase(p.packBase, p.baseUnit)})</span></td>
                    <td className="num px-3 text-right">{p.oldPriceCents !== undefined ? price(p.oldPriceCents, p.oldPerUnitBase ?? null, p.baseUnit) : "–"}</td>
                    <td className="num px-3 text-right">{price(p.priceCents, p.perUnitBase, p.baseUnit)}</td>
                    <td className="px-3"><Badge tone={KIND[p.kind].tone}>{KIND[p.kind].label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.length > 200 && <p className="text-text-muted">Es werden die ersten 200 von {plan.length} Zeilen gezeigt; übernommen werden alle.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={apply} loading={applying} disabled={!actionable}>{countOf(actionable, "Zeile", "Zeilen")} übernehmen</Button>
            {result && <p role="status" className="font-semibold">{result}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
