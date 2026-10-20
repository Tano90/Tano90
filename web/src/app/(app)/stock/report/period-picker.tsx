"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useUrlFilters } from "@/lib/use-url-filters";

type Preset = { label: string; from: string; to: string };

export function PeriodPicker({ from, to, today, presets }: { from: string; to: string; today: string; presets: Preset[] }) {
  const f = useUrlFilters();
  const [v, setV] = useState({ from, to });
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        f.set({ from: v.from || null, to: v.to || null });
      }}
    >
      <Field label="Von">
        <Input type="date" max={today} value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} />
      </Field>
      <Field label="Bis">
        <Input type="date" max={today} value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} />
      </Field>
      <Button type="submit" variant="secondary">Anzeigen</Button>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Zeitraum schnell wählen">
        {presets.map((p) => (
          <Button key={p.label} variant="ghost" size="sm" aria-pressed={p.from === from && p.to === to} onClick={() => { setV({ from: p.from, to: p.to }); f.set({ from: p.from, to: p.to }); }}>
            {p.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
