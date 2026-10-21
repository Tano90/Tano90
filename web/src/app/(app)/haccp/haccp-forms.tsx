"use client";

import { AlertTriangle, CheckCircle2, Download, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveChecklist, saveChecklist, saveHaccpRecords } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { HaccpChecklist, HaccpItem } from "@/data/types";
import { evaluate } from "@/domain/haccp";
import { formatDateTime, formatDay } from "@/lib/dates";
import { countOf } from "@/lib/format";

type Rec = { itemId: string; valueText: string | null; valueNumber: number | null; ok: boolean; action: string | null; recordedAt: string; recordedByName: string };
const shown = (r?: Rec) => (r ? (r.valueNumber !== null ? String(r.valueNumber).replace(".", ",") : r.valueText ?? "") : "");
const limits = (i: HaccpItem) =>
  i.minValue !== null && i.maxValue !== null ? `${String(i.minValue).replace(".", ",")} bis ${String(i.maxValue).replace(".", ",")} °C`
  : i.maxValue !== null ? `höchstens ${String(i.maxValue).replace(".", ",")} °C` : i.minValue !== null ? `mindestens ${String(i.minValue).replace(".", ",")} °C` : "";

export function ChecklistDay({ checklist, day, records }: { checklist: HaccpChecklist; day: string; records: Record<string, Rec> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(checklist.items.map((i) => [i.id, shown(records[i.id])])));
  const [actions, setActions] = useState<Record<string, string>>(Object.fromEntries(checklist.items.map((i) => [i.id, records[i.id]?.action ?? ""])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = checklist.items.filter((i) => i.kind !== "text" && records[i.id]).length;
  const required = checklist.items.filter((i) => i.kind !== "text").length;

  const save = () =>
    start(async () => {
      const res = await saveHaccpRecords(day, checklist.items.map((i) => ({ itemId: i.id, value: values[i.id] ?? "", action: actions[i.id] || null })));
      if (!res.ok) return setError(res.error);
      setError(null);
      toast.success(`${countOf(res.data, "Eintrag", "Einträge")} gespeichert`);
      router.refresh();
    });

  return (
    <section aria-labelledby={`cl-${checklist.id}`} className="flex flex-col gap-3 rounded-md border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`cl-${checklist.id}`} className="text-lg">{checklist.name}</h2>
        <Badge tone={done === required ? "success" : "warning"}>{done} von {required} erledigt</Badge>
      </div>
      {error && <Notice tone="warning">{error}</Notice>}
      <ul className="flex flex-col divide-y divide-border">
        {checklist.items.map((i) => {
          const r = evaluate(i, values[i.id] ?? "");
          const saved = records[i.id];
          const id = `v-${i.id}`;
          return (
            <li key={i.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor={i.kind === "check" ? undefined : id} id={`${id}-label`} className="min-w-48 flex-1 font-semibold">
                  {i.label}
                  {i.kind === "temperature" && <span className="block text-xs font-normal text-text-muted">Soll {limits(i)}</span>}
                </label>
                {i.kind === "temperature" && (
                  <span className="flex items-center gap-1">
                    <input id={id} inputMode="decimal" className="num h-(--size-control-lg) w-24 rounded-sm border border-border-input bg-bg px-3 text-right text-base"
                      value={values[i.id] ?? ""} onChange={(e) => setValues({ ...values, [i.id]: e.target.value.replace(/[^\d,.-]/g, "").replace(".", ",") })} />
                    <span className="text-text-muted">°C</span>
                  </span>
                )}
                {i.kind === "check" && (
                  <span role="radiogroup" aria-labelledby={`${id}-label`} className="flex gap-3">
                    <label className="flex items-center gap-1"><input type="radio" name={id} checked={values[i.id] === "ok"} onChange={() => setValues({ ...values, [i.id]: "ok" })} /> in Ordnung</label>
                    <label className="flex items-center gap-1"><input type="radio" name={id} checked={values[i.id] === "not_ok"} onChange={() => setValues({ ...values, [i.id]: "not_ok" })} /> nicht in Ordnung</label>
                  </span>
                )}
                {i.kind === "text" && (
                  <input id={id} className="h-(--size-control-lg) min-w-48 flex-1 rounded-sm border border-border-input bg-bg px-3 text-base" value={values[i.id] ?? ""} maxLength={500}
                    onChange={(e) => setValues({ ...values, [i.id]: e.target.value })} />
                )}
                {r && i.kind !== "text" && (r.ok
                  ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 aria-hidden className="size-4" /> im Soll</span>
                  : <span className="inline-flex items-center gap-1 text-danger"><AlertTriangle aria-hidden className="size-4" /> {r.reason}</span>)}
              </div>
              {r && !r.ok && (
                <Field label={`Korrekturmaßnahme für „${i.label}“`} hint="Was wurde getan? Pflicht bei jeder Abweichung.">
                  <Textarea rows={2} maxLength={1000} value={actions[i.id] ?? ""} onChange={(e) => setActions({ ...actions, [i.id]: e.target.value })} />
                </Field>
              )}
              {saved && <p className="text-xs text-text-muted">Eingetragen {formatDateTime(saved.recordedAt)} von {saved.recordedByName}</p>}
            </li>
          );
        })}
      </ul>
      <div><Button onClick={save} loading={pending}>Speichern</Button></div>
    </section>
  );
}

type Dev = { itemId: string; day: string; label: string; checklist: string; kind: HaccpItem["kind"]; valueText: string | null; valueNumber: number | null; action: string | null; recordedByName: string; recordedAt: string };

function devCsv(rows: Dev[]) {
  // Typed by people: neutralise a leading = + - @ so Excel never runs it as a formula.
  const text = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["Tag", "Checkliste", "Kontrollpunkt", "Wert", "Maßnahme", "Eingetragen von", "Eingetragen am"];
  const lines = rows.map((r) => [r.day, text(r.checklist), text(r.label), r.valueNumber !== null ? String(r.valueNumber).replace(".", ",") : text(r.valueText ?? ""), text(r.action ?? ""), text(r.recordedByName), formatDateTime(r.recordedAt)].map(esc).join(";"));
  return `﻿${[head.join(";"), ...lines].join("\r\n")}\r\n`;
}

export function Deviations({ rows, outletName }: { rows: Dev[]; outletName: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([devCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const slug = outletName.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-");
    const a = Object.assign(document.createElement("a"), { href: url, download: `haccp-abweichungen-${slug}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section aria-labelledby="deviations" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="deviations" className="text-lg">Abweichungen der letzten 30 Tage</h2>
        <Button variant="secondary" size="sm" disabled={!rows.length} onClick={download}><Download aria-hidden className="size-4" /> Als CSV exportieren</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-text-muted">Keine Abweichungen.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={`${r.itemId}-${r.day}`} className="rounded-md border border-border bg-bg p-3">
              <p className="font-semibold">{formatDay(r.day)} · {r.label} ({r.checklist}): {r.valueNumber !== null ? `${String(r.valueNumber).replace(".", ",")} °C` : r.valueText === "not_ok" ? "nicht in Ordnung" : r.valueText}</p>
              <p className="text-text-muted">Maßnahme: {r.action} · {r.recordedByName}, {formatDateTime(r.recordedAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type DraftItem = { id?: string; label: string; kind: HaccpItem["kind"]; min: string; max: string };
const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

export function ChecklistManager({ checklists }: { checklists: HaccpChecklist[] }) {
  return (
    <section aria-labelledby="manage" className="flex flex-col gap-3">
      <h2 id="manage" className="text-lg">Checklisten verwalten</h2>
      <ul className="flex flex-col gap-2">
        {checklists.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg px-4 py-2">
            <span>{c.name} <span className="text-text-muted">· {c.items.length} Kontrollpunkte</span></span>
            <span className="flex gap-2"><ChecklistEditor checklist={c} /><ArchiveChecklist id={c.id} name={c.name} /></span>
          </li>
        ))}
      </ul>
      <div><ChecklistEditor checklist={null} /></div>
    </section>
  );
}

function ChecklistEditor({ checklist }: { checklist: HaccpChecklist | null }) {
  const router = useRouter();
  const fresh = (): DraftItem => ({ label: "", kind: "check", min: "", max: "" });
  const initial = () => checklist?.items.map((i) => ({ id: i.id, label: i.label, kind: i.kind, min: i.minValue === null ? "" : String(i.minValue).replace(".", ","), max: i.maxValue === null ? "" : String(i.maxValue).replace(".", ",") })) ?? [fresh()];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(checklist?.name ?? "");
  const [items, setItems] = useState<DraftItem[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upd = (k: number, patch: Partial<DraftItem>) => setItems(items.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const save = () =>
    start(async () => {
      const res = await saveChecklist({
        id: checklist?.id, name,
        items: items.map((i) => ({ id: i.id, label: i.label, kind: i.kind, minValue: i.kind === "temperature" ? num(i.min) : null, maxValue: i.kind === "temperature" ? num(i.max) : null })),
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      toast.success("Checkliste gespeichert");
      router.refresh();
    });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) { setName(checklist?.name ?? ""); setItems(initial()); setError(null); } }}
      trigger={checklist ? <Button variant="ghost" size="sm" aria-label={`${checklist.name} bearbeiten`}>Bearbeiten</Button> : <Button variant="secondary"><Plus aria-hidden className="size-4" /> Neue Checkliste</Button>}
      title={checklist ? checklist.name : "Neue Checkliste"}
      footer={<Button onClick={save} loading={pending}>Speichern</Button>}
    >
      <div className="flex flex-col gap-4">
        {error && <p role="alert" className="text-danger">{error}</p>}
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <ol className="flex flex-col gap-3" aria-label="Kontrollpunkte">
          {items.map((it, k) => (
            <li key={it.id ?? `new-${k}`} className="grid gap-2 rounded-sm border border-border p-2 sm:grid-cols-[1fr_9rem]">
              <Field label={`Kontrollpunkt ${k + 1}`}><Input value={it.label} onChange={(e) => upd(k, { label: e.target.value })} maxLength={160} /></Field>
              <Field label="Art">
                <Select value={it.kind} onChange={(e) => upd(k, { kind: e.target.value as HaccpItem["kind"] })}>
                  <option value="check">Abhaken</option>
                  <option value="temperature">Temperatur</option>
                  <option value="text">Notiz</option>
                </Select>
              </Field>
              {it.kind === "temperature" && (
                <div className="flex gap-2 sm:col-span-2">
                  <Field label="von °C" className="w-28"><Input inputMode="decimal" value={it.min} onChange={(e) => upd(k, { min: e.target.value.replace(/[^\d,.-]/g, "") })} /></Field>
                  <Field label="bis °C" className="w-28"><Input inputMode="decimal" value={it.max} onChange={(e) => upd(k, { max: e.target.value.replace(/[^\d,.-]/g, "") })} /></Field>
                </div>
              )}
              <div className="sm:col-span-2">
                <Button variant="ghost" size="sm" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== k))}>
                  <Trash2 aria-hidden className="size-4" /> Kontrollpunkt {k + 1} entfernen
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <div><Button variant="secondary" size="sm" onClick={() => setItems([...items, fresh()])}><Plus aria-hidden className="size-4" /> Kontrollpunkt</Button></div>
      </div>
    </Dialog>
  );
}

function ArchiveChecklist({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="sm" aria-label={`${name} archivieren`}>Archivieren</Button>}
      title={`„${name}“ archivieren?`}
      description="Sie erscheint nicht mehr in der Tagesansicht. Alle bisherigen Einträge bleiben im Protokoll."
      confirmLabel="Archivieren"
      danger
      loading={pending}
      onConfirm={() => start(async () => {
        const res = await archiveChecklist(id);
        if (!res.ok) return void toast.error(res.error);
        router.refresh();
      })}
    />
  );
}
