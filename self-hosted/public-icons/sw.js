// Minimal service worker: it exists so phones offer "Add to Home Screen".
// It never intercepts or caches requests, so the app always loads the latest files.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
