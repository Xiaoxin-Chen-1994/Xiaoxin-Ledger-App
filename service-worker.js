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

// Disable all caching
self.addEventListener('install', event => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Delete ALL caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  );

  // Take control of all pages immediately
  self.clients.claim();
});

// Always fetch from network, never use cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .catch(() => {
        // fallback only if offline AND request is navigation
        if (event.request.mode === 'navigate') {
          return fetch('/index.html', { cache: 'no-store' });
        }
      })
  );
});
