"use client";

import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./field";
import { Spinner } from "./spinner";

export type ComboOption = { value: string; label: string; hint?: string };

type Props = {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  /** Offer "create" when nothing matches (new ingredient straight from a recipe line). */
  onCreate?: (query: string) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

/** Searchable select. Keyboard: type to filter, arrows to move, Enter to pick, Esc to close. */
export const Combobox = forwardRef<HTMLButtonElement, Props>(function Combobox(
  { options, value, onChange, placeholder = "Auswählen …", searchPlaceholder = "Suchen …", loading, onCreate, className, ...aria },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={ref}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(controlClass, "flex items-center justify-between text-left", className)}
          {...aria}
        >
          <span className={cn("truncate", !selected && "text-text-subtle")}>{selected?.label ?? placeholder}</span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-(--radix-popover-trigger-width) min-w-64 rounded-md border border-border bg-surface-raised shadow-pop"
        >
          <Command shouldFilter>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              className="h-(--size-control-md) w-full border-b border-border bg-transparent px-3 text-sm outline-none"
            />
            <Command.List className="max-h-72 overflow-y-auto p-1">
              {loading && (
                <Command.Loading>
                  <div className="flex items-center gap-2 px-3 py-2 text-text-muted">
                    <Spinner /> Lädt …
                  </div>
                </Command.Loading>
              )}
              <Command.Empty className="px-3 py-2 text-text-muted">Keine Treffer.</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 data-[selected=true]:bg-accent-subtle"
                >
                  <Check aria-hidden className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs font-normal text-text-muted">{o.hint}</span>}
                </Command.Item>
              ))}
              {onCreate && query.trim() && (
                <Command.Item
                  value={`__create ${query}`}
                  onSelect={() => {
                    onCreate(query.trim());
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-accent data-[selected=true]:bg-accent-subtle"
                >
                  <Plus aria-hidden className="size-4" /> „{query.trim()}“ neu anlegen
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
