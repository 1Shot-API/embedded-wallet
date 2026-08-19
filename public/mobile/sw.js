/* Minimal service worker for Chromium PWA installability (/mobile/ scope). */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-only — do not cache wallet/Signing assets.
  event.respondWith(fetch(event.request));
});
