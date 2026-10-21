// Screenshots of the app (demo data) for the landing page, into public/landing/. Run again after design changes.
//   npm run build && ALLOW_DEMO=1 npx next start -p 3300   (without DATABASE_URL: the in-memory demo)
//   BASE_URL=http://localhost:3300 node scripts/landing-shots.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const out = (name) => resolve(here, "../public/landing", name);
const base = process.env.BASE_URL ?? "http://localhost:3300";
const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const cii = readFileSync(resolve(here, "../src/domain/fixtures/einvoice-cii.xml"), "utf8").replace("20261020", today);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE", timezoneId: "Europe/Berlin", reducedMotion: "reduce" });
const settle = () => page.waitForLoadState("networkidle").then(() => page.waitForTimeout(500));

await page.goto(`${base}/login`);
await page.getByRole("button", { name: "Anmelden" }).click();
await page.waitForURL(/\/app/);

await page.goto(`${base}/recipes/rec-linsensuppe`);
await settle();
await page.screenshot({ path: out("rezept-kalkulation.png") });

await page.goto(`${base}/analytics/funnel`);
await settle();
await page.screenshot({ path: out("service-funnel.png") });

// Contribution: the demo has no costs yet, so enter typical ones first (only in this in-memory demo).
await page.goto(`${base}/analytics/contribution`);
await page.getByLabel("Anteil vom Umsatz (%)").fill("2,5");
await page.getByLabel("Pro Artikel (€)").fill("0,10");
await page.getByRole("button", { name: "Speichern", exact: true }).click();
await page.getByText("Variable Kosten gespeichert").waitFor();
for (const [name, amount] of [["Miete", "2.400,00"], ["Energie", "650,00"], ["Versicherungen", "180,00"]]) {
  await page.getByRole("button", { name: "Fixkosten", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Bezeichnung").fill(name);
  await d.getByLabel("Betrag pro Monat (€, netto)").fill(amount);
  await d.getByRole("button", { name: "Speichern" }).click();
  await d.waitFor({ state: "hidden" });
}
// One day of demo sales against one day of fixed costs (a month of costs against one day of sales would mislead).
const y = new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
await page.goto(`${base}/analytics/contribution?from=${y}&to=${y}`);
await settle();
await page.screenshot({ path: out("deckungsbeitrag.png") });

await page.goto(`${base}/invoices`);
await page.getByLabel("E-Rechnung hochladen").setInputFiles({ name: "rechnung.xml", mimeType: "application/xml", buffer: Buffer.from(cii) });
await page.getByText("Gelesen. Bitte unten prüfen.").waitFor();
await settle();
await page.getByRole("region", { name: "E-Rechnung einlesen" }).screenshot({ path: out("e-rechnung.png") });

await browser.close();
console.log("landing screenshots written");
