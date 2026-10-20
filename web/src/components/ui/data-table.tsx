"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, SearchX, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  width?: string;
};

type Props<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  state?: "ready" | "loading" | "error";
  /** Shown when rows is empty and no filter is active. */
  empty?: React.ReactNode;
  /** True when a search or filter is active, so an empty result says "no matches" instead of "nothing yet". */
  filtered?: boolean;
  onClearFilters?: () => void;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void };
  compact?: boolean;
};

export function DataTable<T>({
  caption, columns, rows, rowKey, state = "ready", empty, filtered, onClearFilters, onRetry, onRowClick, selection, compact,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "de")) * dir;
    });
  }, [rows, columns, sort]);

  const allKeys = rows.map(rowKey);
  const allSelected = selection && allKeys.length > 0 && allKeys.every((k) => selection.selected.has(k));
  const span = columns.length + (selection ? 1 : 0);
  const rowH = compact ? "h-(--size-table-row-compact)" : "h-(--size-table-row)";

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  return (
    <div className="relative overflow-x-auto rounded-md border border-border bg-surface-raised">
      <table className="w-full border-collapse text-sm" aria-busy={state === "loading" || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface">
          <tr className="h-(--size-table-row) border-b border-border">
            {selection && (
              <th scope="col" className="w-10 px-3">
                <input
                  type="checkbox"
                  aria-label="Alle auswählen"
                  checked={!!allSelected}
                  onChange={() => selection.onChange(allSelected ? new Set() : new Set(allKeys))}
                />
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width }}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("px-3 text-xs text-text-muted", c.align === "right" ? "text-right" : "text-left")}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn("inline-flex items-center gap-1 hover:text-text", c.align === "right" && "flex-row-reverse")}
                    >
                      {c.header}
                      <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {state === "loading" &&
            Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className={cn(rowH, "border-b border-border last:border-0")}>
                <td colSpan={span} className="px-3">
                  <div className="h-3 w-2/3 animate-pulse rounded-sm bg-surface-sunken" />
                </td>
              </tr>
            ))}
          {state === "error" && (
            <tr>
              <td colSpan={span}>
                <EmptyState
                  icon={TriangleAlert}
                  title="Daten konnten nicht geladen werden"
                  body="Die Verbindung ist abgebrochen oder der Server antwortet nicht."
                  action={onRetry && <Button variant="secondary" onClick={onRetry}>Erneut versuchen</Button>}
                />
              </td>
            </tr>
          )}
          {state === "ready" && sorted.length === 0 && (
            <tr>
              <td colSpan={span}>
                {filtered ? (
                  <EmptyState
                    icon={SearchX}
                    title="Keine Treffer"
                    body="Kein Eintrag passt zu Suche und Filtern."
                    action={onClearFilters && <Button variant="secondary" onClick={onClearFilters}>Filter zurücksetzen</Button>}
                  />
                ) : (
                  empty
                )}
              </td>
            </tr>
          )}
          {state === "ready" &&
            sorted.map((row) => {
              const key = rowKey(row);
              const isSelected = selection?.selected.has(key);
              return (
                <tr
                  key={key}
                  onClick={onRowClick && (() => onRowClick(row))}
                  className={cn(
                    rowH,
                    "border-b border-border last:border-0",
                    onRowClick && "cursor-pointer hover:bg-row-hover",
                    isSelected && "bg-accent-subtle",
                  )}
                >
                  {selection && (
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Zeile auswählen"
                        checked={!!isSelected}
                        onChange={() => {
                          const next = new Set(selection.selected);
                          if (isSelected) next.delete(key);
                          else next.add(key);
                          selection.onChange(next);
                        }}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3", c.align === "right" && "num text-right")}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
