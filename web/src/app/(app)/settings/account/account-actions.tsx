"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteAccount, signOutEverywhere } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AccountActions({ supabase, isOwner }: { supabase: boolean; isOwner: boolean }) {
  const [state, action, pending] = useActionState(deleteAccount, null);
  return (
    <div className="flex max-w-(--size-form-max) flex-col gap-10">
      <section aria-labelledby="pw" className="flex flex-col gap-2">
        <h2 id="pw" className="text-lg">Passwort</h2>
        {supabase ? <p><Link className="text-accent underline" href="/forgot-password">Link zum Ändern des Passworts anfordern</Link></p> : <p className="text-text-muted">Im Demo-Modus gibt es keine Passwörter.</p>}
      </section>
      <section aria-labelledby="sessions" className="flex flex-col gap-2">
        <h2 id="sessions" className="text-lg">Angemeldete Geräte</h2>
        <p className="text-text-muted">Meldet dich überall ab, zum Beispiel wenn ein Tablet in der Küche verloren gegangen ist.</p>
        <form action={signOutEverywhere}><Button type="submit" variant="secondary">Auf allen Geräten abmelden</Button></form>
      </section>
      <section aria-labelledby="del" className="flex flex-col gap-3 rounded-md border border-danger p-4">
        <h2 id="del" className="text-lg text-danger">Konto löschen</h2>
        <p>
          Dein Login und deine Mitgliedschaft werden endgültig gelöscht.{" "}
          {isOwner && "Bist du allein im Betrieb, werden auch alle Rezepte, Zutaten, Bestellungen und Bestände gelöscht. Hat dein Betrieb weitere Mitglieder, übertrage vorher die Inhaberschaft. "}
          Ein laufendes Abo kündigst du vorher unter Abo &amp; Rechnungen.
        </p>
        <form action={action} className="flex flex-col gap-3" noValidate>
          {state && !state.ok && <Notice tone="warning">{state.error}</Notice>}
          <Field label="Zur Bestätigung LÖSCHEN eintippen"><Input name="confirm" autoComplete="off" className="w-48" /></Field>
          <div><Button type="submit" variant="danger" loading={pending}>Konto endgültig löschen</Button></div>
        </form>
      </section>
    </div>
  );
}
