"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { importOccupancyCsv, saveOccupancyPlan } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "@/components/ui/toast";
import type { PlanRow } from "@/data/linen-types";
import { cn } from "@/lib/cn";

type Key = "arrivals" | "departures" | "stayovers";
const COLS: { key: Key; label: string }[] = [{ key: "arrivals", label: "Anreisen" }, { key: "departures", label: "Abreisen" }, { key: "stayovers", label: "Bleiber" }];
const typeLabel = (t: string) => t || "Ohne Zimmertyp";
const dayLabel = (d: string) => new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export function PlanEditor({ days, roomTypes, plan }: { days: string[]; roomTypes: string[]; plan: PlanRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const types = roomTypes.length ? roomTypes : [""];
  const [type, setType] = useState(types.find((t) => plan.some((r) => r.roomType === t)) ?? types[types.length - 1]);
  const initial = useMemo(() => {
    const m: Record<string, Record<Key, string>> = {};
    for (const d of days) for (const t of types) {
      const r = plan.find((x) => x.day === d && x.roomType === t);
      m[`${d}|${t}`] = { arrivals: r ? String(r.arrivals) : "", departures: r ? String(r.departures) : "", stayovers: r ? String(r.stayovers) : "" };
    }
    return m;
  }, [days, types, plan]);
  const [values, setValues] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const changed = Object.keys(values).filter((k) => COLS.some((c) => values[k][c.key] !== initial[k][c.key]));
  const invalid = changed.some((k) => COLS.some((c) => values[k][c.key] !== "" && !/^\d{1,4}$/.test(values[k][c.key])));

  const save = () => start(async () => {
    const rows = changed.map((k) => {
      const [day, roomType] = k.split("|");
      const n = (c: Key) => Number(values[k][c] || 0);
      return { day, roomType, arrivals: n("arrivals"), departures: n("departures"), stayovers: n("stayovers") };
    });
    const res = await saveOccupancyPlan(rows);
    if (res.ok) { toast.success(`Belegung gespeichert (${rows.length} ${rows.length === 1 ? "Tag" : "Tage"})`); router.refresh(); } else toast.error(res.error);
  });

  const onFile = (file: File) => {
    setUploading(true);
    start(async () => {
      const res = await importOccupancyCsv(await file.text());
      setUploading(false);
      if (res.ok) { toast.success(`${res.data} Zeilen übernommen`); router.refresh(); } else toast.error(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="grid" className="rounded-lg border border-border bg-bg p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="grid" className="text-lg">Nächste 3 Wochen</h2>
          {types.length > 1 && (
            <label className="flex items-center gap-2 text-sm">Zimmertyp
              <select className={cn(controlClass, "w-auto")} value={type} onChange={(e) => setType(e.target.value)}>
                {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead><tr className="text-left text-xs text-text-muted"><th scope="col" className="py-2 font-normal">Tag</th>{COLS.map((c) => <th key={c.key} scope="col" className="font-normal">{c.label}</th>)}</tr></thead>
            <tbody>
              {days.map((d) => {
                const k = `${d}|${type}`;
                return (
                  <tr key={k} className="border-t border-border">
                    <th scope="row" className="py-1 pr-3 text-left font-normal whitespace-nowrap">{dayLabel(d)}</th>
                    {COLS.map((c) => (
                      <td key={c.key} className="py-1 pr-2">
                        <input aria-label={`${c.label} ${dayLabel(d)}${types.length > 1 ? `, ${typeLabel(type)}` : ""}`} inputMode="numeric" className={cn(controlClass, "num w-24 text-right")}
                          aria-invalid={values[k][c.key] !== "" && !/^\d{1,4}$/.test(values[k][c.key]) || undefined}
                          value={values[k][c.key]} onChange={(e) => setValues((v) => ({ ...v, [k]: { ...v[k], [c.key]: e.target.value.trim() } }))} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={pending && !uploading} disabled={!changed.length || invalid}>Belegung speichern</Button>
          {invalid && <span className="text-sm text-danger">Nur ganze Zahlen ab 0.</span>}
          {!!changed.length && !invalid && <span className="text-sm text-text-muted">{changed.length} geänderte {changed.length === 1 ? "Zeile" : "Zeilen"}</span>}
        </div>
      </section>

      <section aria-labelledby="csv" className="max-w-2xl rounded-lg border border-border bg-bg p-4">
        <h2 id="csv" className="text-lg">Aus dem Hotelprogramm laden</h2>
        <p className="mt-1 text-sm text-text-muted">Eine CSV-Datei mit den Spalten <code>Datum;Zimmertyp;Anreisen;Abreisen;Bleiber</code> (Datum als 22.10.2026 oder 2026-10-22). Vorhandene Tage werden überschrieben; enthält eine Zeile einen Fehler, wird nichts übernommen.</p>
        <div className="mt-3"><FileUpload label="Belegungsbericht" accept=".csv,.txt" formats="CSV" state={uploading ? "uploading" : "idle"} onFile={onFile} /></div>
      </section>
    </div>
  );
}
