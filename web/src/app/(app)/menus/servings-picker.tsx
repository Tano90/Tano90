"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useUrlFilters } from "@/lib/use-url-filters";

export function ServingsPicker({ value }: { value: number }) {
  const f = useUrlFilters();
  const [v, setV] = useState(String(value));
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        f.set({ servings: v.trim() && v !== "1" ? v.trim() : null });
      }}
    >
      <Field label="Gäste">
        <Input inputMode="numeric" className="w-24 text-right" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Button type="submit" variant="secondary">Hochrechnen</Button>
    </form>
  );
}
