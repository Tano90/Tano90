"use client";

import { Boxes, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setStockLevels } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { parseQuantity } from "@/components/ui/quantity-input";
import { toast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { cleanDecimal } from "@/components/ui/money-input";
import type { BaseUnit } from "@/domain/units";
import { formatCents, formatQty } from "@/lib/format";
import { formatBase, formatUnitPrice } from "@/lib/units-display";
import { useUrlFilters } from "@/lib/use-url-filters";

type Row = { id: string; name: string; category: string; baseUnit: BaseUnit; quantityBase: number; avgCostCents: number; valueCents: number; belowMin: boolean; minLevelBase: number | null; parLevelBase: number | null };

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
  {
    key: "levels", header: "Min / Ziel", align: "right", sortValue: (r) => r.minLevelBase ?? -1,
    cell: (r) => (
      <span className="inline-flex items-center justify-end gap-1">
        <span className="text-text-muted">{r.minLevelBase === null ? "–" : formatBase(r.minLevelBase, r.baseUnit)} / {r.parLevelBase === null ? "–" : formatBase(r.parLevelBase, r.baseUnit)}</span>
        <EditLevels row={r} />
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

// Levels are entered the way kitchens think (kg, l, pieces) and stored in base units.
const FACTOR: Record<BaseUnit, number> = { g: 1000, ml: 1000, piece: 1 };
const UNIT: Record<BaseUnit, string> = { g: "kg", ml: "l", piece: "Stk." };

function EditLevels({ row }: { row: Row }) {
  const router = useRouter();
  const f = FACTOR[row.baseUnit];
  const show = (v: number | null) => (v === null ? "" : formatQty(v / f));
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(show(row.minLevelBase));
  const [par, setPar] = useState(show(row.parLevelBase));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toBase = (v: string) => (v.trim() ? (parseQuantity(v) ?? NaN) * f : null);
  const save = () =>
    start(async () => {
      const [m, p] = [toBase(min), toBase(par)];
      if ([m, p].some((x) => x !== null && Number.isNaN(x))) return setError("Bitte eine Zahl angeben.");
      const res = await setStockLevels(row.id, { minLevelBase: m, parLevelBase: p });
      if (!res.ok) return setError(res.error);
      setError(null);
      setOpen(false);
      toast.success("Bestände gespeichert");
      router.refresh();
    });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) { setMin(show(row.minLevelBase)); setPar(show(row.parLevelBase)); setError(null); } }}
      trigger={<Button variant="ghost" size="icon" aria-label={`${row.name}: Mindest- und Zielbestand`} onClick={(e) => e.stopPropagation()}><SlidersHorizontal aria-hidden className="size-4" /></Button>}
      title={row.name}
      description="Unter dem Mindestbestand wird der Artikel markiert und am Morgen gemeldet. Der Bestellvorschlag füllt bis zum Zielbestand auf."
      footer={<Button onClick={save} loading={pending}>Speichern</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {error && <p role="alert" className="text-danger sm:col-span-2">{error}</p>}
        <Field label={`Mindestbestand (${UNIT[row.baseUnit]})`} hint="Leer = keine Warnung">
          <Input inputMode="decimal" className="text-right" value={min} onChange={(e) => setMin(cleanDecimal(e.target.value))} />
        </Field>
        <Field label={`Zielbestand (${UNIT[row.baseUnit]})`} hint="Leer = kein Vorschlag">
          <Input inputMode="decimal" className="text-right" value={par} onChange={(e) => setPar(cleanDecimal(e.target.value))} />
        </Field>
      </div>
    </Dialog>
  );
}
