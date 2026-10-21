"use client";

import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyShiftWeek, deleteShift, saveShift } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, controlClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { ShiftRow } from "@/data/linen-types";
import { shiftMinutes } from "@/domain/linen";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";

type Day = { day: string; requiredMin: number; plannedMin: number; hasPlan: boolean };
type Draft = { id?: string; day: string; who: string; name: string; starts: string; ends: string; breakMinutes: string };

const hours = (min: number) => (min / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 });
const label = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { ...opts, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const OTHER = "__other";

export function Roster({ start, today, days, shifts, people, me, manager }: {
  start: string; today: string; days: Day[]; shifts: ShiftRow[]; people: { id: string; name: string }[]; me: string | null; manager: boolean;
}) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string, after?: () => void) => run(async () => {
    const res = await fn();
    if (res.ok) { toast.success(ok); after?.(); router.refresh(); } else toast.error(res.error);
  });
  const week = { required: days.reduce((m, d) => m + d.requiredMin, 0), planned: days.reduce((m, d) => m + d.plannedMin, 0) };
  const perPerson = [...shifts.reduce((m, x) => m.set(x.person, (m.get(x.person) ?? 0) + shiftMinutes(x.starts, x.ends, x.breakMinutes)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const open = (day: string, x?: ShiftRow) => setDraft(x
    ? { id: x.id, day: x.day, who: x.membershipId ?? OTHER, name: x.membershipId ? "" : x.person, starts: x.starts, ends: x.ends, breakMinutes: String(x.breakMinutes) }
    : { day, who: people[0]?.id ?? OTHER, name: "", starts: "07:00", ends: "15:30", breakMinutes: "30" });
  const person = draft ? (draft.who === OTHER ? draft.name.trim() : people.find((p) => p.id === draft.who)?.name ?? "") : "";
  const save = () => draft && act(() => saveShift({
    id: draft.id, day: draft.day, membershipId: draft.who === OTHER ? null : draft.who, person, starts: draft.starts, ends: draft.ends, breakMinutes: Number(draft.breakMinutes) || 0,
  }).then((r) => (r.ok ? { ok: true as const } : r)), draft.id ? "Schicht gespeichert" : "Schicht angelegt", () => setDraft(null));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link aria-label="Vorige Woche" href={`?week=${addDays(start, -7)}`} className="inline-flex size-(--size-control-md) items-center justify-center rounded-md border border-border-input hover:bg-row-hover"><ChevronLeft aria-hidden className="size-4" /></Link>
          <h2 className="text-lg">Woche {label(start, { day: "2-digit", month: "2-digit" })} – {label(addDays(start, 6), { day: "2-digit", month: "2-digit", year: "numeric" })}</h2>
          <Link aria-label="Nächste Woche" href={`?week=${addDays(start, 7)}`} className="inline-flex size-(--size-control-md) items-center justify-center rounded-md border border-border-input hover:bg-row-hover"><ChevronRight aria-hidden className="size-4" /></Link>
        </div>
        <p className="text-sm">Woche: <span className="num font-semibold">{hours(week.planned)}</span> Std. geplant, <span className="num font-semibold">{hours(week.required)}</span> Std. benötigt</p>
        {manager && <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => copyShiftWeek(start).then((r) => (r.ok ? { ok: true as const } : r)), "Vorwoche übernommen")}><Copy aria-hidden className="size-4" /> Vorwoche übernehmen</Button>}
      </div>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {days.map((d) => {
          const gap = d.plannedMin - d.requiredMin;
          const list = shifts.filter((x) => x.day === d.day);
          return (
            <li key={d.day} className={cn("flex flex-col rounded-lg border bg-bg p-3", d.day === today ? "border-accent" : "border-border")}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{label(d.day, { weekday: "long", day: "2-digit", month: "2-digit" })}</h3>
                {d.day === today && <span className="text-xs font-semibold text-accent">Heute</span>}
              </div>
              <p className={cn("mt-1 text-xs", !d.hasPlan ? "text-text-muted" : gap < 0 ? "text-danger" : "text-success")}>
                {hours(d.plannedMin)} / {d.hasPlan ? `${hours(d.requiredMin)} Std.` : "– (keine Belegung)"}{d.hasPlan && gap < 0 ? ` · ${hours(-gap)} Std. fehlen` : ""}
              </p>
              <ul className="mt-2 flex flex-1 flex-col gap-1.5">
                {list.map((x) => (
                  <li key={x.id} className={cn("flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm", x.membershipId && x.membershipId === me ? "bg-accent-subtle" : "bg-surface")}>
                    <span className="min-w-0"><span className="block truncate font-semibold">{x.person}</span><span className="num text-xs text-text-muted">{x.starts}–{x.ends}{x.breakMinutes ? ` · ${x.breakMinutes} Min. Pause` : ""}</span></span>
                    {manager && (
                      <span className="flex shrink-0">
                        <Button size="icon" variant="ghost" aria-label={`Schicht ${x.person} bearbeiten`} onClick={() => open(d.day, x)}><Pencil aria-hidden className="size-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Schicht ${x.person} löschen`} loading={pending} onClick={() => act(() => deleteShift(x.id), "Schicht gelöscht")}><Trash2 aria-hidden className="size-4" /></Button>
                      </span>
                    )}
                  </li>
                ))}
                {!list.length && <li className="text-sm text-text-muted">Keine Schicht</li>}
              </ul>
              {manager && <Button size="sm" variant="secondary" className="mt-2" onClick={() => open(d.day)} aria-label={`Schicht am ${label(d.day, { weekday: "long" })} hinzufügen`}><Plus aria-hidden className="size-4" /> Schicht</Button>}
            </li>
          );
        })}
      </ul>

      {perPerson.length > 0 && (
        <section aria-labelledby="persons" className="max-w-xl rounded-lg border border-border bg-bg p-4">
          <h2 id="persons" className="text-lg">Stunden pro Person</h2>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {perPerson.map(([name, min]) => <li key={name} className="flex justify-between py-1.5 text-sm"><span>{name}</span><span className="num">{hours(min)} Std.</span></li>)}
          </ul>
        </section>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? "Schicht bearbeiten" : "Schicht anlegen"}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Abbrechen</Button><Button disabled={!draft || !person || draft.ends <= draft.starts} loading={pending} onClick={save}>Speichern</Button></>}>
        {draft && (
          <div className="flex flex-col gap-3">
            <Field label="Tag"><input type="date" className={controlClass} value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} /></Field>
            <Field label="Person">
              <select className={controlClass} value={draft.who} onChange={(e) => setDraft({ ...draft, who: e.target.value })}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value={OTHER}>Andere Person (ohne Konto)</option>
              </select>
            </Field>
            {draft.who === OTHER && <Field label="Name"><input className={controlClass} maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Beginn"><input type="time" className={controlClass} value={draft.starts} onChange={(e) => setDraft({ ...draft, starts: e.target.value })} /></Field>
              <Field label="Ende" error={draft.ends <= draft.starts ? "Nach dem Beginn" : undefined}><input type="time" className={controlClass} value={draft.ends} onChange={(e) => setDraft({ ...draft, ends: e.target.value })} /></Field>
              <Field label="Pause (Min.)"><input inputMode="numeric" className={controlClass} value={draft.breakMinutes} onChange={(e) => setDraft({ ...draft, breakMinutes: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
