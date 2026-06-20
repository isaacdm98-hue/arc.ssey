// Service worker — NETWORK-FIRST for the app so a new deploy always wins and the
// app can never get stuck serving a stale, broken mix of cached files. Falls back
// to cache only when offline, so it still works as an offline PWA. Cross-origin
// requests (fonts, TTS) are cache-first.
const VERSION = "friedzooki-v3";
const SHELL = [
  "./", "./index.html", "./theme.css", "./manifest.webmanifest",
  "./vendor/three.module.js", "./vendor/rapier.es.js",
  "./src/main.js", "./src/engine.js", "./src/physics.js", "./src/zook.js",
  "./src/arena.js", "./src/contests.js", "./src/builder.js", "./src/storage.js",
  "./src/ar.js", "./src/sound.js", "./src/fx.js", "./src/orbit.js",
  "./src/textures.js", "./src/net.js", "./src/joystick.js", "./src/narrator.js",
  "./assets/frame-green.png", "./assets/frame-dashed.png",
  "./assets/blob-yellow.png", "./assets/bubble-pink.png",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    // Network-first: always try the latest, fall back to cache offline.
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
  } else {
    // Cross-origin (fonts, TTS): cache-first.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit)));
  }
});
