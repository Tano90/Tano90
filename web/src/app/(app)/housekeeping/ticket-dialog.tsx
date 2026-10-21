"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTicket } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, controlClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { TicketKind } from "@/data/linen-types";
import { shrinkPhoto } from "@/lib/image";

export const KIND_LABEL: Record<TicketKind, string> = { defect: "Schaden", lost_found: "Fundsache" };

/** Report a defect or a lost item, optionally for a room, with a photo from the phone's camera. */
export function TicketDialog({ kind, roomId, roomLabel, rooms, trigger }: {
  kind: TicketKind; roomId?: string; roomLabel?: string; rooms?: { id: string; number: string }[]; trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [room, setRoom] = useState(roomId ?? "");
  const [photo, setPhoto] = useState<{ base64: string; type: "image/jpeg" } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const reset = () => { setTitle(""); setNote(""); setPhoto(null); setPreview(null); setRoom(roomId ?? ""); };
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      const p = await shrinkPhoto(file);
      setPhoto(p);
      setPreview(`data:${p.type};base64,${p.base64}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Das Foto konnte nicht verarbeitet werden.");
    }
  };
  const save = () => start(async () => {
    const res = await createTicket({ kind, title, note, roomId: room || null, photo });
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${KIND_LABEL[kind]} gemeldet`);
    setOpen(false);
    reset();
    router.refresh();
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }} trigger={trigger}
      title={kind === "defect" ? `Schaden melden${roomLabel ? `: ${roomLabel}` : ""}` : `Fundsache erfassen${roomLabel ? `: ${roomLabel}` : ""}`}
      footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Abbrechen</Button><Button disabled={!title.trim()} loading={pending} onClick={save}>Melden</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label={kind === "defect" ? "Was ist kaputt?" : "Was wurde gefunden?"} required>
          <input className={controlClass} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "defect" ? "z. B. Duschabfluss verstopft" : "z. B. Ladekabel, schwarz"} />
        </Field>
        {rooms && !roomId && (
          <Field label="Zimmer (optional)">
            <select className={controlClass} value={room} onChange={(e) => setRoom(e.target.value)}>
              <option value="">kein Zimmer / Allgemeinbereich</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
            </select>
          </Field>
        )}
        <Field label={kind === "defect" ? "Details (optional)" : "Fundort, Aufbewahrung (optional)"}>
          <textarea className={`${controlClass} h-auto py-2`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <label className="inline-flex h-(--size-control-md) w-fit cursor-pointer items-center gap-2 rounded-md border border-border-input px-3 font-semibold hover:bg-row-hover">
          <Camera aria-hidden className="size-4" /> {photo ? "Anderes Foto" : "Foto aufnehmen"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {preview && <img src={preview} alt="Vorschau des Fotos" className="max-h-48 w-fit rounded-md border border-border" />}
      </div>
    </Dialog>
  );
}
