const CACHE_NAME = 'bugzy-pwa-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png'
];

// Install event - cache static assets with individual error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching shell assets');
      // Use individual fetches to prevent one failure from blocking all
      return Promise.allSettled(
        STATIC_ASSETS.map(url => 
          fetch(url).then(response => {
            if (response.ok) return cache.put(url, response);
            throw new Error(`Failed to fetch ${url}`);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;

  // 1. Navigation requests: Network-First, Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // CRITICAL: Always return a 200 response for the root/index when offline
          return caches.match(event.request)
            .then(response => response || caches.match('/'))
            .then(response => response || caches.match('/index.html'))
            .then(response => {
              if (response) return response;
              // Final fallback if everything fails
              return new Response('<h1>Offline</h1><p>Please check your connection.</p>', {
                status: 200, // Lighthouse prefers 200 even for offline pages
                headers: new Headers({ 'Content-Type': 'text/html' })
              });
            });
        })
    );
    return;
  }

  // 2. Static Assets & Local Files: Cache-First, then Network
  if (isLocal) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // If it's an icon, we might want a fallback, but for now just fail gracefully
          return new Response('Not found', { status: 404 });
        });
      })
    );
    return;
  }

  // 3. External Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
