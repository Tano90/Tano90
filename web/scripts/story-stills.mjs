// Still images of the 3D story for the version without animation (reduced motion, no WebGL).
// Rendered from the same scene: BASE_URL=http://localhost:3300 node scripts/story-stills.mjs
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3300";
const b = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
await p.goto(BASE + "/?story=anim");
await p.waitForFunction(() => document.querySelector("#geschichte canvas")?.classList.contains("opacity-100"), null, { timeout: 60000 });
// only the 3D picture: hide texts, cards and buttons
await p.addStyleTag({ content: "#geschichte .sticky > :not(canvas){visibility:hidden!important}" });
for (const [n, t] of [[2, 0.22], [3, 0.47], [4, 0.62], [6, 0.81]]) {
  await p.evaluate((t) => { const s = document.querySelector("#geschichte"); window.scrollTo(0, s.getBoundingClientRect().top + scrollY + t * (s.offsetHeight - innerHeight)); }, t);
  await p.waitForTimeout(2500);
  const file = `public/story/still-${n}.png`;
  await p.locator("#geschichte canvas").screenshot({ path: file });
  execFileSync("python3", ["-c", `from PIL import Image; Image.open("${file}").convert("RGB").save("${file.replace(".png", ".jpg")}", quality=80, optimize=True, progressive=True)`]);
  execFileSync("rm", [file]);
}
await b.close();
console.log("stills written");
