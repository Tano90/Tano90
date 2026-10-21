"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setOutletCostCenter } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { ControllingRow } from "@/domain/controlling";
import { toCsv } from "@/domain/csv";
import { formatCents } from "@/lib/format";

type Row = ControllingRow & { outletId: string; name: string; costCenter: string | null };
const COLS: [keyof ControllingRow, string][] = [
  ["openingCents", "Anfangsbestand"], ["purchasesCents", "Einkauf"], ["transfersCents", "Umbuchungen"], ["closingCents", "Endbestand"],
  ["foodCostCents", "Wareneinsatz"], ["wasteCents", "davon Schwund"], ["countDiffCents", "davon Inventurdifferenz"], ["revenueCents", "Umsatz netto (Kasse)"],
];
const eur = (c: number) => formatCents(c);
const share = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1).replace(".", ",")} %`);
// Plain numbers for spreadsheets: comma as decimal mark, no currency sign.
const num = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function ControllingTable({ rows, month, monthLabel, months, canEditCostCenters }: { rows: Row[]; month: string; monthLabel: string; months: { value: string; label: string }[]; canEditCostCenters: boolean }) {
  const router = useRouter();
  const total = Object.fromEntries(COLS.map(([k]) => [k, rows.reduce((t, r) => t + (r[k] as number), 0)])) as Record<keyof ControllingRow, number>;
  const totalShare = total.revenueCents > 0 ? total.foodCostCents / total.revenueCents : null;
  const download = () => {
    const csv = toCsv([
      ["Monat", "Kostenstelle", "Outlet", ...COLS.map(([, l]) => `${l} (EUR)`), "Wareneinsatzquote (%)"],
      ...rows.map((r) => [month, r.costCenter, r.name, ...COLS.map(([k]) => num(r[k] as number)), r.foodCostShare === null ? null : (r.foodCostShare * 100).toFixed(1).replace(".", ",")]),
      [month, null, "Summe", ...COLS.map(([k]) => num(total[k])), totalShare === null ? null : (totalShare * 100).toFixed(1).replace(".", ",")],
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `fb-controlling-${month}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-xs">Monat
          <Select value={month} onChange={(e) => router.push(`/analytics/controlling?month=${e.target.value}`)} className="w-56">
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </label>
        <Button variant="secondary" disabled={!rows.length} onClick={download}><Download aria-hidden className="size-4" /> CSV für die Buchhaltung</Button>
      </div>
      {total.revenueCents === 0 && <Notice>Ohne Kassenumsatz in diesem Monat gibt es keine Quote. Verkäufe kommen über Auswertungen → Kasse (CSV oder Schnittstelle).</Notice>}
      <div className="overflow-x-auto rounded-md border border-border bg-bg">
        <table className="w-full min-w-[64rem] text-sm">
          <caption className="sr-only">F&B-Controlling {monthLabel}</caption>
          <thead className="bg-surface text-xs text-text-muted">
            <tr className="h-(--size-table-row)">
              <th scope="col" className="px-3 text-left">Outlet</th>
              <th scope="col" className="px-3 text-left">Kostenstelle</th>
              {COLS.map(([k, l]) => <th key={k} scope="col" className="px-3 text-right">{l}</th>)}
              <th scope="col" className="px-3 text-right">Quote</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.outletId} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-semibold">{r.name}</th>
                <td className="px-3 py-2">{canEditCostCenters ? <CostCenter outletId={r.outletId} name={r.name} value={r.costCenter} /> : (r.costCenter ?? "–")}</td>
                {COLS.map(([k]) => <td key={k} className={`num px-3 py-2 text-right ${k === "foodCostCents" ? "font-semibold" : ""}`}>{eur(r[k] as number)}</td>)}
                <td className="num px-3 py-2 text-right font-semibold">{share(r.foodCostShare)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border bg-surface font-semibold">
            <tr>
              <th scope="row" className="px-3 py-2 text-left" colSpan={2}>Summe {monthLabel}</th>
              {COLS.map(([k]) => <td key={k} className="num px-3 py-2 text-right">{eur(total[k])}</td>)}
              <td className="num px-3 py-2 text-right">{share(totalShare)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-text-muted">Wareneinsatz = Anfangsbestand + Einkauf ± Umbuchungen − Endbestand. Schwund und Inventurdifferenz sind darin enthalten und zur Orientierung einzeln ausgewiesen. Der Export ist eine Auswertung für die Buchhaltung, keine Buchung.</p>
    </div>
  );
}

function CostCenter({ outletId, name, value }: { outletId: string; name: string; value: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(value ?? "");
  const [pending, start] = useTransition();
  const save = () => {
    if (v === (value ?? "")) return;
    start(async () => {
      const res = await setOutletCostCenter(outletId, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Kostenstelle für ${name} gespeichert`);
      router.refresh();
    });
  };
  return (
    <input
      aria-label={`Kostenstelle ${name}`}
      className="h-(--size-control-sm) w-24 rounded-sm border border-border-input bg-bg px-2 text-sm"
      value={v}
      maxLength={20}
      disabled={pending}
      placeholder="z. B. 4100"
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}
