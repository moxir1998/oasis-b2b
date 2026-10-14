/* Oasis B2B service worker: приложение работает офлайн, карта кэширует просмотренные районы */
const VERSION = "oasis-b2b-v4";
const SHELL = ["./", "index.html", "data.js", "playbooks.js", "leaflet.js", "leaflet.css",
  "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
const TILE_CACHE = "oasis-tiles-v2";
const TILE_LIMIT = 1500;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== VERSION && k !== TILE_CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
async function trimTiles() {
  const c = await caches.open(TILE_CACHE); const keys = await c.keys();
  for (let i = 0; i < keys.length - TILE_LIMIT; i++) await c.delete(keys[i]);
}
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(url.host)) {
    e.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) { c.put(e.request, r.clone()); trimTiles(); } return r; }
      catch (_) { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // сначала сеть (свежая версия), без сети — из кэша
  e.respondWith(caches.open(VERSION).then(async c => {
    try {
      const r = await Promise.race([fetch(e.request, { cache: "no-cache" }), new Promise((_, rej) => setTimeout(() => rej("timeout"), 4000))]);
      if (r && r.ok) c.put(e.request, r.clone());
      return r;
    } catch (_) {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match("index.html")) || Response.error();
    }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(list => {
    for (const w of list) { if ("focus" in w) return w.focus(); }
    return self.clients.openWindow("./#today");
  }));
});
