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
  const url = new URL(event.request.url); 
  
  // Don't intercept Firebase Auth 
  if (url.origin.includes('googleapis.com') || url.origin.includes('gstatic.com')) { 
    return; 
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      fetch(event.request)
        .then(response => {
          cache.put(event.request, response.clone()); // <-- update cache
          notifyClients({ offline: false, syncedAt: Date.now() });
          return response;
        })
        .catch(() => {
          notifyClients({ offline: true });
          return caches.match(event.request);
        })
    )
  );
});
