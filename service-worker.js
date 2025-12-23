const CACHE_NAME = 'ledger-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png'
];

// INSTALL: Pre-cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Helper: Notify all open clients (UI pages)
function notifyClients(data) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(data));
  });
}

// FETCH: Network-first + runtime caching + offline fallback
self.addEventListener('fetch', event => {
  const request = event.request;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Notify UI that we are online
        notifyClients({ offline: false, syncedAt: Date.now() });

        // Runtime caching: store a copy of the fresh response
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => {
          cache.put(request, copy);
        });

        return response;
      })
      .catch(async () => {
        // Network failed → offline
        notifyClients({ offline: true });

        // Try runtime cache first, then app shell cache
        const cached = await caches.match(request);
        return cached || Response.error();
      })
  );
});
