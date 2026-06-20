// Service worker for the BAMZOOKi reconstruction PWA.
// Strategy:
//   - Precache the app shell so the app launches offline.
//   - Runtime cache-first for everything else (CDN modules, extracted assets),
//     so the game becomes fully offline-capable after the first online run.

const VERSION = "bamzooki-v1";
const SHELL = [
  "./",
  "./index.html",
  "./main.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Cache successful (or opaque CDN) responses for next time.
          if (response && (response.ok || response.type === "opaque")) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline and not cached: let it fail gracefully
    })
  );
});
