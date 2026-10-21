"use client";

import { BedDouble, BellOff, Check, PackageSearch, Play, Star, Sunrise, UserRound, Wand2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveRoom, assignRooms, autoAssignRooms, createRooms, saveHkChecklist, startHousekeepingDay, updateRoom } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { HkChecklistItem, Room } from "@/data/types";
import { OCCUPANCY_LABEL, type Occupancy, type RoomStatus, STATUS_LABEL, byUrgency, canSetStatus, summary } from "@/domain/housekeeping";
import { TicketDialog } from "./ticket-dialog";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { countOf } from "@/lib/format";

type RoomRow = Room & { assigneeName: string | null };
type Log = { at: string; number: string; fromStatus: string | null; toStatus: string; byName: string };
type Props = { rooms: RoomRow[]; checklist: HkChecklistItem[]; staff: { id: string; name: string }[]; recent: Log[]; me: string | null; manager: boolean; timezone?: string };

const TILE: Record<RoomStatus, string> = {
  dirty: "border-danger bg-danger-subtle",
  clean: "border-info bg-info-subtle",
  inspected: "border-success bg-success-subtle",
  out_of_order: "border-border-input bg-surface-sunken",
};
const DOT: Record<RoomStatus, string> = { dirty: "bg-danger", clean: "bg-info", inspected: "bg-success", out_of_order: "bg-text-muted" };
const STATUSES = Object.keys(STATUS_LABEL) as RoomStatus[];

export function HousekeepingBoard({ rooms, checklist, staff, recent, me, manager, timezone }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<RoomStatus | "all">("all");
  const [mine, setMine] = useState(!manager && !!me);
  const [picked, setPicked] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [sort, setSort] = useState<"urgency" | "number">(manager ? "number" : "urgency");
  const [pending, start] = useTransition();
  const sum = summary(rooms);
  const filtered = rooms.filter((r) => (filter === "all" || r.status === filter) && (!mine || r.assignedTo === me));
  const shown = sort === "urgency" ? [...filtered].sort(byUrgency) : filtered;
  const act = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, ok: (data: unknown) => string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Da ist etwas schiefgegangen.");
      toast.success(ok(res.data));
      setPicked([]);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {([["schmutzig", sum.dirty, "dirty"], ["gereinigt", sum.clean, "clean"], ["kontrolliert", sum.inspected, "inspected"], ["gesperrt", sum.outOfOrder, "out_of_order"]] as const).map(([label, n, st]) => (
          <div key={st} className="rounded-md border border-border bg-bg p-3">
            <dt className="flex items-center gap-2 text-xs text-text-muted"><span aria-hidden className={cn("size-2 rounded-pill", DOT[st])} />{label}</dt>
            <dd className="num text-xl">{n}</dd>
          </div>
        ))}
        <div className="rounded-md border border-border bg-bg p-3"><dt className="text-xs text-text-muted">Abreisen</dt><dd className="num text-xl">{sum.departures}</dd></div>
        <div className="rounded-md border border-border bg-bg p-3">
          <dt className="text-xs text-text-muted">Anreisen</dt>
          <dd className="num text-xl">{sum.arrivals}{sum.arrivalsNotReady > 0 && <span className="ml-2 text-xs font-normal text-danger">{sum.arrivalsNotReady} nicht fertig</span>}</dd>
        </div>
      </dl>

      {rooms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Nach Status filtern" className="flex flex-wrap gap-1">
            {(["all", ...STATUSES] as const).map((st) => (
              <button key={st} type="button" aria-pressed={filter === st} onClick={() => setFilter(st)}
                className={cn("h-(--size-control-sm) rounded-pill border px-3 text-sm", filter === st ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg hover:bg-row-hover")}>
                {st === "all" ? "Alle" : STATUS_LABEL[st]}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm">Reihenfolge
            <Select value={sort} onChange={(e) => setSort(e.target.value as "urgency" | "number")} className="w-44">
              <option value="urgency">Dringlichkeit</option>
              <option value="number">Zimmernummer</option>
            </Select>
          </label>
          {me && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Nur meine Zimmer</label>}
          {manager && <AutoAssign staff={staff} rooms={sum.dirty} />}
          {manager && (
            <ConfirmDialog
              trigger={<Button variant="secondary" size="sm"><Sunrise aria-hidden className="size-4" /> Tagesbeginn</Button>}
              title="Housekeeping-Tag beginnen?"
              description="Belegte Zimmer und Abreisen gehen auf „schmutzig“, gesperrte bleiben gesperrt. Alle Zuteilungen werden aufgehoben."
              confirmLabel="Tag beginnen"
              loading={pending}
              onConfirm={() => act(() => startHousekeepingDay(), (n) => `${countOf(n as number, "Zimmer", "Zimmer")} auf schmutzig`)}
            />
          )}
        </div>
      )}

      {manager && picked.length > 0 && (
        <div className="sticky top-(--size-header) z-20 flex flex-wrap items-end gap-3 rounded-md border border-accent bg-accent-subtle p-3">
          <p className="font-semibold">{countOf(picked.length, "Zimmer", "Zimmer")} ausgewählt</p>
          <label className="flex flex-col gap-1 text-xs">Zuteilen an
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-56">
              <option value="">niemand (Zuteilung aufheben)</option>
              {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </label>
          <Button loading={pending} onClick={() => act(() => assignRooms(picked, assignee || null), (n) => `${countOf(n as number, "Zimmer", "Zimmer")} zugeteilt`)}>Zuteilen</Button>
          <Button variant="ghost" onClick={() => setPicked([])}>Auswahl aufheben</Button>
        </div>
      )}

      {rooms.length === 0 ? (
        <Notice>
          <p className="font-semibold">Noch keine Zimmer in diesem Outlet.</p>
          <p className="text-text-muted">{manager ? "Lege unten die Zimmer an, z. B. „101-120, 201-210“." : "Die Leitung legt die Zimmer an."}</p>
        </Notice>
      ) : shown.length === 0 ? (
        <p className="text-text-muted">Keine Zimmer mit diesem Filter.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {shown.map((r) => (
            <li key={r.id} className="relative">
              {manager && (
                <input type="checkbox" aria-label={`Zimmer ${r.number} auswählen`} checked={picked.includes(r.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))}
                  className="absolute top-2 right-2 z-10 size-6" />
              )}
              <RoomDialog room={r} checklist={checklist} manager={manager} timezone={timezone}
                trigger={
                  <button type="button" className={cn("flex h-full w-full flex-col items-start gap-1 rounded-md border-2 p-3 text-left transition-transform duration-fast hover:-translate-y-0.5", TILE[r.status])}>
                    <span className="flex w-full items-center gap-1.5 pr-7"><span className="num text-xl leading-none">{r.number}</span>
                      {r.vip && <Star aria-label="VIP" className="size-4 fill-saffron text-saffron" />}
                      {r.dnd && <BellOff aria-label="Bitte nicht stören" className="size-4 text-danger" />}
                    </span>
                    <span className="text-xs text-text-muted">{[r.roomType, r.floor && `Etage ${r.floor}`].filter(Boolean).join(" · ") || " "}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="neutral">{STATUS_LABEL[r.status]}</Badge>
                      {r.occupancy !== "vacant" && <Badge tone={r.occupancy === "arrival" ? "warning" : "info"}>{OCCUPANCY_LABEL[r.occupancy]}{r.occupancy === "arrival" && r.arrivalTime ? ` ${r.arrivalTime}` : ""}</Badge>}
                      {r.dnd && <Badge tone="danger">Nicht stören</Badge>}
                      {r.cleaningStartedAt && <Badge tone="info">in Arbeit</Badge>}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-text-muted"><UserRound aria-hidden className="size-3.5" />{r.assigneeName ?? "nicht zugeteilt"}</span>
                    {r.note && <span className="line-clamp-2 text-xs">{r.note}</span>}
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {manager && <Manage checklist={checklist} />}

      <section aria-labelledby="log-h" className="flex flex-col gap-2">
        <h2 id="log-h" className="text-lg">Letzte Änderungen</h2>
        {recent.length === 0 ? <p className="text-text-muted">Noch keine.</p> : (
          <ul className="divide-y divide-border rounded-md border border-border bg-bg text-sm">
            {recent.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 px-3 py-2">
                <span className="num text-text-muted">{formatDateTime(e.at, timezone)}</span>
                <span>Zimmer <strong>{e.number}</strong>: {e.fromStatus ? STATUS_LABEL[e.fromStatus as RoomStatus] : "neu"} → {STATUS_LABEL[e.toStatus as RoomStatus]}</span>
                <span className="text-text-muted">{e.byName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RoomDialog({ room, checklist, manager, timezone, trigger }: { room: RoomRow; checklist: HkChecklistItem[]; manager: boolean; timezone?: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [note, setNote] = useState(room.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const role = manager ? "chef" : "outlet_staff";
  const save = (patch: Parameters<typeof updateRoom>[1], message: string) =>
    start(async () => {
      const res = await updateRoom(room.id, patch);
      if (!res.ok) return setError(res.error);
      setError(null);
      setOpen(false);
      setChecked([]);
      toast.success(message);
      router.refresh();
    });
  const allTicked = checklist.every((i) => checked.includes(i.id));
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }} trigger={trigger}
      title={`Zimmer ${room.number}`}
      description={`${STATUS_LABEL[room.status]} · ${OCCUPANCY_LABEL[room.occupancy]}${room.assigneeName ? ` · ${room.assigneeName}` : ""} · zuletzt ${formatDateTime(room.updatedAt, timezone)}`}>
      <div className="flex flex-col gap-4">
        {error && <Notice tone="warning">{error}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={room.dnd ? "primary" : "secondary"} loading={pending} onClick={() => save({ dnd: !room.dnd }, room.dnd ? `Zimmer ${room.number}: darf wieder gereinigt werden` : `Zimmer ${room.number}: bitte nicht stören`)}>
            <BellOff aria-hidden className="size-4" /> {room.dnd ? "„Nicht stören“ aufheben" : "Bitte nicht stören"}
          </Button>
          {room.status === "dirty" && !room.cleaningStartedAt && !room.dnd && (
            <Button size="sm" variant="secondary" loading={pending} onClick={() => save({ start: true }, `Zimmer ${room.number}: Reinigung läuft`)}><Play aria-hidden className="size-4" /> Reinigung starten</Button>
          )}
          {room.cleaningStartedAt && <span className="self-center text-sm text-text-muted">Reinigung läuft seit {new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(room.cleaningStartedAt))}</span>}
        </div>
        {room.status === "dirty" && (
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 font-semibold">Reinigung</legend>
            {checklist.length === 0 && <p className="text-sm text-text-muted">Keine Checkliste hinterlegt.</p>}
            {checklist.map((i) => (
              <label key={i.id} className="flex items-center gap-2">
                <input type="checkbox" className="size-5" checked={checked.includes(i.id)} onChange={(e) => setChecked(e.target.checked ? [...checked, i.id] : checked.filter((x) => x !== i.id))} />
                {i.label}
              </label>
            ))}
            <div><Button disabled={!allTicked} loading={pending} onClick={() => save({ status: "clean", checked }, `Zimmer ${room.number} gereinigt`)}><Check aria-hidden className="size-4" /> Als gereinigt melden</Button></div>
          </fieldset>
        )}
        {room.status === "clean" && !manager && (
          <div><Button variant="secondary" loading={pending} onClick={() => save({ status: "dirty" }, `Zimmer ${room.number} wieder schmutzig`)}>Zurück auf schmutzig</Button></div>
        )}
        {manager && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Status setzen</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.filter((st) => canSetStatus(role, room.status, st) && st !== "clean").map((st) => (
                <Button key={st} variant={st === "inspected" ? "primary" : "secondary"} size="sm" loading={pending} onClick={() => save({ status: st }, `Zimmer ${room.number}: ${STATUS_LABEL[st]}`)}>
                  {st === "inspected" ? "Kontrolliert, freigeben" : STATUS_LABEL[st]}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Belegung">
                <Select value={room.occupancy} onChange={(e) => save({ occupancy: e.target.value as Occupancy }, `Zimmer ${room.number}: ${OCCUPANCY_LABEL[e.target.value as Occupancy]}`)}>
                  {(Object.keys(OCCUPANCY_LABEL) as Occupancy[]).map((o) => <option key={o} value={o}>{OCCUPANCY_LABEL[o]}</option>)}
                </Select>
              </Field>
              <Field label="Anreisezeit">
                <Input type="time" defaultValue={room.arrivalTime ?? ""} onBlur={(e) => e.target.value !== (room.arrivalTime ?? "") && save({ arrivalTime: e.target.value || null }, `Zimmer ${room.number}: Anreise ${e.target.value || "ohne Uhrzeit"}`)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-6" checked={room.vip} onChange={(e) => save({ vip: e.target.checked }, `Zimmer ${room.number}: ${e.target.checked ? "VIP" : "kein VIP"}`)} /> VIP-Gast (wird zuerst gemacht und kontrolliert)</label>
          </div>
        )}
        <Field label="Notiz (z. B. Defekt, Gästewunsch)">
          <Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <TicketDialog kind="defect" roomId={room.id} roomLabel={`Zimmer ${room.number}`} trigger={<Button size="sm" variant="secondary"><Wrench aria-hidden className="size-4" /> Schaden melden</Button>} />
          <TicketDialog kind="lost_found" roomId={room.id} roomLabel={`Zimmer ${room.number}`} trigger={<Button size="sm" variant="secondary"><PackageSearch aria-hidden className="size-4" /> Fundsache</Button>} />
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" disabled={note === (room.note ?? "")} loading={pending} onClick={() => save({ note }, "Notiz gespeichert")}>Notiz speichern</Button>
          {manager && (
            <Button variant="ghost" loading={pending} onClick={() => start(async () => {
              const res = await archiveRoom(room.id);
              if (!res.ok) return setError(res.error);
              setOpen(false);
              toast.success(`Zimmer ${room.number} archiviert`);
              router.refresh();
            })}>Zimmer archivieren</Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Manage({ checklist }: { checklist: HkChecklistItem[] }) {
  const router = useRouter();
  const [f, setF] = useState({ numbers: "", floor: "", roomType: "" });
  const [items, setItems] = useState(checklist.map((i) => i.label).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="manage-h" className="grid gap-6 rounded-md border border-border bg-surface p-4 lg:grid-cols-2">
      <h2 id="manage-h" className="sr-only">Zimmer und Checkliste verwalten</h2>
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-lg"><BedDouble aria-hidden className="size-5 text-accent" /> Zimmer anlegen</h3>
        {error && <Notice tone="warning">{error}</Notice>}
        <Field label="Zimmernummern" hint="Bereiche und einzelne Namen, z. B. 101-120, 201-210, Suite 1">
          <Input value={f.numbers} onChange={(e) => setF((p) => ({ ...p, numbers: e.target.value }))} maxLength={4000} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Etage (optional)"><Input value={f.floor} onChange={(e) => setF((p) => ({ ...p, floor: e.target.value }))} maxLength={20} /></Field>
          <Field label="Zimmertyp (optional)"><Input value={f.roomType} onChange={(e) => setF((p) => ({ ...p, roomType: e.target.value }))} maxLength={60} placeholder="z. B. Doppelzimmer" /></Field>
        </div>
        <div>
          <Button loading={pending} onClick={() => start(async () => {
            const res = await createRooms(f);
            if (!res.ok) return setError(res.error);
            setError(null);
            setF({ numbers: "", floor: "", roomType: "" });
            toast.success(`${countOf(res.data.added, "Zimmer", "Zimmer")} angelegt${res.data.skipped.length ? `, ${res.data.skipped.length} gab es schon` : ""}`);
            router.refresh();
          })}>Anlegen</Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-lg">Checkliste Reinigung</h3>
        <Field label="Ein Punkt pro Zeile" hint="Wird vor „gereinigt“ abgehakt, für alle Zimmer des Betriebs.">
          <Textarea rows={6} value={items} onChange={(e) => setItems(e.target.value)} />
        </Field>
        <div>
          <Button variant="secondary" loading={pending} onClick={() => start(async () => {
            const res = await saveHkChecklist(items.split("\n"));
            if (!res.ok) return void toast.error(res.error);
            toast.success("Checkliste gespeichert");
            router.refresh();
          })}>Checkliste speichern</Button>
        </div>
      </div>
    </section>
  );
}

function AutoAssign({ staff, rooms }: { staff: { id: string; name: string }[]; rooms: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Zimmer automatisch verteilen"
      description={`${countOf(rooms, "schmutziges Zimmer", "schmutzige Zimmer")} gleichmäßig nach Minuten verteilen, in Blöcken je Etage. „Bitte nicht stören“ bleibt außen vor.`}
      trigger={<Button variant="secondary" size="sm" disabled={!rooms}><Wand2 aria-hidden className="size-4" /> Automatisch verteilen</Button>}
      footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Abbrechen</Button><Button disabled={!people.length} loading={pending} onClick={() => start(async () => {
        const res = await autoAssignRooms(people);
        if (!res.ok) return void toast.error(res.error);
        toast.success(`${countOf(res.data, "Zimmer", "Zimmer")} auf ${people.length} ${people.length === 1 ? "Person" : "Personen"} verteilt`);
        setOpen(false);
        setPeople([]);
        router.refresh();
      })}>Verteilen</Button></>}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Wer arbeitet heute?</legend>
        {staff.map((m) => (
          <label key={m.id} className="flex items-center gap-2"><input type="checkbox" className="size-6" checked={people.includes(m.id)} onChange={(e) => setPeople(e.target.checked ? [...people, m.id] : people.filter((x) => x !== m.id))} /> {m.name}</label>
        ))}
      </fieldset>
    </Dialog>
  );
}
