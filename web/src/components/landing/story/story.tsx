"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Scroll story of the start page. It starts on the real overview of the suite; the camera pulls back onto a laptop in
// the restaurant office, out of the house, back in through the entrance to the service station, picks up the phone
// (the real mobile view is laid onto the phone of the film), passes restaurant and bar and ends on the overview again.
// The film is a generated clip (854×480, AI-upscaled), played as an image sequence on a canvas: the scroll position
// picks the frame, forwards and backwards; nothing plays on its own and no scroll gesture is captured. Two visibly
// broken passages of the clip (the laptop sinking away, the cut from the doorway to the outside) are bridged with
// cross-fades. All app views are real screenshots of the demo, laid over the film as sharp HTML images.
// "Reduced motion" (or ?story=static) shows the still version; if the film fails, texts and actions stay usable.

const CTA_PRIMARY = "Demo ohne Anmeldung öffnen";
const CTA_SECOND = "Vorführung mit eigenen Daten";
const FILM = "/story/film";
const DASH = "/story/screen-overview.webp";
const DASH_ALT = "Dashboard der GLB AI Suite mit Beispieldaten: Kennzahlen, Berichtsfilter und Handlungsbedarf.";
const MOBILE = "/story/screen-mobile.jpg";
const MOBILE_ALT = "Handy-Ansicht der Suite: Team und Aufgaben je Outlet mit Beispieldaten.";
const OUTLETS = [
  { name: "Restaurant", img: "/story/outlet-restaurant.jpg", from: 0.775, to: 0.825 },
  { name: "Bar", img: "/story/outlet-bar.jpg", from: 0.825, to: 0.87 },
  { name: "Bankett & Events", img: "/story/outlet-bankett.jpg", from: 0.87, to: 0.915 },
];

type Film = { count: number; base: [number, number]; laptop: number[][]; phone: { frame: number; rect: number[] } };

// ---------------------------------------------------------------- timeline (progress 0…1)
// play: frames a→b at constant speed; mix: cross-fade from frame a to frame b
type Seg = { p0: number; p1: number; a: number; b: number; mix?: boolean };
const SEGS: Seg[] = [
  { p0: 0, p1: 0.15, a: 0, b: 0 },
  { p0: 0.15, p1: 0.25, a: 0, b: 32 },
  { p0: 0.25, p1: 0.29, a: 32, b: 56, mix: true }, // the laptop sinks away in the clip: fade over to the empty office
  { p0: 0.29, p1: 0.33, a: 56, b: 62 },
  { p0: 0.33, p1: 0.37, a: 62, b: 76, mix: true }, // hard cut doorway → outside in the clip: fade through the light
  { p0: 0.37, p1: 0.47, a: 76, b: 112 },
  { p0: 0.47, p1: 0.56, a: 112, b: 150 },
  { p0: 0.56, p1: 0.6, a: 150, b: 166 },
  { p0: 0.6, p1: 0.76, a: 166, b: 166 },
  { p0: 0.76, p1: 0.9, a: 166, b: 240 },
  { p0: 0.9, p1: 1, a: 240, b: 240 },
];
const T = { heroOut: 0.06, inLaptop: 0.15, phoneIn: 0.6, phoneUp: 0.62, phoneHold: 0.68, phoneDown: 0.72, phoneOut: 0.765, end0: 0.9, end1: 0.95 };
// horizontal focus of the crop per frame (matters on narrow, portrait screens): the phone sits right of centre
const FOCUS: [number, number][] = [[0, 0.5], [140, 0.5], [156, 0.62], [166, 0.69], [174, 0.62], [205, 0.6], [240, 0.5]];

// low: on wide screens the text stands at the bottom (over the desk), so it does not cover the laptop in the middle
type Beat = { from: number; to: number; kicker: string; title: string; text: string; low?: boolean };
const BEATS: Beat[] = [
  { from: 0.11, to: 0.27, kicker: "Im Büro", title: "Dein Betrieb beginnt mit einem Überblick.", text: "Die Übersicht der Suite auf dem Laptop im Büro: Umsatz, Deckungsbeitrag und Handlungsbedarf aus deinen Verkäufen.", low: true },
  { from: 0.37, to: 0.49, kicker: "Der Betrieb", title: "Hinter jeder Zahl steht dein Betrieb.", text: "Gastraum, Bar und Bankett: in der Suite als Outlets geführt, mit eigenen Zahlen und Aufgaben." },
  { from: 0.5, to: 0.6, kicker: "Im Restaurant", title: "Zurück durch den Eingang, bis zur Servicestation.", text: "Dorthin, wo Aufgaben entstehen und erledigt werden." },
  { from: 0.62, to: 0.755, kicker: "Mobile Ansicht", title: "Auch dort, wo gearbeitet wird.", text: "Team & Aufgaben auf dem Handy: offene und überfällige Aufgaben je Outlet. Echte Ansicht aus der Demo." },
  { from: 0.775, to: 0.915, kicker: "Outlets", title: "Restaurant. Bar. Bankett. Zusammen im Blick.", text: "Ein Berichtsfilter zeigt jedes Outlet einzeln oder alle zusammen. Werte: Beispieldaten der Demo." },
];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const win = (p: number, from: number, to: number, edge = 0.02) => clamp(Math.min((p - from) / edge, (to - p) / edge));
type Box = { x: number; y: number; w: number; h: number };
const lerpBox = (a: Box, b: Box, t: number): Box => {
  // sizes in log space, so a large change of scale feels even
  const w = Math.exp(mix(Math.log(a.w), Math.log(b.w), t)), h = Math.exp(mix(Math.log(a.h), Math.log(b.h), t));
  const cx = mix(a.x + a.w / 2, b.x + b.w / 2, t), cy = mix(a.y + a.h / 2, b.y + b.h / 2, t);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};

function filmAt(p: number) {
  const s = SEGS.find((x) => p <= x.p1) ?? SEGS[SEGS.length - 1];
  const t = clamp((p - s.p0) / (s.p1 - s.p0));
  if (s.mix) return { a: s.a, b: s.b, m: smooth(t), f: t < 0.5 ? s.a : s.b };
  const f = Math.round(mix(s.a, s.b, t));
  return { a: f, b: f, m: 0, f };
}
function focusAt(f: number) {
  for (let i = 1; i < FOCUS.length; i++) if (f <= FOCUS[i][0]) return mix(FOCUS[i - 1][1], FOCUS[i][1], smooth((f - FOCUS[i - 1][0]) / (FOCUS[i][0] - FOCUS[i - 1][0])));
  return 0.5;
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
        Kamerafahrt: KI-generierter Film (854×480, per KI hochskaliert), kein Film eines echten Betriebs. Alle App-Ansichten sind echte Bildschirme der GLB AI Suite mit den Beispieldaten der Demo.
      </p>
    </div>
  );
}

function Ctas() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link href="/suite" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-accent px-6 text-base font-bold text-on-accent shadow-[0_0_0_1px_rgba(143,211,193,0.35)] hover:bg-[#13807a]">
        {CTA_PRIMARY} <ArrowRight aria-hidden className="size-4" />
      </Link>
      <a href="#anfrage" className="inline-flex min-h-12 items-center justify-center rounded-pill border border-[var(--story-line)] px-6 text-base font-semibold text-[var(--story-cream)] hover:bg-white/10">
        {CTA_SECOND}
      </a>
    </div>
  );
}

function ScrollStory() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const filmBox = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dash = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [filmOk, setFilmOk] = useState(true);

  useEffect(() => {
    const sec = section.current!, st = stage.current!, box = filmBox.current!, cv = canvas.current!;
    const ctx = cv.getContext("2d", { alpha: false });
    let film: Film | null = null, variant = "d", disposed = false, broken = false;
    let W = 0, H = 0, FW = 0, FH = 0, FY = 0, wide = true, dpr = 1;
    let raf = 0, cur = 0, target = 0, last = 0, started = false;
    // ------------------------------------------------ frame loading: a sparse preview of the whole flight, plus a
    // bounded window of full frames around the current position; requests for positions already left are dropped
    const COARSE = 8, NEAR = 10, MAX_NEAR = 48, PAR = 4;
    const frames = new Map<number, HTMLImageElement>(), inflight = new Map<number, HTMLImageElement>(), failed = new Set<number>();
    let queue: number[] = [], focusFrame = 0;
    const coarse = (i: number) => i % COARSE === 0 || i === (film?.count ?? 1) - 1;
    const url = (i: number) => `${FILM}/${variant}/${String(i).padStart(4, "0")}.webp`;
    const want = (i: number, first = false) => {
      if (!film || i < 0 || i >= film.count || frames.has(i) || inflight.has(i) || failed.has(i) || queue.includes(i)) return;
      if (first) queue.unshift(i);
      else queue.push(i);
    };
    const pump = () => {
      while (inflight.size < PAR && queue.length && !disposed) {
        const i = queue.shift()!;
        const im = new Image();
        im.decoding = "async";
        inflight.set(i, im);
        im.onload = () => {
          inflight.delete(i);
          if (disposed) return;
          frames.set(i, im);
          // memory bound: drop full frames far from the current position, keep the sparse preview
          const near = [...frames.keys()].filter((k) => !coarse(k));
          if (near.length > MAX_NEAR) near.sort((x, y) => Math.abs(y - focusFrame) - Math.abs(x - focusFrame)).slice(0, near.length - MAX_NEAR).forEach((k) => frames.delete(k));
          if (i === 0) setFilmOk(true);
          kick();
          pump();
        };
        im.onerror = () => {
          inflight.delete(i);
          failed.add(i);
          if (i === 0) { broken = true; setFilmOk(false); apply(cur); }
          pump();
        };
        im.src = url(i);
      }
    };
    const request = (f: number) => {
      focusFrame = f;
      // forget queued and running requests for positions the reader has already left
      queue = queue.filter((i) => coarse(i) || Math.abs(i - f) <= NEAR);
      for (const [i, im] of inflight) if (!coarse(i) && Math.abs(i - f) > NEAR) { im.src = ""; inflight.delete(i); }
      for (const d of [0, 1, -1, 2, -2, 3, -3, 5, -5, 8, -8]) want(f + d, true);
      if (started && film) for (let i = 0; i < film.count; i += COARSE) want(i);
      pump();
    };
    const nearest = (f: number) => {
      for (let d = 0; d <= 24; d++) {
        if (frames.has(f + d)) return frames.get(f + d)!;
        if (frames.has(f - d)) return frames.get(f - d)!;
      }
      return frames.get(0) ?? null;
    };

    const measure = () => {
      W = st.clientWidth;
      H = st.clientHeight;
      wide = W >= 1024 && W / H > 1.15;
      FW = box.clientWidth;
      FH = box.clientHeight;
      FY = box.offsetTop;
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(FW * dpr);
      cv.height = Math.round(FH * dpr);
    };
    // the visible part of the film frame (base coordinates), from cover fit, focus and digital zoom
    const view = (f: number, zoom: number, zc: [number, number] | null, pull = 1.6) => {
      const [bw, bh] = film!.base;
      const s = Math.max(FW / bw, FH / bh);
      let ww = FW / s / zoom, wh = FH / s / zoom;
      let cx = focusAt(f) * bw, cy = bh / 2;
      if (zc) { const t = 1 - 1 / zoom; cx = mix(cx, zc[0], clamp(t * pull)); cy = mix(cy, zc[1], clamp(t * pull)); }
      ww = Math.min(ww, bw);
      wh = Math.min(wh, bh);
      return { x: clamp(cx - ww / 2, 0, bw - ww), y: clamp(cy - wh / 2, 0, bh - wh), w: ww, h: wh };
    };
    const toStage = (v: Box, r: number[]): Box => ({ x: ((r[0] - v.x) / v.w) * FW, y: FY + ((r[1] - v.y) / v.h) * FH, w: (r[2] / v.w) * FW, h: (r[3] / v.h) * FH });
    // where the overview stands before and after the flight
    const heroBox = (): Box => {
      if (wide) { const w = Math.min(W * 0.5, 800), h = w / 1.6; return { x: W * 0.47, y: H * 0.53 - h / 2, w, h }; }
      // below the skip link, centred in the film area
      const w = Math.min(FW - 32, (FH - 76) * 1.6), h = w / 1.6;
      return { x: (W - w) / 2, y: FY + 60 + (FH - 60 - h) / 2, w, h };
    };

    const apply = (pp: number) => {
      if (!film || !ctx || broken) {
        // without the film the overview simply stays where it is; texts and actions keep working
        const d = dash.current!.style, b = heroBox();
        d.transform = `translate3d(${b.x}px,${b.y}px,0)`;
        d.width = `${b.w}px`;
        d.height = `${b.h}px`;
        return;
      }
      const fa = filmAt(pp);
      const pr = film.phone.rect;
      const pc: [number, number] = [pr[0] + pr[2] / 2, pr[1] + pr[3] / 2];
      const l0 = film.laptop[0];
      let v: Box;
      if (pp < T.inLaptop + 0.02) {
        // the camera pulls back: it starts close on the laptop screen (the size of the overview) and backs off
        const v1 = view(0, 1, null);
        const z0 = clamp(heroBox().w / ((l0[2] * FW) / v1.w), 1, 2.6);
        v = view(0, mix(z0, 1, span(pp, 0.1, T.inLaptop + 0.01)), [l0[0] + l0[2] / 2, l0[1] + l0[3] / 2], 3);
      } else {
        const zoom = pp < T.phoneIn ? 1 : mix(1, wide ? 2.2 : 1.7, span(pp, T.phoneIn, T.phoneUp + 0.02) * (1 - span(pp, T.phoneDown, T.phoneOut)));
        v = view(fa.f, zoom, fa.f === film.phone.frame ? pc : null);
      }
      request(fa.f);
      // film
      const filmIn = span(pp, 0.07, 0.105) * (1 - span(pp, T.end0, T.end1));
      const drawFrame = (f: number, alpha: number) => {
        const im = nearest(f);
        if (!im) return false;
        const k = im.naturalWidth / film!.base[0];
        ctx.globalAlpha = alpha;
        ctx.drawImage(im, v.x * k, v.y * k, v.w * k, v.h * k, 0, 0, cv.width, cv.height);
        return true;
      };
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#0a1315";
      ctx.fillRect(0, 0, cv.width, cv.height);
      drawFrame(fa.a, 1);
      if (fa.m > 0) drawFrame(fa.b, fa.m);
      // the light of the doorway carries the cut to the outside
      if (pp > 0.33 && pp < 0.37) { ctx.globalAlpha = 0.5 * Math.sin(((pp - 0.33) / 0.04) * Math.PI); ctx.fillStyle = "#fff6e8"; ctx.fillRect(0, 0, cv.width, cv.height); }
      ctx.globalAlpha = 1;
      cv.style.opacity = String(filmIn);

      // the overview: hero → into the laptop screen → follows the screen → fades with the laptop; back at the end
      const d = dash.current!.style;
      let db: Box, dOp = 1, radius = 12;
      const lap = film.laptop[Math.min(fa.a, film.laptop.length - 1)];
      if (pp <= 0.1) {
        db = lerpBox(heroBox(), toStage(v, l0), span(pp, T.heroOut, 0.1));
        radius = mix(12, 4, span(pp, T.heroOut, 0.1));
      } else if (pp < 0.29) {
        db = toStage(v, lap);
        radius = 3;
        dOp = fa.m > 0 ? 1 - smooth(fa.m * 1.8) : 1;
      } else {
        db = heroBox();
        dOp = span(pp, T.end0 + 0.02, T.end1 + 0.01);
      }
      d.transform = `translate3d(${db.x}px,${db.y}px,0)`;
      d.width = `${db.w}px`;
      d.height = `${db.h}px`;
      d.opacity = String(dOp);
      d.visibility = dOp <= 0.001 ? "hidden" : "visible";
      d.borderRadius = `${radius}px`;

      // the phone: the real mobile view lies exactly on the phone of the film, then is lifted up to read it
      const ph = phone.current!.style;
      const on = win(pp, T.phoneIn - 0.004, T.phoneOut, 0.006);
      if (on > 0) {
        const at = toStage(v, pr);
        // narrow screens: below the skip link, as tall as the film area allows
        const readH = wide ? Math.min(FH * 0.86, 700) : Math.min(FH - 70, 700), readW = readH * (780 / 1688);
        const read: Box = wide ? { x: W * 0.62 - readW / 2, y: FY + (FH - readH) / 2, w: readW, h: readH } : { x: (W - readW) / 2, y: FY + 62, w: readW, h: readH };
        const lift = span(pp, T.phoneUp, T.phoneHold) * (1 - span(pp, T.phoneDown, T.phoneOut - 0.01));
        const b = lerpBox(at, read, lift);
        ph.transform = `translate3d(${b.x}px,${b.y}px,0)`;
        ph.width = `${b.w}px`;
        ph.height = `${b.h}px`;
        ph.borderRadius = `${b.w * 0.12}px`;
        ph.borderWidth = `${Math.max(1, b.w * 0.035)}px`;
        dim.current!.style.opacity = String(lift * 0.55);
      } else dim.current!.style.opacity = "0";
      ph.opacity = String(on);
      ph.visibility = on <= 0 ? "hidden" : "visible";
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      cur += (target - cur) * (1 - Math.exp(-dt / 80));
      if (Math.abs(target - cur) < 0.0003) cur = target;
      apply(cur);
      setP(cur);
      if (cur !== target) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => {
      const r = sec.getBoundingClientRect();
      target = clamp(-r.top / Math.max(1, sec.offsetHeight - innerHeight));
      if (target > 0.002) started = true;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const resize = () => {
      measure();
      apply(cur);
      kick();
    };
    measure();
    fetch(`${FILM}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: Film) => {
        if (disposed) return;
        film = m;
        // smaller frames for phones and narrow windows
        variant = FW * dpr < 1400 ? "m" : "d";
        kick();
      })
      .catch(() => { broken = true; setFilmOk(false); apply(cur); });
    kick();
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", resize);
    return () => {
      disposed = true;
      removeEventListener("scroll", kick);
      removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      for (const im of inflight.values()) im.src = "";
    };
  }, []);

  const hero = clamp(1 - p / T.heroOut);
  const outro = clamp((p - (T.end1 - 0.01)) / 0.03);
  const fade = (o: number) => ({ opacity: o, visibility: o <= 0 ? ("hidden" as const) : ("visible" as const), transform: `translateY(${(1 - o) * 14}px)` });
  return (
    <section ref={section} id="geschichte" aria-label="Kamerafahrt vom Dashboard durch den Betrieb und zurück" className="relative h-[820svh]" data-film={filmOk ? "ok" : "failed"}>
      <div ref={stage} className="story-stage sticky top-0 h-svh overflow-hidden">
        <div ref={filmBox} className="story-filmbox absolute inset-x-0 top-0">
          <canvas ref={canvas} aria-hidden className="block h-full w-full" style={{ opacity: 0 }} />
          <div aria-hidden className="story-scrim pointer-events-none absolute inset-0" />
          <div ref={dim} aria-hidden className="pointer-events-none absolute inset-0 bg-[#0a1315]" style={{ opacity: 0 }} />
        </div>
        {/* the real overview (top of the page, 16:10) – sharp HTML image over the film */}
        <div ref={dash} className="story-dash absolute left-0 top-0 overflow-hidden" style={{ width: 0, height: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={DASH} alt={DASH_ALT} fetchPriority="high" className="absolute left-0 top-0 block w-full max-w-none" />
        </div>
        <div ref={phone} className="story-phone-real absolute left-0 top-0 overflow-hidden" style={{ visibility: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MOBILE} alt={MOBILE_ALT} loading="lazy" className="block h-full w-full object-cover object-top" />
        </div>
        {/* outlet views: real crops of the overview with the outlet filter */}
        <div className="story-outlets pointer-events-none absolute">
          {OUTLETS.map((o, i) => {
            const op = win(p, o.from, i === 2 ? 0.915 : o.to, 0.015);
            return (
              <figure key={o.name} className="story-card absolute inset-x-0 bottom-0" style={fade(op)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.img} alt={`Übersicht mit Outlet-Filter ${o.name} (Beispieldaten).`} loading="lazy" className="block h-auto w-full" />
                <figcaption className="absolute left-3 top-3 rounded-pill bg-[var(--story-ink)] px-3 py-1 text-xs font-bold text-[var(--story-cream)]">{o.name}{i === 2 ? " · Ansicht aus der Suite" : ""}</figcaption>
              </figure>
            );
          })}
        </div>

        {/* texts: all in one grid cell; wide screens: left over the film, narrow: below the film */}
        <div className="story-copywrap pointer-events-none absolute">
          <div className="grid">
            <div className="story-copy pointer-events-auto [grid-area:1/1]" style={fade(hero)}>
              <p className="story-kicker">GLB AI Suite<span className="hidden sm:inline"> · Gastro Leadership Board</span></p>
              <h1 id="hero" className="story-h1 mt-3">Gastro führen mit echten Zahlen.</h1>
              <p className="story-lead mt-3 sm:mt-4">Erkenne, welche Gerichte deine Warenquote überschreiten, was du nachbestellen musst und welche Aufgaben im Team offen sind.</p>
              <div className="mt-6"><Ctas /></div>
            </div>
            {BEATS.map((b) => (
              <div key={b.title} className={`story-copy [grid-area:1/1] ${b.low ? "story-copy-low" : ""}`} style={fade(win(p, b.from, b.to))}>
                <p className="story-kicker">{b.kicker}</p>
                <h2 className="story-h2 mt-3">{b.title}</h2>
                <p className="story-lead mt-3">{b.text}</p>
              </div>
            ))}
            <div className="story-copy pointer-events-auto [grid-area:1/1]" style={fade(outro)}>
              <p className="story-kicker">Eine Übersicht</p>
              <h2 className="story-h2 mt-3">Dein Betrieb. Alle Bereiche. Eine Übersicht.</h2>
              <p className="story-lead mt-3">Die Demo öffnet die Suite mit Beispieldaten, ohne Anmeldung. Mit deinen eigenen Daten zeigen wir sie dir gern.</p>
              <div className="mt-6"><Ctas /></div>
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] lg:right-6 lg:top-6">
          <a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-[var(--story-line)] bg-[var(--story-ink)] px-4 text-sm font-semibold text-[var(--story-cream)] hover:bg-white/10">Animation überspringen</a>
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
          <div className="h-full bg-[var(--story-mint)]" style={{ width: `${p * 100}%` }} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- still version ("reduced motion")
function Still({ frame, alt }: { frame: number; alt: string }) {
  const n = String(frame).padStart(4, "0");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${FILM}/m/${n}.webp`} srcSet={`${FILM}/m/${n}.webp 960w, ${FILM}/d/${n}.webp 1280w`} sizes="(min-width: 1024px) 58vw, 100vw" alt={alt} loading="lazy" className="story-frame block h-auto w-full" />
  );
}

function StaticStory() {
  return (
    <section id="geschichte" aria-label="Kamerafahrt vom Dashboard durch den Betrieb und zurück, als Standbilder" className="mx-auto max-w-(--size-content-max) px-4 pb-10 pt-6 lg:px-8">
      <div className="flex flex-wrap justify-end gap-2">
        <a href="?story=anim" className="inline-flex min-h-11 items-center rounded-pill border border-[var(--story-line)] px-4 text-sm font-semibold">Animation trotzdem abspielen</a>
        <a href="#nach-geschichte" className="inline-flex min-h-11 items-center rounded-pill border border-[var(--story-line)] px-4 text-sm font-semibold">Zu den Inhalten springen</a>
      </div>
      <div className="mt-6 grid items-center gap-8 lg:grid-cols-[5fr_7fr]">
        <div>
          <p className="story-kicker">GLB AI Suite · Gastro Leadership Board</p>
          <h1 id="hero" className="story-h1 mt-3">Gastro führen mit echten Zahlen.</h1>
          <p className="story-lead mt-4">Erkenne, welche Gerichte deine Warenquote überschreiten, was du nachbestellen musst und welche Aufgaben im Team offen sind.</p>
          <div className="mt-6"><Ctas /></div>
        </div>
        <div className="story-frame relative overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={DASH} alt={DASH_ALT} className="absolute left-0 top-0 block w-full max-w-none" />
        </div>
      </div>
      <ol className="mt-16 flex flex-col gap-14">
        {BEATS.map((b, i) => (
          <li key={b.title} className="grid items-center gap-6 lg:grid-cols-[5fr_7fr]">
            <div>
              <p className="story-kicker">{b.kicker}</p>
              <h2 className="story-h2 mt-3">{b.title}</h2>
              <p className="story-lead mt-3">{b.text}</p>
            </div>
            {i === 0 && <Still frame={16} alt="Laptop auf dem Schreibtisch im Büro des Restaurants (KI-generierte Szene)." />}
            {i === 1 && <Still frame={96} alt="Das Haus des Restaurants von außen, leicht erhöht gesehen (KI-generierte Szene)." />}
            {i === 2 && <Still frame={160} alt="Gastraum mit der Servicestation am Eingang, darauf ein Telefon (KI-generierte Szene)." />}
            {i === 3 && (
              <div className="mx-auto w-full max-w-[280px] rounded-[34px] bg-[#05090a] p-2.5 shadow-[0_0_0_1px_var(--story-line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MOBILE} alt={MOBILE_ALT} loading="lazy" className="h-auto w-full rounded-[26px]" />
              </div>
            )}
            {i === 4 && (
              <div className="flex flex-col gap-3">
                <Still frame={200} alt="Gastraum mit Bar und Weinregal (KI-generierte Szene)." />
                {OUTLETS.map((o) => (
                  <figure key={o.name} className="story-card relative">
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
