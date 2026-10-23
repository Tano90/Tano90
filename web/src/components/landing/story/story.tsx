"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Engine } from "./engine";

// Scroll story of the start page: tool → laptop → restaurant from above → dining room → phone → outlets → dashboard.
// The scroll position is the only input: it sets one progress value (0…1); camera, texts and cards follow from it,
// backwards as well as forwards. Nothing scrolls on its own and no scroll gesture is captured.
// Text is HTML on top of the canvas. Without WebGL, with reduced motion or on request the same story is shown as
// still images (rendered from the same scene) with the same texts.

const CTA_PRIMARY = "Mit eigenen Daten vorführen lassen";
const CTA_DEMO = "Demo ohne Anmeldung öffnen";

type Beat = { from: number; to: number; kicker: string; title: string; text?: string };
const BEATS: Beat[] = [
  { from: 0.13, to: 0.3, kicker: "Aus dem Bildschirm heraus", title: "Das Dashboard läuft dort, wo du planst.", text: "Im Büro deines Restaurants – mit Umsatz, Deckungsbeitrag und Handlungsbedarf aus deinen Verkäufen." },
  { from: 0.34, to: 0.53, kicker: "Der Betrieb", title: "Hinter jeder Zahl steht dein Betrieb.", text: "Büro, Restaurant, Bar und Bankett: ein Betrieb, in der Suite als Outlets geführt." },
  { from: 0.58, to: 0.66, kicker: "Im Gastraum", title: "Auch die Servicestation gehört dazu.", text: "Aufgaben je Outlet sind auf dem Handy erreichbar." },
  { from: 0.67, to: 0.78, kicker: "Mobile Ansicht", title: "Auch dort, wo gearbeitet wird.", text: "Team & Aufgaben in der Handy-Ansicht der Suite: offene und überfällige Aufgaben je Outlet. Ansicht aus der Demo." },
  { from: 0.785, to: 0.935, kicker: "Die Outlets", title: "Restaurant. Bar. Bankett. Zusammen im Blick.", text: "Derselbe Berichtsfilter zeigt jedes Outlet einzeln. Werte aus den Beispieldaten der Demo." },
];
const OUTLETS = [
  { from: 0.785, to: 0.835, id: "restaurant", name: "Restaurant", img: "/story/outlet-restaurant.jpg" },
  { from: 0.835, to: 0.885, id: "bar", name: "Bar", img: "/story/outlet-bar.jpg" },
  { from: 0.885, to: 0.935, id: "bankett", name: "Bankett & Events", img: "/story/outlet-bankett.jpg" },
];
const LABELS: { id: string; label: string; windows: [number, number][] }[] = [
  { id: "buero", label: "Büro", windows: [[0.37, 0.55], [0.94, 0.975]] },
  { id: "restaurant", label: "Restaurant", windows: [[0.4, 0.55], [0.94, 0.975]] },
  { id: "bar", label: "Bar", windows: [[0.4, 0.55], [0.94, 0.975]] },
  { id: "bankett", label: "Bankett", windows: [[0.4, 0.55], [0.94, 0.975]] },
];
// still images for the version without animation (rendered from the same scene, scripts/story-stills.mjs)
const STILLS = [
  { img: "/story/screen-dashboard.jpg", alt: "Das Dashboard der GLB AI Suite füllt den Bildschirm.", kicker: "Im Tool", title: "Dein Betrieb beginnt mit einem Überblick." },
  { img: "/story/still-2.jpg", alt: "Der Laptop mit dem Dashboard steht auf dem Schreibtisch im Restaurantbüro.", kicker: BEATS[0].kicker, title: BEATS[0].title, text: BEATS[0].text },
  { img: "/story/still-3.jpg", alt: "Das Restaurant von oben: Büro, Gastraum, Bar und Bankett in einem Gebäude.", kicker: BEATS[1].kicker, title: BEATS[1].title, text: BEATS[1].text },
  { img: "/story/still-4.jpg", alt: "Servicestation im Gastraum mit einem Smartphone auf einem Ständer.", kicker: BEATS[2].kicker, title: BEATS[2].title, text: BEATS[2].text },
  { img: "/story/screen-mobile.jpg", alt: "Handy-Ansicht der Suite: Team und Aufgaben je Outlet mit Beispieldaten.", kicker: BEATS[3].kicker, title: BEATS[3].title, text: BEATS[3].text, phone: true },
  { img: "/story/still-6.jpg", alt: "Blick in Restaurant, Bar und Bankett.", kicker: BEATS[4].kicker, title: BEATS[4].title, text: BEATS[4].text },
];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** 0 outside [from, to], 1 inside, with soft edges. */
const win = (t: number, from: number, to: number, edge = 0.025) => clamp(Math.min((t - from) / edge, (to - t) / edge));

function useMode() {
  // "anim" with WebGL and normal motion, "static" otherwise; decided in the browser only
  const [mode, setMode] = useState<"pending" | "anim" | "static">("pending");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("story");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    setMode(q === "static" || (q !== "anim" && reduced) || !webgl ? "static" : "anim");
  }, []);
  return [mode, setMode] as const;
}

export function Story() {
  const [mode, setMode] = useMode();
  const fail = useCallback(() => setMode("static"), [setMode]);
  return (
    <>
      <div className="relative">
        {mode === "static" ? <StaticStory /> : <AnimatedStory onFail={fail} pending={mode === "pending"} />}
      </div>
      <div id="nach-geschichte" />
    </>
  );
}

function Ctas({ light = false }: { light?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <a href="#anfrage" className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-accent px-5 text-base font-bold text-on-accent hover:bg-accent-hover">
        {CTA_PRIMARY} <ArrowRight aria-hidden className="size-4" />
      </a>
      <Link href="/suite" className={`inline-flex min-h-12 items-center rounded-pill border px-5 text-base font-semibold ${light ? "border-border-input bg-surface-raised hover:bg-row-hover" : "border-border-input bg-surface-raised/95 hover:bg-row-hover"}`}>
        {CTA_DEMO}
      </Link>
    </div>
  );
}

function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-[12px] border border-border bg-bg/95 p-5 shadow-[0_8px_30px_rgba(34,28,21,0.12)] lg:p-6 ${className}`} style={style}>
      {children}
    </div>
  );
}

function AnimatedStory({ onFail, pending }: { onFail: () => void; pending: boolean }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);
  const [labels, setLabels] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});

  useEffect(() => {
    if (pending) return;
    let disposed = false, raf = 0, current = -1, target = 0, visible = true, last = 0;
    const readScroll = () => {
      const el = section.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
    };
    const tick = (now: number) => {
      raf = 0;
      // light, time-based smoothing towards the scroll position (≈0.1 s), the same on fast and slow devices;
      // it settles and never runs ahead of the scroll position
      const dt = last ? Math.min(250, now - last) : 16;
      last = now;
      const next = current < 0 ? target : current + (target - current) * (1 - Math.exp(-dt / 90));
      current = Math.abs(target - next) < 0.0004 ? target : next;
      engine.current?.setProgress(current);
      setT(current);
      const e = engine.current;
      if (e) setLabels(Object.fromEntries(LABELS.map((l) => [l.id, e.project(l.id) || { x: 0, y: 0, visible: false }])));
      if (current !== target && visible) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const onScroll = () => {
      target = readScroll();
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };
    const lite = window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as { deviceMemory?: number }).deviceMemory || 8) <= 4;
    const fail = setTimeout(() => !engine.current && !disposed && onFail(), 12000); // no endless loading
    import("./engine")
      .then(({ createEngine }) => createEngine(canvas.current!, { lite, onFirstFrame: () => !disposed && setReady(true) }))
      .then((e) => {
        if (disposed) return e.dispose();
        engine.current = e;
        onScroll();
      })
      .catch(() => !disposed && onFail());
    const ro = new ResizeObserver(() => {
      engine.current?.resize();
      onScroll();
    });
    if (canvas.current) ro.observe(canvas.current);
    // pause outside the viewport
    const io = new IntersectionObserver(([x]) => {
      visible = x.isIntersecting;
      if (visible) onScroll();
    });
    if (section.current) io.observe(section.current);
    window.addEventListener("scroll", onScroll, { passive: true });
    target = readScroll();
    setT(target);
    return () => {
      disposed = true;
      clearTimeout(fail);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      io.disconnect();
      engine.current?.dispose();
      engine.current = null;
    };
  }, [pending, onFail]);

  const intro = 1 - clamp((t - 0.09) / 0.04);
  const outro = clamp((t - 0.965) / 0.03);
  const progressLabel = `${Math.round(t * 100)} %`;
  return (
    <section ref={section} id="geschichte" aria-label="Produktgeschichte: vom Dashboard in den Betrieb und zurück" className="relative h-[560svh] lg:h-[640svh]">
      <div className="sticky top-0 h-svh w-full overflow-hidden bg-[#efe7da]">
        {/* preview until the first 3D frame: the same dashboard, framed like the opening shot */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${ready ? "opacity-0" : "opacity-100"}`} aria-hidden={ready}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/story/screen-dashboard.jpg" alt="Dashboard der GLB AI Suite mit Beispieldaten: Kennzahlen, Berichtsfilter und Handlungsbedarf." className="max-h-full max-w-full object-contain" />
        </div>
        <canvas ref={canvas} className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden />

        {/* zone labels, projected from the 3D positions */}
        {LABELS.map((l) => {
          const o = Math.max(...l.windows.map(([a, b]) => win(t, a, b)));
          const p = labels[l.id];
          if (!p?.visible || o <= 0) return null;
          return (
            <span key={l.id} aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-pill bg-text px-3 py-1 text-sm font-semibold text-bg" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, opacity: o }}>
              {l.label}
            </span>
          );
        })}

        {/* scene 1: in the tool – heading and both actions right away */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-10" style={{ opacity: intro, visibility: intro <= 0 ? "hidden" : "visible" }}>
          <Panel className="pointer-events-auto max-w-xl">
            <p className="text-sm font-bold text-accent">Beispieldaten der Demo</p>
            <h1 id="hero" className="font-display mt-2 text-[2rem] leading-[1.1] lg:text-[2.75rem]">Gastro führen mit <span className="text-accent">echten Zahlen.</span></h1>
            <p className="mt-3 text-base text-text-muted">Dein Betrieb beginnt mit einem Überblick. Scrolle, um vom Dashboard in den Betrieb zu gehen.</p>
            <div className="mt-5"><Ctas /></div>
          </Panel>
        </div>

        {/* scenes 2–6: one message at a time */}
        {BEATS.map((b) => {
          const o = win(t, b.from, b.to);
          if (o <= 0) return null;
          return (
            <div key={b.title} className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-10" style={{ opacity: o }}>
              <Panel className="max-w-md">
                <p className="text-sm font-bold text-accent">{b.kicker}</p>
                <h2 className="font-display mt-2 text-[1.6rem] leading-tight lg:text-[2.1rem]">{b.title}</h2>
                {b.text && <p className="mt-2 text-base text-text-muted">{b.text}</p>}
              </Panel>
            </div>
          );
        })}

        {/* scene 6: each outlet with its own figures from the demo */}
        {OUTLETS.map((x) => {
          // mounted from the start (hidden), so the image is loaded before its outlet comes into view
          const o = win(t, x.from, x.to, 0.015);
          return (
            <figure key={x.id} aria-hidden={o <= 0} className="pointer-events-none absolute inset-x-4 top-[max(4.5rem,env(safe-area-inset-top))] lg:inset-x-auto lg:right-10 lg:top-24 lg:w-[min(46vw,640px)]" style={{ opacity: o, visibility: o <= 0 ? "hidden" : "visible" }}>
              <div className="overflow-hidden rounded-[12px] border border-border bg-white shadow-[0_8px_30px_rgba(34,28,21,0.14)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.img} alt={`Berichtsfilter auf Outlet ${x.name} mit Netto-Umsatz, DB II, Wareneinsatzquote und verkauften Einheiten (Beispieldaten).`} className="h-auto w-full" />
              </div>
              <figcaption className="mt-2 inline-block rounded-pill bg-text px-3 py-1 text-sm font-semibold text-bg">{x.name} · Übersicht mit Outlet-Filter</figcaption>
            </figure>
          );
        })}

        {/* scene 7: back to the shared overview */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-10" style={{ opacity: outro, visibility: outro <= 0 ? "hidden" : "visible" }}>
          <Panel className="pointer-events-auto max-w-xl">
            <p className="text-sm font-bold text-accent">Eine Übersicht</p>
            <h2 className="font-display mt-2 text-[1.8rem] leading-tight lg:text-[2.4rem]">Dein Betrieb. Alle Bereiche. Eine Übersicht.</h2>
            <div className="mt-5"><Ctas /></div>
          </Panel>
        </div>

        {/* always there: skip, progress */}
        <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-2 lg:right-6 lg:top-6">
          <a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-border-input bg-bg/95 px-4 text-sm font-semibold hover:bg-row-hover">Animation überspringen</a>
        </div>
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-border/60">
          <div className="h-full bg-accent" style={{ width: progressLabel }} />
        </div>
      </div>
    </section>
  );
}

function StaticStory() {
  return (
    <section id="geschichte" aria-label="Produktgeschichte: vom Dashboard in den Betrieb und zurück" className="mx-auto max-w-(--size-content-max) px-4 pt-6 pb-10 lg:px-8">
      <div className="flex justify-end"><a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-border-input px-4 text-sm font-semibold">Zu den Inhalten springen</a></div>
      <div className="mt-4 grid items-center gap-8 lg:grid-cols-[5fr_7fr]">
        <div>
          <p className="text-sm font-bold text-accent">Beispieldaten der Demo</p>
          <h1 id="hero" className="font-display mt-2 text-[2.25rem] leading-[1.1] lg:text-[3.25rem]">Gastro führen mit <span className="text-accent">echten Zahlen.</span></h1>
          <p className="mt-4 text-base text-text-muted lg:text-lg">Dein Betrieb beginnt mit einem Überblick.</p>
          <div className="mt-6"><Ctas light /></div>
        </div>
        <div className="overflow-hidden rounded-[12px] border border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/story/screen-dashboard.jpg" alt="Dashboard der GLB AI Suite mit Beispieldaten: Kennzahlen, Berichtsfilter und Handlungsbedarf." className="h-auto w-full" />
        </div>
      </div>
      <ol className="mt-14 flex flex-col gap-12">
        {STILLS.slice(1).map((s) => (
          <li key={s.title} className="grid items-center gap-6 lg:grid-cols-[5fr_7fr]">
            <div>
              <p className="text-sm font-bold text-accent">{s.kicker}</p>
              <h2 className="font-display mt-2 text-[1.6rem] leading-tight lg:text-[2rem]">{s.title}</h2>
              {s.text && <p className="mt-2 text-text-muted">{s.text}</p>}
            </div>
            <div className={s.phone ? "mx-auto w-full max-w-[280px] overflow-hidden rounded-[24px] border-4 border-text bg-white" : "overflow-hidden rounded-[12px] border border-border bg-white"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.img} alt={s.alt} loading="lazy" className="h-auto w-full" />
            </div>
          </li>
        ))}
        <li className="grid gap-4 lg:grid-cols-3">
          {OUTLETS.map((x) => (
            <figure key={x.id} className="overflow-hidden rounded-[12px] border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.img} alt={`Berichtsfilter auf Outlet ${x.name} mit Kennzahlen (Beispieldaten).`} loading="lazy" className="h-auto w-full" />
              <figcaption className="border-t border-border px-3 py-2 text-sm font-semibold">{x.name}</figcaption>
            </figure>
          ))}
        </li>
        <li>
          <h2 className="font-display text-[1.8rem] leading-tight lg:text-[2.4rem]">Dein Betrieb. Alle Bereiche. Eine Übersicht.</h2>
          <div className="mt-5"><Ctas light /></div>
        </li>
      </ol>
    </section>
  );
}
