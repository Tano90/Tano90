"use client";

import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importSalesCsv, linkPosItem } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { FileUpload, type RowError } from "@/components/ui/file-upload";
import { toast } from "@/components/ui/toast";
import { formatQty } from "@/lib/format";
import { useUrlFilters } from "@/lib/use-url-filters";

export function SalesImport() {
  const [state, setState] = useState<"idle" | "uploading" | "done">("idle");
  const [errors, setErrors] = useState<RowError[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  return (
    <section aria-labelledby="import" className="flex flex-col gap-3">
      <h2 id="import" className="text-lg">Verkäufe importieren</h2>
      <p className="text-text-muted">
        CSV-Export der Kasse mit Kopfzeile, z. B. <code className="num rounded-sm bg-surface-sunken px-1">Belegposition;PLU;Artikel;Menge;Umsatz netto;Zeitpunkt</code>.
        Schon importierte Belegpositionen werden übersprungen, du kannst dieselbe Datei also gefahrlos noch einmal hochladen.
      </p>
      <FileUpload
        label="Verkäufe als CSV hochladen"
        accept=".csv,text/csv"
        formats="CSV"
        maxBytes={5 * 1024 * 1024}
        state={state}
        errors={errors}
        onFile={async (file) => {
          setState("uploading");
          setSummary(null);
          const res = await importSalesCsv(await file.text()).catch(() => ({ ok: false as const, error: "Verbindung unterbrochen. Bitte noch einmal versuchen." }));
          if (!res.ok) {
            setState("idle");
            setErrors([]);
            toast.error("Import fehlgeschlagen", { description: res.error });
            return;
          }
          const r = res.data;
          setErrors(r.errors);
          setState("done");
          setSummary(`${r.imported} Verkäufe übernommen, ${r.duplicates} schon vorhanden, ${r.depleted} vom Lager abgebucht${r.unmapped ? `, ${r.unmapped} warten auf ein Rezept` : ""}.${r.errorCount > r.errors.length ? ` Es werden nur die ersten ${r.errors.length} von ${r.errorCount} Fehlern gezeigt.` : ""}`);
          // No router.refresh(): the action's revalidatePath already brings fresh data, and a second refresh
          // would pass through the loading boundary and reset this component (the summary would vanish).
        }}
      />
      {summary && <p role="status" className="font-semibold">{summary}</p>}
    </section>
  );
}

type Item = { id: string; plu: string; name: string; recipeId: string | null; ignored: boolean; recipeName: string | null; sold30: number; pending: number };

function LinkCell({ item, recipes }: { item: Item; recipes: { value: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const value = item.ignored ? "__ignore" : item.recipeId ?? "";
  return (
    <Select
      aria-label={`Rezept für ${item.name}`}
      className="min-w-48"
      value={value}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          const res = await linkPosItem(item.id, { recipeId: v && v !== "__ignore" ? v : null, ignored: v === "__ignore" });
          if (!res.ok) return void toast.error("Nicht gespeichert", { description: res.error });
          toast.success(v === "__ignore" ? `„${item.name}“ wird ignoriert` : v ? `„${item.name}“ verknüpft` : "Verknüpfung gelöst", res.data.depleted ? { description: `${res.data.depleted} wartende Verkäufe vom Lager abgebucht.` } : undefined);
          router.refresh();
        });
      }}
    >
      <option value="">Nicht verknüpft</option>
      <option value="__ignore">Ignorieren (kein Lagerabzug)</option>
      {recipes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
    </Select>
  );
}

export function PosItems({ items, recipes, openCount, filtered }: { items: Item[]; recipes: { value: string; label: string }[]; openCount: number; filtered: boolean }) {
  const f = useUrlFilters();
  const columns: Column<Item>[] = [
    { key: "plu", header: "PLU", sortValue: (r) => r.plu, cell: (r) => <span className="num">{r.plu}</span> },
    { key: "name", header: "Kassenartikel", sortValue: (r) => r.name, cell: (r) => r.name },
    { key: "recipe", header: "Rezept", sortValue: (r) => r.recipeName ?? "", cell: (r) => <LinkCell item={r} recipes={recipes} /> },
    {
      key: "state", header: "Status", sortValue: (r) => (r.ignored ? 2 : r.recipeId ? 1 : 0),
      cell: (r) => r.ignored ? <Badge>ignoriert</Badge> : r.recipeId ? <Badge tone="success">verknüpft</Badge> : <Badge tone="warning">{r.pending ? `${formatQty(r.pending)} warten` : "offen"}</Badge>,
    },
    { key: "sold", header: "Verkauft (30 Tage)", align: "right", sortValue: (r) => r.sold30, cell: (r) => formatQty(r.sold30) },
  ];
  return (
    <section aria-labelledby="items" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="items" className="text-lg">Kassenartikel</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filtered} onChange={(e) => f.set({ open: e.target.checked ? "1" : null })} /> Nur nicht verknüpfte ({openCount})
        </label>
      </div>
      <DataTable
        caption="Kassenartikel"
        columns={columns}
        rows={items}
        rowKey={(r) => r.id}
        filtered={filtered}
        onClearFilters={() => f.set({ open: null })}
        empty={<EmptyState icon={Link2} title="Noch keine Kassenartikel" body="Sie entstehen beim ersten Import oder beim ersten Aufruf der Schnittstelle, eine Zeile je PLU." />}
      />
    </section>
  );
}
