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
  const req = event.request;
  const url = new URL(req.url);

  // 1. Never intercept Firebase Auth
  if (url.origin.includes('googleapis.com') || url.origin.includes('gstatic.com')) {
    return;
  }

  // 2. Never intercept navigation requests (iOS breaks here)
  if (req.mode === 'navigate') {
    return;
  }

  // 3. Never intercept HTML files
  if (req.destination === 'document') {
    return;
  }

  // 4. Never intercept JS modules (iOS sometimes blocks them)
  if (req.destination === 'script') {
    return;
  }

  // 5. Never intercept CSS (iOS sometimes blocks them)
  if (req.destination === 'style') {
    return;
  }

  // 6. Only intercept safe static assets (images, icons, fonts)
  event.respondWith(
    fetch(req)
      .then(response => {
        notifyClients({ offline: false, syncedAt: Date.now() });
        return response;
      })
      .catch(() => {
        notifyClients({ offline: true });
        return caches.match(req);
      })
  );
});

