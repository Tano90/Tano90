// Service worker for housekeeping: the room board opens without network (cellar, laundry) from the last copy.
// Pages: network first, the copy only when offline. Static build files: from the cache once loaded.
const CACHE = "mirepa-hk-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) ?? fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
    return;
  }
  if (req.mode === "navigate" && url.pathname.startsWith("/housekeeping")) {
    event.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) c.put(url.pathname, res.clone());
        return res;
      } catch {
        return (await c.match(url.pathname)) ?? (await c.match("/housekeeping")) ?? Response.error();
      }
    })());
  }
});
