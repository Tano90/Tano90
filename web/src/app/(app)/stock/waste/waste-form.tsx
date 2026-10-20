"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordWaste } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/field";
import { QuantityInput, type Unit, parseQuantity } from "@/components/ui/quantity-input";
import { toast } from "@/components/ui/toast";
import { type BaseUnit, toBase } from "@/domain/units";
import { formatCents } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

const REASONS = ["Verdorben", "Abgelaufen", "Beschädigt", "Zubereitungsfehler", "Rückläufer vom Gast", "Sonstiges"];
type Opt = { value: string; label: string; hint: string; baseUnit: BaseUnit };
type Row = { key: string; itemId: string | null; quantity: string; unit: Unit; reason: string };
const newRow = (): Row => ({ key: crypto.randomUUID(), itemId: null, quantity: "", unit: "g", reason: "" });
const UNITS_FOR: Record<BaseUnit, Unit[]> = { g: ["g", "kg"], ml: ["ml", "cl", "l"], piece: ["piece"] };

export function WasteForm({ items }: { items: Opt[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(items.map((i) => [i.value, i]));
  const update = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = () =>
    start(async () => {
      const lines = rows.filter((r) => r.itemId || r.quantity).map((r) => {
        const it = r.itemId ? byId.get(r.itemId) : undefined;
        const q = parseQuantity(r.quantity);
        const base = it && q ? toBase(q, r.unit as Exclude<Unit, "portion">, { baseUnit: it.baseUnit, gramsPerPiece: null, mlPerGram: null }) : null;
        return { ingredientId: r.itemId ?? "", quantityBase: base ?? 0, reason: r.reason };
      });
      const res = await recordWaste(lines);
      if (!res.ok) return setError(res.error);
      setError(null);
      setRows([newRow()]);
      toast.success("Schwund gebucht");
      router.refresh();
    });

  return (
    <section aria-labelledby="new-waste" className="flex flex-col gap-3">
      <h2 id="new-waste" className="text-lg">Neue Buchung</h2>
      {error && <Notice tone="warning">{error}</Notice>}
      <ol className="flex flex-col gap-2" aria-label="Positionen">
        {rows.map((r, i) => {
          const it = r.itemId ? byId.get(r.itemId) : undefined;
          return (
            <li key={r.key} aria-label={`Position ${i + 1}`} className="grid gap-2 rounded-md border border-border bg-bg p-2 md:grid-cols-[1fr_12rem_12rem_2.5rem] md:items-center">
              <Combobox aria-label="Zutat" options={items} value={r.itemId} onChange={(v) => update(r.key, { itemId: v, unit: UNITS_FOR[byId.get(v)!.baseUnit][0] })} placeholder="Zutat wählen" />
              <QuantityInput aria-label="Menge" value={r.quantity} unit={r.unit} units={it ? UNITS_FOR[it.baseUnit] : ["g"]} onValueChange={(v) => update(r.key, { quantity: v })} onUnitChange={(u) => update(r.key, { unit: u })} />
              <Select aria-label="Grund" value={r.reason} onChange={(e) => update(r.key, { reason: e.target.value })}>
                <option value="">Grund wählen</option>
                {REASONS.map((x) => <option key={x}>{x}</option>)}
              </Select>
              <Button variant="ghost" size="icon" aria-label={`Position ${i + 1} entfernen`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setRows([...rows, newRow()])}><Plus aria-hidden className="size-4" /> Position</Button>
        <Button onClick={submit} loading={pending}>Schwund buchen</Button>
      </div>
    </section>
  );
}

type Ev = { id: string; occurredAt: string; by: string; valueCents: number; lines: { id: string; ingredient: string; deltaBase: number; baseUnit: BaseUnit; reason: string | null }[] };

export function WasteOverview({ events }: { events: Ev[] }) {
  return (
    <section aria-labelledby="waste-hist" className="mt-10">
      <h2 id="waste-hist" className="mb-2 text-lg">Bisherige Buchungen</h2>
      {events.length === 0 ? (
        <p className="text-text-muted">Noch kein Schwund gebucht.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border border-border bg-bg p-3">
              <p className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(e.occurredAt))} · {e.by}</span>
                <span className="num text-danger">−{formatCents(Math.round(e.valueCents))}</span>
              </p>
              <ul className="mt-1 text-text-muted">
                {e.lines.map((l) => <li key={l.id}>{formatBase(-l.deltaBase, l.baseUnit)} {l.ingredient} · {l.reason ?? "ohne Grund"}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
