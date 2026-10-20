"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./field";

export const UNITS = ["g", "kg", "mg", "ml", "cl", "l", "piece"] as const;
/** "portion" is only offered for sub-recipes. */
export type Unit = (typeof UNITS)[number] | "portion";
const UNIT_LABEL: Record<Unit, string> = { g: "g", kg: "kg", mg: "mg", ml: "ml", cl: "cl", l: "l", piece: "Stk.", portion: "Port." };

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  unit: Unit;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: Unit) => void;
  units?: readonly Unit[];
};

/**
 * Number plus unit in one control. Accepts a German decimal comma; the parent parses.
 * The unit select is labelled separately so screen readers announce both parts.
 */
export const QuantityInput = forwardRef<HTMLInputElement, Props>(function QuantityInput(
  { value, unit, onValueChange, onUnitChange, units = UNITS, className, id, ...props },
  ref,
) {
  const invalid = props["aria-invalid"];
  return (
    <div className={cn("flex", className)}>
      <input
        ref={ref}
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className={cn(controlClass, "num rounded-r-none text-right")}
        {...props}
      />
      <select
        aria-label="Einheit"
        disabled={props.disabled}
        value={unit}
        onChange={(e) => onUnitChange(e.target.value as Unit)}
        aria-invalid={invalid}
        className={cn(controlClass, "w-20 shrink-0 rounded-l-none border-l-0 bg-surface")}
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {UNIT_LABEL[u]}
          </option>
        ))}
      </select>
    </div>
  );
});

/** "1,5" or "1.5" -> 1.5, "1.500,5" -> 1500.5; null for anything that is not a positive number. */
export function parseQuantity(raw: string): number | null {
  const normalised = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalised);
  return Number.isFinite(n) && n > 0 ? n : null;
}
