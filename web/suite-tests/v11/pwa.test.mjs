// PWA: every file the suite loads is in the offline shell of the service worker, and each release has a new cache name
// (old caches are deleted on activation, the network is asked first, so an update arrives with the next load).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../../public/suite/", import.meta.url);
const html = readFileSync(new URL("index.html", dir), "utf8");
const sw = readFileSync(new URL("sw.js", dir), "utf8");

test("Offline-Shell enthält alle Skripte, Styles und Module der Suite", () => {
  const local = [...html.matchAll(/(?:src|href)="(src\/[^"]+|manifest\.webmanifest)"/g)].map((m) => m[1]);
  assert.ok(local.length > 20);
  for (const f of local) assert.ok(sw.includes(`"./${f}"`), `fehlt im Service Worker: ${f}`);
  for (const f of readdirSync(new URL("src/v11/", dir))) assert.ok(sw.includes(`"./src/v11/${f}"`), `fehlt: src/v11/${f}`);
});
test("Cache-Name versioniert, alte Caches werden gelöscht, Netzwerk zuerst, Cloud-Daten nie im Cache", () => {
  assert.match(sw, /const NAME = "glb-v11-shell-\d{8}[a-z]"/);
  assert.match(sw, /keys\.filter\(\(k\) => k !== NAME\)/);
  assert.match(sw, /fetch\(req\)/);
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
  assert.match(sw, /\/api\//);
});
