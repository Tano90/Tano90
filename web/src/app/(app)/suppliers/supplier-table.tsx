"use client";

import { Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { useUrlFilters } from "@/lib/use-url-filters";

type Row = { id: string; companyName: string; orderEmail: string | null; leadTimeDays: number; itemCount: number };

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Firma", sortValue: (r) => r.companyName, cell: (r) => <Link href={`/suppliers/${r.id}`} className="font-semibold hover:underline">{r.companyName}</Link> },
  { key: "mail", header: "Bestellungen an", cell: (r) => r.orderEmail ?? <Badge tone="warning">keine Adresse</Badge> },
  { key: "lead", header: "Lieferzeit", align: "right", sortValue: (r) => r.leadTimeDays, cell: (r) => `${r.leadTimeDays} ${r.leadTimeDays === 1 ? "Tag" : "Tage"}` },
  { key: "items", header: "Artikel", align: "right", sortValue: (r) => r.itemCount, cell: (r) => r.itemCount },
];

export function SupplierTable({ rows, filtered, canEdit }: { rows: Row[]; filtered: boolean; canEdit: boolean }) {
  const router = useRouter();
  const f = useUrlFilters();
  return (
    <div className="flex flex-col gap-4">
      <FilterBar query={f.query} onQueryChange={f.setQuery} placeholder="Lieferanten suchen" />
      <DataTable
        caption="Lieferanten"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        filtered={filtered}
        onClearFilters={f.clear}
        onRowClick={(r) => router.push(`/suppliers/${r.id}`)}
        empty={<EmptyState icon={Truck} title="Noch keine Lieferanten" body="Lege an, bei wem du einkaufst. Danach kannst du Zutaten Preise zuordnen und bestellen." action={canEdit && <Link href="/suppliers/new" className="font-semibold text-accent underline">Lieferant anlegen</Link>} />}
      />
    </div>
  );
}
