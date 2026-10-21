"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveFixedCost, saveCostSettings, saveFixedCost } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, controlClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { FixedCost, FixedCostCategory } from "@/data/cost-types";
import { type VariableCosts, targetPrice } from "@/domain/contribution";
import { formatCents } from "@/lib/format";

const CATEGORY: Record<FixedCostCategory, string> = { rent: "Miete & Pacht", staff: "Personal (fest)", energy: "Energie", insurance: "Versicherung", leasing: "Leasing & Kredite", marketing: "Marketing", other: "Sonstiges" };
const euro = (v: string) => { const t = v.trim().replace(/\s|€|\./g, "").replace(",", "."); return /^\d{1,7}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null; };
const toEuro = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const num = (v: string) => { const t = v.trim().replace(",", "."); return /^\d{1,3}(\.\d{1,2})?$/.test(t) ? Number(t) : null; };

export function CostSettings({ variableRevenuePct, perItemCents, fixed, outlets }: { variableRevenuePct: number; perItemCents: number; fixed: FixedCost[]; outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pct, setPct] = useState(String(variableRevenuePct).replace(".", ","));
  const [item, setItem] = useState(toEuro(perItemCents));
  const [draft, setDraft] = useState<{ id?: string; name: string; category: FixedCostCategory; amount: string; outletId: string } | null>(null);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(ok); after?.(); router.refresh(); } else toast.error(r.error ?? "Fehler");
  });
  const total = fixed.reduce((t, f) => t + f.monthlyCents, 0);
  return (
    <section aria-labelledby="costs" className="grid gap-6 rounded-lg border border-border bg-bg p-4 lg:grid-cols-2">
      <h2 id="costs" className="sr-only">Kosten</h2>
      <div className="flex flex-col gap-3">
        <h3 className="text-lg">Variable Kosten</h3>
        <p className="text-sm text-text-muted">Was mit jedem Verkauf anfällt: Kartengebühren, Provision von Lieferplattformen (Anteil am Umsatz) und z. B. Verpackung (pro Artikel).</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Anteil vom Umsatz (%)" error={num(pct) === null ? "Zahl, z. B. 2,5" : undefined}><input inputMode="decimal" className={controlClass} value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
          <Field label="Pro Artikel (€)" error={euro(item) === null ? "Betrag, z. B. 0,15" : undefined}><input inputMode="decimal" className={controlClass} value={item} onChange={(e) => setItem(e.target.value)} /></Field>
        </div>
        <div><Button variant="secondary" disabled={num(pct) === null || euro(item) === null} loading={pending} onClick={() => act(() => saveCostSettings({ variableRevenuePct: num(pct)!, perItemCents: euro(item)! }), "Variable Kosten gespeichert")}>Speichern</Button></div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <h3 className="text-lg">Fixkosten pro Monat</h3>
          <Button size="sm" onClick={() => setDraft({ name: "", category: "rent", amount: "", outletId: "" })}><Plus aria-hidden className="size-4" /> Fixkosten</Button>
        </div>
        {fixed.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {fixed.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-semibold">{f.name}</span> <span className="text-text-muted">· {CATEGORY[f.category]}{f.outletId ? ` · ${outlets.find((o) => o.id === f.outletId)?.name ?? ""}` : " · ganzer Betrieb"}</span></span>
                <span className="flex items-center gap-1">
                  <span className="num mr-2">{formatCents(f.monthlyCents)}</span>
                  <Button size="icon" variant="ghost" aria-label={`${f.name} bearbeiten`} onClick={() => setDraft({ id: f.id, name: f.name, category: f.category, amount: toEuro(f.monthlyCents), outletId: f.outletId ?? "" })}><Pencil aria-hidden className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`${f.name} entfernen`} loading={pending} onClick={() => act(() => archiveFixedCost(f.id), `${f.name} entfernt`)}><Trash2 aria-hidden className="size-4" /></Button>
                </span>
              </li>
            ))}
            <li className="flex justify-between py-2 text-sm font-semibold"><span>Summe</span><span className="num">{formatCents(total)}</span></li>
          </ul>
        ) : <p className="text-sm text-text-muted">Noch keine Fixkosten. Typisch: Miete, Personal mit festem Gehalt, Energie, Versicherungen, Leasing.</p>}
      </div>
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? "Fixkosten bearbeiten" : "Fixkosten anlegen"}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Abbrechen</Button><Button disabled={!draft?.name.trim() || euro(draft?.amount ?? "") === null} loading={pending}
          onClick={() => draft && act(() => saveFixedCost({ id: draft.id, name: draft.name, category: draft.category, monthlyCents: euro(draft.amount)!, outletId: draft.outletId || null }), "Fixkosten gespeichert", () => setDraft(null))}>Speichern</Button></>}>
        {draft && (
          <div className="flex flex-col gap-3">
            <Field label="Bezeichnung"><input className={controlClass} maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Art"><select className={controlClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as FixedCostCategory })}>{(Object.keys(CATEGORY) as FixedCostCategory[]).map((k) => <option key={k} value={k}>{CATEGORY[k]}</option>)}</select></Field>
            <Field label="Betrag pro Monat (€, netto)"><input inputMode="decimal" className={controlClass} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></Field>
            <Field label="Gilt für"><select className={controlClass} value={draft.outletId} onChange={(e) => setDraft({ ...draft, outletId: e.target.value })}><option value="">den ganzen Betrieb</option>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          </div>
        )}
      </Dialog>
    </section>
  );
}

export function TargetPrice({ items, variable, defaultVatBp }: { items: { id: string; name: string; costPerPortionCents: number }[]; variable: VariableCosts; defaultVatBp: number }) {
  const [pick, setPick] = useState(items[0]?.id ?? "");
  const [cost, setCost] = useState(items[0] ? toEuro(Math.round(items[0].costPerPortionCents)) : "");
  const [vat, setVat] = useState(String(defaultVatBp));
  const [mode, setMode] = useState<"food" | "db">("food");
  const [goal, setGoal] = useState("28");
  const c = euro(cost);
  const g = mode === "food" ? num(goal) : euro(goal);
  let price: number | null = null;
  try { if (c !== null && g !== null && g > 0) price = targetPrice(mode === "food" ? { costPerPortionCents: c, vatBp: Number(vat), variable, foodCostBp: Math.round(g * 100) } : { costPerPortionCents: c, vatBp: Number(vat), variable, db2Cents: g }); } catch { price = null; }
  return (
    <section aria-labelledby="target" className="rounded-lg border border-border bg-bg p-4">
      <h2 id="target" className="text-lg">Zielpreis berechnen</h2>
      <p className="mt-1 text-sm text-text-muted">Welcher Kartenpreis (brutto) nötig ist, um einen Ziel-Wareneinsatz oder einen Deckungsbeitrag pro Portion zu erreichen, mit deinen variablen Kosten.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.length > 0 && (
          <Field label="Artikel"><select className={controlClass} value={pick} onChange={(e) => { setPick(e.target.value); const i = items.find((x) => x.id === e.target.value); if (i) setCost(toEuro(Math.round(i.costPerPortionCents))); }}>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
        )}
        <Field label="Wareneinsatz pro Portion (€)"><input inputMode="decimal" className={controlClass} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="MwSt."><select className={controlClass} value={vat} onChange={(e) => setVat(e.target.value)}><option value="700">7 %</option><option value="1900">19 %</option></select></Field>
        <Field label="Ziel"><select className={controlClass} value={mode} onChange={(e) => { setMode(e.target.value as "food" | "db"); setGoal(e.target.value === "food" ? "28" : "8,00"); }}><option value="food">Wareneinsatz in %</option><option value="db">DB II pro Portion in €</option></select></Field>
        <Field label={mode === "food" ? "Ziel-Wareneinsatz (%)" : "DB II pro Portion (€)"}><input inputMode="decimal" className={controlClass} value={goal} onChange={(e) => setGoal(e.target.value)} /></Field>
      </div>
      <p role="status" className="mt-4 text-lg">Kartenpreis: <span className="num font-bold text-accent">{price === null ? "–" : formatCents(price)}</span> <span className="text-sm text-text-muted">brutto, aufgerundet auf 10 Cent</span></p>
    </section>
  );
}
