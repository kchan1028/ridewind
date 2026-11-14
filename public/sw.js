/*
 * RideWind service worker: keeps the app itself available without a connection.
 *
 * Only this site's own files are cached. Map tiles (OpenStreetMap) and forecast
 * requests (Open-Meteo) are never intercepted: the OSM tile policy forbids
 * offline caching, and forecasts have their own saved-route fallback in the app.
 *
 * - The page: network first, so a new release shows up straight away; the
 *   cached copy is used when the network fails.
 * - Built files under assets/: cache first. Their names contain a content hash,
 *   so a cached copy is always correct. Files the current page no longer uses
 *   are removed whenever a fresh page arrives, so the cache doesn't grow.
 * - Anything else of ours (sample routes, the icon): network first, cache fallback.
 */
const CACHE = 'ridewind-shell-v1';
const scope = self.registration.scope; // e.g. https://example.github.io/ridewind/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(scope))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ridewind-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // tiles and forecasts: straight to the network
  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request));
  } else if (url.pathname.startsWith(new URL(scope).pathname + 'assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

async function pageNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const html = await response.clone().text();
      await cache.put(scope, response.clone());
      await pruneAssets(cache, html);
    }
    return response;
  } catch (err) {
    const cached = await cache.match(scope);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/** Removes cached assets/ files that the given page no longer references. */
async function pruneAssets(cache, html) {
  const used = new Set(html.match(/assets\/[\w.-]+/g) ?? []);
  const assetsPath = new URL(scope).pathname + 'assets/';
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith(assetsPath) && !used.has('assets/' + path.slice(assetsPath.length))) await cache.delete(request);
  }
}
