const CACHE_NAME = 'ledger-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icons/icon-192.png'
  ];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(response => {
      // Network succeeded → tell page to hide banner
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ offline: false }));
      });
      return response;
    }).catch(() => {
      // Network failed → try cache
      return caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // Tell page to show banner
          self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ offline: true }));
          });
          return cachedResponse;
        }
        // No cache and network failed
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ offline: true }));
        });
        return new Response('Offline resource not available', {
          status: 404,
          statusText: 'Not Found'
        });
      });
    })
  );
});



