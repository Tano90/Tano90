"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelProductionRequest, deliverProduction, produce, requestProduction } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { cleanDecimal } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toast";
import type { ProductionRequest } from "@/data/types";
import type { Need } from "@/domain/production";
import { formatDay } from "@/lib/dates";
import { countOf, formatCents, formatQty } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

type Row = ProductionRequest & { fromOutlet: string; recipe: string };
const STATUS: Record<Row["status"], { label: string; tone: "neutral" | "warning" | "success" | "info" }> = {
  requested: { label: "angefordert", tone: "warning" },
  produced: { label: "produziert", tone: "info" },
  delivered: { label: "geliefert", tone: "success" },
  cancelled: { label: "storniert", tone: "neutral" },
};

export function KitchenPlan({ requests, needs }: { requests: Row[]; needs: Record<string, { lines: Need[]; unknown: number }> }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmDay, setConfirmDay] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = requests.filter((r) => r.status === "requested" || r.status === "produced");
  const days = [...new Set(open.map((r) => r.neededOn))];
  const act = (fn: typeof produce, ids: string[], ok: (n: number) => string) =>
    start(async () => {
      const res = await fn(ids);
      if (!res.ok) return void toast.error(res.error);
      setPicked([]);
      setConfirmDay(null);
      toast.success(ok(res.data));
      router.refresh();
    });
  return (
    <section aria-labelledby="plan" className="flex flex-col gap-4">
      <h2 id="plan" className="text-lg">Produktionsplan</h2>
      {days.length === 0 && <p className="text-text-muted">Keine offenen Anforderungen.</p>}
      {days.map((day) => {
        const rows = open.filter((r) => r.neededOn === day);
        const need = needs[day];
        const toProduce = rows.filter((r) => r.status === "requested" && picked.includes(r.id)).map((r) => r.id);
        const toDeliver = rows.filter((r) => r.status === "produced" && picked.includes(r.id)).map((r) => r.id);
        const short = need?.lines.filter((l) => l.shortBase > 0) ?? [];
        return (
          <div key={day} className="flex flex-col gap-3 rounded-md border border-border bg-bg p-4">
            <h3 className="font-semibold">Für {formatDay(day, "full")}</h3>
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                  <label className="flex min-w-56 flex-1 items-center gap-2">
                    <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} />
                    <span><span className="font-semibold">{formatQty(r.portions)} × {r.recipe}</span> <span className="text-text-muted">für {r.fromOutlet}{r.note ? ` · ${r.note}` : ""}</span></span>
                  </label>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  {r.costCents !== null && <span className="num text-text-muted">{formatCents(Math.round(r.costCents))}</span>}
                </li>
              ))}
            </ul>
            {need && need.lines.length > 0 && (
              <details className="rounded-sm bg-surface-sunken p-3" open={short.length > 0}>
                <summary className="cursor-pointer font-semibold">
                  Rohware für die angeforderten Rezepte {short.length > 0 && <span className="text-danger">· {short.length} knapp</span>}
                </summary>
                <table className="mt-2 w-full text-sm">
                  <caption className="sr-only">Rohwarenbedarf für {formatDay(day)}</caption>
                  <thead className="text-xs text-text-muted">
                    <tr><th scope="col" className="text-left">Zutat</th><th scope="col" className="text-right">Bedarf</th><th scope="col" className="text-right">Bestand</th><th scope="col" className="text-right">Fehlt</th></tr>
                  </thead>
                  <tbody>
                    {need.lines.map((l) => (
                      <tr key={l.ingredientId} className={l.shortBase > 0 ? "text-danger" : undefined}>
                        <td>{l.name}</td>
                        <td className="num text-right">{formatBase(l.needBase, l.baseUnit)}</td>
                        <td className="num text-right">{formatBase(l.onHandBase, l.baseUnit)}</td>
                        <td className="num text-right">{l.shortBase > 0 ? formatBase(l.shortBase, l.baseUnit) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              <ConfirmDialog
                open={confirmDay === day}
                onOpenChange={(o) => setConfirmDay(o ? day : null)}
                trigger={<Button disabled={!toProduce.length || pending}>Produzieren ({toProduce.length})</Button>}
                title={`${countOf(toProduce.length, "Anforderung", "Anforderungen")} produzieren?`}
                description={`Die Rohware wird aus dem Lager der Zentralküche gebucht.${short.length ? ` Achtung: ${countOf(short.length, "Zutat reicht", "Zutaten reichen")} laut Bestand nicht, der Bestand wird dann negativ.` : ""}`}
                confirmLabel="Produzieren"
                loading={pending}
                onConfirm={() => act(produce, toProduce, (n) => `${countOf(n, "Anforderung", "Anforderungen")} produziert`)}
              />
              <Button variant="secondary" disabled={!toDeliver.length || pending} onClick={() => act(deliverProduction, toDeliver, (n) => `${countOf(n, "Anforderung", "Anforderungen")} als geliefert markiert`)}>
                Geliefert ({toDeliver.length})
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function RequestForm({ kitchenName, recipes, minDay, defaultDay }: { kitchenName: string; recipes: { value: string; label: string }[]; minDay: string; defaultDay: string }) {
  const router = useRouter();
  const [f, setF] = useState({ recipeId: "", portions: "", neededOn: defaultDay, note: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const res = await requestProduction({ recipeId: f.recipeId, portions: Number(f.portions.replace(",", ".")) || 0, neededOn: f.neededOn, note: f.note.trim() || null });
      if (!res.ok) return setError(res.error);
      setError(null);
      setF({ recipeId: "", portions: "", neededOn: defaultDay, note: "" });
      toast.success(`Bei ${kitchenName} angefordert`);
      router.refresh();
    });
  return (
    <section aria-labelledby="request" className="flex flex-col gap-3">
      <h2 id="request" className="text-lg">Bei {kitchenName} anfordern</h2>
      {error && <Notice tone="warning">{error}</Notice>}
      <div className="grid gap-3 md:grid-cols-[1fr_8rem_11rem]">
        <Field label="Rezept">
          <Select value={f.recipeId} onChange={(e) => setF((p) => ({ ...p, recipeId: e.target.value }))}>
            <option value="">Rezept wählen</option>
            {recipes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Portionen"><Input inputMode="decimal" className="text-right" value={f.portions} onChange={(e) => setF((p) => ({ ...p, portions: cleanDecimal(e.target.value) }))} /></Field>
        <Field label="Liefertag"><Input type="date" min={minDay} value={f.neededOn} onChange={(e) => setF((p) => ({ ...p, neededOn: e.target.value }))} /></Field>
        <Field label="Hinweis (optional)" className="md:col-span-3"><Input value={f.note} maxLength={300} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} /></Field>
      </div>
      <div><Button onClick={submit} loading={pending}>Anfordern</Button></div>
    </section>
  );
}

export function MyRequests({ requests }: { requests: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="mine" className="flex flex-col gap-3">
      <h2 id="mine" className="text-lg">Eigene Anforderungen</h2>
      {requests.length === 0 ? (
        <p className="text-text-muted">Noch nichts angefordert.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-bg">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <span className="min-w-56 flex-1"><span className="font-semibold">{formatQty(r.portions)} × {r.recipe}</span> <span className="text-text-muted">für {formatDay(r.neededOn)}</span></span>
              <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
              {r.costCents !== null && <span className="num text-text-muted" title="Rohwarenkosten der Zentralküche">{formatCents(Math.round(r.costCents))}</span>}
              {r.status === "requested" && (
                <Button variant="ghost" size="sm" loading={pending} aria-label={`${r.recipe} für ${formatDay(r.neededOn)} stornieren`}
                  onClick={() => start(async () => {
                    const res = await cancelProductionRequest(r.id);
                    if (!res.ok) return void toast.error(res.error);
                    router.refresh();
                  })}>
                  Stornieren
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
