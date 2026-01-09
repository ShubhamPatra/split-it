/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'split-it-v2';
const RUNTIME_CACHE = 'split-it-runtime';
const MAX_CACHE_SIZE = 50;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Only cache assets that don't change names between builds
// Hashed JS/CSS assets will be cached at runtime on first fetch
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
];

// Install event - cache shell assets only (not hashed build files)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests - NEVER cache authenticated API responses (security risk)
  // Always go to network, only fallback to cache for public endpoints
  if (url.pathname.startsWith('/api/')) {
    // Skip caching for all API requests to prevent sensitive data leakage
    event.respondWith(
      fetch(request).catch(() => {
        // Only provide offline fallback for health check
        if (url.pathname === '/api/health') {
          return new Response(JSON.stringify({ status: 'offline' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ message: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Hashed static assets (JS/CSS with hash in filename) - cache first, long-lived
  const isHashedAsset = url.pathname.match(/\/static\/(js|css)\/.*\.[a-f0-9]+\.(js|css)$/);
  
  if (isHashedAsset) {
    // Hashed assets are immutable - cache first, never expire
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request)
            .then(response => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(RUNTIME_CACHE).then(async (cache) => {
                  await cache.put(request, responseClone);
                  // Limit cache size for runtime cached assets
                  await limitCacheSize(RUNTIME_CACHE, MAX_CACHE_SIZE);
                });
              }
              return response;
            })
            .catch(() => new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // Other static assets - stale-while-revalidate strategy
  // Returns cached version immediately, then updates cache in background
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      
      // Fetch in background to update cache
      const fetchPromise = fetch(request)
        .then(networkResponse => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);
      
      // Return cached response immediately if available
      // Otherwise wait for network
      if (cachedResponse) {
        // Fire-and-forget background update
        fetchPromise.catch(() => {});
        return cachedResponse;
      }
      
      // No cache, wait for network
      const networkResponse = await fetchPromise;
      if (networkResponse) {
        return networkResponse;
      }
      
      return new Response('Offline', { status: 503 });
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/logo192.png',
      badge: data.badge || '/logo192.png',
      tag: data.tag || 'default',
      data: data.data || {},
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Split-It', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Helper to limit cache size
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    await cache.delete(keys[0]);
    limitCacheSize(cacheName, maxSize);
  }
}
