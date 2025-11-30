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

let offlineState = null;

function notifyClients(state) {
  if (state !== offlineState) {
    offlineState = state;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ offline: state }));
    });
  }
}

event.respondWith(
  fetch(event.request).then(response => {
    notifyClients(false); // online
    return response;
  }).catch(() => {
    return caches.match(event.request).then(cachedResponse => {
      notifyClients(true); // offline
      return cachedResponse || new Response('Offline resource not available', { status: 404 });
    });
  })
);
