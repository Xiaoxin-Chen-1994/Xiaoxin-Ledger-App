const CACHE_NAME = 'ledger-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png'
];

// ✅ Cache app shell on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// ✅ Notify UI helper
function notifyClients(data) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(data));
  });
}

// ✅ Network-first for everything, fallback to cache for app shell
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        notifyClients({ offline: false, syncedAt: Date.now() });
        return response;
      })
      .catch(() => {
        notifyClients({ offline: true });
        return caches.match(event.request);
      })
  );
});
