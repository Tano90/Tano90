"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <Field label="E-Mail" required>
        <Input name="email" type="email" autoComplete="email" defaultValue="inhaber@example.com" />
      </Field>
      <Field label="Passwort" required error={state && !state.ok ? state.error : undefined}>
        <Input name="password" type="password" autoComplete="current-password" defaultValue="demo" />
      </Field>
      <Button type="submit" loading={pending}>Anmelden</Button>
    </form>
  );
}
