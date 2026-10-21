"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { APP_NAME } from "@/lib/brand";

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, null);
  if (state?.ok) return <Notice className="mt-4">{state.data}</Notice>;
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {state && !state.ok && <Notice tone="warning">{state.error}</Notice>}
      <Field label="Dein Name" required><Input name="name" autoComplete="name" /></Field>
      <Field label="E-Mail" required><Input name="email" type="email" autoComplete="email" /></Field>
      <Field label="Passwort" required hint="Mindestens 10 Zeichen."><Input name="password" type="password" autoComplete="new-password" minLength={10} /></Field>
      <p className="text-xs font-normal text-text-muted">Mit der Registrierung bestätigst du, dass du {APP_NAME} für deinen Betrieb nutzt, und akzeptierst die <Link className="underline" href="/legal/terms">Nutzungsbedingungen</Link> mit dem <Link className="underline" href="/legal/dpa">Vertrag zur Auftragsverarbeitung</Link>. Wie wir mit Daten umgehen, steht in der <Link className="underline" href="/legal/privacy">Datenschutzerklärung</Link>.</p>
      <Button type="submit" loading={pending}>Konto anlegen</Button>
    </form>
  );
}
