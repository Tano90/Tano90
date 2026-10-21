"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveOutlet, createOutlet, inviteMember, removeMember, transferOwnership, updateMember } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { Member, Role } from "@/data/types";

const ROLE: Record<Role, { label: string; text: string }> = {
  owner: { label: "Inhaber", text: "Alles, inklusive Abrechnung" },
  admin: { label: "Admin", text: "Alles außer Abrechnung" },
  chef: { label: "Küchenleitung", text: "Zutaten, Rezepte, Lieferanten bearbeiten; alle Outlets" },
  outlet_staff: { label: "Team", text: "Bestellen, Ware annehmen, zählen, Schwund – nur in den eigenen Outlets" },
};

type O = { id: string; name: string; isCentralKitchen: boolean };

export function TeamAdmin({ members, outlets, me }: { members: Member[]; outlets: O[]; me: { userId: string; role: Role } }) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="outlets-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="outlets-h" className="text-lg">Outlets ({outlets.length})</h2>
          <NewOutlet />
        </div>
        <ul className="divide-y divide-border rounded-md border border-border bg-bg">
          {outlets.map((o) => (
            <li key={o.id} className="flex items-center gap-2 px-4 py-3">
              <span className="font-semibold">{o.name}</span>
              {o.isCentralKitchen && <Badge tone="info">Zentralküche</Badge>}
              {outlets.length > 1 && <ArchiveOutlet outlet={o} />}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="team-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="team-h" className="text-lg">Team ({members.length})</h2>
          <Invite outlets={outlets} />
        </div>
        <div className="relative overflow-x-auto rounded-md border border-border bg-bg">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Teammitglieder</caption>
            <thead className="bg-surface text-xs text-text-muted">
              <tr className="h-(--size-table-row)"><th scope="col" className="px-3 text-left">Name</th><th scope="col" className="px-3 text-left">Rolle</th><th scope="col" className="px-3 text-left">Outlets</th><th scope="col" className="px-3"><span className="sr-only">Aktionen</span></th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2"><span className="block font-semibold">{m.name}</span><span className="block text-xs font-normal text-text-muted">{m.email}</span></td>
                  <td className="px-3 py-2"><span className="block">{ROLE[m.role].label}</span><span className="block text-xs font-normal text-text-muted">{ROLE[m.role].text}</span></td>
                  <td className="px-3 py-2">{m.allOutlets || m.role === "owner" || m.role === "admin" ? "Alle" : m.outletIds.map((id) => outlets.find((o) => o.id === id)?.name ?? "?").join(", ")}</td>
                  <td className="px-3 py-2 text-right">
                    {m.userId === me.userId ? <span className="text-xs text-text-muted">Du</span> : (m.role !== "owner" || me.role === "owner") && <EditMember member={m} outlets={outlets} meIsOwner={me.role === "owner"} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ArchiveOutlet({ outlet }: { outlet: O }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => { setOpen(o); setError(null); }}
      trigger={<Button variant="ghost" size="sm" className="ml-auto" aria-label={`${outlet.name} archivieren`}>Archivieren</Button>}
      title={`${outlet.name} archivieren?`}
      description={error ?? "Das Outlet verschwindet aus der Auswahl und aus der Abrechnung (anteilig gutgeschrieben). Bestände, Buchungen und Berichte bleiben gespeichert; Kassen-Schlüssel dieses Outlets werden widerrufen."}
      confirmLabel="Archivieren"
      danger
      loading={pending}
      onConfirm={() =>
        start(async () => {
          const res = await archiveOutlet(outlet.id);
          if (!res.ok) return setError(res.error);
          setOpen(false);
          toast.success(`${outlet.name} archiviert`);
          router.refresh();
        })
      }
    />
  );
}

function NewOutlet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [central, setCentral] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="secondary"><Plus aria-hidden className="size-4" /> Outlet</Button>}
      title="Outlet anlegen"
      description="Jedes Outlet hat eigenen Bestand und eigene Bestellungen. Rezepte und Zutaten gelten für alle."
      footer={
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await createOutlet(name, central);
              if (!res.ok) return setError(res.error);
              setOpen(false);
              setName("");
              toast.success("Outlet angelegt");
              router.refresh();
            })
          }
        >
          Anlegen
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" required error={error ?? undefined}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" checked={central} onChange={(e) => setCentral(e.target.checked)} /> Zentralküche (beliefert andere Outlets)</label>
      </div>
    </Dialog>
  );
}

function Invite({ outlets }: { outlets: O[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", role: "outlet_staff" as Role });
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button><Plus aria-hidden className="size-4" /> Einladen</Button>}
      title="Teammitglied einladen"
      description="Die Einladung geht per E-Mail raus und gilt 7 Tage. Im Demo-Modus ohne Datenbank wird das Mitglied direkt angelegt."
      footer={
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              if (f.role === "outlet_staff" && picked.length === 0) return setError("Bitte mindestens ein Outlet wählen.");
              const res = await inviteMember({ ...f, outletIds: f.role === "outlet_staff" ? picked : [] });
              if (!res.ok) return setError(res.error);
              setOpen(false);
              setF({ name: "", email: "", role: "outlet_staff" });
              setPicked([]);
              toast.success(res.data.sent ? "Einladung gesendet" : "Teammitglied hinzugefügt");
              router.refresh();
            })
          }
        >
          Einladen
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p role="alert" className="text-danger">{error}</p>}
        <Field label="Name" required><Input value={f.name} onChange={(e) => { const v = e.target.value; setF((p) => ({ ...p, name: v })); }} /></Field>
        <Field label="E-Mail" required><Input type="email" value={f.email} onChange={(e) => { const v = e.target.value; setF((p) => ({ ...p, email: v })); }} /></Field>
        <Field label="Rolle" hint={ROLE[f.role].text}>
          <Select value={f.role} onChange={(e) => { const v = e.target.value as Role; setF((p) => ({ ...p, role: v })); }}>
            <option value="outlet_staff">Team</option>
            <option value="chef">Küchenleitung</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        {f.role === "outlet_staff" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs">Outlets</legend>
            {outlets.map((o) => (
              <label key={o.id} className="flex items-center gap-2">
                <input type="checkbox" checked={picked.includes(o.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, o.id] : picked.filter((x) => x !== o.id))} /> {o.name}
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}

function EditMember({ member, outlets, meIsOwner }: { member: Member; outlets: O[]; meIsOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isOwner = member.role === "owner";
  const [role, setRole] = useState<Exclude<Role, "owner">>(isOwner ? "admin" : (member.role as Exclude<Role, "owner">));
  const [picked, setPicked] = useState<string[]>(member.outletIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = (msg: string) => {
    setOpen(false);
    toast.success(msg);
    router.refresh();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="ghost" size="sm" aria-label={`${member.name} bearbeiten`}>Bearbeiten</Button>}
      title={member.name}
      description={member.email}
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={<Button variant="ghost">Entfernen</Button>}
              title={`${member.name} aus dem Team entfernen?`}
              description="Der Zugang endet sofort. Was diese Person gebucht hat, bleibt erhalten."
              confirmLabel="Entfernen"
              danger
              loading={pending}
              onConfirm={() =>
                start(async () => {
                  const res = await removeMember(member.id);
                  if (!res.ok) return setError(res.error);
                  done("Teammitglied entfernt");
                })
              }
            />
            {meIsOwner && !isOwner && (
              <ConfirmDialog
                trigger={<Button variant="ghost">Inhaberschaft übertragen</Button>}
                title={`${member.name} zur Inhaberin oder zum Inhaber machen?`}
                description="Diese Person bekommt alle Rechte einschließlich Abo und Rechnungen. Du wirst Admin und kannst das nicht selbst rückgängig machen."
                confirmLabel="Übertragen"
                danger
                loading={pending}
                onConfirm={() =>
                  start(async () => {
                    const res = await transferOwnership(member.id);
                    if (!res.ok) return setError(res.error);
                    done("Inhaberschaft übertragen");
                  })
                }
              />
            )}
          </div>
          {!isOwner && (
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await updateMember(member.id, { role, outletIds: role === "outlet_staff" ? picked : [] });
                  if (!res.ok) return setError(res.error);
                  done("Änderungen gespeichert");
                })
              }
            >
              Speichern
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p role="alert" className="text-danger">{error}</p>}
        {isOwner ? (
          <p className="text-text-muted">Inhaber haben immer alle Rechte. Um die Rolle zu ändern, zuerst die Inhaberschaft an jemand anderen übertragen.</p>
        ) : (
          <>
            <Field label="Rolle" hint={ROLE[role].text}>
              <Select value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, "owner">)}>
                <option value="outlet_staff">Team</option>
                <option value="chef">Küchenleitung</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            {role === "outlet_staff" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs">Outlets</legend>
                {outlets.map((o) => (
                  <label key={o.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={picked.includes(o.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, o.id] : picked.filter((x) => x !== o.id))} /> {o.name}
                  </label>
                ))}
              </fieldset>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
