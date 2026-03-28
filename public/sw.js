const CACHE_NAME = 'securesheet-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/sync.html',
  '/generator.html',
  '/details.html',
  '/add.html',
  '/lock.html',
  '/manifest.json',
  '/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
