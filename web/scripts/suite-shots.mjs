// Screenshots and a short walkthrough video of the GLB AI Suite dashboard (public/suite, demo data) for the
// landing page, into public/landing/. Run again after the suite changes.
//   npm run build && ALLOW_DEMO=1 npx next start -p 3300   (without GLB_SUPABASE_*: the suite runs as a browser demo)
//   BASE_URL=http://localhost:3300 node scripts/suite-shots.mjs     (needs ffmpeg for the video)
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const out = (name) => resolve(here, "../public/landing", name);
const base = process.env.BASE_URL ?? "http://localhost:3300";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-proxy-server"] });

async function open(page, view) {
  await page.click(`#sidebar [data-view="${view}"]`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector("#main")?.scrollTo?.(0, 0); document.querySelector("#sidebar")?.scrollTo?.(0, 0); });
  await page.waitForTimeout(200);
}

// Desktop screenshots
const SHOTS = ["overview", "reports", "funnel", "portfolio", "costs", "lifecycle", "market", "purchasing", "inventory", "insights", "recipes", "menuimport", "v11cockpit", "v11funnel", "v11training", "v11market", "v11menu", "v11tasks"];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "de-DE", timezoneId: "Europe/Berlin" });
await page.goto(`${base}/suite`);
await page.waitForSelector("#sidebar [data-view]");
for (const v of SHOTS) {
  await open(page, v);
  await page.screenshot({ path: out(`suite-${v}.png`) });
}

// Phone: the service funnel as staff see it after service
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" });
await phone.goto(`${base}/suite`);
await phone.waitForTimeout(1000);
await phone.screenshot({ path: out("suite-mobile.png") });

// Walkthrough video: frames captured while moving through the modules, put together with ffmpeg as H.264 mp4.
const dir = mkdtempSync(join(tmpdir(), "glb-video-"));
const v = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: "de-DE", timezoneId: "Europe/Berlin" });
await v.goto(`${base}/suite`);
await v.waitForSelector("#sidebar [data-view]");
let frame = 0;
const grab = async (n, scroll = 0) => {
  for (let i = 0; i < n; i++) {
    if (scroll) await v.mouse.wheel(0, scroll);
    await v.screenshot({ path: join(dir, `f${String(frame++).padStart(5, "0")}.jpg`), type: "jpeg", quality: 85 });
  }
};
await v.mouse.move(900, 450);
await grab(20);
for (const view of ["reports", "funnel", "portfolio", "costs", "lifecycle", "market", "purchasing", "insights"]) {
  await open(v, view);
  await v.mouse.move(900, 450);
  await grab(14);
  await grab(16, 22);
}
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "10", "-i", join(dir, "f%05d.jpg"), "-vf", "fps=30,scale=1280:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out("suite-rundgang.mp4")]);
rmSync(dir, { recursive: true, force: true });

await browser.close();
console.log("suite screenshots and video written");
