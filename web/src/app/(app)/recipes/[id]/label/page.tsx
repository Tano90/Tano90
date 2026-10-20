import { notFound } from "next/navigation";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { ALLERGENS } from "@/lib/allergen-labels";
import { getRecipeLabel } from "@/data/repo";
import { requireSession } from "@/data/session";
import type { Totals } from "@/domain/nutrition";
import { PrintButton } from "./print-button";

export const metadata = { title: "Etikett" };

const nf = (digits: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const ROWS: { label: string; indent?: boolean; value: (t: Totals) => string }[] = [
  { label: "Energie", value: (t) => `${nf(0).format(t.energyKcal * 4.184)} kJ / ${nf(0).format(t.energyKcal)} kcal` },
  { label: "Fett", value: (t) => `${nf(1).format(t.fatG)} g` },
  { label: "davon gesättigte Fettsäuren", indent: true, value: (t) => `${nf(1).format(t.saturatedFatG)} g` },
  { label: "Kohlenhydrate", value: (t) => `${nf(1).format(t.carbohydrateG)} g` },
  { label: "davon Zucker", indent: true, value: (t) => `${nf(1).format(t.sugarsG)} g` },
  { label: "Eiweiß", value: (t) => `${nf(1).format(t.proteinG)} g` },
  { label: "Salz", value: (t) => `${nf(2).format(t.saltG)} g` },
];

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const label = await getRecipeLabel(s, id);
  if (!label) notFound();
  const name = (k: string) => ALLERGENS.find(([a]) => a === k)?.[1] ?? k;
  const by = (status: string) => Object.entries(label.allergens).filter(([, v]) => v === status).map(([k]) => name(k));
  const [contains, traces, unknown] = [by("contains"), by("may_contain"), by("unknown")];
  const n = label.nutrition;
  const per = label.netUnit === "ml" ? "100 ml" : "100 g";
  return (
    <>
      <PageHeader title={`Etikett: ${label.name}`} back={{ href: `/recipes/${id}`, label: label.name }} actions={<PrintButton />} />
      <div className="flex flex-col gap-4">
        {(unknown.length > 0 || n.missing.length > 0) && (
          <Notice tone="warning">
            {unknown.length > 0 && <>Nicht geprüft: {unknown.join(", ")}. Erst in den Zutaten klären, dann drucken. </>}
            {n.missing.length > 0 && <>Ohne Nährwerte: {n.missing.join(", ")}. Die Werte unten sind deshalb zu niedrig.</>}
          </Notice>
        )}
        <article data-print aria-label="Etikett" className="max-w-xl rounded-md border border-border bg-bg p-6">
          <h2 className="text-xl">{label.name}</h2>
          <p className="mt-3">
            <span className="font-semibold">Zutaten: </span>
            {n.byWeight.map((x) => x.name).join(", ") || "–"}
          </p>
          <p className="mt-2">
            <span className="font-semibold">Allergene: </span>
            {contains.length ? `enthält ${contains.join(", ")}` : unknown.length ? "noch nicht vollständig geprüft" : "keine der 14 Hauptallergene enthalten"}
            {traces.length > 0 && `. Kann Spuren enthalten von ${traces.join(", ")}`}.
          </p>
          <table className="mt-4 w-full text-sm">
            <caption className="mb-1 text-left font-semibold">Durchschnittliche Nährwerte</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1 text-left font-normal"><span className="sr-only">Nährstoff</span></th>
                {n.per100 && <th scope="col" className="py-1 text-right font-semibold">je {per}</th>}
                <th scope="col" className="py-1 text-right font-semibold">je Portion</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-b border-border">
                  <th scope="row" className={r.indent ? "py-1 pl-4 text-left font-normal" : "py-1 text-left font-normal"}>{r.label}</th>
                  {n.per100 && <td className="num py-1 text-right">{r.value(n.per100)}</td>}
                  <td className="num py-1 text-right">{r.value(n.perPortion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-text-muted">
            Eine Portion = 1/{nf(0).format(label.portions)} des Rezepts. {!n.per100 && "Werte je 100 g fehlen, weil die Ausbeute unbekannt ist. "}{label.libraryName}
          </p>
        </article>
      </div>
    </>
  );
}
