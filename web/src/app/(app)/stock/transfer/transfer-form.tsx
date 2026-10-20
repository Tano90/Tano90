"use client";

import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordTransfer } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Select } from "@/components/ui/field";
import { QuantityInput, type Unit, parseQuantity } from "@/components/ui/quantity-input";
import { toast } from "@/components/ui/toast";
import { type BaseUnit, toBase } from "@/domain/units";
import { formatDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

type Opt = { value: string; label: string; hint: string; baseUnit: BaseUnit; onHandBase: number };
type Row = { key: string; itemId: string | null; quantity: string; unit: Unit };
const newRow = (): Row => ({ key: crypto.randomUUID(), itemId: null, quantity: "", unit: "g" });
const UNITS_FOR: Record<BaseUnit, Unit[]> = { g: ["kg", "g"], ml: ["l", "ml", "cl"], piece: ["piece"] };

export function TransferForm({ fromName, targets, items }: { fromName: string; targets: { value: string; label: string }[]; items: Opt[] }) {
  const router = useRouter();
  const [to, setTo] = useState(targets.length === 1 ? targets[0].value : "");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(items.map((i) => [i.value, i]));
  const update = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const baseOf = (r: Row) => {
    const it = r.itemId ? byId.get(r.itemId) : undefined;
    const q = parseQuantity(r.quantity);
    return it && q ? toBase(q, r.unit as Exclude<Unit, "portion">, { baseUnit: it.baseUnit, gramsPerPiece: null, mlPerGram: null }) : null;
  };

  const submit = () =>
    start(async () => {
      const lines = rows.filter((r) => r.itemId || r.quantity).map((r) => ({ ingredientId: r.itemId ?? "", quantityBase: baseOf(r) ?? 0 }));
      const res = await recordTransfer({ toOutletId: to, lines });
      if (!res.ok) return setError(res.error);
      setError(null);
      setRows([newRow()]);
      toast.success("Umgebucht", { description: `${lines.length} Position(en) nach ${targets.find((t) => t.value === to)?.label}.` });
      router.refresh();
    });

  return (
    <section aria-labelledby="new-transfer" className="flex flex-col gap-3">
      <h2 id="new-transfer" className="text-lg">Neue Umbuchung</h2>
      {error && <Notice tone="warning">{error}</Notice>}
      <div className="flex flex-wrap items-end gap-3">
        <p className="pb-2">Von <span className="font-semibold">{fromName}</span> nach</p>
        <Field label="Ziel-Outlet" className="w-56">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Outlet wählen</option>
            {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
      </div>
      <ol className="flex flex-col gap-2" aria-label="Positionen">
        {rows.map((r, i) => {
          const it = r.itemId ? byId.get(r.itemId) : undefined;
          const base = baseOf(r);
          const over = it && base !== null && base > it.onHandBase;
          return (
            <li key={r.key} aria-label={`Position ${i + 1}`} className="grid gap-2 rounded-md border border-border bg-bg p-2 md:grid-cols-[1fr_12rem_12rem_2.5rem] md:items-center">
              <Combobox aria-label="Zutat" options={items} value={r.itemId} onChange={(v) => update(r.key, { itemId: v, unit: UNITS_FOR[byId.get(v)!.baseUnit][0] })} placeholder="Zutat wählen" />
              <QuantityInput aria-label="Menge" value={r.quantity} unit={r.unit} units={it ? UNITS_FOR[it.baseUnit] : ["g"]} onValueChange={(v) => update(r.key, { quantity: v })} onUnitChange={(u) => update(r.key, { unit: u })} />
              <span className={over ? "text-xs text-warning" : "text-xs text-text-muted"}>
                {it ? (over ? `Mehr als im Bestand (${formatBase(it.onHandBase, it.baseUnit)})` : `Bestand ${formatBase(it.onHandBase, it.baseUnit)}`) : ""}
              </span>
              <Button variant="ghost" size="icon" aria-label={`Position ${i + 1} entfernen`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setRows([...rows, newRow()])}><Plus aria-hidden className="size-4" /> Position</Button>
        <Button onClick={submit} loading={pending}>Umbuchen</Button>
      </div>
    </section>
  );
}

type Transfer = {
  id: string; occurredAt: string; direction: "in" | "out"; otherOutlet: string; by: string; valueCents: number;
  lines: { id: string; ingredient: string; baseUnit: BaseUnit; quantityBase: number }[];
};

export function TransferList({ transfers, tz }: { transfers: Transfer[]; tz?: string }) {
  return (
    <section aria-labelledby="transfer-hist" className="mt-10">
      <h2 id="transfer-hist" className="mb-2 text-lg">Bisherige Umbuchungen</h2>
      {transfers.length === 0 ? (
        <p className="text-text-muted">Noch nichts umgebucht.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {transfers.map((t) => {
            const Icon = t.direction === "out" ? ArrowUpRight : ArrowDownLeft;
            return (
              <li key={t.id} className="rounded-md border border-border bg-bg p-3">
                <p className="flex flex-wrap justify-between gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Icon aria-hidden className="size-4" />
                    {t.direction === "out" ? `An ${t.otherOutlet}` : `Von ${t.otherOutlet}`} · {formatDateTime(t.occurredAt, tz)} · {t.by}
                  </span>
                  <span className="num">{formatCents(Math.round(t.valueCents))}</span>
                </p>
                <ul className="mt-1 text-text-muted">
                  {t.lines.map((l) => <li key={l.id}>{formatBase(l.quantityBase, l.baseUnit)} {l.ingredient}</li>)}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
