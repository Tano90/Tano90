// Run against a local demo server (ALLOW_DEMO=1 next start -p 3300): node scripts/journeys.mjs
// Customer journeys A–D at six widths, Chromium with phone/tablet emulation (no real device). Nothing is submitted.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3300";
const OUT = process.env.OUT_DIR || "test-results/journeys";
mkdirSync(OUT, { recursive: true });
const WIDTHS = [[360, 780], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]];
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const rows = [];
for (const [w, h] of WIDTHS) {
  const touch = w < 1024;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < 700, locale: "de-DE", timezoneId: "Europe/Berlin" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("dialog", (d) => d.accept());
  const res = {};
  const step = async (key, fn) => { try { await fn(); res[key] = res[key] ?? "ok"; } catch (e) { res[key] = "FEHLER: " + String(e.message || e).split("\n")[0].slice(0, 140); } };
  const noX = async (where) => { const d = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (d > 0) throw new Error(`${where}: ${d}px Querscroll`); };
  const tap = (loc) => (touch ? loc.tap() : loc.click());
  // A: offer → prices → calculator → demo request form (filled, NOT submitted)
  await step("A", async () => {
    await p.goto(BASE + "/"); await noX("Start");
    const cta = p.getByRole("link", { name: /Mit eigenen Daten vorführen lassen/ }).first();
    await cta.waitFor();
    await p.locator("#preise").scrollIntoViewIfNeeded(); await noX("Preise");
    const input = p.getByLabel("Anzahl Nutzer"); await input.fill("5");
    const t = (await p.locator('dl[data-plan="standard"] [data-total]').innerText()).replace(/\s/g, " ");
    const t2 = (await p.locator('dl[data-plan="premium"] [data-total]').innerText()).replace(/\s/g, " ");
    if (t !== "103,95 €" || t2 !== "124,94 €") throw new Error(`Rechner ${t} / ${t2}`);
    await tap(cta); await p.waitForTimeout(400);
    const form = p.locator("#anfrage form"); await form.waitFor();
    await form.getByLabel(/Name/).first().fill("Test Person");
    await form.getByLabel(/E-Mail/).first().fill("test@example.com");
    const btn = form.getByRole("button", { name: "Vorführung anfragen" });
    const bb = await btn.boundingBox(); if (bb.height < 40) throw new Error("Absenden-Knopf zu klein");
    await noX("Anfrage");
    await p.screenshot({ path: `${OUT}/A-${w}.png` });
  });
  // B: demo → KPIs → problem → detail (target price) and Bar → Limonade → lifecycle
  await step("B", async () => {
    await p.goto(BASE + "/suite"); await p.evaluate(() => localStorage.clear()); await p.goto(BASE + "/suite#overview");
    await p.waitForFunction(() => window.GLBSuite && window.GLBV11);
    await p.getByText("NETTO-UMSATZ", { exact: false }).first().waitFor(); await noX("Übersicht");
    if (w < 761) { await tap(p.locator("[data-v6-filter-toggle]")); }
    const bar = await p.locator("#v6-filter-outlet option", { hasText: "Bar" }).first().getAttribute("value");
    await p.selectOption("#v6-filter-outlet", bar);
    if (w < 761) await tap(p.locator("[data-v6-filter-toggle]"));
    const lc = p.locator(".v6-action", { hasText: "Hausgemachte Limonade" }).getByRole("button", { name: /Verlauf ansehen/ });
    await lc.scrollIntoViewIfNeeded(); await tap(lc);
    await p.waitForFunction(() => location.hash === "#lifecycle");
    if ((await p.inputValue("#lc-outlet")) !== bar) throw new Error("Outlet nicht übernommen");
    await noX("Lebenszyklus");
    await p.goBack(); await p.waitForFunction(() => location.hash === "#overview");
    if ((await p.inputValue("#v6-filter-outlet")) !== bar) throw new Error("Filter nach Zurück verloren");
    await p.selectOption("#v6-filter-outlet", "all").catch(async () => { await tap(p.locator("[data-v6-filter-toggle]")); await p.selectOption("#v6-filter-outlet", "all"); });
    const cf = p.locator("[data-cost-focus]").first(); const id = await cf.getAttribute("data-cost-focus");
    await cf.scrollIntoViewIfNeeded(); await tap(cf);
    await p.waitForFunction(() => location.hash === "#costs"); await p.waitForTimeout(400);
    const row = p.locator(`#cost-row-${id}`);
    const inView = await p.waitForFunction((id) => { const r = document.querySelector("#cost-row-" + id); const x = r?.getBoundingClientRect(); return x && x.top < innerHeight && x.bottom > 0; }, id, { timeout: 3000 }).then(() => true, () => false);
    if (!inView || !(await row.getAttribute("class")).includes("row-focus")) throw new Error("Artikel nicht markiert/sichtbar");
    await noX("Zielpreise");
    await p.screenshot({ path: `${OUT}/B-${w}.png` });
  });
  // C: own data → menu import → first evaluation status
  await step("C", async () => {
    await p.evaluate(() => window.GLBAppSync.startBlank("Testbetrieb Geräte"));
    await p.evaluate(() => window.GLBSuite.navigate("menuimport")); await p.waitForTimeout(300);
    await p.locator("#v08-menu-text").fill("BURGER\nTestburger 16,90 €\nGETRÄNKE\nTestlimo 4,20 €");
    await tap(p.getByRole("button", { name: "Text erkennen" }));
    await p.locator(".v08-review-item").first().waitFor();
    await noX("Import-Vorschau");
    await tap(p.getByRole("button", { name: /Angehakte Artikel speichern/ }));
    await p.waitForFunction(() => window.GLBAppSync.snapshot().items.length === 2);
    await p.evaluate(() => window.GLBSuite.navigate("setup")); await p.waitForTimeout(300);
    const next = await p.locator(".v12-step.next h3").innerText();
    if (!/Verkäufe/.test(next)) throw new Error("nächster Schritt: " + next);
    await noX("Erste Schritte");
    await p.screenshot({ path: `${OUT}/C-${w}.png` });
  });
  // D: tasks and inventory quickly (demo)
  await step("D", async () => {
    await p.goto(BASE + "/suite"); await p.evaluate(() => localStorage.clear()); await p.goto(BASE + "/suite#v11tasks");
    await p.waitForFunction(() => window.GLBSuite && window.GLBV11);
    const form = p.locator("#v11-task-form");
    await form.getByLabel("Beschreibung").fill("Kühlraum prüfen");
    await form.getByLabel("Outlet").selectOption({ label: "Bar" });
    await tap(p.getByRole("button", { name: "Aufgabe erstellen" }));
    const t = p.locator(".v11-task", { hasText: "Kühlraum prüfen" }); await t.waitFor();
    await tap(t.locator(".v11-task-check"));
    await p.waitForFunction(() => window.GLBAppSync.snapshot().tasks.find((x) => x.title === "Kühlraum prüfen")?.status === "done");
    await noX("Aufgaben");
    await p.evaluate(() => window.GLBSuite.navigate("inventory")); await p.waitForTimeout(400);
    const cf = p.locator("#v4-count-form");
    await cf.locator("#v4-count-packs").scrollIntoViewIfNeeded();
    const mode = await cf.locator("#v4-count-packs").getAttribute("inputmode");
    if (mode !== "decimal") throw new Error("kein Ziffernblock");
    await cf.locator("#v4-count-packs").fill("2");
    const before = await p.evaluate(() => window.GLBAppSync.snapshot().inventoryCounts.length);
    await tap(cf.getByRole("button", { name: /Bestand buchen/ }));
    await p.waitForFunction((n) => window.GLBAppSync.snapshot().inventoryCounts.length > n, before);
    await noX("Inventur");
    await p.screenshot({ path: `${OUT}/D-${w}.png` });
  });
  res.errors = errs.length ? errs.slice(0, 3).join(" | ") : "keine";
  rows.push({ w, ...res });
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(rows, null, 1));
