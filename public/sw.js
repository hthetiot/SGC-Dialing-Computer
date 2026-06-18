// sw.js — Service worker for offline-capable PWA.
// Caches the app shell on install and serves cache-first, falling back to network.

const CACHE = "sgc-dialer-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/gate.svg",
  "./src/main.js",
  "./src/screen.js",
  "./src/gate.js",
  "./src/hud.js",
  "./src/dialer.js",
  "./src/debug.js",
  "./src/logo.js",
  "./src/sound.js",
  "./src/addresses.js",
  "./src/layout.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // runtime-cache successful same-origin + CDN module responses
          const url = new URL(req.url);
          const cacheable = res.ok && (url.origin === location.origin ||
            url.host.includes("cdn.jsdelivr.net") || url.host.includes("jsdelivr"));
          if (cacheable) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
