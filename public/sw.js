/* eslint-disable no-restricted-globals */

// Service Worker for Split-It Push Notifications

const CACHE_NAME = 'split-it-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

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
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(url);
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
  console.log('Background sync:', event.tag);
});

// Message handler (for communication with main app)
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
