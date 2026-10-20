"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlClass } from "./field";

export type Chip = { key: string; label: string };

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  placeholder?: string;
  chips?: Chip[];
  onRemoveChip?: (key: string) => void;
  children?: React.ReactNode; // filter dropdowns
};

export function FilterBar({ query, onQueryChange, placeholder = "Suchen …", chips = [], onRemoveChip, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div role="search" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            aria-label={placeholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className={cn(controlClass, "pl-9")}
          />
        </div>
        {children}
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Aktive Filter">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => onRemoveChip?.(c.key)}
                className="inline-flex h-7 items-center gap-1 rounded-pill bg-accent-subtle pr-2 pl-3 text-xs text-accent"
              >
                {c.label}
                <X aria-hidden className="size-3.5" />
                <span className="sr-only">Filter entfernen</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
