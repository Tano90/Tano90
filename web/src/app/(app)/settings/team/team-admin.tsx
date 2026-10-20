"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOutlet, inviteMember } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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

export function TeamAdmin({ members, outlets }: { members: Member[]; outlets: O[] }) {
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
              <tr className="h-(--size-table-row)"><th scope="col" className="px-3 text-left">Name</th><th scope="col" className="px-3 text-left">Rolle</th><th scope="col" className="px-3 text-left">Outlets</th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2"><span className="block font-semibold">{m.name}</span><span className="block text-xs font-normal text-text-muted">{m.email}</span></td>
                  <td className="px-3 py-2"><span className="block">{ROLE[m.role].label}</span><span className="block text-xs font-normal text-text-muted">{ROLE[m.role].text}</span></td>
                  <td className="px-3 py-2">{m.allOutlets || m.role === "owner" || m.role === "admin" ? "Alle" : m.outletIds.map((id) => outlets.find((o) => o.id === id)?.name ?? "?").join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
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
      description="Die Einladung geht per E-Mail raus, sobald der Mailversand angebunden ist. Bis dahin wird das Mitglied direkt angelegt."
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
              toast.success("Teammitglied hinzugefügt");
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
        <Field label="Name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="E-Mail" required><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Rolle" hint={ROLE[f.role].text}>
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
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
