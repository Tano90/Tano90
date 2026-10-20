"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./field";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Show the net/gross toggle (sell prices). Purchase prices are always net. */
  vat?: { includesVat: boolean; onChange: (includesVat: boolean) => void };
};

export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onValueChange, vat, className, ...props },
  ref,
) {
  return (
    <div className={cn("flex items-stretch", className)}>
      <div className="relative w-full">
        <input
          ref={ref}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onValueChange(e.target.value.replace(/[^\d,]/g, ""))}
          className={cn(controlClass, "num pr-8 text-right", vat && "rounded-r-none")}
          {...props}
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted">
          €
        </span>
      </div>
      {vat && (
        <div role="group" aria-label="Preisangabe" className="flex shrink-0">
          {[false, true].map((incl) => (
            <button
              key={String(incl)}
              type="button"
              aria-pressed={vat.includesVat === incl}
              onClick={() => vat.onChange(incl)}
              className={cn(
                "border border-l-0 border-border-input px-3 text-xs last:rounded-r-sm",
                vat.includesVat === incl ? "bg-accent-subtle text-accent" : "bg-surface text-text-muted",
              )}
            >
              {incl ? "brutto" : "netto"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

/** "12,5" -> 1250 cents; null when empty or invalid. */
export function parseCents(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
