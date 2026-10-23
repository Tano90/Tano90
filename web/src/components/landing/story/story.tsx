"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// Scroll story of the start page. A camera flight pre-rendered in Blender (Cycles) is played as an image sequence:
// the scroll position sets one progress value, which picks the frame (neighbouring frames are cross-faded), the
// texts and the screen overlay – forwards and backwards. Nothing moves on its own; no scroll gesture is captured.
// The laptop and phone screens are overlaid with the real demo screenshots, fitted to the rendered screen corners
// of every frame, so the product view stays sharp and readable throughout the move.
// Needs no WebGL. Only "reduced motion" (or ?story=static) shows the still version.

const CTA_PRIMARY = "Mit eigenen Daten vorführen lassen";
const CTA_DEMO = "Demo ohne Anmeldung öffnen";
const BASE = "/story/seq";

type Corner = [number, number, number];
type Frame = { laptop: Corner[] | null; phone: Corner[] | null; zones?: Record<string, Corner> | null };
type Variant = { w: number; h: number; count: number; shots: { name: string; start: number; count: number }[]; frames: Frame[] };
type Manifest = { version: number; variants: { d: Variant; m: Variant } };

// messages per shot (fractions of that shot); shots that are not rendered yet are skipped
type Beat = { shot: string; from: number; to: number; kicker: string; title: string; text?: string };
const BEATS: Beat[] = [
  { shot: "office", from: 0.22, to: 0.7, kicker: "Aus dem Bildschirm heraus", title: "Das Dashboard läuft dort, wo du planst.", text: "Im Büro deines Restaurants – mit Umsatz, Deckungsbeitrag und Handlungsbedarf aus deinen Verkäufen." },
  { shot: "aerial", from: 0.25, to: 1.01, kicker: "Der Betrieb", title: "Hinter jeder Zahl steht dein Betrieb.", text: "Büro, Restaurant, Bar und Bankett: ein Betrieb, in der Suite als Outlets geführt." },
  { shot: "enter", from: 0.55, to: 1.01, kicker: "Im Gastraum", title: "Die Servicestation am Eingang.", text: "Aufgaben je Outlet sind auch auf dem Handy erreichbar." },
  { shot: "phone", from: 0.4, to: 1.01, kicker: "Mobile Ansicht", title: "Auch dort, wo gearbeitet wird.", text: "Team & Aufgaben in der Handy-Ansicht der Suite: offene und überfällige Aufgaben je Outlet. Ansicht aus der Demo." },
  { shot: "outlets", from: 0.2, to: 1.01, kicker: "Die Outlets", title: "Restaurant. Bar. Bankett. Zusammen im Blick.", text: "Derselbe Berichtsfilter zeigt jedes Outlet einzeln. Werte aus den Beispieldaten der Demo." },
  { shot: "return", from: 0.0, to: 0.7, kicker: "Zurück ins Büro", title: "Alle Bereiche laufen in einer Übersicht zusammen." },
];
// outlet figures from the demo while the camera is in that area (fractions of the "outlets" shot)
const OUTLETS = [
  { from: 0.22, to: 0.45, name: "Restaurant", img: "/story/outlet-restaurant.jpg" },
  { from: 0.47, to: 0.7, name: "Bar", img: "/story/outlet-bar.jpg" },
  { from: 0.78, to: 1.01, name: "Bankett & Events", img: "/story/outlet-bankett.jpg" },
];
// area labels at the projected 3D positions (only in the shots from above / at the entrance)
const LABELS: { id: string; label: string; shots: string[] }[] = [
  { id: "buero", label: "Büro", shots: ["aerial"] },
  { id: "restaurant", label: "Restaurant", shots: ["aerial"] },
  { id: "bar", label: "Bar", shots: ["aerial"] },
  { id: "bankett", label: "Bankett", shots: ["aerial"] },
];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const win = (t: number, from: number, to: number, edge = 0.06) => clamp(Math.min((t - from) / edge, (to - t) / edge));

// ---------- perspective fit of a rectangle onto four points (CSS matrix3d)
type M3 = number[];
const adj = (m: M3): M3 => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
const mul = (a: M3, b: M3): M3 => {
  const c: M3 = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  return c;
};
const mulv = (m: M3, v: number[]) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
function basis(p: number[]): M3 {
  const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1];
  const v = mulv(adj(m), [p[6], p[7], 1]);
  return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
/** matrix3d that maps a w×h element (origin top left) onto the quad tl, tr, bl, br (viewport pixels). */
function fit(w: number, h: number, q: number[][]) {
  const s = basis([0, 0, w, 0, 0, h, w, h]);
  const d = basis([q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]]);
  const t = mul(d, adj(s)).map((x, _, a) => x / a[8]);
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}

function useMode() {
  const [mode, setMode] = useState<"pending" | "anim" | "static">("pending");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("story");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMode(q === "static" || (q !== "anim" && reduced) ? "static" : "anim");
  }, []);
  return [mode, setMode] as const;
}

export function Story() {
  const [mode, setMode] = useMode();
  const fail = useCallback(() => setMode("static"), [setMode]);
  return (
    <>
      <div className="relative" data-story-mode={mode}>
        {mode === "static" ? <StaticStory /> : <SequenceStory onFail={fail} pending={mode === "pending"} />}
      </div>
      <p id="nach-geschichte" className="mx-auto max-w-(--size-content-max) px-4 pt-3 text-xs text-text-muted lg:px-8">
        Kamerafahrt in Blender gerendert. Möbelmodelle: Khronos glTF Sample Assets – Sofa, Pflanze, Windlicht und Kühlschrank von Eric Chadwick und Sean Thomas (CC BY 4.0), weitere Modelle CC0. Bildschirminhalte: Beispieldaten der GLB-Demo.
      </p>
    </>
  );
}

function Ctas() {
  return (
    <div className="flex flex-wrap gap-3">
      <a href="#anfrage" className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-accent px-5 text-base font-bold text-on-accent hover:bg-accent-hover">
        {CTA_PRIMARY} <ArrowRight aria-hidden className="size-4" />
      </a>
      <Link href="/suite" className="inline-flex min-h-12 items-center rounded-pill border border-border-input bg-surface-raised px-5 text-base font-semibold hover:bg-row-hover">
        {CTA_DEMO}
      </Link>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[12px] border border-border bg-bg/95 p-4 shadow-[0_8px_30px_rgba(34,28,21,0.14)] lg:p-6 ${className}`}>{children}</div>;
}

function SequenceStory({ onFail, pending }: { onFail: () => void; pending: boolean }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLImageElement>(null);
  const phoneOverlay = useRef<HTMLImageElement>(null);
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [variantKey, setVariantKey] = useState<"d" | "m">("d");
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);

  // manifest and the variant for this screen (portrait frames on phones)
  useEffect(() => {
    if (pending) return;
    const pick = () => setVariantKey(window.innerWidth / window.innerHeight < 0.9 ? "m" : "d");
    pick();
    window.addEventListener("resize", pick);
    fetch(`${BASE}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setManifest)
      .catch(onFail);
    return () => window.removeEventListener("resize", pick);
  }, [pending, onFail]);

  useEffect(() => {
    if (!manifest) return;
    const v = manifest.variants[variantKey];
    const imgs: (HTMLImageElement | null)[] = new Array(v.count).fill(null);
    let disposed = false, raf = 0, current = -1, target = 0, last = 0;
    const ctx = canvas.current!.getContext("2d", { alpha: false })!;

    // load order: first frame, then coarse to fine, so every scroll position soon has a nearby frame
    const order: number[] = [];
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < v.count; i += step) if (!order.includes(i)) order.push(i);
    if (!order.includes(v.count - 1)) order.splice(1, 0, v.count - 1);
    let next = 0, active = 0;
    const pump = () => {
      while (active < 6 && next < order.length && !disposed) {
        const i = order[next++];
        const im = new Image();
        im.decoding = "async";
        im.src = `${BASE}/${variantKey}/${String(i).padStart(4, "0")}.webp`;
        active++;
        im.onload = () => {
          active--;
          if (disposed) return;
          imgs[i] = im;
          if (i === 0) setReady(true);
          request();
          pump();
        };
        im.onerror = () => {
          active--;
          pump();
        };
      }
    };
    const nearest = (i: number) => {
      for (let d = 0; d < v.count; d++) {
        if (imgs[i - d]) return i - d;
        if (imgs[i + d]) return i + d;
      }
      return -1;
    };

    const draw = (p: number) => {
      const c = canvas.current!;
      const W = c.clientWidth, H = c.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      // cover-fit of the rendered frame
      const s = Math.max(W / v.w, H / v.h), ox = (W - v.w * s) / 2, oy = (H - v.h * s) / 2;
      const f = p * (v.count - 1), a = Math.floor(f), b = Math.min(v.count - 1, a + 1), wgt = f - a;
      const ia = nearest(a);
      if (ia >= 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.drawImage(imgs[ia]!, ox, oy, v.w * s, v.h * s);
        if (wgt > 0.01 && imgs[b] && ia === a) {
          ctx.globalAlpha = wgt;
          ctx.drawImage(imgs[b]!, ox, oy, v.w * s, v.h * s);
          ctx.globalAlpha = 1;
        }
      }
      // sharp screenshots on the laptop and phone screens, corners interpolated between the two frames
      const place = (el: HTMLImageElement | null, key: "laptop" | "phone", nw: number, nh: number) => {
        if (!el) return;
        const ca = v.frames[a]?.[key], cb = v.frames[b]?.[key];
        if (ca && cb && ca.every((x) => x[2] > 0) && cb.every((x) => x[2] > 0)) {
          const pt = (k: number) => [ox + (ca[k][0] + (cb[k][0] - ca[k][0]) * wgt) * v.w * s, oy + (ca[k][1] + (cb[k][1] - ca[k][1]) * wgt) * v.h * s];
          // corners from the render: bottom left, bottom right, top right, top left
          const q = [pt(3), pt(2), pt(0), pt(1)];
          const area = Math.abs((q[1][0] - q[0][0]) * (q[2][1] - q[0][1])) / (W * H);
          el.style.transform = fit(el.naturalWidth || nw, el.naturalHeight || nh, q);
          el.style.opacity = String(clamp((area - 0.004) / 0.01));
        } else el.style.opacity = "0";
      };
      place(overlay.current, "laptop", 1920, 1200);
      place(phoneOverlay.current, "phone", 780, 1688);
      // area labels
      const shot = v.shots.find((x) => a >= x.start && a < x.start + x.count)?.name || "";
      for (const l of LABELS) {
        const el = labelRefs.current[l.id];
        const za = v.frames[a]?.zones?.[l.id], zb = v.frames[b]?.zones?.[l.id];
        if (!el) continue;
        if (!za || !zb || !l.shots.includes(shot) || za[2] <= 0) {
          el.style.opacity = "0";
          continue;
        }
        const x = ox + (za[0] + (zb[0] - za[0]) * wgt) * v.w * s, y = oy + (za[1] + (zb[1] - za[1]) * wgt) * v.h * s;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        el.style.opacity = x > 0 && x < W && y > 0 && y < H ? "1" : "0";
      }
    };
    const readScroll = () => {
      const r = section.current!.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
    };
    const tick = (now: number) => {
      raf = 0;
      // short, time-based smoothing towards the scroll position (never ahead of it)
      const dt = last ? Math.min(100, now - last) : 16;
      last = now;
      const nx = current < 0 ? target : current + (target - current) * (1 - Math.exp(-dt / 70));
      current = Math.abs(target - nx) < 0.0002 ? target : nx;
      draw(current);
      setT(current);
      if (current !== target) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    function request() {
      if (!raf) raf = requestAnimationFrame(tick);
    }
    const onScroll = () => {
      target = readScroll();
      request();
    };
    const fail = setTimeout(() => !disposed && !imgs[0] && onFail(), 15000);
    pump();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      disposed = true;
      clearTimeout(fail);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [manifest, variantKey, onFail]);

  const v = manifest?.variants[variantKey];
  const local = (shot: string) => {
    const s = v?.shots.find((x) => x.name === shot);
    if (!s || !v) return -1;
    return clamp((t * (v.count - 1) - s.start) / Math.max(1, s.count - 1), -1, 2);
  };
  const intro = 1 - clamp((t - 0.05) / 0.06);
  const frames = v?.count ?? 60;
  return (
    <section ref={section} id="geschichte" aria-label="Produktgeschichte: vom Dashboard in den Betrieb und zurück" className="relative" style={{ height: `calc(100svh + ${Math.round(frames * 3.4)}svh)` }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden bg-[#2b2620]">
        {/* first frame as preview until the sequence is ready */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE}/${variantKey}/0000.webp`} alt="Dashboard der GLB AI Suite mit Beispieldaten auf einem Laptop im Restaurantbüro." className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${ready ? "opacity-0" : "opacity-100"}`} />
        <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={overlay} src="/story/screen-dashboard.jpg" alt="" aria-hidden className="pointer-events-none absolute left-0 top-0 origin-top-left opacity-0" style={{ width: 1920, height: 1200, maxWidth: "none" }} width={1920} height={1200} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={phoneOverlay} src="/story/screen-mobile.jpg" alt="" aria-hidden className="pointer-events-none absolute left-0 top-0 origin-top-left opacity-0" style={{ width: 780, height: 1688, maxWidth: "none" }} width={780} height={1688} />
        {LABELS.map((l) => (
          <span key={l.id} ref={(el) => { labelRefs.current[l.id] = el; }} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-pill bg-text/90 px-3 py-1 text-sm font-semibold text-bg opacity-0 transition-opacity duration-200">
            {l.label}
          </span>
        ))}
        {OUTLETS.map((x) => {
          const l = local("outlets");
          const o = l < 0 ? 0 : win(l, x.from, x.to, 0.04);
          return (
            <figure key={x.name} aria-hidden={o <= 0} className="pointer-events-none absolute inset-x-4 top-[max(4rem,env(safe-area-inset-top))] lg:inset-x-auto lg:right-8 lg:top-20 lg:w-[min(44vw,620px)]" style={{ opacity: o, visibility: o <= 0 ? "hidden" : "visible" }}>
              <div className="overflow-hidden rounded-[12px] border border-border bg-white shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.img} alt={`Übersicht mit Outlet-Filter ${x.name}: Netto-Umsatz, DB II, Wareneinsatzquote und verkaufte Einheiten (Beispieldaten).`} className="h-auto w-full" />
              </div>
              <figcaption className="mt-2 inline-block rounded-pill bg-text px-3 py-1 text-sm font-semibold text-bg">{x.name} · Übersicht mit Outlet-Filter</figcaption>
            </figure>
          );
        })}

        {/* opening: heading and both actions right away, over the keyboard area below the screen */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:justify-start lg:p-8" style={{ opacity: intro, visibility: intro <= 0 ? "hidden" : "visible" }}>
          <Panel className="pointer-events-auto w-full max-w-2xl">
            <p className="text-sm font-bold text-accent">Beispieldaten der Demo</p>
            <h1 id="hero" className="font-display mt-1 text-[1.75rem] leading-[1.1] lg:text-[2.4rem]">Gastro führen mit <span className="text-accent">echten Zahlen.</span></h1>
            <p className="mt-2 text-base text-text-muted">Dein Betrieb beginnt mit einem Überblick. Scrolle, um aus dem Dashboard in den Betrieb zu gehen.</p>
            <div className="mt-4"><Ctas /></div>
          </Panel>
        </div>

        {BEATS.map((b) => {
          const l = local(b.shot);
          const o = l < 0 ? 0 : win(l, b.from, b.to);
          if (o <= 0) return null;
          return (
            <div key={b.title} className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-8" style={{ opacity: o }}>
              <Panel className="max-w-md">
                <p className="text-sm font-bold text-accent">{b.kicker}</p>
                <h2 className="font-display mt-1 text-[1.5rem] leading-tight lg:text-[2rem]">{b.title}</h2>
                {b.text && <p className="mt-2 text-base text-text-muted">{b.text}</p>}
              </Panel>
            </div>
          );
        })}

        {(() => {
          const l = local("return");
          const o = l < 0 ? 0 : clamp((l - 0.8) / 0.12);
          return (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:justify-start lg:p-8" style={{ opacity: o, visibility: o <= 0 ? "hidden" : "visible" }}>
              <Panel className="pointer-events-auto w-full max-w-2xl">
                <p className="text-sm font-bold text-accent">Eine Übersicht</p>
                <h2 className="font-display mt-1 text-[1.6rem] leading-tight lg:text-[2.2rem]">Dein Betrieb. Alle Bereiche. Eine Übersicht.</h2>
                <div className="mt-4"><Ctas /></div>
              </Panel>
            </div>
          );
        })()}

        <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] lg:right-6 lg:top-6">
          <a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-border-input bg-bg/95 px-4 text-sm font-semibold hover:bg-row-hover">Animation überspringen</a>
        </div>
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-black/20">
          <div className="h-full bg-accent" style={{ width: `${t * 100}%` }} />
        </div>
      </div>
    </section>
  );
}

// still version for "reduced motion": the same story with frames of the same render
const STILLS = [
  { frame: 30, kicker: "Aus dem Bildschirm heraus", title: "Das Dashboard läuft dort, wo du planst.", text: "Im Büro deines Restaurants – mit Umsatz, Deckungsbeitrag und Handlungsbedarf aus deinen Verkäufen.", alt: "Der Laptop mit dem Dashboard auf dem Schreibtisch im Restaurantbüro, Ziegelwand und Regal." },
  { frame: 50, kicker: "Der Betrieb", title: "Hinter jeder Zahl steht dein Betrieb.", alt: "Blick durch das Fenster in das Restaurantbüro mit Schreibtisch, Sessel und Pflanze." },
];

function StaticStory() {
  return (
    <section id="geschichte" aria-label="Produktgeschichte: vom Dashboard in den Betrieb und zurück" className="mx-auto max-w-(--size-content-max) px-4 pt-6 pb-10 lg:px-8">
      <div className="flex flex-wrap justify-end gap-2">
        <a href="?story=anim" className="inline-flex min-h-11 items-center rounded-pill border border-border-input px-4 text-sm font-semibold">Animation trotzdem abspielen</a>
        <a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-border-input px-4 text-sm font-semibold">Zu den Inhalten springen</a>
      </div>
      <div className="mt-4 grid items-center gap-8 lg:grid-cols-[5fr_7fr]">
        <div>
          <p className="text-sm font-bold text-accent">Beispieldaten der Demo</p>
          <h1 id="hero" className="font-display mt-2 text-[2.25rem] leading-[1.1] lg:text-[3.25rem]">Gastro führen mit <span className="text-accent">echten Zahlen.</span></h1>
          <p className="mt-4 text-base text-text-muted lg:text-lg">Dein Betrieb beginnt mit einem Überblick.</p>
          <div className="mt-6"><Ctas /></div>
        </div>
        <div className="overflow-hidden rounded-[12px] border border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/story/screen-dashboard.jpg" alt="Dashboard der GLB AI Suite mit Beispieldaten: Kennzahlen, Berichtsfilter und Handlungsbedarf." className="h-auto w-full" />
        </div>
      </div>
      <ol className="mt-14 flex flex-col gap-12">
        {STILLS.map((s) => (
          <li key={s.title} className="grid items-center gap-6 lg:grid-cols-[5fr_7fr]">
            <div>
              <p className="text-sm font-bold text-accent">{s.kicker}</p>
              <h2 className="font-display mt-2 text-[1.6rem] leading-tight lg:text-[2rem]">{s.title}</h2>
              {s.text && <p className="mt-2 text-text-muted">{s.text}</p>}
            </div>
            <div className="overflow-hidden rounded-[12px] border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE}/d/${String(s.frame).padStart(4, "0")}.webp`} alt={s.alt} loading="lazy" className="h-auto w-full" onError={(e) => (e.currentTarget.parentElement!.style.display = "none")} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
