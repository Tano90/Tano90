"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLibrary } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { MoneyInput, readCents } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toast";
import type { Library } from "@/data/types";

export function LibraryForm({ library }: { library: Library }) {
  const router = useRouter();
  const [name, setName] = useState(library.name);
  const [vat, setVat] = useState(String(library.defaultVatBp / 100).replace(".", ","));
  const [wage, setWage] = useState(library.wageCentsPerHour ? String(library.wageCentsPerHour / 100).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="flex max-w-(--size-form-max) flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const w = readCents(wage);
          if (!w.ok) return setError(w.error);
          const res = await updateLibrary({ name, defaultVatBp: Math.round(Number(vat.replace(",", ".")) * 100), wageCentsPerHour: w.cents });
          if (!res.ok) return setError(res.error);
          setError(null);
          toast.success("Einstellungen gespeichert");
          router.refresh();
        });
      }}
    >
      {error && <Notice tone="warning">{error}</Notice>}
      <Field label="Name des Betriebs" required><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
      <Field label="Standard-Mehrwertsteuer für Speisen (%)" hint="Neue Rezepte übernehmen diesen Satz.">
        <Input inputMode="decimal" className="num w-32 text-right" value={vat} onChange={(e) => setVat(e.target.value)} />
      </Field>
      <Field label="Durchschnittlicher Stundenlohn Küche (inkl. Nebenkosten)" hint="Für Personalkosten pro Portion aus der Arbeitszeit im Rezept.">
        <MoneyInput className="w-48" value={wage} onValueChange={setWage} />
      </Field>
      <Field label="Währung" hint="Mehrere Währungen sind noch nicht möglich.">
        <Input value={library.currency} disabled className="w-24" />
      </Field>
      <div><Button type="submit" loading={pending}>Speichern</Button></div>
    </form>
  );
}
