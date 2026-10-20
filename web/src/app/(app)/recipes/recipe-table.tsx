"use client";

import { AlertTriangle, ChefHat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatBp, formatCents } from "@/lib/format";
import { useUrlFilters } from "@/lib/use-url-filters";

type Row = {
  id: string; name: string; category: string; productType: "finished" | "semi_finished"; perPortionCents: number; missing: number;
  foodCostBp: number | null; targetFoodCostBp: number | null; sellPriceCents: number | null;
};

const COLUMNS: Column<Row>[] = [
  {
    key: "name", header: "Name", sortValue: (r) => r.name,
    cell: (r) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Link href={`/recipes/${r.id}`} className="font-semibold hover:underline">{r.name}</Link>
        {r.productType === "semi_finished" && <Badge>Unterrezept</Badge>}
      </span>
    ),
  },
  { key: "category", header: "Kategorie", sortValue: (r) => r.category, cell: (r) => r.category },
  {
    key: "cost", header: "Kosten/Portion", align: "right", sortValue: (r) => r.perPortionCents,
    cell: (r) => (
      <span className="inline-flex items-center gap-1">
        {r.missing > 0 && <AlertTriangle className="size-4 text-warning" aria-label={`${r.missing} Zeilen ohne Preis, Kosten unvollständig`} />}
        {formatCents(Math.round(r.perPortionCents))}
      </span>
    ),
  },
  { key: "sell", header: "Verkaufspreis", align: "right", sortValue: (r) => r.sellPriceCents ?? -1, cell: (r) => (r.sellPriceCents ? formatCents(r.sellPriceCents) : "–") },
  {
    key: "fc", header: "Wareneinsatz", align: "right", sortValue: (r) => r.foodCostBp ?? -1,
    cell: (r) => {
      if (r.foodCostBp === null) return "–";
      const over = r.targetFoodCostBp !== null && r.foodCostBp > r.targetFoodCostBp;
      return <Badge tone={over ? "danger" : "success"}>{formatBp(r.foodCostBp)}{over ? " · über Ziel" : ""}</Badge>;
    },
  },
];

export function RecipeTable({ rows, filtered, categories, canEdit }: { rows: Row[]; filtered: boolean; categories: { value: string; label: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const f = useUrlFilters();
  const cat = f.params.get("cat");
  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        query={f.query}
        onQueryChange={f.setQuery}
        placeholder="Rezepte suchen"
        chips={cat ? [{ key: "cat", label: `Kategorie: ${categories.find((c) => c.value === cat)?.label ?? "?"}` }] : []}
        onRemoveChip={(k) => f.set({ [k]: null })}
      >
        <Select aria-label="Kategorie" className="w-44" value={cat ?? ""} onChange={(e) => f.set({ cat: e.target.value || null })}>
          <option value="">Alle Kategorien</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </FilterBar>
      <DataTable
        caption="Rezepte"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        filtered={filtered}
        onClearFilters={f.clear}
        onRowClick={(r) => router.push(`/recipes/${r.id}`)}
        empty={
          <EmptyState
            icon={ChefHat}
            title="Noch keine Rezepte"
            body="Leg ein Rezept an – noch beim Tippen siehst du, was ein Teller kostet."
            action={canEdit && <Link href="/recipes/new" className="font-semibold text-accent underline">Rezept anlegen</Link>}
          />
        }
      />
    </div>
  );
}
