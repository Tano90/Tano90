"use client";

import { ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { closeCount, saveCountLines, startCount } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { toast } from "@/components/ui/toast";
import type { BaseUnit } from "@/domain/units";
import { formatDate } from "@/lib/dates";
import { formatCents, formatQty } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

type Item = { id: string; name: string; category: string; baseUnit: BaseUnit; expectedBase: number };
// Count in the unit people count in: kg, l, pieces.
const FACTOR: Record<BaseUnit, number> = { g: 1000, ml: 1000, piece: 1 };
const LABEL: Record<BaseUnit, string> = { g: "kg", ml: "l", piece: "Stk." };

export function StartCount({ past }: { past: { id: string; closedAt: string | null; lines: number; valueCents: number; by: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-border bg-bg">
        <EmptyState
          icon={ClipboardList}
          title="Keine Inventur offen"
          body="Starte eine Inventur, zähle in Ruhe und schließe sie ab. Nicht gezählte Artikel behalten ihren Bestand."
          action={
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await startCount();
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  router.refresh();
                })
              }
            >
              Inventur starten
            </Button>
          }
        />
      </div>
      {past.length > 0 && (
        <section aria-labelledby="past">
          <h2 id="past" className="mb-2 text-lg">Letzte Inventuren</h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-bg">
            {past.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <span>{formatDate(p.closedAt)} · {p.by}</span>
                <span className="num text-text-muted">{p.lines} Differenzen · {formatCents(Math.round(p.valueCents))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CountSheet({ eventId, draft, items }: { eventId: string; draft: Record<string, number>; items: Item[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(draft).map(([id, base]) => {
      const it = items.find((i) => i.id === id);
      return [id, it ? formatQty(base / FACTOR[it.baseUnit]) : ""];
    })),
  );
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const dirty = useRef<Record<string, number | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Save the sheet a moment after typing stops, so a dead spot in the cold room costs seconds, not the count.
  const flush = async () => {
    const batch = dirty.current;
    if (!Object.keys(batch).length) return true;
    dirty.current = {};
    setSaved("saving");
    // A dropped connection makes the action call itself throw, not return an error result.
    const res = await saveCountLines(eventId, batch).catch(() => ({ ok: false as const, error: "offline" }));
    if (!res.ok) {
      dirty.current = { ...batch, ...dirty.current };
      setSaved("error");
      return false;
    }
    setSaved("saved");
    return true;
  };
  // While saving fails (offline), retry every few seconds and as soon as the browser is back online.
  useEffect(() => {
    if (saved !== "error") return;
    const retry = () => void flush();
    const t = setInterval(retry, 5000);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (it: Item, raw: string) => {
    const clean = raw.replace(/[^\d,]/g, "");
    setValues({ ...values, [it.id]: clean });
    const n = clean.trim() ? Number(clean.replace(",", ".")) : null;
    dirty.current[it.id] = n === null || Number.isNaN(n) ? null : n * FACTOR[it.baseUnit];
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  const shown = useMemo(() => items.filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const counted = Object.values(values).filter((v) => v.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      <Notice>Starte während einer offenen Inventur keine Lieferungen oder Umbuchungen für dieses Outlet – sonst stimmen die Differenzen nicht.</Notice>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-56 flex-1"><FilterBar query={query} onQueryChange={setQuery} placeholder="Artikel suchen" /></div>
        <p role="status" className="text-xs text-text-muted">
          {counted} von {items.length} gezählt · {saved === "saving" ? "speichert …" : saved === "saved" ? "Zwischenstand gespeichert" : saved === "error" ? "Speichern fehlgeschlagen, wird erneut versucht" : "noch nichts gespeichert"}
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-bg">
        {shown.map((it) => {
          const id = `c-${it.id}`;
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label htmlFor={id} className="min-w-40 flex-1">
                <span className="block font-semibold">{it.name}</span>
                <span className="block text-xs font-normal text-text-muted">{it.category} · laut System {formatBase(it.expectedBase, it.baseUnit)}</span>
              </label>
              <span className="flex items-center gap-2">
                <input
                  id={id}
                  inputMode="decimal"
                  className="num h-(--size-control-lg) w-28 rounded-sm border border-border-input bg-bg px-3 text-right text-base"
                  value={values[it.id] ?? ""}
                  placeholder="–"
                  onChange={(e) => change(it, e.target.value)}
                  onBlur={() => flush()}
                />
                <span className="w-8 text-text-muted">{LABEL[it.baseUnit]}</span>
              </span>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-text-muted">Kein Artikel passt zur Suche.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          trigger={<Button disabled={pending}>Inventur abschließen</Button>}
          title="Inventur abschließen?"
          description={`${counted} Artikel gezählt. Für diese wird die Differenz zum Systembestand gebucht. ${items.length - counted} nicht gezählte Artikel behalten ihren Bestand. Das lässt sich nicht rückgängig machen.`}
          confirmLabel="Abschließen"
          loading={pending}
          onConfirm={() =>
            start(async () => {
              clearTimeout(timer.current);
              if (!(await flush())) {
                toast.error("Zwischenstand konnte nicht gespeichert werden. Bitte erneut versuchen.");
                return;
              }
              const res = await closeCount(eventId);
              setConfirm(false);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Inventur abgeschlossen", { description: `${res.data.changed} Bestände angepasst.` });
              router.push("/stock");
            })
          }
        />
      </div>
    </div>
  );
}
