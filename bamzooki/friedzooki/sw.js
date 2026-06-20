// Service worker — precache the app shell, runtime cache-first for everything
// else (Three.js, Rapier WASM, fonts), so FriedZooki runs offline after first use.
const VERSION = "friedzooki-v1";
const SHELL = [
  "./", "./index.html", "./theme.css", "./manifest.webmanifest",
  "./src/main.js", "./src/engine.js", "./src/physics.js", "./src/zook.js",
  "./src/arena.js", "./src/contests.js", "./src/builder.js", "./src/storage.js",
  "./src/ar.js", "./src/sound.js", "./src/fx.js",
  "./src/net.js", "./src/joystick.js",
  "./assets/frame-green.png", "./assets/frame-dashed.png",
  "./assets/blob-yellow.png", "./assets/bubble-pink.png",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res && (res.ok || res.type === "opaque")) {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => hit)));
});
