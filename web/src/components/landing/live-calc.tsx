"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

// An example from the demo data (lentil soup, 10 portions), not a customer's numbers. Everything except the lentils
// keeps its demo cost, so moving the slider shows exactly what the suite does: one price changes, the plate cost follows.
const PORTIONS = 10;
const LENTIL_KG = 0.8;
const FIXED = [
  ["Zwiebeln", "2 Stk.", 0.35], ["Karotten", "300 g", 0.39], ["Gemüsefond", "2,5 l", 2.33],
  ["Kreuzkümmel", "10 g", 0.16], ["Olivenöl", "50 ml", 0.45], ["Schlagsahne", "200 ml", 0.7],
] as const;
const TARGET = 0.3;
const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const pct = (n: number) => `${(n * 100).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

export function LiveCalc() {
  const id = useId();
  const [lentilPerKg, setLentil] = useState(2.36);
  const [sell, setSell] = useState(7.38);
  const lentils = lentilPerKg * LENTIL_KG;
  const total = lentils + FIXED.reduce((t, l) => t + l[2], 0);
  const perPortion = total / PORTIONS;
  const share = perPortion / sell;
  const ok = share <= TARGET;
  return (
    <div className="rounded-lg border border-ink-raised bg-ink-raised p-5 text-on-ink shadow-glow">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Linsensuppe · {PORTIONS} Portionen</p>
        <p className="text-xs text-on-ink-muted">Beispiel aus den Demodaten</p>
      </div>
      <ul className="mt-4 flex flex-col gap-1 text-sm">
        <li className="flex justify-between gap-2 rounded-sm bg-ink px-2 py-1">
          <span>Rote Linsen <span className="text-on-ink-muted">800 g</span></span>
          <span className="num font-semibold text-saffron">{eur(lentils)}</span>
        </li>
        {FIXED.map(([name, qty, cost]) => (
          <li key={name} className="flex justify-between gap-2 px-2">
            <span>{name} <span className="text-on-ink-muted">{qty}</span></span>
            <span className="num">{eur(cost)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-lentil`}>
          <span className="flex justify-between"><span>Einkaufspreis Rote Linsen</span><span className="num font-semibold">{eur(lentilPerKg)} / kg</span></span>
          <input id={`${id}-lentil`} type="range" min={1} max={8} step={0.01} value={lentilPerKg} onChange={(e) => setLentil(Number(e.target.value))} className="w-full accent-saffron" />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-sell`}>
          <span className="flex justify-between"><span>Verkaufspreis netto</span><span className="num font-semibold">{eur(sell)}</span></span>
          <input id={`${id}-sell`} type="range" min={3} max={14} step={0.1} value={sell} onChange={(e) => setSell(Number(e.target.value))} className="w-full accent-saffron" />
        </label>
      </div>

      <div aria-live="polite" className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-ink p-3">
          <p className="text-xs text-on-ink-muted">Wareneinsatz pro Portion</p>
          <p className="num text-xl">{eur(perPortion)}</p>
        </div>
        <div className="rounded-md bg-ink p-3">
          <p className="text-xs text-on-ink-muted">Anteil am Verkaufspreis</p>
          <p className={cn("num text-xl", ok ? "text-on-ink" : "text-saffron")}>{pct(share)}</p>
        </div>
      </div>
      <div className="mt-3" aria-hidden>
        <div className="relative h-2 rounded-pill bg-ink">
          <div className={cn("h-2 rounded-pill transition-[width] duration-base", ok ? "bg-accent-glow" : "bg-saffron")} style={{ width: `${Math.min(100, share * 100 / 0.6)}%` }} />
          <div className="absolute inset-y-0 w-px bg-on-ink-muted" style={{ left: `${(TARGET * 100) / 0.6}%` }} />
        </div>
        <p className="mt-1 text-xs text-on-ink-muted">Strich = Ziel 30 %{ok ? "" : " · über dem Ziel"}</p>
      </div>
    </div>
  );
}
