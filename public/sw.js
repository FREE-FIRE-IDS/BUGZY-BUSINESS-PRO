const CACHE_NAME = 'bugzy-v13';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache critical assets
      return cache.addAll(['/', '/manifest.json']).then(() => {
        // Cache other assets without failing the whole install
        return Promise.allSettled(
          ASSETS.filter(a => a !== '/' && a !== '/manifest.json')
            .map(url => fetch(url).then(res => {
              if (res.ok) return cache.put(url, res);
            }))
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;

  // Navigation: Network-First with robust fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Correctly chain fallback promises
          return caches.match(event.request)
            .then(res => res || caches.match('/'))
            .then(res => res || caches.match('/index.html'));
        })
    );
    return;
  }

  // All other requests: Cache-First, then Network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && response.ok && isLocal) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);
    })
  );
});
