"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Scroll story of the start page: the real overview of the suite (demo data) is the only object on a dark stage.
// The scroll position sets one progress value; a camera moves over the screenshot (tilt, zoom, glide), dims
// everything but the part the text talks about, lifts the phone view and the outlet views to the front and ends on
// the whole overview again. Plain CSS 3D transforms, no WebGL, no canvas. Nothing moves on its own and no scroll
// gesture is captured, so it plays forwards and backwards. "Reduced motion" (or ?story=static) shows the still version.

const CTA_PRIMARY = "Mit eigenen Daten vorführen lassen";
const CTA_DEMO = "Demo ohne Anmeldung öffnen";
const IMG = "/story/screen-overview.webp";
const ALT = "Dashboard der GLB AI Suite mit Beispieldaten: Kennzahlen, Berichtsfilter, Handlungsbedarf und Umsatz nach Outlet.";
// page size of the capture (CSS px at 1440 wide, image at 2×) and the boxes of its parts – from scripts/story-assets.mjs
const PAGE = { w: 1440, h: 1924, screen: 900 };
const R = {
  sidebar: [0, 0, 257, 900],
  kpis: [291, 425, 1115, 145],
  hints: [291, 636, 1115, 305],
  outlets: [291, 1670, 1115, 230],
} as const;
const OUTLETS = [
  { name: "Restaurant", img: "/story/outlet-restaurant.jpg" },
  { name: "Bar", img: "/story/outlet-bar.jpg" },
  { name: "Bankett & Events", img: "/story/outlet-bankett.jpg" },
];

type Rect = readonly [number, number, number, number];
// one camera position: focus box (page px), scroll of the screen, rotation, depth, dimming outside the focus,
// device opacity, phone and outlet cards (0…1), device shift to the side (share of the stage width)
type Key = { at: number; f: Rect; sc: number; rx: number; ry: number; z: number; dim: number; dev: number; ph: number; oc: number; dx: number };
const FULL: Rect = [0, 0, PAGE.w, PAGE.screen];
const k = (at: number, f: Rect, o: Partial<Omit<Key, "at" | "f">> = {}): Key => ({ at, f, sc: 0, rx: 0, ry: 0, z: 0, dim: 0, dev: 1, ph: 0, oc: 0, dx: 0, ...o });
const MAXSC = PAGE.h - PAGE.screen;
const pad = (r: Rect, p = 14): Rect => [r[0] - p, r[1] - p, r[2] + 2 * p, r[3] + 2 * p];

const KEYS_WIDE: Key[] = [
  k(0, FULL, { rx: 14, ry: -24, z: -80 }),
  k(0.1, FULL),
  k(0.2, FULL, { ry: 2 }),
  k(0.3, pad(R.kpis), { dim: 0.62, ry: 6, rx: 3 }),
  k(0.4, pad(R.kpis), { dim: 0.62, ry: -5, rx: 2 }),
  k(0.5, pad(R.hints), { sc: 560, dim: 0.6, ry: 5 }),
  k(0.58, pad(R.hints), { sc: 560, dim: 0.6, ry: -3 }),
  k(0.66, FULL, { ry: 26, z: -520, dx: -0.2, dev: 0.5, ph: 1 }),
  k(0.74, FULL, { ry: 22, z: -560, dx: -0.22, dev: 0.5, ph: 1 }),
  k(0.8, pad(R.outlets), { sc: MAXSC, dim: 0.62, ry: -4 }),
  k(0.84, pad(R.outlets), { sc: MAXSC, dim: 0.62, ry: 3 }),
  k(0.9, pad(R.outlets), { sc: MAXSC, z: -700, dim: 0.62, dev: 0.3, oc: 1, rx: 10 }),
  k(0.95, FULL, { rx: 6, ry: -10 }),
  k(1, FULL, { rx: 6, ry: -12, z: -40 }),
];
// narrow screens: smaller focus boxes, so the figures stay legible; the camera pans from card to card
const KEYS_NARROW: Key[] = [
  k(0, FULL, { rx: 20, ry: -10, z: -60 }),
  k(0.1, FULL),
  k(0.2, FULL),
  k(0.27, pad([291, 425, 552, 145], 8), { dim: 0.62, ry: 6 }),
  k(0.33, pad([291, 425, 552, 145], 8), { dim: 0.62, ry: 4 }),
  k(0.4, pad([855, 425, 551, 145], 8), { dim: 0.62, ry: -6 }),
  k(0.5, [370, 745, 600, 196], { sc: 560, dim: 0.6, ry: 5 }),
  k(0.58, [370, 745, 600, 196], { sc: 560, dim: 0.6, ry: -4 }),
  k(0.66, FULL, { z: -600, dev: 0.15, ph: 1 }),
  k(0.74, FULL, { z: -600, dev: 0.15, ph: 1 }),
  k(0.8, pad([291, 1670, 700, 230], 8), { sc: MAXSC, dim: 0.62, ry: -4 }),
  k(0.84, pad([291, 1670, 700, 230], 8), { sc: MAXSC, dim: 0.62, ry: 3 }),
  k(0.9, FULL, { sc: MAXSC, z: -700, dev: 0.15, oc: 1 }),
  k(0.95, FULL, { rx: 8 }),
  k(1, FULL, { rx: 8, z: -40 }),
];

// the texts, by progress
type Beat = { from: number; to: number; kicker: string; title: string; text?: string };
const BEATS: Beat[] = [
  { from: 0.12, to: 0.24, kicker: "Übersicht", title: "Dein Betrieb beginnt mit einem Überblick.", text: "Umsatz, Deckungsbeitrag und Handlungsbedarf aus deinen Verkäufen – auf einer Seite." },
  { from: 0.27, to: 0.43, kicker: "Kennzahlen", title: "Hinter jeder Zahl steht dein Betrieb.", text: "Netto-Umsatz, DB II, Wareneinsatzquote und verkaufte Einheiten, gerechnet aus deinen Verkaufszeilen." },
  { from: 0.46, to: 0.6, kicker: "Handlungsbedarf", title: "Was du als Nächstes tun solltest.", text: "Hinweise nur aus deinen Daten und deinen Zielen: ohne Ziel keine Bewertung, ohne Daten kein Hinweis." },
  { from: 0.63, to: 0.76, kicker: "Mobile Ansicht", title: "Auch dort, wo gearbeitet wird.", text: "Team & Aufgaben auf dem Handy: offene und überfällige Aufgaben je Outlet." },
  { from: 0.79, to: 0.92, kicker: "Outlets", title: "Restaurant. Bar. Bankett. Zusammen im Blick.", text: "Ein Berichtsfilter: jedes Outlet einzeln oder alle zusammen." },
];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const win = (t: number, from: number, to: number, edge = 0.025) => clamp(Math.min((t - from) / edge, (to - t) / edge));
const ease = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function camera(keys: Key[], p: number): Key {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const a = keys[i], b = keys[i + 1];
  const t = ease(clamp((p - a.at) / (b.at - a.at)));
  const out = { at: p } as Key;
  for (const key of ["sc", "rx", "ry", "z", "dim", "dev", "ph", "oc", "dx"] as const) out[key] = mix(a[key], b[key], t);
  // the zoom feels even when the size of the focus box changes a lot; the centre glides in screen coordinates
  const w = Math.exp(mix(Math.log(a.f[2]), Math.log(b.f[2]), t)), h = Math.exp(mix(Math.log(a.f[3]), Math.log(b.f[3]), t));
  const cx = mix(a.f[0] + a.f[2] / 2, b.f[0] + b.f[2] / 2, t), cy = mix(a.f[1] + a.f[3] / 2 - a.sc, b.f[1] + b.f[3] / 2 - b.sc, t) + out.sc;
  out.f = [cx - w / 2, cy - h / 2, w, h];
  return out;
}

function useMode() {
  const [mode, setMode] = useState<"pending" | "anim" | "static">("pending");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("story");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMode(q === "static" || (q !== "anim" && reduced) ? "static" : "anim");
  }, []);
  return mode;
}

export function Story() {
  const mode = useMode();
  return (
    <div className="story-ink" data-story-mode={mode}>
      {mode === "static" ? <StaticStory /> : <ScrollStory />}
      <p id="nach-geschichte" className="mx-auto max-w-(--size-content-max) px-4 pb-6 pt-3 text-xs text-[var(--story-muted)] lg:px-8">
        Alle Ansichten: echte Bildschirme der GLB AI Suite mit den Beispieldaten der Demo.
      </p>
    </div>
  );
}

function Ctas() {
  return (
    <div className="flex flex-wrap gap-3">
      <a href="#anfrage" className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-accent px-5 text-base font-bold text-on-accent shadow-[0_0_0_1px_rgba(143,211,193,0.35)] hover:bg-[#13807a]">
        {CTA_PRIMARY} <ArrowRight aria-hidden className="size-4" />
      </a>
      <Link href="/suite" className="inline-flex min-h-12 items-center rounded-pill border border-[var(--story-line)] px-5 text-base font-semibold text-[var(--story-cream)] hover:bg-white/10">
        {CTA_DEMO}
      </Link>
    </div>
  );
}

const SCREEN_W = PAGE.w * 2, SCREEN_H = PAGE.screen * 2, BEZEL = 34;
const PHONE_W = 780, PHONE_H = 1688, PHONE_B = 26;

function ScrollStory() {
  const section = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const device = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sec = section.current!, st = stage.current!;
    let W = 0, H = 0, raf = 0, cur = 0, target = 0, last = 0;
    const measure = () => {
      W = st.clientWidth;
      H = st.clientHeight;
    };
    const read = () => {
      const r = sec.getBoundingClientRect();
      target = clamp(-r.top / Math.max(1, sec.offsetHeight - innerHeight));
    };
    const apply = (p: number) => {
      const wide = W >= 1024 && W / H > 1.15;
      const cam = camera(wide ? KEYS_WIDE : KEYS_NARROW, p);
      // the free area next to (wide) or below (narrow) the text
      const area = wide ? { x: W * 0.4, y: 72, w: W * 0.57, h: H - 132 } : { x: 16, y: H * 0.43, w: W - 32, h: H * 0.57 - 36 };
      // the objects fade out softly before they reach the text, however far the camera zooms in
      const mask = wide ? `linear-gradient(90deg, transparent ${W * 0.35}px, #000 ${W * 0.43}px)` : `linear-gradient(180deg, transparent ${area.y - 28}px, #000 ${area.y + 16}px)`;
      scene.current!.style.maskImage = mask;
      scene.current!.style.webkitMaskImage = mask;
      const [fx, fy, fw, fh] = cam.f;
      const s = Math.min(area.w / (fw * 2), area.h / (fh * 2)) * (wide ? 0.88 : 0.94);
      const ax = area.x + area.w / 2 + cam.dx * W, ay = area.y + area.h / 2;
      const cx = BEZEL + (fx + fw / 2) * 2, cy = BEZEL + (fy + fh / 2 - cam.sc) * 2;
      const dv = device.current!.style;
      dv.transform = `translate3d(${ax}px,${ay}px,${cam.z}px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) scale(${s}) translate(${-cx}px,${-cy}px)`;
      dv.opacity = String(cam.dev);
      content.current!.style.transform = `translate3d(0,${-cam.sc * 2}px,0)`;
      const sp = spot.current!.style;
      sp.left = `${fx * 2}px`;
      sp.top = `${fy * 2}px`;
      sp.width = `${fw * 2}px`;
      sp.height = `${fh * 2}px`;
      sp.opacity = String(cam.dim);
      // phone: rises from below into the area while the device steps back
      const ps = (area.h * 0.94) / (PHONE_H + 2 * PHONE_B);
      const px = wide ? area.x + area.w * 0.62 : area.x + area.w / 2;
      const ph = phone.current!.style;
      ph.transform = `translate3d(${px}px,${ay + (1 - cam.ph) * H * 0.9}px,${(1 - cam.ph) * -200}px) rotateY(${wide ? -8 * cam.ph : 0}deg) scale(${ps}) translate(-50%,-50%)`;
      ph.opacity = String(clamp(cam.ph * 1.6));
      ph.visibility = cam.ph <= 0.001 ? "hidden" : "visible";
      // outlet views: one after another to the front, stacked in the area
      const cw = Math.min(area.w * 0.96, 880), chh = (cw * 574) / 1942, gap = Math.max(10, area.h * 0.03);
      const top0 = ay - (3 * chh + 2 * gap) / 2;
      cards.current.forEach((c, i) => {
        if (!c) return;
        const ci = ease(clamp(cam.oc * 3.2 - i * 0.9));
        c.style.width = `${cw}px`;
        c.style.transform = `translate3d(${area.x + area.w / 2 - cw / 2}px,${top0 + i * (chh + gap) + (1 - ci) * 60}px,${(1 - ci) * -500}px) rotateX(${(1 - ci) * 24}deg)`;
        c.style.opacity = String(ci);
        c.style.visibility = ci <= 0.001 ? "hidden" : "visible";
      });
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      cur += (target - cur) * (1 - Math.exp(-dt / 90));
      if (Math.abs(target - cur) < 0.0004) cur = target;
      apply(cur);
      setT(cur);
      if (cur !== target) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => {
      read();
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const resize = () => {
      measure();
      apply(cur);
      kick();
    };
    measure();
    read();
    cur = target;
    apply(cur);
    setT(cur);
    setReady(true);
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", resize);
    return () => {
      removeEventListener("scroll", kick);
      removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const intro = clamp(1 - t / 0.06);
  const outro = clamp((t - 0.935) / 0.04);
  const fade = (o: number) => ({ opacity: o, visibility: o <= 0 ? ("hidden" as const) : ("visible" as const), transform: `translateY(${(1 - o) * 18}px)` });
  return (
    <section ref={section} id="geschichte" aria-label="Produktgeschichte: die Übersicht der Suite von nah" className="relative h-[760svh]">
      <div ref={stage} className="sticky top-0 h-svh overflow-hidden">
        <div aria-hidden className="story-glow absolute inset-0" />
        <div ref={scene} className="absolute inset-0 [perspective:1800px]" style={{ opacity: ready ? 1 : 0, transition: "opacity .6s" }}>
          <div ref={device} className="story-device absolute left-0 top-0 origin-top-left" style={{ width: SCREEN_W + 2 * BEZEL, height: SCREEN_H + 2 * BEZEL, padding: BEZEL }}>
            <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-white">
              <div ref={content} className="absolute left-0 top-0" style={{ width: SCREEN_W }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG} alt={ALT} width={SCREEN_W} height={PAGE.h * 2} fetchPriority="high" className="block max-w-none" style={{ width: SCREEN_W, height: PAGE.h * 2 }} />
                <div ref={spot} aria-hidden className="story-spot absolute" />
              </div>
              {/* the sidebar of the suite stays in place while the page scrolls, as in the app */}
              <div aria-hidden className="absolute left-0 top-0" style={{ width: R.sidebar[2] * 2, height: SCREEN_H, backgroundImage: `url(${IMG})`, backgroundSize: `${SCREEN_W}px auto` }} />
              <div aria-hidden className="story-glare pointer-events-none absolute inset-0" />
            </div>
          </div>
          <div ref={phone} className="story-phone absolute left-0 top-0 origin-top-left" style={{ width: PHONE_W + 2 * PHONE_B, height: PHONE_H + 2 * PHONE_B, padding: PHONE_B, visibility: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/story/screen-mobile.jpg" alt="Handy-Ansicht der Suite: Team und Aufgaben je Outlet mit Beispieldaten." loading="lazy" className="block h-full w-full rounded-[84px] object-cover" />
          </div>
          {OUTLETS.map((o, i) => (
            <figure key={o.name} ref={(el) => { cards.current[i] = el; }} className="story-card absolute left-0 top-0 origin-top" style={{ visibility: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.img} alt={`Übersicht mit Outlet-Filter ${o.name} (Beispieldaten).`} loading="lazy" className="block h-auto w-full" />
              <figcaption className="absolute left-3 top-3 rounded-pill bg-[var(--story-ink)] px-3 py-1 text-xs font-bold text-[var(--story-cream)]">{o.name}</figcaption>
            </figure>
          ))}
        </div>

        {/* texts: HTML over the stage, all in one grid cell (top on phones, vertically centred on the left on wide screens) */}
        <div className="pointer-events-none absolute inset-0 mx-auto max-w-(--size-content-max) px-4 pt-[max(4.25rem,8svh)] lg:px-8 lg:pt-0">
          <div className="grid h-full content-start lg:w-[36%] lg:content-center">
            <div className="story-copy pointer-events-auto [grid-area:1/1]" style={fade(intro)}>
              <p className="story-kicker">GLB AI Suite · Gastro Leadership Board</p>
              <h1 id="hero" className="story-h1 mt-3">Gastro führen mit echten Zahlen.</h1>
              <p className="mt-4 max-w-md text-base text-[var(--story-muted)] lg:text-lg">Dein Betrieb beginnt mit einem Überblick.</p>
              <div className="mt-6"><Ctas /></div>
            </div>
            {BEATS.map((b) => (
              <div key={b.title} className="story-copy [grid-area:1/1]" style={fade(win(t, b.from, b.to))}>
                <p className="story-kicker">{b.kicker}</p>
                <h2 className="story-h2 mt-3">{b.title}</h2>
                {b.text && <p className="mt-4 max-w-md text-base text-[var(--story-muted)] lg:text-lg">{b.text}</p>}
              </div>
            ))}
            <div className="story-copy pointer-events-auto [grid-area:1/1]" style={fade(outro)}>
              <p className="story-kicker">Eine Übersicht</p>
              <h2 className="story-h2 mt-3">Dein Betrieb. Alle Bereiche. Eine Übersicht.</h2>
              <div className="mt-6"><Ctas /></div>
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] lg:right-6 lg:top-6">
          <a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-[var(--story-line)] bg-[var(--story-ink)] px-4 text-sm font-semibold text-[var(--story-cream)] hover:bg-white/10">Animation überspringen</a>
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/10">
          <div className="h-full bg-[var(--story-mint)]" style={{ width: `${t * 100}%` }} />
        </div>
      </div>
    </section>
  );
}

// a part of the overview capture, cut out with CSS (no extra image files)
function Crop({ r, alt }: { r: Rect; alt: string }) {
  const [x, y, w, h] = r;
  return (
    <div className="story-frame relative overflow-hidden" style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMG} alt={alt} loading="lazy" className="absolute max-w-none" style={{ width: `${(PAGE.w / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }} />
    </div>
  );
}

// still version for "reduced motion": the same messages with the same views, nothing moves
function StaticStory() {
  return (
    <section id="geschichte" aria-label="Produktgeschichte: die Übersicht der Suite von nah" className="mx-auto max-w-(--size-content-max) px-4 pb-10 pt-6 lg:px-8">
      <div className="flex flex-wrap justify-end gap-2">
        <a href="?story=anim" className="inline-flex min-h-11 items-center rounded-pill border border-[var(--story-line)] px-4 text-sm font-semibold">Animation trotzdem abspielen</a>
        <a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-[var(--story-line)] px-4 text-sm font-semibold">Zu den Inhalten springen</a>
      </div>
      <div className="mt-6 grid items-center gap-8 lg:grid-cols-[5fr_7fr]">
        <div>
          <p className="story-kicker">GLB AI Suite · Gastro Leadership Board</p>
          <h1 id="hero" className="story-h1 mt-3">Gastro führen mit echten Zahlen.</h1>
          <p className="mt-4 text-base text-[var(--story-muted)] lg:text-lg">Dein Betrieb beginnt mit einem Überblick.</p>
          <div className="mt-6"><Ctas /></div>
        </div>
        <Crop r={FULL} alt={ALT} />
      </div>
      <ol className="mt-16 flex flex-col gap-14">
        {BEATS.map((b, i) => (
          <li key={b.title} className="grid items-center gap-6 lg:grid-cols-[5fr_7fr]">
            <div>
              <p className="story-kicker">{b.kicker}</p>
              <h2 className="story-h2 mt-3">{b.title}</h2>
              {b.text && <p className="mt-3 text-[var(--story-muted)]">{b.text}</p>}
            </div>
            {i === 0 && <Crop r={[257, 60, 1183, 520]} alt="Kopf der Übersicht mit Berichtsfilter und Kennzahlen (Beispieldaten)." />}
            {i === 1 && <Crop r={pad(R.kpis)} alt="Kennzahlen der Übersicht: Netto-Umsatz, DB II, Wareneinsatzquote, verkaufte Einheiten (Beispieldaten)." />}
            {i === 2 && <Crop r={pad(R.hints)} alt="Handlungsbedarf: Hinweise zu Warenquoten über dem Ziel (Beispieldaten)." />}
            {i === 3 && (
              <div className="mx-auto w-full max-w-[280px] rounded-[34px] bg-[#05090a] p-2.5 shadow-[0_0_0_1px_var(--story-line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/story/screen-mobile.jpg" alt="Handy-Ansicht der Suite: Team und Aufgaben je Outlet mit Beispieldaten." loading="lazy" className="h-auto w-full rounded-[26px]" />
              </div>
            )}
            {i === 4 && (
              <div className="flex flex-col gap-3">
                <Crop r={pad(R.outlets)} alt="Umsatz nach Outlet: Restaurant, Bar, Bankett & Events (Beispieldaten)." />
                {OUTLETS.map((o) => (
                  <figure key={o.name} className="story-frame relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.img} alt={`Übersicht mit Outlet-Filter ${o.name} (Beispieldaten).`} loading="lazy" className="h-auto w-full" />
                    <figcaption className="absolute left-3 top-3 rounded-pill bg-[var(--story-ink)] px-3 py-1 text-xs font-bold text-[var(--story-cream)]">{o.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </li>
        ))}
        <li>
          <h2 className="story-h2">Dein Betrieb. Alle Bereiche. Eine Übersicht.</h2>
          <div className="mt-6"><Ctas /></div>
        </li>
      </ol>
    </section>
  );
}
