"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/actions";
import { AuthCard } from "@/components/app/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export default function UpdatePasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <AuthCard title="Neues Passwort" intro="Mindestens 10 Zeichen.">
      <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Neues Passwort" required><Input name="password" type="password" autoComplete="new-password" /></Field>
        <Field label="Wiederholen" required error={state && !state.ok ? state.error : undefined}><Input name="confirm" type="password" autoComplete="new-password" /></Field>
        <Button type="submit" loading={pending}>Passwort speichern</Button>
      </form>
    </AuthCard>
  );
}
