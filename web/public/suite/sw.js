/* PWA shell cache ONLY. Cloud data and Supabase authentication MUST NEVER be cached. */
const NAME = "glb-v11-shell-20261022d";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./config.js",
  "./src/style.css",
  "./src/v04.css",
  "./src/v05.css",
  "./src/v06.css",
  "./src/cloud.css",
  "./src/v08.css",
  "./src/mobile.css",
  "./src/core.js",
  "./src/v04core.js",
  "./src/v05core.js",
  "./src/v06core.js",
  "./src/v08roles.js",
  "./src/v08menu.js",
  "./src/app.js",
  "./src/cloud.js",
  "./src/v08ui.js",
  "./src/mobile.js",
  "./src/market-plus.js",
  "./src/xlsx.js",
  "./src/calm.css",
  "./src/a11y.js",
  "./src/v11.css",
  "./src/v11/ui.mjs",
  "./src/v11/core.mjs",
  "./src/v11/intelligence.mjs",
  "./src/v11/demo.mjs",
  "./src/v11/cloud.mjs",
  "./src/v11/tasks.mjs",
  "./src/v11/market.mjs",
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(NAME).then(async (c) => {
      for (const url of SHELL) {
        try {
          await c.add(url);
        } catch (_) {
          /* optional offline shell */
        }
      }
    }),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/") || url.pathname.endsWith("/sw.js")) return;
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(NAME).then((c) => c.put(req, copy));
        }
        return r;
      })
      .catch(() => caches.match(req)),
  );
});
