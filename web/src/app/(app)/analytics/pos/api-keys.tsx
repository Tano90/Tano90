"use client";

import { Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createApiKey, revokeApiKey } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/dates";

type Key = { id: string; name: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

export function ApiKeys({ keys, outletName }: { keys: Key[]; outletName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="api" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="api" className="text-lg">Schnittstelle für die Kasse</h2>
        <Dialog
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) { setCreated(null); setName(""); setError(null); } }}
          trigger={<Button variant="secondary" size="sm"><KeyRound aria-hidden className="size-4" /> API-Schlüssel erstellen</Button>}
          title={created ? "Schlüssel erstellt" : "API-Schlüssel erstellen"}
          description={created ? "Kopiere ihn jetzt. Er wird nur dieses eine Mal angezeigt." : `Der Schlüssel darf nur Verkäufe für ${outletName} senden.`}
          footer={created ? <Button onClick={() => setOpen(false)}>Fertig</Button> : (
            <Button loading={pending} onClick={() => start(async () => {
              const res = await createApiKey(name);
              if (!res.ok) return setError(res.error);
              setCreated(res.data.key);
              router.refresh();
            })}>Erstellen</Button>
          )}
        >
          {created ? (
            <div className="flex items-center gap-2">
              <Input readOnly aria-label="Neuer API-Schlüssel" value={created} className="num" onFocus={(e) => e.target.select()} />
              <Button variant="secondary" size="icon" aria-label="Schlüssel kopieren" onClick={() => navigator.clipboard.writeText(created).then(() => toast.success("Kopiert"))}>
                <Copy aria-hidden className="size-4" />
              </Button>
            </div>
          ) : (
            <Field label="Name" hint="Woran du den Schlüssel später erkennst, z. B. „Kasse Theke“." error={error ?? undefined}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </Field>
          )}
        </Dialog>
      </div>
      <p className="text-text-muted">
        Die Kasse sendet Verkäufe per <code className="num rounded-sm bg-surface-sunken px-1">POST /api/pos/sales</code> mit
        <code className="num rounded-sm bg-surface-sunken px-1">Authorization: Bearer …</code>, höchstens 1000 Positionen und 60 Anfragen pro Minute.
        Jede Position braucht <code className="num">id</code>, <code className="num">plu</code>, <code className="num">quantity</code> und <code className="num">soldAt</code> mit Zeitzone; doppelte <code className="num">id</code>s werden übersprungen.
      </p>
      {keys.length === 0 ? (
        <p className="text-text-muted">Noch kein Schlüssel für dieses Outlet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-bg">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-semibold">{k.name}</span>
                <span className="block text-xs text-text-muted">
                  erstellt {formatDateTime(k.createdAt)} · {k.revokedAt ? `widerrufen ${formatDateTime(k.revokedAt)}` : k.lastUsedAt ? `zuletzt benutzt ${formatDateTime(k.lastUsedAt)}` : "noch nie benutzt"}
                </span>
              </span>
              {!k.revokedAt && <Revoke id={k.id} name={k.name} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Revoke({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="sm">Widerrufen</Button>}
      title={`„${name}“ widerrufen?`}
      description="Die Kasse kann mit diesem Schlüssel sofort nichts mehr senden. Bereits übertragene Verkäufe bleiben."
      confirmLabel="Widerrufen"
      danger
      loading={pending}
      onConfirm={() => start(async () => {
        const res = await revokeApiKey(id);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Schlüssel widerrufen");
        router.refresh();
      })}
    />
  );
}
