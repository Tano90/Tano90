"use client";

import { Download, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReportRow } from "@/domain/stock";
import type { BaseUnit } from "@/domain/units";
import { formatCents, formatQty } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

type Row = ReportRow & { name: string; category: string; baseUnit: BaseUnit };

const qty = (q: number, unit: BaseUnit) => (Math.abs(q) < 1e-9 ? "–" : formatBase(q, unit));
const signed = (q: number, unit: BaseUnit) => (Math.abs(q) < 1e-9 ? "–" : `${q > 0 ? "+" : "−"}${formatBase(Math.abs(q), unit)}`);

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Zutat", sortValue: (r) => r.name, cell: (r) => <span className="font-semibold">{r.name}</span> },
  { key: "opening", header: "Anfang", align: "right", sortValue: (r) => r.openingBase, cell: (r) => qty(r.openingBase, r.baseUnit) },
  { key: "delivered", header: "Eingang", align: "right", sortValue: (r) => r.columns.delivered.base, cell: (r) => signed(r.columns.delivered.base, r.baseUnit) },
  { key: "transfer", header: "Umbuchung", align: "right", sortValue: (r) => r.columns.transfer.base, cell: (r) => signed(r.columns.transfer.base, r.baseUnit) },
  { key: "sold", header: "Verkauf", align: "right", sortValue: (r) => r.columns.sold.base, cell: (r) => signed(r.columns.sold.base, r.baseUnit) },
  { key: "waste", header: "Schwund", align: "right", sortValue: (r) => r.columns.waste.base, cell: (r) => signed(r.columns.waste.base, r.baseUnit) },
  { key: "count", header: "Inventur & Korrektur", align: "right", sortValue: (r) => r.columns.countDiff.base + r.columns.other.base, cell: (r) => signed(r.columns.countDiff.base + r.columns.other.base, r.baseUnit) },
  { key: "closing", header: "Ende", align: "right", sortValue: (r) => r.closingBase, cell: (r) => <span className="font-semibold">{qty(r.closingBase, r.baseUnit)}</span> },
  { key: "value", header: "Wert", align: "right", sortValue: (r) => r.closingCents, cell: (r) => formatCents(Math.round(r.closingCents)) },
];

// Spreadsheet-friendly for German Excel: semicolons, decimal comma, base units in the header.
function toCsv(rows: Row[]) {
  const n = (x: number) => formatQty(x).replace(/\./g, "");
  const unit = { g: "g", ml: "ml", piece: "Stk" } as const;
  const head = ["Zutat", "Kategorie", "Einheit", "Anfang", "Eingang", "Umbuchung", "Verkauf", "Schwund", "Inventurdifferenz", "Sonstiges", "Ende", "Wert EUR"];
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((r) => [
    r.name, r.category, unit[r.baseUnit], n(r.openingBase), n(r.columns.delivered.base), n(r.columns.transfer.base), n(r.columns.sold.base),
    n(r.columns.waste.base), n(r.columns.countDiff.base), n(r.columns.other.base), n(r.closingBase), (r.closingCents / 100).toFixed(2).replace(".", ","),
  ].map(esc).join(";"));
  return `﻿${[head.join(";"), ...lines].join("\r\n")}\r\n`;
}

export function ReportTable({ rows, from, to, outletName }: { rows: Row[]; from: string; to: string; outletName: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const slug = outletName.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-");
    const a = Object.assign(document.createElement("a"), { href: url, download: `lagerbericht-${slug}-${from}-${to}.csv` });
    document.body.append(a); // Chromium ignores the file name on links outside the document
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section aria-labelledby="report-rows" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="report-rows" className="text-lg">Bewegungen je Zutat</h2>
        <Button variant="secondary" size="sm" disabled={!rows.length} onClick={download}><Download aria-hidden className="size-4" /> Als CSV exportieren</Button>
      </div>
      <DataTable
        caption="Lagerbericht"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.ingredientId}
        empty={<EmptyState icon={FileBarChart} title="Keine Bewegungen" body="In diesem Zeitraum wurde in diesem Outlet nichts gebucht, und es liegt nichts auf Lager." />}
      />
    </section>
  );
}
