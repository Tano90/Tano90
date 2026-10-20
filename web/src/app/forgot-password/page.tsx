"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions";
import { AuthCard } from "@/components/app/auth-card";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <AuthCard title="Passwort vergessen" intro="Wir schicken dir einen Link, mit dem du ein neues Passwort setzt." footer={<Link className="text-accent underline" href="/login">Zurück zur Anmeldung</Link>}>
      {state?.ok ? <Notice className="mt-4">{state.data}</Notice> : (
        <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
          <Field label="E-Mail" required error={state && !state.ok ? state.error : undefined}><Input name="email" type="email" autoComplete="email" /></Field>
          <Button type="submit" loading={pending}>Link senden</Button>
        </form>
      )}
    </AuthCard>
  );
}
