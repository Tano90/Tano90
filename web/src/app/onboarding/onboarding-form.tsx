"use client";

import { useActionState } from "react";
import { createLibrary } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createLibrary, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {state && !state.ok && <Notice tone="warning">{state.error}</Notice>}
      <Field label="Dein Name" required><Input name="ownerName" autoComplete="name" /></Field>
      <Field label="Name des Betriebs" required hint="Zum Beispiel der Name deines Restaurants oder deiner Gruppe."><Input name="libraryName" autoComplete="organization" /></Field>
      <Field label="Erster Standort" required hint="Jeder Standort hat eigenen Bestand und eigene Bestellungen."><Input name="outletName" defaultValue="Küche" /></Field>
      <Button type="submit" loading={pending}>Betrieb anlegen</Button>
    </form>
  );
}
