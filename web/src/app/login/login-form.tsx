"use client";

import { useActionState } from "react";
import { sendMagicLink, signIn } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm({ demo, next }: { demo: boolean; next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="E-Mail" required>
        <Input name="email" type="email" autoComplete="email" defaultValue={demo ? "inhaber@example.com" : undefined} />
      </Field>
      <Field label="Passwort" required error={state && !state.ok ? state.error : undefined}>
        <Input name="password" type="password" autoComplete="current-password" defaultValue={demo ? "demo" : undefined} />
      </Field>
      <Button type="submit" loading={pending}>Anmelden</Button>
    </form>
  );
}

export function MagicLinkForm() {
  const [state, action, pending] = useActionState(sendMagicLink, null);
  if (state?.ok) return <Notice>{state.data}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Field label="Ohne Passwort: Link per E-Mail" error={state && !state.ok ? state.error : undefined}>
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>Anmeldelink senden</Button>
    </form>
  );
}
