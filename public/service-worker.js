/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'split-it-v4';
const RUNTIME_CACHE = 'split-it-runtime-v4';
const MAX_CACHE_SIZE = 50;

// NEVER cache index.html - it must always be fetched fresh to get new asset references
// Only cache truly static assets that don't change between builds
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache shell assets only (not index.html or hashed build files)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
    // Don't call skipWaiting() - let the new SW wait until all tabs are closed
    // This prevents refresh loops and ensures a clean update
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
    // Don't call clients.claim() - let new SW control only new tabs/navigations
    // This prevents refresh loops in existing tabs
  );
});

// Fetch event - network first for HTML, cache first for hashed assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) return;

  // API requests - NEVER cache (security risk with authenticated data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
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

  // Navigation requests (HTML pages) - ALWAYS network first, no caching
  // This ensures users always get the latest index.html with new asset references
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Return fresh response, don't cache HTML
          return response;
        })
        .catch(() => {
          // Offline fallback - try cache as last resort
          return caches.match('/').then(cached => {
            if (cached) return cached;
            return new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }
  
  // Hashed static assets (JS/CSS with hash in filename) - cache first, immutable
  const isHashedAsset = url.pathname.match(/\/static\/(js|css)\/.*\.[a-f0-9]+\.(js|css)$/);
  
  if (isHashedAsset) {
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

  // Other static assets (images, fonts, etc.) - network first with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          return new Response('Offline', { status: 503 });
        });
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
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
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
