"use client";

import { Check, PackageSearch, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeTicket } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, controlClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { TicketKind, TicketRow } from "@/data/linen-types";
import { formatDateTime } from "@/lib/dates";
import { KIND_LABEL, TicketDialog } from "../ticket-dialog";

const DONE_LABEL: Record<TicketKind, string> = { defect: "Erledigt", lost_found: "Zurückgegeben / entsorgt" };

export function TicketList({ tickets, rooms }: { tickets: TicketRow[]; rooms: { id: string; number: string }[] }) {
  const [kind, setKind] = useState<TicketKind | "all">("all");
  const shown = tickets.filter((t) => kind === "all" || t.kind === kind);
  const open = shown.filter((t) => t.status === "open");
  const done = shown.filter((t) => t.status === "done");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Art" className="flex gap-1">
          {(["all", "defect", "lost_found"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`h-(--size-control-sm) rounded-pill border px-3 text-sm ${kind === k ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg hover:bg-row-hover"}`}>
              {k === "all" ? "Alle" : k === "defect" ? "Schäden" : "Fundsachen"}
            </button>
          ))}
        </div>
        <span className="ml-auto flex gap-2">
          <TicketDialog kind="defect" rooms={rooms} trigger={<Button size="sm"><Wrench aria-hidden className="size-4" /> Schaden melden</Button>} />
          <TicketDialog kind="lost_found" rooms={rooms} trigger={<Button size="sm" variant="secondary"><PackageSearch aria-hidden className="size-4" /> Fundsache erfassen</Button>} />
        </span>
      </div>
      <section aria-labelledby="open-h">
        <h2 id="open-h" className="text-lg">Offen ({open.length})</h2>
        {open.length ? <ul className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{open.map((t) => <Ticket key={t.id} t={t} />)}</ul> : <p className="mt-1 text-text-muted">Nichts offen.</p>}
      </section>
      {done.length > 0 && (
        <section aria-labelledby="done-h">
          <h2 id="done-h" className="text-lg">Erledigt, letzte 30 Tage</h2>
          <ul className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{done.map((t) => <Ticket key={t.id} t={t} />)}</ul>
        </section>
      )}
    </div>
  );
}

function Ticket({ t }: { t: TicketRow }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(false);
  const [resolution, setResolution] = useState("");
  const [pending, start] = useTransition();
  const days = Math.floor((Date.now() - Date.parse(t.createdAt)) / 86_400_000);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{t.title}</p>
        <Badge tone={t.kind === "defect" ? "warning" : "info"}>{KIND_LABEL[t.kind]}</Badge>
      </div>
      <p className="text-xs text-text-muted">{t.roomNumber ? `Zimmer ${t.roomNumber} · ` : ""}{formatDateTime(t.createdAt)}{t.createdByName ? ` · ${t.createdByName}` : ""}{t.status === "open" && days >= 2 ? ` · seit ${days} Tagen offen` : ""}</p>
      {t.note && <p className="text-sm">{t.note}</p>}
      {t.hasPhoto && <a href={`/api/hk-photo/${t.id}`} target="_blank" rel="noreferrer" className="w-fit"><img src={`/api/hk-photo/${t.id}`} alt={`Foto: ${t.title}`} loading="lazy" className="max-h-40 rounded-md border border-border" /></a>}
      {t.status === "done" ? (
        <p className="flex items-center gap-1 text-sm text-success"><Check aria-hidden className="size-4" /> {DONE_LABEL[t.kind]}{t.resolution ? `: ${t.resolution}` : ""}</p>
      ) : (
        <Dialog open={dialog} onOpenChange={setDialog} title={`${t.title}: ${DONE_LABEL[t.kind].toLowerCase()}`}
          trigger={<Button size="sm" variant="secondary" className="w-fit"><Check aria-hidden className="size-4" /> {t.kind === "defect" ? "Erledigt" : "Zurückgegeben / entsorgt"}</Button>}
          footer={<><Button variant="secondary" onClick={() => setDialog(false)}>Abbrechen</Button><Button loading={pending} onClick={() => start(async () => {
            const res = await closeTicket(t.id, resolution);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Meldung erledigt");
            setDialog(false);
            router.refresh();
          })}>Abschließen</Button></>}>
          <Field label={t.kind === "defect" ? "Was wurde gemacht? (optional)" : "An wen / wie? (optional)"}>
            <input className={controlClass} maxLength={300} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
        </Dialog>
      )}
    </li>
  );
}
