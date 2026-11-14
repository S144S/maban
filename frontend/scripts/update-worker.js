// Online-only: never cache API responses, pages, or financial data.
// The build adds a fingerprint so every changed build has a new worker.
self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// An explicitly requested reload must retrieve the current HTML from the server.
self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
  }
});
