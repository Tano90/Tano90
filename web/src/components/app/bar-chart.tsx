"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

// Columns per category (here: days), stacked or side by side, one y axis. Each column is focusable and shows its
// values on hover or focus; the same numbers are in a table below for screen readers and print.
export type Series = { key: string; label: string; color: "chart-1" | "chart-2" | "chart-3" };
export type Column = { label: string; sub?: string; values: Record<string, number> };

const BG = { "chart-1": "bg-chart-1", "chart-2": "bg-chart-2", "chart-3": "bg-chart-3" } as const;

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
};

export function BarChart({ title, series, columns, stacked = false, unit = "", decimals = 0, className }: {
  title: string; series: Series[]; columns: Column[]; stacked?: boolean; unit?: string; decimals?: number; className?: string;
}) {
  const format = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: decimals });
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(...columns.map((c) => (stacked ? series.reduce((s, x) => s + (c.values[x.key] ?? 0), 0) : Math.max(...series.map((x) => c.values[x.key] ?? 0)))), 0);
  const max = niceMax(peak);
  const ticks = [max, max / 2, 0];
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-3 text-xs text-text-muted">
            {series.map((x) => <span key={x.key} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-2.5 rounded-sm", BG[x.color])} />{x.label}</span>)}
          </span>
        )}
      </figcaption>
      <div className="relative mt-3 flex h-44 gap-2 pl-8">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-8">
          {ticks.map((t) => (
            <div key={t} className="absolute right-0 left-0 border-t border-border" style={{ bottom: pct(t) }}>
              <span className="num absolute -top-2 -left-8 w-7 text-right text-xs text-text-muted">{format(t)}</span>
            </div>
          ))}
        </div>
        {columns.map((c, i) => (
          <div key={c.label + i} tabIndex={0} role="img" aria-label={`${c.label}${c.sub ? ` ${c.sub}` : ""}: ${series.map((x) => `${x.label} ${format(c.values[x.key] ?? 0)}${unit}`).join(", ")}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
            className="group relative flex min-w-3 flex-1 items-end justify-center gap-0.5 rounded-sm outline-offset-2 hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-accent">
            {stacked ? (
              <div className="flex h-full w-full max-w-8 flex-col-reverse gap-0.5">
                {series.map((x) => (c.values[x.key] ?? 0) > 0 && <div key={x.key} className={cn("w-full first:rounded-b-none last:rounded-t-sm", BG[x.color])} style={{ height: `calc(${pct(c.values[x.key])} - 2px)` }} />)}
              </div>
            ) : (
              series.map((x) => <div key={x.key} className={cn("w-full max-w-4 rounded-t-sm", BG[x.color])} style={{ height: pct(c.values[x.key] ?? 0) }} />)
            )}
            {active === i && (
              <div className="absolute bottom-full z-10 mb-2 w-max min-w-32 rounded-md border border-border bg-bg p-2 text-xs shadow-pop">
                <p className="font-semibold">{c.label}{c.sub ? ` · ${c.sub}` : ""}</p>
                {series.map((x) => (
                  <p key={x.key} className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-sm", BG[x.color])} />{x.label}</span><span className="num">{format(c.values[x.key] ?? 0)}{unit}</span></p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1 flex gap-2 pl-8">
        {columns.map((c, i) => <span key={c.label + i} className="min-w-3 flex-1 truncate text-center text-xs text-text-muted">{c.label}</span>)}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-text-muted hover:text-text">Als Tabelle</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead><tr><th scope="col" className="text-left font-semibold">Tag</th>{series.map((x) => <th key={x.key} scope="col" className="text-right font-semibold">{x.label}</th>)}</tr></thead>
            <tbody>{columns.map((c, i) => <tr key={c.label + i} className="border-t border-border"><th scope="row" className="py-1 text-left font-normal">{c.label}{c.sub ? ` ${c.sub}` : ""}</th>{series.map((x) => <td key={x.key} className="num text-right">{format(c.values[x.key] ?? 0)}{unit}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
