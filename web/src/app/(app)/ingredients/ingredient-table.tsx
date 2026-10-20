"use client";

import { Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import type { BaseUnit } from "@/domain/units";
import { formatUnitPrice } from "@/lib/units-display";
import { useUrlFilters } from "@/lib/use-url-filters";

type Row = { id: string; name: string; category: string; supplier: string; baseUnit: BaseUnit; costPerBaseCents: number | null; allergensVerified: boolean };
type Opt = { value: string; label: string };

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", sortValue: (r) => r.name, cell: (r) => <Link href={`/ingredients/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
  { key: "category", header: "Kategorie", sortValue: (r) => r.category, cell: (r) => r.category },
  { key: "supplier", header: "Lieferant", sortValue: (r) => r.supplier, cell: (r) => r.supplier },
  {
    key: "price", header: "Preis", align: "right", sortValue: (r) => r.costPerBaseCents ?? -1,
    cell: (r) => (r.costPerBaseCents === null ? <Badge tone="warning">kein Preis</Badge> : formatUnitPrice(r.costPerBaseCents, r.baseUnit)),
  },
  { key: "allergens", header: "Allergene", cell: (r) => (r.allergensVerified ? <Badge tone="success">geprüft</Badge> : <Badge tone="warning">ungeprüft</Badge>) },
];

export function IngredientTable({ rows, filtered, categories, suppliers, canEdit }: { rows: Row[]; filtered: boolean; categories: Opt[]; suppliers: Opt[]; canEdit: boolean }) {
  const router = useRouter();
  const f = useUrlFilters();
  const cat = f.params.get("cat");
  const sup = f.params.get("sup");
  const chips = [
    cat && { key: "cat", label: `Kategorie: ${categories.find((c) => c.value === cat)?.label ?? "?"}` },
    sup && { key: "sup", label: `Lieferant: ${suppliers.find((c) => c.value === sup)?.label ?? "?"}` },
    f.params.get("unverified") && { key: "unverified", label: "Nur ungeprüfte Allergene" },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar query={f.query} onQueryChange={f.setQuery} placeholder="Zutaten suchen" chips={chips} onRemoveChip={(k) => f.set({ [k]: null })}>
        <Select aria-label="Kategorie" className="w-44" value={cat ?? ""} onChange={(e) => f.set({ cat: e.target.value || null })}>
          <option value="">Alle Kategorien</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <Select aria-label="Lieferant" className="w-48" value={sup ?? ""} onChange={(e) => f.set({ sup: e.target.value || null })}>
          <option value="">Alle Lieferanten</option>
          {suppliers.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!f.params.get("unverified")} onChange={(e) => f.set({ unverified: e.target.checked ? "1" : null })} />
          Allergene ungeprüft
        </label>
      </FilterBar>
      <p className="text-xs font-normal text-text-muted" aria-live="polite">{rows.length} Zutaten</p>
      <DataTable
        caption="Zutaten"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        filtered={filtered}
        onClearFilters={f.clear}
        onRowClick={(r) => router.push(`/ingredients/${r.id}`)}
        empty={
          <EmptyState
            icon={Package}
            title="Noch keine Zutaten"
            body="Lege deine erste Zutat mit Gebinde und Preis an. Danach kannst du Rezepte kalkulieren."
            action={canEdit && <Link href="/ingredients/new" className="font-semibold text-accent underline">Zutat anlegen</Link>}
          />
        }
      />
    </div>
  );
}
