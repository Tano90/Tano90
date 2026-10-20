import { ClipboardList, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { getOpenCount, getStock, listOutlets } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { formatCents } from "@/lib/format";
import { StockTable } from "./stock-table";

export const metadata = { title: "Lager" };

const linkCls = "inline-flex h-(--size-control-md) items-center gap-2 rounded-sm border border-border-input bg-bg px-4 font-semibold hover:bg-row-hover";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const [all, open] = await Promise.all([getStock(s, outletId, sp.q), getOpenCount(s, outletId)]);
  const rows = sp.low ? all.filter((r) => r.belowMin) : all;
  const value = all.reduce((sum, r) => sum + r.valueCents, 0);
  return (
    <>
      <PageHeader
        title="Lager"
        description={<>Bestand in {outlet?.name}, bewertet zum gleitenden Durchschnittspreis. Gesamtwert <span className="num font-semibold text-text">{formatCents(Math.round(value))}</span>.</>}
        actions={
          <>
            <Link href="/stock/count" className={linkCls}><ClipboardList aria-hidden className="size-4" /> {open ? "Inventur fortsetzen" : "Inventur"}</Link>
            <Link href="/stock/waste" className={linkCls}><Trash2 aria-hidden className="size-4" /> Schwund buchen</Link>
          </>
        }
      />
      <StockTable rows={rows} filtered={!!(sp.q || sp.low)} />
    </>
  );
}
