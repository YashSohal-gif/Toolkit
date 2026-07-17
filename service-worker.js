/* KBResize service worker — keeps tool pages usable offline once opened.

   Strategy is deliberately the OPPOSITE of the naive default:
   - Our OWN files (HTML/CSS/JS) use network-first. These change as the site
     is developed/deployed, so a visitor must always get the latest version
     when online; the cache is only a fallback for when they're offline.
     (Cache-first here would mean every edit after the first visit is
     invisible to a returning visitor until the browser cache is manually
     cleared — silently "sticky" stale bugs.)
   - Third-party CDN libraries (pdf.js, jsPDF, ...) use cache-first, which
     is safe because their URLs are pinned to an exact version number and
     never change content for the same URL — instant load, no staleness risk. */

const CACHE_NAME = 'kbresize-v2';
const APP_SHELL = [
  '/index.html',
  '/css/style.css',
  '/js/theme.js',
  '/js/homepage-interactive.js',
  '/js/ad-gate.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isOwnOrigin = url.origin === self.location.origin;

  if (isOwnOrigin) {
    // Network-first for our own site files — always fetch the latest when
    // online; cache is purely an offline fallback, never shown over a
    // successful network response.
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    // Cache-first for CDN libraries — safe because these URLs are pinned to
    // an exact version and never change content, so a cache hit is always
    // correct and skips a network round-trip entirely.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        });
      })
    );
  }
});
