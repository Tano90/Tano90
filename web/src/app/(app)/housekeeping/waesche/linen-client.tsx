"use client";

import { Pencil, Plus, Send, Trash2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveLinenItem, countLinen, deleteLinenOrder, receiveLinenOrder, saveHkSettings, saveLinenItem, saveLinenOrder, sendLinenOrder } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, controlClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { LinenItemRow, LinenOrderRow } from "@/data/linen-types";
import type { HkSettings, LinenKind } from "@/domain/linen";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";

type Result = { ok: true } | { ok: false; error: string };
const int = (v: string) => (/^\d{1,7}$/.test(v.trim()) ? Number(v.trim()) : null);
const euroToCents = (v: string) => {
  const t = v.trim().replace(/\s|€/g, "").replace(",", ".");
  return /^\d{1,6}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null;
};
const centsToEuro = (c: number) => (c / 100).toFixed(2).replace(".", ",");

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<Result>, ok: string, after?: () => void) => start(async () => {
    const res = await fn();
    if (res.ok) { toast.success(ok); after?.(); router.refresh(); } else toast.error(res.error);
  });
  return { pending, act };
}

// ---------------------------------------------------------------- count

export function CountForm({ items, manager }: { items: LinenItemRow[]; manager: boolean }) {
  const { pending, act } = useAct();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [discarded, setDiscarded] = useState<Record<string, string>>({});
  const filled = items.filter((i) => (counted[i.id] ?? "") !== "");
  const bad = items.some((i) => ((counted[i.id] ?? "") !== "" && int(counted[i.id]) === null) || ((discarded[i.id] ?? "") !== "" && int(discarded[i.id]) === null));
  return (
    <section aria-labelledby="count" className="rounded-lg border border-border bg-bg p-4">
      <h2 id="count" className="text-lg">Zählung</h2>
      <p className="mt-1 text-sm text-text-muted">Nur saubere, einsatzbereite Wäsche im Lager zählen. Leere Felder bleiben unverändert.</p>
      {items.length ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Artikel</th><th scope="col" className="pr-4 text-right font-normal">Laut System</th><th scope="col" className="font-normal">Gezählt</th>{manager && <th scope="col" className="font-normal">Ausgesondert</th>}</tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <th scope="row" className="py-1 text-left font-semibold">{i.name}</th>
                    <td className="num pr-4 text-right">{i.stockClean}</td>
                    <td className="py-1 pr-2"><input aria-label={`Gezählt ${i.name}`} inputMode="numeric" className={cn(controlClass, "num w-28 text-right")} value={counted[i.id] ?? ""} onChange={(e) => setCounted((c) => ({ ...c, [i.id]: e.target.value }))} /></td>
                    {manager && <td className="py-1"><input aria-label={`Ausgesondert ${i.name}`} inputMode="numeric" className={cn(controlClass, "num w-28 text-right")} value={discarded[i.id] ?? ""} onChange={(e) => setDiscarded((c) => ({ ...c, [i.id]: e.target.value }))} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button disabled={!filled.length || bad} loading={pending}
              onClick={() => act(() => countLinen(filled.map((i) => ({ itemId: i.id, counted: int(counted[i.id])!, discarded: int(discarded[i.id] ?? "") ?? 0 }))), `Zählung gespeichert (${filled.length} ${filled.length === 1 ? "Artikel" : "Artikel"})`, () => { setCounted({}); setDiscarded({}); })}>
              Zählung speichern
            </Button>
            {bad && <span className="text-sm text-danger">Nur ganze Zahlen ab 0.</span>}
          </div>
        </>
      ) : <p className="mt-2 text-text-muted">Noch keine Wäscheartikel angelegt.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- order proposal

type ProposalLine = { itemId: string; name: string; proposal: number; need: number; stock: number; incoming: number; priceCents: number; packSize: number };

export function OrderProposal({ lines, suppliers, tomorrow, coverDays }: { lines: ProposalLine[]; suppliers: { id: string; name: string; hasEmail: boolean }[]; tomorrow: string; coverDays: number }) {
  const { pending, act } = useAct();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [supplierId, setSupplierId] = useState("");
  const [day, setDay] = useState(tomorrow);
  const [note, setNote] = useState("");
  const value = (l: ProposalLine) => qty[l.itemId] ?? String(l.proposal || "");
  const chosen = lines.map((l) => ({ itemId: l.itemId, qty: int(value(l) || "0") })).filter((l) => l.qty);
  const bad = lines.some((l) => value(l) !== "" && int(value(l)) === null);
  const total = lines.reduce((sum, l) => sum + (int(value(l) || "0") ?? 0) * l.priceCents, 0);
  return (
    <section id="bestellen" aria-labelledby="order" className="scroll-mt-20 rounded-lg border border-border bg-bg p-4">
      <h2 id="order" className="text-lg">Bestellvorschlag</h2>
      <p className="mt-1 text-sm text-text-muted">Bedarf der nächsten {coverDays} Tage laut Belegung und Wäscheset, minus sauberes Lager und was schon unterwegs ist, aufgerundet auf ganze Packungen. Mengen lassen sich ändern.</p>
      {lines.length ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Artikel</th><th scope="col" className="text-right font-normal">Bedarf</th><th scope="col" className="text-right font-normal">Lager</th><th scope="col" className="text-right font-normal">Unterwegs</th><th scope="col" className="pl-3 font-normal">Bestellen</th><th scope="col" className="text-right font-normal">Betrag</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.itemId} className="border-t border-border">
                    <th scope="row" className="py-1 text-left font-semibold">{l.name}{l.packSize > 1 && <span className="font-normal text-text-muted"> · Pack {l.packSize}</span>}</th>
                    <td className="num text-right">{l.need}</td><td className="num text-right">{l.stock}</td><td className="num text-right">{l.incoming || "–"}</td>
                    <td className="py-1 pl-3"><input aria-label={`Bestellmenge ${l.name}`} inputMode="numeric" className={cn(controlClass, "num w-28 text-right")} value={value(l)} onChange={(e) => setQty((q) => ({ ...q, [l.itemId]: e.target.value }))} /></td>
                    <td className="num text-right">{formatCents((int(value(l) || "0") ?? 0) * l.priceCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border font-semibold"><th scope="row" className="py-2 text-left">Summe</th><td colSpan={4} /><td className="num text-right">{formatCents(total)}</td></tr></tfoot>
            </table>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Wäscherei / Lieferant">
              <select className={controlClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Ohne (nur intern)</option>
                {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}{x.hasEmail ? "" : " (ohne Bestell-E-Mail)"}</option>)}
              </select>
            </Field>
            <Field label="Liefertag"><input type="date" className={controlClass} value={day} min={tomorrow} onChange={(e) => setDay(e.target.value)} /></Field>
            <Field label="Hinweis (optional)"><input className={controlClass} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <Button className="mt-3" disabled={!chosen.length || bad || !day} loading={pending}
            onClick={() => act(() => saveLinenOrder({ supplierId: supplierId || null, deliveryDay: day, note, lines: chosen.map((l) => ({ itemId: l.itemId, qty: l.qty! })) }), "Bestellung als Entwurf angelegt", () => setQty({}))}>
            <Plus aria-hidden className="size-4" /> Als Entwurf anlegen
          </Button>
        </>
      ) : <p className="mt-2 text-text-muted">Für einen Vorschlag braucht jeder Artikel ein Wäscheset (unten unter Artikel).</p>}
    </section>
  );
}

const STATUS = { draft: { label: "Entwurf", tone: "neutral" }, sent: { label: "Bestellt", tone: "info" }, received: { label: "Geliefert", tone: "success" } } as const;

export function OrdersList({ orders }: { orders: LinenOrderRow[] }) {
  const { pending, act } = useAct();
  return (
    <section id="bestellungen" aria-labelledby="orders" className="scroll-mt-20 rounded-lg border border-border bg-bg p-4">
      <h2 id="orders" className="text-lg">Bestellungen</h2>
      {orders.length ? (
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">Lieferung {formatDay(o.deliveryDay, "medium")} <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>{o.supplierName && <span className="font-normal text-text-muted">· {o.supplierName}</span>}</p>
                <p className="text-sm text-text-muted">{o.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")} · {formatCents(o.lines.reduce((n, l) => n + l.qty * l.priceCents, 0))}</p>
              </div>
              <div className="flex gap-2">
                {o.status === "draft" && (
                  <>
                    <Button size="sm" loading={pending} onClick={() => act(async () => { const r = await sendLinenOrder(o.id); return r.ok ? { ok: true } : r; }, o.supplierName ? "Bestellung gesendet" : "Als bestellt markiert")}><Send aria-hidden className="size-4" /> {o.supplierName ? "Senden" : "Als bestellt markieren"}</Button>
                    <Button size="sm" variant="secondary" aria-label="Entwurf löschen" loading={pending} onClick={() => act(() => deleteLinenOrder(o.id), "Entwurf gelöscht")}><Trash2 aria-hidden className="size-4" /></Button>
                  </>
                )}
                {o.status === "sent" && (
                  <ConfirmDialog trigger={<Button size="sm"><Truck aria-hidden className="size-4" /> Lieferung buchen</Button>} title="Lieferung buchen?"
                    description="Die bestellten Mengen kommen ins saubere Lager. Wurde etwas anderes geliefert, danach zählen." confirmLabel="Buchen" loading={pending}
                    onConfirm={() => act(async () => { const r = await receiveLinenOrder(o.id); return r.ok ? { ok: true } : r; }, "Lieferung gebucht")} />
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-text-muted">Noch keine Wäschebestellungen.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- items

type ItemDraft = { id?: string; name: string; kind: LinenKind; price: string; pack: string; sets: Record<string, string> };

export function ItemsPanel({ items, roomTypes, kindLabels }: { items: Pick<LinenItemRow, "id" | "name" | "kind" | "priceCents" | "packSize" | "sets">[]; roomTypes: string[]; kindLabels: Record<LinenKind, string> }) {
  const { pending, act } = useAct();
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const typeLabel = (t: string) => t || (roomTypes.length > 1 ? "Ohne Zimmertyp / Standard" : "Pro Zimmer");
  const open = (i?: (typeof items)[number]) => setDraft(i
    ? { id: i.id, name: i.name, kind: i.kind, price: centsToEuro(i.priceCents), pack: String(i.packSize), sets: Object.fromEntries(i.sets.map((l) => [l.roomType, String(l.qty)])) }
    : { name: "", kind: "bed", price: "", pack: "1", sets: {} });
  const price = draft ? euroToCents(draft.price || "0") : null;
  const pack = draft ? int(draft.pack) : null;
  const setsOk = draft ? Object.values(draft.sets).every((v) => v === "" || (int(v) !== null && int(v)! <= 50)) : true;
  const valid = !!draft && draft.name.trim() && price !== null && pack !== null && pack >= 1 && setsOk;
  const save = () => draft && act(() => saveLinenItem({
    id: draft.id, name: draft.name, kind: draft.kind, priceCents: price!, packSize: pack!,
    sets: Object.entries(draft.sets).filter(([, v]) => int(v)).map(([roomType, v]) => ({ roomType, qty: int(v)! })),
  }).then((r) => (r.ok ? { ok: true as const } : r)), draft.id ? "Artikel gespeichert" : "Artikel angelegt", () => setDraft(null));

  return (
    <section id="artikel" aria-labelledby="items" className="scroll-mt-20 rounded-lg border border-border bg-bg p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="items" className="text-lg">Artikel und Wäschesets</h2>
        <Button size="sm" onClick={() => open()}><Plus aria-hidden className="size-4" /> Artikel anlegen</Button>
      </div>
      <p className="mt-1 text-sm text-text-muted">Preis = was ein Stück pro Wäsche bzw. Miete kostet. Das Set sagt, wie viele Stück ein Komplettwechsel je Zimmertyp braucht.</p>
      {items.length ? (
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-semibold">{i.name} <span className="font-normal text-text-muted">· {kindLabels[i.kind]} · {formatCents(i.priceCents)}{i.packSize > 1 ? ` · Pack ${i.packSize}` : ""}</span></p>
                <p className="text-sm text-text-muted">{i.sets.length ? i.sets.map((l) => `${typeLabel(l.roomType)}: ${l.qty}`).join(" · ") : "Kein Set: geht nicht in den Bedarf ein"}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => open(i)}><Pencil aria-hidden className="size-4" /> Bearbeiten</Button>
                <ConfirmDialog trigger={<Button size="sm" variant="secondary" aria-label={`${i.name} archivieren`}><Trash2 aria-hidden className="size-4" /></Button>} title={`${i.name} archivieren?`}
                  description="Der Artikel verschwindet aus Zählung und Bestellung; Zählungen und Bestellungen bleiben erhalten." confirmLabel="Archivieren" danger loading={pending}
                  onConfirm={() => act(() => archiveLinenItem(i.id), `${i.name} archiviert`)} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-text-muted">Noch keine Artikel. Typisch: Bettbezug, Kissenbezug, Laken, Handtuch groß, Handtuch klein, Badvorleger.</p>}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? "Artikel bearbeiten" : "Wäscheartikel anlegen"}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Abbrechen</Button><Button disabled={!valid} loading={pending} onClick={save}>Speichern</Button></>}>
        {draft && (
          <div className="flex flex-col gap-3">
            <Field label="Name" required><input className={controlClass} maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Art">
              <select className={controlClass} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as LinenKind })}>
                {(Object.keys(kindLabels) as LinenKind[]).map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}
              </select>
            </Field>
            <p className="-mt-1 text-xs text-text-muted">Bettwäsche wechselt bei Bleibern im Bett-Rhythmus, Frottee im Handtuch-Rhythmus, Sonstiges nur bei Abreise.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preis pro Stück (€)" error={price === null ? "Betrag wie 0,45" : undefined}><input inputMode="decimal" className={controlClass} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></Field>
              <Field label="Packungsgröße" error={pack === null || pack < 1 ? "Ganze Zahl ab 1" : undefined}><input inputMode="numeric" className={controlClass} value={draft.pack} onChange={(e) => setDraft({ ...draft, pack: e.target.value })} /></Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Stück pro Komplettwechsel</legend>
              {roomTypes.map((t) => (
                <label key={t} className="flex items-center justify-between gap-3 text-sm">{typeLabel(t)}
                  <input inputMode="numeric" className={cn(controlClass, "num w-24 text-right")} value={draft.sets[t] ?? ""} onChange={(e) => setDraft({ ...draft, sets: { ...draft.sets, [t]: e.target.value } })} />
                </label>
              ))}
              {!setsOk && <p className="text-sm text-danger">Ganze Zahlen von 1 bis 50.</p>}
            </fieldset>
          </div>
        )}
      </Dialog>
    </section>
  );
}

// ---------------------------------------------------------------- settings

const SETTING_FIELDS: { key: keyof HkSettings; label: string; min: number; max: number }[] = [
  { key: "bedEveryDays", label: "Bettwäsche bei Bleibern alle … Tage", min: 1, max: 14 },
  { key: "bathEveryDays", label: "Handtücher bei Bleibern alle … Tage", min: 1, max: 14 },
  { key: "minutesDeparture", label: "Minuten je Abreise-Zimmer", min: 1, max: 240 },
  { key: "minutesStayover", label: "Minuten je Bleiber-Zimmer", min: 0, max: 240 },
  { key: "minutesArrival", label: "Minuten je Anreise (Kontrolle)", min: 0, max: 240 },
  { key: "safetyPct", label: "Reserve in %", min: 0, max: 100 },
  { key: "coverDays", label: "Bestellung deckt … Tage", min: 1, max: 28 },
];

export function SettingsForm({ settings }: { settings: HkSettings }) {
  const { pending, act } = useAct();
  const [v, setV] = useState<Record<keyof HkSettings, string>>(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, String(settings[f.key])])) as Record<keyof HkSettings, string>);
  const errors = Object.fromEntries(SETTING_FIELDS.map((f) => { const n = int(v[f.key]); return [f.key, n === null || n < f.min || n > f.max ? `${f.min} bis ${f.max}` : undefined]; }));
  const valid = Object.values(errors).every((e) => !e);
  return (
    <section aria-labelledby="settings" className="rounded-lg border border-border bg-bg p-4">
      <h2 id="settings" className="text-lg">Einstellungen</h2>
      <p className="mt-1 text-sm text-text-muted">Wechselrhythmus und Zeiten gelten für dieses Hotel und fließen in Wäschebedarf und Personalbedarf.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SETTING_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} error={errors[f.key]}><input inputMode="numeric" className={controlClass} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} /></Field>
        ))}
      </div>
      <Button className="mt-3" disabled={!valid} loading={pending}
        onClick={() => act(() => saveHkSettings(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, int(v[f.key])!])) as HkSettings), "Einstellungen gespeichert")}>Einstellungen speichern</Button>
    </section>
  );
}
