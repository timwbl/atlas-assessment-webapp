const CACHE_NAME = "atlas-mobile-v3-10-1";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/atlas-logo.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (url.pathname.startsWith("/admin")) return;
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  // Next.js build assets are content-hashed and managed by the browser/CDN.
  // Caching them here can keep an old deploy alive and cause ChunkLoadError
  // when a previously opened page requests a chunk that no longer exists.
  if (url.pathname.startsWith("/_next/")) return;

  if (url.pathname.startsWith("/api/assessments")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/assets/")
    || url.pathname === "/atlas-logo.svg"
    || url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request))
      || (fallbackPath ? await cache.match(fallbackPath) : undefined)
      || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    void fetch(request)
      .then((response) => {
        if (response.ok) return cache.put(request, response);
      })
      .catch(() => undefined);
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
