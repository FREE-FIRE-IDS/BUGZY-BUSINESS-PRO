const CACHE_NAME = 'bugzy-pro-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We don't cache anything for now to ensure Supabase and other dynamic features work perfectly.
  // The presence of this fetch handler is enough to make the app installable.
  event.respondWith(fetch(event.request));
});
