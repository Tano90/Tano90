"use client";

import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { deleteFunnelDay, saveFunnelDays, saveFunnelSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, controlClass } from "@/components/ui/field";
import { FileUpload, type RowError } from "@/components/ui/file-upload";
import { StatTile } from "@/components/ui/stat-tile";
import { toast } from "@/components/ui/toast";
import type { FunnelEntry } from "@/data/cost-types";
import { FUNNEL_STEPS, type FunnelImportRow, type FunnelStep, type StepSetting, funnelSummary, parseFunnelCsv } from "@/domain/funnel";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";

const pct = (v: number | null) => (v === null ? "–" : `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`);
const signed = (c: number) => `${c > 0 ? "+" : ""}${formatCents(c)}`;
const units = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`;
const euro = (v: string) => { const t = v.trim().replace(/\s|€/g, "").replace(",", "."); return /^\d{1,4}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null; };
const toEuro = (c: number) => (c / 100).toFixed(2).replace(".", ",");

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(ok); after?.(); router.refresh(); } else toast.error(r.error ?? "Fehler");
  });
  return { pending, act };
}

export function FunnelScenario({ days, steps, projectedDays, costsVisible }: { days: FunnelEntry[]; steps: StepSetting[]; projectedDays: number; costsVisible: boolean }) {
  const [goals, setGoals] = useState<Record<FunnelStep, number>>(() => Object.fromEntries(steps.map((s) => [s.step, s.goalPct])) as Record<FunnelStep, number>);
  const [lift, setLift] = useState(0);
  const r = funnelSummary(days, steps, { goals, trafficLiftPct: lift, projectedDays });
  if (!r.covers) return <p className="rounded-lg border border-border bg-bg p-4 text-text-muted">Für diesen Zeitraum sind keine Tage mit Gästen erfasst. Trag unten einen Tag ein oder importiere eine CSV.</p>;
  return (
    <>
      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`Gäste (${r.outletDays} Tage)`} value={r.covers.toLocaleString("de-DE")} />
        <StatTile label="Extras pro 100 Gäste" value={pct((r.extras / r.covers) * 100)} />
        {costsVisible ? <StatTile label="Szenario: DB II im Zeitraum" value={signed(r.db2DeltaCents)} /> : <StatTile label="Szenario: Umsatz netto im Zeitraum" value={signed(r.revenueDeltaCents)} />}
        {costsVisible ? <StatTile label={`Szenario: DB II pro Monat (${projectedDays} Tage)`} value={signed(r.monthlyDb2DeltaCents)} /> : <StatTile label={`Szenario: Umsatz pro Monat (${projectedDays} Tage)`} value={signed(r.monthlyRevenueDeltaCents)} />}
      </section>
      <section aria-labelledby="scenario" className="rounded-lg border border-border bg-bg p-4">
        <h2 id="scenario" className="text-lg">Was bringt eine höhere Quote?</h2>
        <p className="mt-1 text-sm text-text-muted">Ziel je 100 Gäste pro Stufe und die Gästeentwicklung verschieben. Preise und Kosten pro Verkauf bleiben gleich. Die Ziele dauerhaft ändern Inhaber und Leitung unten bei den Annahmen.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Slider label="Gästeentwicklung" min={-50} max={100} value={lift} onChange={setLift} />
          {FUNNEL_STEPS.map((s) => <Slider key={s.id} label={`${s.label}: Ziel je 100 Gäste`} min={0} max={150} value={goals[s.id]} onChange={(v) => setGoals({ ...goals, [s.id]: v })} />)}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">Quote je Service-Stufe</caption>
            <thead className="text-left text-xs text-text-muted"><tr>
              <th scope="col" className="py-2 font-normal">Stufe</th><th scope="col" className="text-right font-normal">Verkauft</th><th scope="col" className="text-right font-normal">Ist je 100 Gäste</th><th scope="col" className="text-right font-normal">Ziel</th><th scope="col" className="text-right font-normal">Zusatzmenge</th><th scope="col" className="text-right font-normal">Umsatz netto</th>
              {costsVisible && <th scope="col" className="text-right font-normal">DB II</th>}
            </tr></thead>
            <tbody>
              {r.steps.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <th scope="row" className="py-2 text-left font-semibold">{s.label}</th>
                  <td className="num text-right">{s.sold.toLocaleString("de-DE")}</td>
                  <td className={cn("num text-right", s.currentPct !== null && s.currentPct < s.goalPct && "text-warning")}>{pct(s.currentPct)}</td>
                  <td className="num text-right">{pct(s.goalPct)}</td>
                  <td className="num text-right">{units(s.deltaUnits)}</td>
                  <td className="num text-right">{signed(s.revenueDeltaCents)}</td>
                  {costsVisible && <td className={cn("num text-right font-semibold", s.db2DeltaCents < 0 && "text-danger")}>{signed(s.db2DeltaCents)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-text-muted">Ein Gast kann mehrere Extras nehmen, darum sind Quoten über 100 % möglich. Die Monatswerte rechnen den Schnitt pro erfasstem Tag auf {projectedDays} Betriebstage hoch.</p>
      </section>
    </>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-text">{label}</label>
      <span className="flex items-center gap-3">
        <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
        <output htmlFor={id} className="num w-14 text-right text-sm">{value > 0 && min < 0 ? "+" : ""}{value} %</output>
      </span>
    </div>
  );
}

type Draft = { day: string; covers: string; note: string } & Record<FunnelStep, string>;
const emptyDraft = (day: string): Draft => ({ day, covers: "", note: "", aperitif: "", water: "", upgrades: "", sides: "", desserts: "", coffee: "" });
const int = (v: string) => (v.trim() === "" ? 0 : /^\d{1,6}$/.test(v.trim()) ? Number(v) : null);
const TEMPLATE = "Datum;Covers;Aperitif;Wasser;Upgrades;Beilagen;Desserts;Kaffee\r\n01.10.2026;112;20;58;9;24;27;46\r\n";

export function FunnelDays({ days, today }: { days: FunnelEntry[]; today: string }) {
  const { pending, act } = useAct();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<{ rows: FunnelImportRow[]; errors: RowError[] } | null>(null);
  const bad = draft ? [draft.covers, ...FUNNEL_STEPS.map((s) => draft[s.id])].some((v) => int(v) === null) || draft.covers.trim() === "" || !draft.day : true;
  const save = () => draft && act(() => saveFunnelDays([{ day: draft.day, covers: int(draft.covers)!, note: draft.note || null, ...Object.fromEntries(FUNNEL_STEPS.map((s) => [s.id, int(draft[s.id])!])) as Record<FunnelStep, number> }]),
    `${formatDay(draft.day)} gespeichert`, () => setDraft(null));
  const template = () => {
    const url = URL.createObjectURL(new Blob([`﻿${TEMPLATE}`], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: "service-funnel-vorlage.csv" }).click();
    URL.revokeObjectURL(url);
  };
  return (
    <section aria-labelledby="days" className="rounded-lg border border-border bg-bg p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="days" className="text-lg">Erfasste Tage</h2>
          <p className="text-sm text-text-muted">Nach dem Service: Gäste und verkaufte Extras eintragen. Ein Tag pro Outlet, erneutes Speichern überschreibt.</p>
        </div>
        <Button onClick={() => setDraft(emptyDraft(days.some((d) => d.day === today) ? "" : today))}><Plus aria-hidden className="size-4" /> Tag erfassen</Button>
      </div>
      {days.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">Erfasste Tage mit Gästen und Extras</caption>
            <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Tag</th><th scope="col" className="text-right font-normal">Gäste</th>{FUNNEL_STEPS.map((s) => <th key={s.id} scope="col" className="text-right font-normal">{s.label}</th>)}<th scope="col"><span className="sr-only">Aktionen</span></th></tr></thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <th scope="row" className="py-2 text-left font-semibold">{formatDay(d.day)}{d.note && <span className="block text-xs font-normal text-text-muted">{d.note}</span>}</th>
                  <td className="num text-right">{d.covers.toLocaleString("de-DE")}</td>
                  {FUNNEL_STEPS.map((s) => <td key={s.id} className="num text-right">{d[s.id].toLocaleString("de-DE")}</td>)}
                  <td className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" aria-label={`${formatDay(d.day)} bearbeiten`} onClick={() => setDraft({ day: d.day, covers: String(d.covers), note: d.note ?? "", ...Object.fromEntries(FUNNEL_STEPS.map((s) => [s.id, String(d[s.id])])) as Record<FunnelStep, string> })}><Pencil aria-hidden className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`${formatDay(d.day)} löschen`} loading={pending} onClick={() => act(() => deleteFunnelDay(d.day), `${formatDay(d.day)} gelöscht`)}><Trash2 aria-hidden className="size-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-base">Aus CSV importieren</h3>
          <p className="text-sm text-text-muted">Spalten: Datum; Covers (oder Gäste); dann Aperitif, Wasser, Upgrades, Beilagen, Desserts, Kaffee. Fehlende Stufen zählen als 0.</p>
          <div><Button variant="secondary" size="sm" onClick={template}><Download aria-hidden className="size-4" /> Vorlage</Button></div>
        </div>
        <FileUpload label="Funnel-CSV" accept=".csv,text/csv" formats="CSV" state={preview ? "done" : "idle"} errors={preview?.errors} doneText={preview ? `${preview.rows.length} Tage erkannt, noch nichts gespeichert.` : undefined}
          onFile={async (file) => setPreview(parseFunnelCsv(await file.text()))} />
      </div>
      {preview && preview.rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm">{preview.rows.length} Tage von {formatDay(preview.rows[0].day)} bis {formatDay(preview.rows.at(-1)!.day)}. Vorhandene Tage werden überschrieben.</p>
          <Button loading={pending} onClick={() => act(() => saveFunnelDays(preview.rows.map(({ row: _r, ...x }) => ({ ...x, note: null }))), `${preview.rows.length} Tage übernommen`, () => setPreview(null))}>Übernehmen</Button>
          <Button variant="secondary" onClick={() => setPreview(null)}>Verwerfen</Button>
        </div>
      )}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title="Tag erfassen"
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Abbrechen</Button><Button disabled={bad} loading={pending} onClick={save}>Speichern</Button></>}>
        {draft && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tag" required><input type="date" className={controlClass} value={draft.day} max={today} onChange={(e) => setDraft({ ...draft, day: e.target.value })} /></Field>
            <Field label="Gäste (Covers)" required error={draft.covers && int(draft.covers) === null ? "Ganze Zahl" : undefined}><input inputMode="numeric" className={controlClass} value={draft.covers} onChange={(e) => setDraft({ ...draft, covers: e.target.value })} /></Field>
            {FUNNEL_STEPS.map((s) => (
              <Field key={s.id} label={s.label} error={int(draft[s.id]) === null ? "Ganze Zahl" : undefined}><input inputMode="numeric" className={controlClass} value={draft[s.id]} onChange={(e) => setDraft({ ...draft, [s.id]: e.target.value })} /></Field>
            ))}
            <Field label="Notiz" className="col-span-2"><input className={controlClass} maxLength={500} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </section>
  );
}

export function FunnelSettings({ steps, projectedDays }: { steps: StepSetting[]; projectedDays: number }) {
  const { pending, act } = useAct();
  const [rows, setRows] = useState(() => steps.map((s) => ({ step: s.step, price: toEuro(s.priceGrossCents), vatBp: s.vatBp, variable: toEuro(s.variableCents), goal: String(s.goalPct).replace(".", ",") })));
  const [daysPerMonth, setDaysPerMonth] = useState(String(projectedDays));
  const goal = (v: string) => { const t = v.trim().replace(",", "."); return /^\d{1,3}(\.\d)?$/.test(t) && Number(t) <= 200 ? Number(t) : null; };
  const dpm = /^\d{1,2}$/.test(daysPerMonth) && Number(daysPerMonth) >= 1 && Number(daysPerMonth) <= 31 ? Number(daysPerMonth) : null;
  const invalid = dpm === null || rows.some((r) => euro(r.price) === null || euro(r.variable) === null || goal(r.goal) === null);
  const set = (i: number, k: "price" | "variable" | "goal" | "vatBp", v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "vatBp" ? Number(v) : v } : r)));
  return (
    <section aria-labelledby="assumptions" className="rounded-lg border border-border bg-bg p-4">
      <h2 id="assumptions" className="text-lg">Annahmen je Verkauf</h2>
      <p className="mt-1 text-sm text-text-muted">Durchschnittlicher Kartenpreis brutto, Mehrwertsteuer und variable Kosten (Wareneinsatz) pro verkauftem Extra, dazu die Zielquote. Das Service-Team sieht Quoten und Umsatz, aber keine Kosten.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Stufe</th><th scope="col" className="font-normal">Preis brutto (€)</th><th scope="col" className="font-normal">MwSt.</th><th scope="col" className="font-normal">Variable Kosten netto (€)</th><th scope="col" className="font-normal">Ziel je 100 Gäste</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const label = FUNNEL_STEPS.find((s) => s.id === r.step)!.label;
              return (
                <tr key={r.step} className="border-t border-border">
                  <th scope="row" className="py-2 pr-2 text-left font-semibold">{label}</th>
                  <td className="pr-2"><input aria-label={`${label}: Preis brutto`} aria-invalid={euro(r.price) === null || undefined} inputMode="decimal" className={controlClass} value={r.price} onChange={(e) => set(i, "price", e.target.value)} /></td>
                  <td className="pr-2"><select aria-label={`${label}: Mehrwertsteuer`} className={controlClass} value={r.vatBp} onChange={(e) => set(i, "vatBp", e.target.value)}><option value={700}>7 %</option><option value={1900}>19 %</option><option value={0}>0 %</option></select></td>
                  <td className="pr-2"><input aria-label={`${label}: variable Kosten`} aria-invalid={euro(r.variable) === null || undefined} inputMode="decimal" className={controlClass} value={r.variable} onChange={(e) => set(i, "variable", e.target.value)} /></td>
                  <td><input aria-label={`${label}: gespeicherte Zielquote`} aria-invalid={goal(r.goal) === null || undefined} inputMode="decimal" className={controlClass} value={r.goal} onChange={(e) => set(i, "goal", e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Betriebstage pro Monat" error={dpm === null ? "1 bis 31" : undefined}><input inputMode="numeric" className={cn(controlClass, "w-28")} value={daysPerMonth} onChange={(e) => setDaysPerMonth(e.target.value)} /></Field>
        <Button disabled={invalid} loading={pending} onClick={() => act(() => saveFunnelSettings({ projectedDays: dpm!, steps: rows.map((r) => ({ step: r.step, priceGrossCents: euro(r.price)!, vatBp: r.vatBp as 0 | 700 | 1900, variableCents: euro(r.variable)!, goalPct: goal(r.goal)! })) }), "Annahmen gespeichert")}>Annahmen speichern</Button>
      </div>
    </section>
  );
}
