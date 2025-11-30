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
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Notify page we’re offline (served from cache)
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ offline: true }));
          console.log('tell client to show banner')
        });
        return cachedResponse;
      }

      // Otherwise, try network
      return fetch(event.request).then(response => {
        // Notify page we’re online
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ offline: false }));
          console.log('tell client to hide banner')
        });
        return response;
      }).catch(() => {
        // Network failed and no cache
        return new Response('Offline resource not available', {
          status: 404,
          statusText: 'Not Found'
        });
      });
    })
  );
});


