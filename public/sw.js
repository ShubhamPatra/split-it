/* eslint-disable no-restricted-globals */

// Service Worker for Split-It Push Notifications

const STATIC_CACHE = 'split-it-static-v2';
const API_CACHE = 'split-it-api-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
  '/favicon.ico',
  '/image.png',
  // Add more static assets as needed
];
const API_PATTERN = /\/api\//;
const MAX_API_CACHE_AGE = 60 * 1000; // 1 minute

// Install event

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => ![STATIC_CACHE, API_CACHE].includes(key)).map(key => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});
// Helper: Check if a cached API response is fresh
function isFresh(response) {
  if (!response) return false;
  const date = response.headers.get('sw-cache-time');
  if (!date) return false;
  return Date.now() - Number(date) < MAX_API_CACHE_AGE;
}

// Helper: Clone response and add sw-cache-time header
function withCacheTime(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-time', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Fetch handler: cache-first for GET /api/*, network-first for mutations, static for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(resp =>
          resp || fetch(request).then(networkResp => {
            cache.put(request, networkResp.clone());
            return networkResp;
          })
        )
      )
    );
    return;
  }

  // API requests
  if (API_PATTERN.test(url.pathname)) {
    if (request.method === 'GET') {
      event.respondWith(
        caches.open(API_CACHE).then(async cache => {
          const cached = await cache.match(request);
          if (cached && isFresh(cached)) {
            // Stale-while-revalidate
            fetch(request).then(networkResp => {
              if (networkResp.ok) cache.put(request, withCacheTime(networkResp.clone()));
            });
            return cached;
          }
          // Try network first
          try {
            const networkResp = await fetch(request);
            if (networkResp.ok) {
              cache.put(request, withCacheTime(networkResp.clone()));
              return networkResp;
            }
            if (cached) return cached;
            return networkResp;
          } catch (err) {
            if (cached) return cached;
            return new Response('Offline', { status: 503 });
          }
        })
      );
      return;
    } else if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      // Network-first for mutations, fallback to background sync if offline
      event.respondWith((async () => {
        try {
          const resp = await fetch(request.clone());
          // Invalidate API cache for this endpoint
          const cache = await caches.open(API_CACHE);
          const keys = await cache.keys();
          for (const key of keys) {
            if (key.url.includes(url.pathname)) await cache.delete(key);
          }
          return resp;
        } catch (err) {
          // Queue for background sync if supported
          try {
            if ('sync' in self.registration) {
              await enqueueMutation({
                url: request.url,
                method: request.method,
                headers: Array.from(request.headers.entries()),
                body: await request.clone().text(),
              });
              await self.registration.sync.register('split-it-sync');
            }
          } catch (e) {
            // Ignore enqueue errors
          }
          return new Response('Saved for background sync', { status: 202 });
        }
      })());
      return;
    }
  }
});

// IndexedDB helpers for offline mutation queue (top-level scope)
function openMutationDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('split-it-mutation-queue', 1);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueMutation(mutation) {
  const db = await openMutationDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutations', 'readwrite');
    tx.objectStore('mutations').add(mutation);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function getAllMutations() {
  const db = await openMutationDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutations', 'readonly');
    const store = tx.objectStore('mutations');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}

async function clearMutations() {
  const db = await openMutationDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutations', 'readwrite');
    tx.objectStore('mutations').clear();
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// Push notification received
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Split-It',
    body: 'You have a new notification',
    icon: '/image.png',
    badge: '/image.png',
    tag: 'split-it-notification',
    data: {},
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload,
      };
    }
  } catch (error) {
    console.error('Error parsing push data:', error);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/image.png',
    badge: data.badge || '/image.png',
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    requireInteraction: true,
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Determine URL based on notification type
  if (data.type === 'expense_added' && data.groupId) {
    url = `/groups/${data.groupId}`;
  } else if (data.type === 'settlement' && data.groupId) {
    url = `/groups/${data.groupId}`;
  } else if (data.type === 'budget_alert' && data.groupId) {
    url = `/groups/${data.groupId}`;
  } else if (data.type === 'member_joined' && data.groupId) {
    url = `/groups/${data.groupId}`;
  } else if (data.url) {
    url = data.url;
  }

  // Handle action clicks
  if (event.action === 'view' && data.groupId) {
    url = `/groups/${data.groupId}`;
  } else if (event.action === 'confirm' && data.groupId) {
    url = `/groups/${data.groupId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Background sync (for offline support)
self.addEventListener('sync', (event) => {
  if (event.tag === 'split-it-sync') {
    event.waitUntil((async () => {
      const mutations = await getAllMutations();
      for (const mutation of mutations) {
        try {
          const headers = {};
          for (const [k, v] of mutation.headers) headers[k] = v;
          await fetch(mutation.url, {
            method: mutation.method,
            headers,
            body: mutation.method !== 'GET' ? mutation.body : undefined,
          });
        } catch (err) {
          // Leave in queue for next sync
          continue;
        }
      }
      await clearMutations();
    })());
  }
});

// Message handler (for communication with main app)
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
