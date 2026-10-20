"use client";

import { Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import type { BaseUnit } from "@/domain/units";
import { formatCents } from "@/lib/format";
import { formatBase, formatUnitPrice } from "@/lib/units-display";
import { useUrlFilters } from "@/lib/use-url-filters";

type Row = { id: string; name: string; category: string; baseUnit: BaseUnit; quantityBase: number; avgCostCents: number; valueCents: number; belowMin: boolean; minLevelBase: number | null };

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Zutat", sortValue: (r) => r.name, cell: (r) => r.name },
  { key: "cat", header: "Kategorie", sortValue: (r) => r.category, cell: (r) => r.category },
  {
    key: "qty", header: "Bestand", align: "right", sortValue: (r) => r.quantityBase,
    cell: (r) => (
      <span className="inline-flex items-center justify-end gap-2">
        {r.quantityBase < 0 ? <Badge tone="danger">negativ</Badge> : r.belowMin && <Badge tone="warning">unter Minimum</Badge>}
        {formatBase(r.quantityBase, r.baseUnit)}
      </span>
    ),
  },
  { key: "avg", header: "Ø Preis", align: "right", sortValue: (r) => r.avgCostCents, cell: (r) => formatUnitPrice(r.avgCostCents || null, r.baseUnit) },
  { key: "value", header: "Wert", align: "right", sortValue: (r) => r.valueCents, cell: (r) => formatCents(Math.round(r.valueCents)) },
];

export function StockTable({ rows, filtered }: { rows: Row[]; filtered: boolean }) {
  const f = useUrlFilters();
  const low = !!f.params.get("low");
  return (
    <div className="flex flex-col gap-4">
      <FilterBar query={f.query} onQueryChange={f.setQuery} placeholder="Zutat suchen" chips={low ? [{ key: "low", label: "Nur unter Minimum" }] : []} onRemoveChip={() => f.set({ low: null })}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={low} onChange={(e) => f.set({ low: e.target.checked ? "1" : null })} /> Nur unter Minimum</label>
      </FilterBar>
      <DataTable
        caption="Lagerbestand"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        filtered={filtered}
        onClearFilters={f.clear}
        empty={<EmptyState icon={Boxes} title="Noch kein Bestand" body="Bestand entsteht durch Lieferungen und Inventuren." />}
      />
    </div>
  );
}
