"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import type { Dish, Group } from "@/domain/menu-engineering";
import { GROUPS } from "@/lib/menu-groups";
import { formatCents, formatQty } from "@/lib/format";

const LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label])) as Record<Group, string>;
const euro = (c: number) => formatCents(Math.round(c));
const pct = (v: number) => `${formatQty(Math.round(v * 10) / 10)} %`;

// Drawn at the container's real width, so text keeps its size on a phone instead of shrinking with a viewBox.
const L = 64, R = 16, T = 16, B = 48;

export function Matrix({ dishes, shareLinePct, marginLineCents }: { dishes: Dish[]; shareLinePct: number; marginLineCents: number }) {
  const [active, setActive] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(380, Math.max(280, W * 0.6)));
  const xMax = Math.max(shareLinePct * 2, ...dishes.map((d) => d.sharePct)) * 1.1;
  const yVals = dishes.map((d) => d.marginCents);
  const yMin = Math.min(0, ...yVals);
  const yMax = Math.max(marginLineCents * 2, ...yVals, 1) * 1.1;
  const x = (v: number) => L + (v / xMax) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map((v) => Math.round(v / 50) * 50);
  const xTicks = [0, xMax / 2, xMax].map((v) => Math.round(v));
  const hot = dishes.find((d) => d.id === active);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-lg font-semibold">Matrix: Beliebtheit × Deckungsbeitrag</figcaption>
      <div ref={box} className="relative w-full max-w-3xl">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="group" aria-label="Gerichte nach Anteil an den Verkäufen und Deckungsbeitrag pro Portion">
          {/* recessive frame and ticks */}
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={L - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-text-muted text-xs">{euro(v)}</text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={x(v)} y={H - B + 18} textAnchor="middle" className="fill-text-muted text-xs">{v} %</text>
          ))}
          <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="fill-text-muted text-xs">Anteil an den verkauften Portionen</text>
          <text x={14} y={(T + H - B) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`} className="fill-text-muted text-xs">Deckungsbeitrag pro Portion</text>
          {/* the two dividing lines */}
          <line x1={x(shareLinePct)} x2={x(shareLinePct)} y1={T} y2={H - B} className="stroke-text-subtle" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={L} x2={W - R} y1={y(marginLineCents)} y2={y(marginLineCents)} className="stroke-text-subtle" strokeWidth={1} strokeDasharray="4 4" />
          <text x={W - R - 4} y={T + 14} textAnchor="end" className="fill-text-muted text-xs">Stars</text>
          <text x={L + 6} y={T + 14} className="fill-text-muted text-xs">Rätsel</text>
          <text x={W - R - 4} y={H - B - 8} textAnchor="end" className="fill-text-muted text-xs">Arbeitspferde</text>
          <text x={L + 6} y={H - B - 8} className="fill-text-muted text-xs">Ladenhüter</text>
          {/* one series: position carries the group, colour only marks the dish */}
          {dishes.map((d) => (
            <g key={d.id}>
              <circle cx={x(d.sharePct)} cy={y(d.marginCents)} r={d.id === active ? 8 : 6} className="fill-accent stroke-bg" strokeWidth={2} />
              {dishes.length <= 8 && (
                // Labels point inwards, so a dish at the right edge is not cut off.
                <text
                  x={x(d.sharePct) + (x(d.sharePct) > W / 2 ? -12 : 12)} y={y(d.marginCents)} dominantBaseline="middle"
                  textAnchor={x(d.sharePct) > W / 2 ? "end" : "start"} className="fill-text text-xs"
                >
                  {d.name.length > 24 ? `${d.name.slice(0, 23)}…` : d.name}
                </text>
              )}
              {/* 24 px hit area, keyboard reachable; the same details are in the table below */}
              <circle
                cx={x(d.sharePct)} cy={y(d.marginCents)} r={12} fill="transparent" tabIndex={0} role="img"
                aria-label={`${d.name}: ${pct(d.sharePct)} der Portionen, ${euro(d.marginCents)} Deckungsbeitrag, ${LABEL[d.group]}`}
                className="cursor-pointer outline-none focus-visible:stroke-focus-ring" strokeWidth={2}
                onPointerEnter={() => setActive(d.id)} onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(d.id)} onBlur={() => setActive(null)}
              />
            </g>
          ))}
        </svg>
        {hot && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-border bg-surface-raised px-3 py-2 text-xs shadow-card"
            style={{ left: x(hot.sharePct), top: y(hot.marginCents) - 12 }}
          >
            <p className="font-semibold">{hot.name}</p>
            <p className="num text-text-muted">{formatQty(hot.sold)} Portionen · {pct(hot.sharePct)}</p>
            <p className="num text-text-muted">Deckungsbeitrag {euro(hot.marginCents)} · {LABEL[hot.group]}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-text-muted">
        Gestrichelt: Beliebtheit ab {pct(shareLinePct)} (70 % eines gleichmäßigen Anteils) und Deckungsbeitrag {euro(marginLineCents)} (Mittel über alle verkauften Portionen).
      </p>
    </figure>
  );
}

const COLUMNS: Column<Dish>[] = [
  { key: "name", header: "Gericht", sortValue: (d) => d.name, cell: (d) => <span className="font-semibold">{d.name}</span> },
  { key: "group", header: "Gruppe", sortValue: (d) => GROUPS.findIndex((g) => g.key === d.group), cell: (d) => <Badge>{LABEL[d.group]}</Badge> },
  { key: "sold", header: "Verkauft", align: "right", sortValue: (d) => d.sold, cell: (d) => formatQty(d.sold) },
  { key: "share", header: "Anteil", align: "right", sortValue: (d) => d.sharePct, cell: (d) => pct(d.sharePct) },
  { key: "net", header: "Netto/Portion", align: "right", sortValue: (d) => d.netPerPortionCents, cell: (d) => euro(d.netPerPortionCents) },
  { key: "cost", header: "Wareneinsatz/Portion", align: "right", sortValue: (d) => d.costPerPortionCents, cell: (d) => euro(d.costPerPortionCents) },
  { key: "margin", header: "Deckungsbeitrag", align: "right", sortValue: (d) => d.marginCents, cell: (d) => euro(d.marginCents) },
  { key: "total", header: "Summe", align: "right", sortValue: (d) => d.marginCents * d.sold, cell: (d) => euro(d.marginCents * d.sold) },
];

export function DishTable({ dishes }: { dishes: Dish[] }) {
  return <DataTable caption="Gerichte im Zeitraum" columns={COLUMNS} rows={dishes} rowKey={(d) => d.id} />;
}
