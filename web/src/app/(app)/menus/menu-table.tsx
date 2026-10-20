"use client";

import { AlertTriangle, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatBp, formatCents } from "@/lib/format";
import { useUrlFilters } from "@/lib/use-url-filters";

type Row = {
  id: string; name: string; category: string; courses: number; dishes: number; priceCents: number | null; costCents: number; missing: number;
  foodCostBp: number | null; marginBp: number | null; targetMarginBp: number | null; belowTarget: boolean;
};

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", sortValue: (r) => r.name, cell: (r) => <Link href={`/menus/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
  { key: "category", header: "Kategorie", sortValue: (r) => r.category, cell: (r) => r.category },
  { key: "courses", header: "Gänge", align: "right", sortValue: (r) => r.courses, cell: (r) => `${r.courses} · ${r.dishes} Gerichte` },
  {
    key: "cost", header: "Wareneinsatz", align: "right", sortValue: (r) => r.costCents,
    cell: (r) => (
      <span className="inline-flex items-center gap-1">
        {r.missing > 0 && <AlertTriangle className="size-4 text-warning" aria-label={`${r.missing} Gerichte ohne vollständige Preise, Wareneinsatz unvollständig`} />}
        {formatCents(Math.round(r.costCents))}
      </span>
    ),
  },
  { key: "price", header: "Preis", align: "right", sortValue: (r) => r.priceCents ?? -1, cell: (r) => (r.priceCents ? formatCents(r.priceCents) : "–") },
  {
    key: "margin", header: "Marge", align: "right", sortValue: (r) => r.marginBp ?? -1,
    cell: (r) => r.marginBp === null ? "–" : <Badge tone={r.belowTarget ? "danger" : "success"}>{formatBp(r.marginBp)}{r.belowTarget ? " · unter Ziel" : ""}</Badge>,
  },
];

export function MenuTable({ rows, filtered, canEdit }: { rows: Row[]; filtered: boolean; canEdit: boolean }) {
  const router = useRouter();
  const f = useUrlFilters();
  return (
    <div className="flex flex-col gap-4">
      <FilterBar query={f.query} onQueryChange={f.setQuery} placeholder="Menüs suchen" />
      <DataTable
        caption="Menüs"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        filtered={filtered}
        onClearFilters={f.clear}
        onRowClick={(r) => router.push(`/menus/${r.id}`)}
        empty={
          <EmptyState
            icon={UtensilsCrossed}
            title="Noch keine Menüs"
            body="Stell Gänge aus deinen Rezepten zusammen und sieh sofort, was das Menü kostet und was übrig bleibt."
            action={canEdit && <Link href="/menus/new" className="font-semibold text-accent underline">Menü anlegen</Link>}
          />
        }
      />
    </div>
  );
}
