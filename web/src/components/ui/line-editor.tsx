"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/format";
import { Button } from "./button";
import { Combobox, type ComboOption } from "./combobox";
import { QuantityInput, type Unit } from "./quantity-input";

export type Line = {
  id: string;
  itemId: string | null;
  quantity: string;
  unit: Unit;
  /** Computed by the caller; null when it cannot be costed. */
  costCents: number | null;
  warning?: string;
};

type Props = {
  label: string;
  lines: Line[];
  options: ComboOption[];
  onChange: (lines: Line[]) => void;
  onCreateItem?: (name: string) => void;
  newLine: () => Line;
  showCost?: boolean;
};

/**
 * Rows of item + quantity + unit (+ cost). Used by recipes, menus, orders, deliveries, counts and waste.
 * Each row is a labelled group so screen readers announce "Zeile 3 von 5".
 */
export function LineEditor({ label, lines, options, onChange, onCreateItem, newLine, showCost = true }: Props) {
  const update = (id: string, patch: Partial<Line>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="hidden grid-cols-[1fr_12rem_7rem_2.5rem] gap-2 px-1 text-xs text-text-muted md:grid">
        <span>Artikel</span>
        <span>Menge</span>
        {showCost ? <span className="text-right">Kosten</span> : <span />}
        <span />
      </div>
      <ol aria-label={label} className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <li
            key={line.id}
            aria-label={`Zeile ${i + 1} von ${lines.length}`}
            className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 md:grid-cols-[1fr_12rem_7rem_2.5rem] md:items-center md:border-0 md:p-0"
          >
            <Combobox
              aria-label="Artikel"
              options={options}
              value={line.itemId}
              onChange={(itemId) => update(line.id, { itemId })}
              onCreate={onCreateItem}
              placeholder="Zutat oder Rezept wählen"
            />
            <QuantityInput
              aria-label="Menge"
              value={line.quantity}
              unit={line.unit}
              onValueChange={(quantity) => update(line.id, { quantity })}
              onUnitChange={(unit) => update(line.id, { unit })}
              aria-invalid={line.warning ? true : undefined}
            />
            <span className="num text-right">
              {showCost &&
                (line.costCents === null ? (
                  <span className="inline-flex items-center gap-1 text-warning" title={line.warning}>
                    <AlertTriangle aria-hidden className="size-4" /> –
                  </span>
                ) : (
                  formatCents(line.costCents)
                ))}
            </span>
            <Button variant="ghost" size="icon" aria-label={`Zeile ${i + 1} entfernen`} onClick={() => onChange(lines.filter((l) => l.id !== line.id))}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
            {line.warning && <p className="text-xs text-warning md:col-span-4">{line.warning}</p>}
          </li>
        ))}
      </ol>
      <div>
        <Button variant="secondary" size="sm" onClick={() => onChange([...lines, newLine()])}>
          <Plus aria-hidden className="size-4" /> Zeile hinzufügen
        </Button>
      </div>
    </div>
  );
}
