const CACHE_VERSION = 'v2';
const CACHE_NAME = `my-app-cache-${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png'
];

// Cache app shell on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Helper to notify all clients
function notifyClients(data) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(data));
  });
}

// ❗ NEW: Listen for manual update request
self.addEventListener('message', async event => {
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    console.log("SW: Starting manual update…");

    const cache = await caches.open(CACHE_NAME);

    for (const url of urlsToCache) {
      try {
        console.log("SW: Fetching", url);
        const response = await fetch(url, { cache: 'reload' });
        await cache.put(url, response);
      } catch (err) {
        console.error("SW: Failed to update", url, err);
      }
    }

    console.log("SW: Update complete");
    notifyClients({ updated: true });
  }
});

// ❗ NEW: Cache-first fetch handler (no auto-updating)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached; // Always prefer cached version
      }

      // If not cached, fetch from network
      return fetch(event.request)
        .then(response => response)
        .catch(() => caches.match('/index.html'));
    })
  );
});
