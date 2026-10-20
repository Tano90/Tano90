"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state && !state.ok && <Notice tone="warning">{state.error}</Notice>}
      <Field label="Dein Name" required><Input name="name" autoComplete="name" /></Field>
      <Button type="submit" loading={pending}>Einladung annehmen</Button>
    </form>
  );
}
