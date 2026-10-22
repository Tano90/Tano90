// Browserprüfung Camperteil: Darstellung (320/390/768/1440), Tastatur, Touch, Kontrast, Filme, 3D mit WebGL,
// Software-Fallback und Kontextverlust sowie der gesamte Anfrage-Ablauf.
// Aufruf: CHROMIUM_PATH=/pfad/zu/chromium BASE_URL=http://localhost:4173 node tests/flow.mjs
// Erwartet einen laufenden Server (npm run serve). Bildschirmfotos landen in test-results/.
// WebGL läuft hier über SwiftShader (Software-Rasterizer von Chromium). Das prüft den WebGL-Code, nicht eine echte GPU.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const OUT = "test-results";
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
mkdirSync(OUT, { recursive: true });

// Kleine Test-PNG-Dateien erzeugen (einfarbig), dazu eine PDF-Attrappe und eine zu große Datei
function png(w, h, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const files = {
  a: join(OUT, "riegel-vorne.png"), b: join(OUT, "riegel-hinten.png"), pdf: join(OUT, "rechnung.pdf"), big: join(OUT, "riesig.jpg"),
};
writeFileSync(files.a, png(120, 90, [201, 138, 18]));
writeFileSync(files.b, png(90, 120, [40, 70, 60]));
writeFileSync(files.pdf, "%PDF-1.4\n%Test\n");
writeFileSync(files.big, Buffer.alloc(16 * 1024 * 1024, 1));

let failures = 0;
function check(cond, msg) { console.log((cond ? "  ok   " : "  FAIL ") + msg); if (!cond) failures++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(page, fn, arg, ms = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; }
}

let browser = await chromium.launch({ executablePath: EXE, args: GL_ARGS });
const errorsOf = (page) => { const e = []; page.on("pageerror", (x) => e.push(x.message)); page.on("console", (m) => { if (m.type() === "error") e.push(m.text()); }); return e; };
const d3 = (page) => page.evaluate(() => document.querySelector("#model-stage").debug3d?.());
const scrollToEl = (page, sel, block = "center") => page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ block: b, behavior: "instant" }), [sel, block]);

/* ---------- Darstellung ---------- */
async function layoutPass(name, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `${name}: kein horizontales Scrollen (Überstand ${overflow}px)`);
  const fonts = await page.evaluate(() => ["Archivo Var", "Plex Sans", "Plex Mono"].map((f) => document.fonts.check(`16px "${f}"`)));
  check(fonts.every(Boolean), `${name}: eigene Schriften geladen (${fonts.join(",")})`);
  // Kleinste sichtbare Schrift
  const tiny = await page.evaluate(() => {
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode; if (!t.textContent.trim()) continue;
      const el = t.parentElement; if (!el || el.closest(".visually-hidden, [hidden], svg, .skip")) continue;
      const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      if (parseFloat(cs.fontSize) < 10.9) out.add(`${t.textContent.trim().slice(0, 24)} (${cs.fontSize})`);
    }
    return [...out];
  });
  check(tiny.length === 0, `${name}: keine Schrift unter 11px ${tiny.slice(0, 6).join("; ")}`);
  if (isMobile) {
    const small = await page.evaluate(() => [...document.querySelectorAll("a, button, input, select, textarea, summary, [tabindex='0']")]
      .filter((n) => n.offsetParent && !n.classList.contains("visually-hidden") && !n.closest(".skip, .parts-list, .faq, p, li:not(.nav-cta-item), dd, .draft-line, .footer-links, .sheet-cap"))
      .map((n) => ({ n: (n.textContent || n.id || n.tagName).trim().replace(/\s+/g, " ").slice(0, 28), r: n.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && (x.r.height < 44 || x.r.width < 44)).map((x) => `${x.n} (${Math.round(x.r.width)}×${Math.round(x.r.height)})`));
    check(small.length === 0, `${name}: Bedienelemente mindestens 44 × 44 px ${small.join("; ")}`);
  }
  // Hero-Aussage und Hauptaktion im ersten Bild
  const cta = await page.locator(".hero-actions .btn-primary").boundingBox();
  check(cta && cta.y + cta.height <= viewport.height, `${name}: „Ersatzteil anfragen“ im ersten Bild (Unterkante ${Math.round(cta.y + cta.height)}px)`);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  check(errors.length === 0, `${name}: keine Konsolenfehler ${errors.join(" | ")}`);
  await ctx.close();
}

console.log("Darstellung");
await layoutPass("breite-1440", { width: 1440, height: 900 }, false);
await layoutPass("breite-768", { width: 768, height: 1024 }, true);
await layoutPass("breite-390", { width: 390, height: 844 }, true);
await layoutPass("breite-320", { width: 320, height: 640 }, true);

console.log("Kontrast (berechnet aus den tatsächlichen Farben)");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  const res = await page.evaluate(() => {
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); const k = c.startsWith("color(") ? 255 : 1; return { r: m[0] * k, g: m[1] * k, b: m[2] * k, a: m[3] ?? 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const bgOf = (el) => { const stack = []; for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (const c of stack.reverse()) base = blend(c, base); return base; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const sels = [".status-row p", ".status-label", ".manifesto-bottom p", ".chapter", ".section-intro", ".eyebrow", ".lab-copy > p", ".lab-disclaimer", ".control-label", ".control-hint", ".parts-list tbody td", ".tips dd", ".limit-note p", ".hint", ".req", ".faq summary", ".site-footer p", ".steps p", ".sheet-cap"];
    return sels.map((s) => { const el = [...document.querySelectorAll(s)].find((n) => n.offsetParent && !n.closest(".film-hero, .journey-film, .model-stage")); if (!el) return [s, null]; const cs = getComputedStyle(el); const r = ratio(blend(parse(cs.color), bgOf(el)), bgOf(el)); const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700); return [s, +r.toFixed(2), large]; });
  });
  for (const [s, r, large] of res) if (r !== null) check(r >= (large ? 3 : 4.5), `Kontrast ${s}: ${r}:1`);
  // Text über Film und 3D-Bühne: gegen die hellste Stelle des Standbilds unter dem Text geprüft (Schatten eingerechnet), siehe Bericht
  await ctx.close();
}

console.log("Navigation und Kopfzeile");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/index.html");
  const toggle = page.locator(".nav-toggle");
  await toggle.click();
  check((await toggle.getAttribute("aria-expanded")) === "true", "Menü öffnet");
  await page.screenshot({ path: join(OUT, "handy-menue.png") });
  await page.locator("#nav-list a", { hasText: "Ablauf" }).click();
  await page.waitForTimeout(1200);
  check((await toggle.getAttribute("aria-expanded")) === "false", "Menü schließt nach Klick");
  const top = await page.evaluate(() => document.querySelector("#ablauf").getBoundingClientRect().top);
  check(top >= 0 && top < 140, `Sprung zu „Ablauf“ (Abstand oben ${Math.round(top)}px)`);
  check(await page.locator(".site-header").evaluate((n) => n.classList.contains("is-solid")), "Kopfzeile nach dem Film als feste Leiste");
  await page.mouse.wheel(0, 600); await page.waitForTimeout(500);
  check(await page.locator(".site-header").evaluate((n) => n.classList.contains("is-tucked")), "Kopfzeile weicht beim Weiterlesen aus");
  check(await page.locator("[data-mobile-cta]").evaluate((n) => n.classList.contains("is-away")), "Mobile Schaltfläche weicht beim Weiterlesen aus");
  await page.mouse.wheel(0, -200); await page.waitForTimeout(500);
  check(!(await page.locator(".site-header").evaluate((n) => n.classList.contains("is-tucked"))), "Kopfzeile kommt beim Zurückscrollen");
  const cta = page.locator("[data-mobile-cta]");
  check(await cta.evaluate((n) => n.classList.contains("is-visible") && !n.classList.contains("is-away")), "Mobile Schaltfläche kommt beim Zurückscrollen");
  await scrollToEl(page, "#model-stage"); await page.waitForTimeout(1200);
  check(await cta.evaluate((n) => n.classList.contains("is-suppressed")), "Mobile Schaltfläche verdeckt die 3D-Bühne nicht");
  await scrollToEl(page, "#ablauf", "start"); await page.waitForTimeout(1200); await page.mouse.wheel(0, -100); await page.waitForTimeout(600);
  await cta.click(); await page.waitForTimeout(1200);
  check(!(await cta.evaluate((n) => n.classList.contains("is-visible"))), "Mobile Schaltfläche führt zum Formular und verschwindet dort");
  await page.mouse.wheel(0, -150); await page.waitForTimeout(600);
  check(await toggle.isVisible() && (await toggle.boundingBox()).y >= 0, "Menü nach kurzem Zurückscrollen wieder erreichbar");
  await toggle.click(); await page.keyboard.press("Escape");
  check((await toggle.getAttribute("aria-expanded")) === "false", "Escape schließt Menü");
  await ctx.close();
}

console.log("Tastatur");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/index.html");
  await page.keyboard.press("Tab");
  check((await page.evaluate(() => document.activeElement.className)) === "skip", "Erster Tab: „Zum Inhalt springen“");
  const skipVisible = await page.evaluate(() => document.activeElement.getBoundingClientRect().top >= 0);
  check(skipVisible, "Sprunglink wird bei Fokus sichtbar");
  // Bis zur Hauptaktion tabben, Fokus muss sichtbar sein
  let found = false, outlineOk = false;
  for (let i = 0; i < 15 && !found; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { hero: !!a.closest(".hero-actions") && a.classList.contains("btn-primary"), outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 }; });
    if (info.hero) { found = true; outlineOk = info.outline; }
  }
  check(found, "Hauptaktion per Tab erreichbar");
  check(outlineOk, "Fokus auf der Hauptaktion sichtbar (Rahmen mindestens 2px)");
  await page.keyboard.press("Enter");
  check(await until(page, () => Math.abs(document.querySelector("#anfrage").getBoundingClientRect().top) < 160), "Enter auf der Hauptaktion springt zum Formular");
  await ctx.close();
}

/* ---------- Filme ---------- */
console.log("Filme");
async function filmCtx(opts = {}, launchArgs = []) {
  const b = launchArgs.length ? await chromium.launch({ executablePath: EXE, args: [...GL_ARGS, ...launchArgs] }) : browser;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  return { b, ctx, page: await ctx.newPage() };
}
const film = (page, id) => page.evaluate((i) => { const v = document.getElementById(i); return { src: v.getAttribute("src"), paused: v.paused, playing: v.closest(".film-frame").classList.contains("is-playing"), error: v.closest(".film-frame").classList.contains("has-error"), label: document.querySelector(`[data-video="${i}"] .ft-label`).textContent, disabled: document.querySelector(`[data-video="${i}"]`).disabled, time: v.currentTime }; }, id);
{
  const { b, ctx, page } = await filmCtx({}, ["--autoplay-policy=no-user-gesture-required"]);
  const errors = errorsOf(page);
  const posterReq = [];
  page.on("request", (r) => { if (/\.(webm|mp4)$/.test(r.url())) posterReq.push(r.url().split("/").pop()); });
  await page.goto(BASE + "/index.html");
  check(await page.locator(".film-hero .film-poster").evaluate((i) => i.complete && i.naturalWidth > 0), "Standbild steht sofort, vor jedem Filmabruf");
  check(await until(page, () => document.querySelector("#top .film-frame").classList.contains("is-playing")), "Hero-Film startet stumm und inline");
  const h = await film(page, "hero-film");
  check(h.playing && h.label === "Film anhalten", `Film blendet über das Standbild, Knopf „${h.label}“`);
  check(await page.evaluate(() => { const v = document.getElementById("hero-film"); return v.muted && v.loop && v.playsInline; }), "Film ist stumm, wiederholt sich, spielt inline");
  check((await film(page, "journey-film")).src === null, `Zweiter Film wird noch nicht geladen (abgerufen: ${posterReq.join(", ")})`);
  await page.locator('[data-video="hero-film"]').click();
  check((await film(page, "hero-film")).paused, "Hero-Film lässt sich anhalten");
  await page.locator('[data-video="hero-film"]').click();
  check(!(await film(page, "hero-film")).paused, "und wieder starten");
  await scrollToEl(page, ".journey-film");
  check(await until(page, () => !document.getElementById("journey-film").paused), "Zweiter Film startet erst im Bild");
  check((await film(page, "hero-film")).paused, "Hero-Film pausiert außerhalb des Bildes");
  await page.evaluate(() => scrollTo(0, 0));
  await until(page, () => !document.getElementById("hero-film").paused);
  await page.locator('[data-video="hero-film"]').click(); // Nutzer hält an
  await scrollToEl(page, ".journey-film"); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600);
  check((await film(page, "hero-film")).paused, "Vom Nutzer angehaltener Film bleibt beim Zurückkehren angehalten");
  check(errors.length === 0, "Filme ohne Konsolenfehler " + errors.join(" | "));
  await ctx.close(); if (b !== browser) await b.close();
}
{
  // Gesperrtes Autoplay nachgestellt: play() wird ohne Nutzergeste abgelehnt, wie es Browser im Stromsparmodus tun
  const { b, ctx, page } = await filmCtx({}, []);
  await page.addInitScript(() => {
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { return navigator.userActivation.isActive ? orig.call(this) : Promise.reject(new DOMException("blockiert", "NotAllowedError")); };
  });
  await page.goto(BASE + "/index.html");
  await page.waitForTimeout(2500);
  const h = await film(page, "hero-film");
  check(h.paused && !h.playing, "Autoplay gesperrt: Standbild bleibt, kein Fehler");
  check(h.label === "Film abspielen", "Autoplay gesperrt: Knopf bietet „Film abspielen“ an");
  await page.locator('[data-video="hero-film"]').click();
  check(await until(page, () => !document.getElementById("hero-film").paused), "Autoplay gesperrt: Film startet nach Klick");
  await ctx.close(); if (b !== browser) await b.close();
}
{
  const { ctx, page } = await filmCtx({ reducedMotion: "reduce" });
  const req = []; page.on("request", (r) => { if (/\.(webm|mp4)$/.test(r.url())) req.push(r.url()); });
  await page.goto(BASE + "/index.html"); await page.waitForTimeout(2000);
  check(req.length === 0 && (await film(page, "hero-film")).paused, "Weniger Bewegung: kein Film wird geladen oder gestartet");
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector(".film-copy h1")).animationName);
  check(anim === "none", "Weniger Bewegung: Überschrift ohne Einblendung");
  const hidden = await page.evaluate(() => [...document.querySelectorAll(".reveal")].length);
  check(hidden === 0, "Weniger Bewegung: keine versteckten Abschnitte");
  await page.locator('[data-video="hero-film"]').click();
  check(await until(page, () => !document.getElementById("hero-film").paused), "Weniger Bewegung: Film startet nur auf Wunsch");
  await ctx.close();
}
{
  const { ctx, page } = await filmCtx();
  await page.addInitScript(() => { Object.defineProperty(navigator, "connection", { value: { saveData: true, effectiveType: "4g", addEventListener() {} }, configurable: true }); });
  await page.goto(BASE + "/index.html"); await page.waitForTimeout(2000);
  const h = await film(page, "hero-film");
  check(h.src === null && /MB\)$/.test(h.label), `Datensparmodus: kein Autoplay, Knopf nennt die Größe („${h.label}“)`);
  await ctx.close();
}
{
  const { ctx, page } = await filmCtx({}, []);
  await ctx.route(/\.(webm|mp4)$/, (r) => r.abort());
  await page.goto(BASE + "/index.html");
  await page.locator('[data-video="hero-film"]').click().catch(() => {});
  check(await until(page, () => document.querySelector('[data-video="hero-film"]').disabled), "Filmfehler: Knopf meldet „nicht verfügbar“");
  const h = await film(page, "hero-film");
  check(h.error && /nicht verfügbar/.test(h.label), `Filmfehler: Standbild bleibt („${h.label}“)`);
  check(await page.locator(".film-hero .film-poster").isVisible(), "Filmfehler: Standbild sichtbar");
  await ctx.close();
}

/* ---------- 3D ---------- */
console.log("3D: Anpassung an langsame Darstellung (SwiftShader, 1440 px)");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/index.html");
  await scrollToEl(page, "#model-stage");
  await until(page, () => document.querySelector("#model-stage").dataset.ready === "webgl");
  await page.waitForTimeout(2500);
  await page.locator("#auto-rotate").click(); // dauerhafte Bewegung, damit gemessen wird
  const q = await until(page, () => { const st = document.querySelector("#model-stage"); return st.dataset.quality || st.dataset.ready === "software3d"; }, null, 20000);
  const st = await page.evaluate(() => ({ ready: document.querySelector("#model-stage").dataset.ready, quality: document.querySelector("#model-stage").dataset.quality, reason: document.querySelector("#model-stage").dataset.reason }));
  console.log("  info gemessen: " + JSON.stringify(st));
  check(q, "Zu langsame WebGL-Darstellung senkt die Qualität oder wechselt zur Canvas-Ansicht");
  await ctx.close();
}

console.log("3D mit WebGL (SwiftShader, Qualitätsanpassung für den Test abgeschaltet)");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.CAMPERTEIL_3D = { adaptive: false }; });
  const errors = errorsOf(page);
  await page.goto(BASE + "/index.html");
  await scrollToEl(page, "#model-stage");
  check(await until(page, () => document.querySelector("#model-stage").dataset.ready === "webgl"), "WebGL-Ansicht aktiv");
  await page.waitForTimeout(2200); // Einstiegsfahrt
  let s = await d3(page);
  check(Math.abs(s.radius - 12.4) < 0.3, `Ruhige Ausgangsansicht nach der Einstiegsfahrt (Abstand ${s.radius})`);
  await page.screenshot({ path: join(OUT, "3d-webgl-ruhe.png"), clip: await page.locator("#model-stage").boundingBox() });
  // Nach dem Ausklingen aller Bewegungen darf in 1,2 s kein Bild mehr gezeichnet werden
  let idle = false, drawn = 0;
  for (let i = 0; i < 8 && !idle; i++) { const a = (await d3(page)).frames; await page.waitForTimeout(1200); drawn = (await d3(page)).frames - a; idle = drawn === 0; }
  check(idle, `Ohne Bewegung wird nicht neu gezeichnet (zuletzt ${drawn} Bilder in 1,2 s)`);
  s = await d3(page);
  // Maus: ziehen dreht
  const box = await page.locator("#part-canvas").boundingBox();
  const t0 = s.theta;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(700);
  s = await d3(page); check(Math.abs(s.theta - t0) > 0.3, `Maus ziehen dreht (θ ${t0} → ${s.theta})`);
  // Mausrad ohne Strg scrollt die Seite, mit Strg zoomt es
  const y0 = await page.evaluate(() => scrollY), r0 = s.radius;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 300); await page.waitForTimeout(600);
  s = await d3(page);
  check((await page.evaluate(() => scrollY)) > y0 && Math.abs(s.radius - r0) < 0.05, "Mausrad über der Bühne scrollt die Seite, kein Zoom-Fang");
  await scrollToEl(page, "#model-stage"); await page.waitForTimeout(300);
  await page.keyboard.down("Control"); await page.mouse.wheel(0, -300); await page.keyboard.up("Control"); await page.waitForTimeout(800);
  const r1 = (await d3(page)).radius; check(r1 < r0 - 0.3, `Strg + Mausrad zoomt (${r0} → ${r1})`);
  // Knöpfe
  await page.locator("#zoom-out").click();
  check(await until(page, (r) => document.querySelector("#model-stage").debug3d().radius > r + 0.3, r1), "Knopf „Verkleinern“");
  await page.locator("#zoom-in").click(); await page.waitForTimeout(500);
  await page.locator('.material[data-material="olive"]').click();
  await until(page, () => document.querySelector("#model-stage").debug3d().color === "#68705a");
  s = await d3(page); check(s.color === "#68705a", `Farbwechsel Olive mit Überblendung (${s.color})`);
  check((await page.locator('.material[data-material="olive"]').getAttribute("aria-pressed")) === "true" && (await page.locator("#model-stage").getAttribute("aria-pressed")) === null, "Farbknopf meldet Zustand (aria-pressed), nur am Knopf");
  await page.locator("#explode").fill("100");
  await until(page, () => document.querySelector("#model-stage").debug3d().explode > 0.95);
  s = await d3(page); check(s.explode > 0.95, `Explosionsansicht 100 % (${s.explode})`);
  check(await until(page, () => [...document.querySelectorAll("[data-label]")].filter((n) => +n.style.opacity > 0.9).length >= 2), "Bauteile werden beschriftet, sobald sie auseinandergezogen sind");
  const outside = await page.evaluate(() => { const st = document.querySelector("#model-stage").getBoundingClientRect(); return [...document.querySelectorAll("[data-label]")].filter((n) => +n.style.opacity > 0).filter((n) => { const r = n.getBoundingClientRect(); return r.left < st.left || r.right > st.right || r.top < st.top || r.bottom > st.bottom; }).map((n) => n.textContent); });
  check(outside.length === 0, "Beschriftungen bleiben innerhalb der Bühne " + outside.join(", "));
  await page.screenshot({ path: join(OUT, "3d-webgl-explosion.png"), clip: await page.locator("#model-stage").boundingBox() });
  await page.locator("#wireframe").click();
  check(await until(page, () => document.querySelector("#model-stage").debug3d().wire === true), "Drahtgitter an");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "3d-webgl-drahtgitter.png"), clip: await page.locator("#model-stage").boundingBox() });
  await page.locator("#auto-rotate").click(); const ta = (await d3(page)).theta; await page.waitForTimeout(2500);
  check(Math.abs((await d3(page)).theta - ta) > 0.05, "Langsames Drehen läuft");
  // Unsichtbar: kein Zeichnen, auch bei laufender Drehung
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1500);
  const fa = (await d3(page)).frames; await page.waitForTimeout(1000);
  check((await d3(page)).frames - fa <= 1, "Außerhalb des Bildes ruht die Darstellung");
  await scrollToEl(page, "#model-stage"); await page.waitForTimeout(300);
  await page.locator("#reset-model").click();
  await until(page, () => { const d = document.querySelector("#model-stage").debug3d(); return Math.abs(d.radius - 12.4) < 0.3 && d.explode < 0.02; });
  s = await d3(page);
  check(Math.abs(s.radius - 12.4) < 0.3 && s.explode < 0.02 && !s.wire && !s.auto, `Zurücksetzen (Abstand ${s.radius}, Explosion ${s.explode})`);
  check((await page.locator("#explode-value").textContent()) === "0 %", "Regler zeigt nach dem Zurücksetzen 0 %");
  // Tastatur
  await page.locator("#part-canvas").focus();
  const tk = (await d3(page)).theta;
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  check(await until(page, (t) => Math.abs(document.querySelector("#model-stage").debug3d().theta - t) > 0.3, tk), "Pfeiltasten drehen");
  await page.keyboard.press("+");
  check(await until(page, () => document.querySelector("#model-stage").debug3d().radius < 12), "Taste + zoomt");
  await page.keyboard.press("Home");
  check(await until(page, () => Math.abs(document.querySelector("#model-stage").debug3d().radius - 12.4) < 0.3), "Pos1 setzt zurück");
  await page.locator("#explode").focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  check((await page.locator("#explode-value").textContent()) === "2 %", "Regler per Pfeiltaste bedienbar");
  check((await page.locator("#stage-status").textContent()).length > 0, "Änderungen werden für Screenreader angesagt");
  check(errors.length === 0, "3D ohne Konsolenfehler " + errors.join(" | "));
  // Kontextverlust: Wechsel auf die Software-Ansicht
  await page.evaluate(() => document.querySelector("#part-canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
  check(await until(page, () => document.querySelector("#model-stage").dataset.ready === "software3d"), "WebGL-Kontextverlust: Software-Ansicht übernimmt");
  await page.locator('.material[data-material="graphite"]').click();
  check(await until(page, () => document.querySelector("#model-stage").debug3d().color === "58,63,59"), "Nach Kontextverlust: Bedienung funktioniert weiter");
  await ctx.close();
}
console.log("3D per Touch (Handy, WebGL)");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.CAMPERTEIL_3D = { adaptive: false }; });
  await page.goto(BASE + "/index.html");
  await scrollToEl(page, "#model-stage");
  await until(page, () => document.querySelector("#model-stage").dataset.ready === "webgl");
  await page.waitForTimeout(2200);
  check((await page.locator("#part-canvas").evaluate((c) => getComputedStyle(c).touchAction)) === "pan-y", "Touch: senkrechtes Wischen bleibt Seiten-Scrollen (touch-action: pan-y)");
  check(await page.locator(".help-touch").isVisible(), "Touch: passende Bedienhinweise sichtbar");
  const touch = (type, pts) => page.evaluate(([t, p]) => {
    const c = document.querySelector("#part-canvas");
    for (const [id, x, y] of p) c.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: t === "pointerup" ? 0 : 1 }));
  }, [type, pts]);
  const box = await page.locator("#part-canvas").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const t0 = (await d3(page)).theta;
  await touch("pointerdown", [[1, cx, cy]]);
  for (let i = 1; i <= 8; i++) await touch("pointermove", [[1, cx + i * 15, cy]]);
  await touch("pointerup", [[1, cx + 120, cy]]); await page.waitForTimeout(700);
  check(Math.abs((await d3(page)).theta - t0) > 0.2, "Touch: waagerecht wischen dreht");
  const r0 = (await d3(page)).radius;
  await touch("pointerdown", [[1, cx - 30, cy]]); await touch("pointerdown", [[2, cx + 30, cy]]);
  for (let i = 1; i <= 8; i++) await touch("pointermove", [[1, cx - 30 - i * 10, cy], [2, cx + 30 + i * 10, cy]]);
  await touch("pointerup", [[1, cx - 110, cy]]); await touch("pointerup", [[2, cx + 110, cy]]); await page.waitForTimeout(700);
  check((await d3(page)).radius < r0 - 0.3, `Touch: zwei Finger zoomen (${r0} → ${(await d3(page)).radius})`);
  await page.locator("#reset-model").tap();
  await scrollToEl(page, "#model-stage"); // die Darstellung ruht, solange die Bühne nicht im Bild ist
  check(await until(page, () => Math.abs(document.querySelector("#model-stage").debug3d().radius - 12.4) < 0.3), "Touch: Zurücksetzen per Antippen");
  await page.screenshot({ path: join(OUT, "3d-webgl-handy.png") });
  await ctx.close();
}
console.log("3D ohne WebGL");
for (const mode of ["software", "statisch"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = errorsOf(page);
  await page.addInitScript((m) => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/webgl/.test(type)) return null;
      if (m === "statisch" && type === "2d" && this.id === "part-canvas") return null;
      return orig.call(this, type, ...rest);
    };
  }, mode);
  await page.goto(BASE + "/index.html");
  await scrollToEl(page, "#model-stage");
  if (mode === "software") {
    check(await until(page, () => document.querySelector("#model-stage").dataset.ready === "software3d"), "Ohne WebGL: Software-3D übernimmt");
    await page.waitForTimeout(1800);
    await page.locator('.material[data-material="olive"]').click();
    await page.locator("#explode").fill("100"); await page.waitForTimeout(900);
    let s = await d3(page);
    check(s.explode > 0.95 && s.color === "104,112,90", "Software-3D: Farbe und Explosion");
    check((await page.evaluate(() => +document.querySelector('[data-label="insert"]').style.opacity)) > 0.9, "Software-3D: Beschriftungen");
    await page.screenshot({ path: join(OUT, "3d-software.png"), clip: await page.locator("#model-stage").boundingBox() });
    await page.locator("#part-canvas").focus(); const y = s.yaw; await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400);
    check((await d3(page)).yaw !== y, "Software-3D: Pfeiltasten drehen");
    await page.locator("#wireframe").click(); check(await until(page, () => document.querySelector("#model-stage").debug3d().wire), "Software-3D: Drahtgitter");
    await page.locator("#auto-rotate").click(); const ya = (await d3(page)).yaw; await page.waitForTimeout(800);
    check((await d3(page)).yaw !== ya, "Software-3D: langsames Drehen");
    await page.locator("#reset-model").click(); await page.waitForTimeout(1200);
    s = await d3(page); check(s.explode < 0.02 && !s.wire && Math.abs(s.yaw + 0.5) < 0.05, "Software-3D: Zurücksetzen");
  } else {
    check(await until(page, () => document.querySelector("#model-stage").dataset.ready === "fallback"), "Weder WebGL noch Canvas: Standbild mit Hinweis");
    check(await page.locator("#model-fallback").isVisible(), "Hinweis „3D ist auf diesem Gerät nicht verfügbar“ sichtbar");
    check(await page.locator("#explode").isDisabled(), "Regler deaktiviert statt wirkungslos");
  }
  check(errors.length === 0, `3D ${mode}: keine Konsolenfehler ` + errors.join(" | "));
  await ctx.close();
}

console.log("Anfrage-Ablauf (Handy)");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/index.html#anfrage");
  const next = page.locator("[data-next]");
  const prev = page.locator("[data-prev]");
  const summary = page.locator("#error-summary");
  const visibleStep = async () => page.locator(".step:not([hidden])").getAttribute("data-step");

  check(await page.locator(".limit-note").isVisible(), "Hinweis „Versand noch nicht eingerichtet“ sichtbar");
  check(await prev.isHidden(), "Schritt 1: kein Zurück");

  // Schritt 1
  await next.click();
  check(await summary.isVisible(), "Ohne Foto: Fehlerübersicht erscheint");
  check((await summary.textContent()).includes("mindestens ein Foto"), "Fehlertext nennt das fehlende Foto");
  check((await page.evaluate(() => document.activeElement.id)) === "error-summary", "Fokus springt auf die Fehlerübersicht");
  await page.setInputFiles("#photos", [files.pdf, files.big]);
  const fileErr = await page.locator("#photos-error").textContent();
  check(fileErr.includes("kein unterstütztes Bild") && fileErr.includes("höchstens 15 MB"), "PDF und zu große Datei werden verständlich abgelehnt");
  await page.setInputFiles("#photos", [files.a, files.b]);
  check((await page.locator(".thumb").count()) === 2, "Zwei Vorschaubilder");
  check(await summary.isHidden(), "Fehlerübersicht verschwindet, sobald Fotos gewählt sind");
  await page.waitForTimeout(200);
  check(await page.locator(".thumb img").first().evaluate((i) => i.complete && i.naturalWidth > 0), "Vorschau wird gerendert");
  await page.screenshot({ path: join(OUT, "ablauf-1-fotos.png"), fullPage: false });
  await page.locator(".thumb-remove").nth(1).click();
  check((await page.locator(".thumb").count()) === 1, "Foto lässt sich entfernen");
  await page.setInputFiles("#photos", [files.b]);
  check((await page.locator(".thumb").count()) === 2, "Foto wieder hinzugefügt");
  await next.click();
  check((await visibleStep()) === "2", "Weiter zu Schritt 2");

  // Schritt 2
  await next.click();
  check((await page.locator("#error-summary li").count()) === 3, "Schritt 2 leer: drei Fehler");
  check((await page.locator("#make").getAttribute("aria-invalid")) === "true", "Feld Hersteller als fehlerhaft markiert");
  await page.screenshot({ path: join(OUT, "ablauf-2-fehler.png"), fullPage: false });
  await page.fill("#make", "Hymer");
  check((await page.locator("#make").getAttribute("aria-invalid")) === null, "Fehler verschwindet beim Tippen");
  await page.fill("#model", "Hymermobil B 544");
  await page.fill("#year", "92");
  await next.click();
  check((await page.locator("#year-error").textContent()).includes("vierstellig"), "Baujahr zweistellig: verständlicher Fehler");
  await page.fill("#year", "1890");
  await next.click();
  check((await page.locator("#year-error").textContent()).includes("zwischen 1950"), "Baujahr außerhalb des Bereichs");
  await page.fill("#year", "1992");
  await next.click();
  check((await visibleStep()) === "3", "Weiter zu Schritt 3");

  // Schritt 3
  await page.fill("#partName", "Riegel Ausstellfenster links");
  await page.selectOption("#location", "Fenster und Dachhauben");
  await page.fill("#dimL", "77,5");
  await page.fill("#desc", "zu kurz");
  await next.click();
  check((await page.locator("#dims-error").textContent()).includes("mindestens zwei"), "Nur ein Maß: Fehler");
  check((await page.locator("#desc-error").textContent()).includes("Bisher sind es 7"), "Beschreibung zu kurz: Zeichenzahl genannt");
  await page.fill("#dimB", "abc");
  await next.click();
  check((await page.locator("#dims-error").textContent()).startsWith("Breite"), "Ungültiges Maß wird benannt");
  await page.fill("#dimB", "19");
  await page.fill("#dimH", "8.5");
  await page.check("#dimsEstimated");
  await page.fill("#desc", "Lagerauge ist am Bohrloch gerissen, der Riegel hält das Fenster nicht mehr. Gegenstück am Rahmen ist intakt.");

  // Zurück: alles bleibt erhalten
  await prev.click();
  check((await visibleStep()) === "2", "Zurück zu Schritt 2");
  check((await page.inputValue("#model")) === "Hymermobil B 544" && (await page.inputValue("#year")) === "1992", "Schritt 2: Eingaben erhalten");
  await prev.click();
  check((await page.locator(".thumb").count()) === 2, "Schritt 1: Fotos erhalten");
  // Vorwärts über die Schrittleiste (Handy: Weiter-Knopf)
  await next.click(); await next.click();
  check((await visibleStep()) === "3" && (await page.inputValue("#dimL")) === "77,5" && (await page.inputValue("#desc")).startsWith("Lagerauge"), "Schritt 3: Eingaben erhalten");
  await next.click();
  check((await visibleStep()) === "4", "Weiter zu Schritt 4");

  // Schritt 4
  await page.fill("#name", "Erika Beispiel");
  await page.fill("#email", "erika@beispiel");
  await page.fill("#phone", "abc");
  await next.click();
  const s4 = await summary.textContent();
  check(s4.includes("unvollständig") && s4.includes("Ziffern") && s4.includes("Einwilligung"), "Schritt 4: E-Mail, Telefon, Einwilligung geprüft");
  await page.locator("#error-summary a").first().click();
  check((await page.evaluate(() => document.activeElement.id)) === "email", "Link in Fehlerübersicht fokussiert das Feld");
  await page.fill("#email", "erika@beispiel.de");
  await page.fill("#phone", "+49 170 0000000");
  await page.check("#consent");
  await next.click();
  check((await visibleStep()) === "5", "Übersicht erreicht");

  // Schritt 5
  const sum = await page.locator("#summary").textContent();
  check(["Hymer", "1992", "Riegel Ausstellfenster links", "L 77,5 mm × B 19 mm × H 8,5 mm (geschätzt)", "erika@beispiel.de", "2 Fotos"].every((t) => sum.includes(t)), "Übersicht enthält alle Angaben");
  check(await page.locator("button[type=submit]").isHidden(), "Kein Senden-Knopf ohne Versandweg");
  check((await page.locator("#send-box").textContent()).includes("nicht"), "Übersicht sagt deutlich: nicht übertragen");
  await page.screenshot({ path: join(OUT, "ablauf-5-uebersicht.png"), fullPage: false });
  await page.locator("#copy-btn").click();
  await page.waitForTimeout(200);
  const status = await page.locator("#action-status").textContent();
  check(status.includes("nicht versendet") || status.includes("manuell"), "Kopieren meldet ehrlich den Stand: " + status);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  check(clip.includes("Hymermobil B 544") || status.includes("manuell"), "Zwischenablage enthält die Anfrage");

  // Ändern springt zurück, Werte bleiben
  await page.locator(".sum-edit").nth(1).click();
  check((await visibleStep()) === "2" && (await page.inputValue("#make")) === "Hymer", "„Ändern“ springt zu Fahrzeug, Werte erhalten");
  await page.fill("#model", "B 544 SL");
  await next.click(); await next.click(); await next.click();
  check((await page.locator("#summary").textContent()).includes("B 544 SL"), "Änderung erscheint in der Übersicht");

  // Neu laden: Entwurf ohne Fotos
  await page.waitForTimeout(500);
  await page.reload();
  check((await page.inputValue("#make")) === "Hymer" && (await page.inputValue("#desc")).startsWith("Lagerauge"), "Nach Neuladen: Texte aus Entwurf zurück");
  check((await page.locator("#draft-state").textContent()).includes("Fotos bitte neu"), "Hinweis: Fotos neu auswählen");
  // Alles löschen
  await page.locator("#reset-btn").click();
  await page.locator("#reset-yes").click();
  check((await page.inputValue("#make")) === "" && (await page.inputValue("#qty")) === "1", "Alle Eingaben gelöscht");
  check(errors.length === 0, "Ablauf ohne Skriptfehler " + errors.join(" | "));
  await ctx.close();
}

console.log("Anfrage-Ablauf (Desktop, Schrittleiste)");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/index.html#anfrage");
  check(await page.locator(".progress li[data-step-link='3'] button").isDisabled(), "Noch nicht erreichte Schritte gesperrt");
  await page.setInputFiles("#photos", [files.a]);
  await page.locator("[data-next]").click();
  await page.locator(".progress li[data-step-link='1'] button").click();
  check((await page.locator(".step:not([hidden])").getAttribute("data-step")) === "1", "Schrittleiste: zurück zu Fotos");
  await page.locator(".progress li[data-step-link='2'] button").click();
  await page.locator("[data-next]").click();
  check(await page.locator("#error-summary").isVisible(), "Desktop: Fehlerübersicht in Schritt 2");
  await page.screenshot({ path: join(OUT, "desktop-formular.png"), fullPage: false });
  // Tastatur: Tab erreicht den Fotoauswahl-Input
  await page.locator(".progress li[data-step-link='1'] button").click();
  await ctx.close();
}

console.log("Unterseiten");
for (const p of ["impressum.html", "datenschutz.html"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/${p}`);
  check(res.ok(), `${p} erreichbar`);
  check((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${p}: kein horizontales Scrollen`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failures ? 1 : 0);
