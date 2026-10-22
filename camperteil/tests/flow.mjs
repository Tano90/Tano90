// Browserprüfung: Darstellung (Handy/Desktop, hell/dunkel), Navigation und der gesamte Anfrage-Ablauf.
// Aufruf: BASE_URL=http://localhost:4173 node tests/flow.mjs
// Erwartet einen laufenden Server (npm run serve). Bildschirmfotos landen in test-results/.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const OUT = "test-results";
const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
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

const browser = await chromium.launch({ executablePath: EXE });

async function layoutPass(name, viewport, colorScheme, isMobile) {
  const ctx = await browser.newContext({ viewport, colorScheme, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `${name}: kein horizontales Scrollen (Überstand ${overflow}px)`);
  const fonts = await page.evaluate(() => ["Archivo Var", "Plex Sans", "Plex Mono"].map((f) => document.fonts.check(`16px "${f}"`)));
  check(fonts.every(Boolean), `${name}: eigene Schriften geladen (${fonts.join(",")})`);
  // Ziele kleiner als 40px auf dem Handy finden
  if (isMobile) {
    const small = await page.evaluate(() => [...document.querySelectorAll("a, button, input, select, textarea, summary")]
      .filter((n) => n.offsetParent && !n.classList.contains("visually-hidden") && !n.closest(".skip"))
      .map((n) => ({ n: (n.textContent || n.id || n.tagName).trim().slice(0, 30), r: n.getBoundingClientRect() }))
      .filter((x) => x.r.height < 40 && x.r.width > 0 && !["A"].includes(x.n)).map((x) => `${x.n} (${Math.round(x.r.height)}px)`));
    console.log("  info kleine Tippziele: " + (small.length ? small.join("; ") : "keine"));
  }
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  check(errors.length === 0, `${name}: keine Konsolenfehler ${errors.join(" | ")}`);
  await ctx.close();
}

console.log("Darstellung");
await layoutPass("desktop-hell", { width: 1440, height: 900 }, "light", false);
await layoutPass("desktop-dunkel", { width: 1440, height: 900 }, "dark", false);
await layoutPass("tablet-hell", { width: 820, height: 1180 }, "light", true);
await layoutPass("handy-hell", { width: 390, height: 844 }, "light", true);
await layoutPass("handy-dunkel", { width: 390, height: 844 }, "dark", true);
await layoutPass("handy-klein", { width: 320, height: 640 }, "light", true);

console.log("Navigation (Handy)");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/index.html");
  const toggle = page.locator(".nav-toggle");
  check(await toggle.isVisible(), "Menüknopf sichtbar");
  await toggle.click();
  check((await toggle.getAttribute("aria-expanded")) === "true", "Menü öffnet");
  await page.screenshot({ path: join(OUT, "handy-menue.png") });
  await page.locator("#nav-list a", { hasText: "Ablauf" }).click();
  await page.waitForTimeout(900);
  check((await toggle.getAttribute("aria-expanded")) === "false", "Menü schließt nach Klick");
  const top = await page.evaluate(() => document.querySelector("#ablauf").getBoundingClientRect().top);
  check(top >= 0 && top < 140, `Sprung zu „Ablauf“ (Abstand oben ${Math.round(top)}px)`);
  check(await page.locator("[data-mobile-cta]").evaluate((n) => n.classList.contains("is-visible")), "Mobile Schaltfläche erscheint außerhalb des Heros");
  await page.locator("[data-mobile-cta]").click();
  await page.waitForTimeout(900);
  check(!(await page.locator("[data-mobile-cta]").evaluate((n) => n.classList.contains("is-visible"))), "Mobile Schaltfläche verschwindet am Formular");
  await toggle.click();
  await page.keyboard.press("Escape");
  check((await toggle.getAttribute("aria-expanded")) === "false", "Escape schließt Menü");
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
