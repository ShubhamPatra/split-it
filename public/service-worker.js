/* eslint-disable no-restricted-globals */
/* global clients */

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

  // Skip webpack dev server resources (chunks, hot module replacement, websocket)
  // These are development-only and should always go to network
  if (url.pathname.includes('.chunk.js') ||
    url.pathname.includes('.hot-update.') ||
    url.pathname === '/ws' ||
    url.pathname.includes('hot-update.json')) {
    return; // Let browser handle normally
  }

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

  // Navigation requests (HTML pages) - Network first with offline caching
  // Cache a copy of index.html for offline fallback
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache the response for offline use (only for successful navigation responses)
          if (response.ok && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              // Cache with a normalized key for offline fallback
              cache.put('/offline-fallback', responseToCache);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback - try cached index.html
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match('/offline-fallback');
          if (cached) {
            return cached;
          }
          // Final fallback - basic offline page
          return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Split-It - Offline</title>
              <style>
                body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #1a1a2e; color: #fff; }
                .container { text-align: center; padding: 2rem; }
                h1 { font-size: 2rem; margin-bottom: 1rem; }
                p { color: #888; margin-bottom: 2rem; }
                button { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; }
                button:hover { background: #5558e8; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>📴 You're Offline</h1>
                <p>Please check your internet connection and try again.</p>
                <button onclick="location.reload()">Retry</button>
              </div>
            </body>
            </html>
          `, {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
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
    // Guard against non-JSON data
    let data;
    try {
      data = event.data.json();
    } catch (parseError) {
      // Fallback for text-based push messages
      const text = event.data.text();
      data = { title: 'Split-It', body: text };
    }

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

// Background Sync event - sync pending actions when connection restored
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync event:', event.tag);

  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(
      syncPendingActions()
        .then(() => {
          console.log('[Service Worker] Background sync completed successfully');
          // Notify all clients about successful sync
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_COMPLETE',
                success: true,
              });
            });
          });
        })
        .catch(async (error) => {
          console.error('[Service Worker] Background sync failed:', error);
          // Notify all clients about sync failure
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              success: false,
              error: error.message,
            });
          });
          // Re-throw to trigger Background Sync retry
          throw error;
        })
    );
  }
});

// Sync pending actions from IndexedDB
async function syncPendingActions() {
  let db = null;
  try {
    // Open IndexedDB
    db = await openIndexedDB();

    // Get pending actions
    const pendingActions = await getPendingActions(db);

    if (pendingActions.length === 0) {
      console.log('[Service Worker] No pending actions to sync');
      return;
    }

    console.log(`[Service Worker] Syncing ${pendingActions.length} pending actions`);

    // Process each action
    for (const action of pendingActions) {
      try {
        await processSyncAction(action);
        // Remove from pending actions after successful sync
        await removePendingAction(db, action.id);
      } catch (error) {
        console.error('[Service Worker] Failed to sync action:', action.id, error);
        // Update retry count
        await updatePendingActionRetry(db, action.id);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync error:', error);
    throw error;
  } finally {
    // Always close the database connection to prevent leaks
    if (db) {
      db.close();
    }
  }
}

// Open IndexedDB with proper onupgradeneeded handler
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('splitit_offline', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('pending_actions')) {
        db.createObjectStore('pending_actions', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get pending actions from IndexedDB
function getPendingActions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_actions'], 'readonly');
    const store = transaction.objectStore('pending_actions');
    const request = store.getAll();

    request.onsuccess = () => {
      const actions = request.result.filter(a => a.status === 'pending');
      resolve(actions);
    };
    request.onerror = () => reject(request.error);
  });
}

// Remove pending action from IndexedDB
function removePendingAction(db, actionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_actions'], 'readwrite');
    const store = transaction.objectStore('pending_actions');
    const request = store.delete(actionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Update pending action retry count
function updatePendingActionRetry(db, actionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending_actions'], 'readwrite');
    const store = transaction.objectStore('pending_actions');
    const getRequest = store.get(actionId);

    getRequest.onsuccess = () => {
      const action = getRequest.result;
      if (action) {
        action.retryCount = (action.retryCount || 0) + 1;
        action.lastError = new Date().toISOString();

        if (action.retryCount >= 3) {
          action.status = 'failed';
        }

        const putRequest = store.put(action);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Process a single sync action
async function processSyncAction(action) {
  const API_URL = self.location.origin + '/api';

  let response;
  switch (action.type) {
    case 'CREATE_EXPENSE':
      response = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(action.data),
      });
      break;

    case 'UPDATE_EXPENSE':
      response = await fetch(`${API_URL}/expenses/${action.data._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(action.data),
      });
      break;

    case 'DELETE_EXPENSE':
      response = await fetch(`${API_URL}/expenses/${action.data._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      break;

    case 'CREATE_SETTLEMENT':
      response = await fetch(`${API_URL}/settlements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(action.data),
      });
      break;

    case 'UPDATE_SETTLEMENT':
      response = await fetch(`${API_URL}/settlements/${action.data._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(action.data),
      });
      break;

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }

  if (!response.ok) {
    // Guard against non-JSON error responses with text/status fallback
    let errorMessage = `Sync failed (${response.status})`;
    try {
      const parsedError = await response.json();
      errorMessage = parsedError.message || errorMessage;
    } catch (parseError) {
      // Response was not JSON, try text fallback
      try {
        const textFallback = await response.text();
        errorMessage = textFallback || `Sync failed (${response.status})`;
      } catch (textError) {
        // Use status text as last resort
        errorMessage = response.statusText || `Sync failed (${response.status})`;
      }
    }
    throw new Error(errorMessage);
  }

  // Guard against non-JSON success responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return {}; // Return empty object for non-JSON responses
}

// Helper to limit cache size
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    await cache.delete(keys[0]);
    limitCacheSize(cacheName, maxSize);
  }
}
