// Afterlight service worker.
//
// It caches the application shell so the app opens with no network — a patient recording a
// symptom on a train should not be blocked by connectivity. It caches NOTHING about the record
// itself: there is no user data on the network to cache, and there never will be.

const VERSION = "afterlight-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // The page asks for the update to take effect; we never reload someone mid-entry on our own.
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: serve the shell when offline so the app still opens.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match("./index.html", { ignoreVary: true, ignoreSearch: true })
          .then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  // Static assets: cache-first, and fill the cache as they are requested. Asset filenames are
  // content-hashed, so a cached asset is never stale.
  // ignoreVary matters: a precached response can carry a Vary header (Accept-Encoding, typically)
  // that does not match the page's own request, and the asset would then quietly fail offline —
  // which is the one moment it must not.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
    }),
  );
});
