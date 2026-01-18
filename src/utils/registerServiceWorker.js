import apiClient from '../lib/apiClient';

const PUSH_SUBSCRIPTION_KEY = 'splitit_push_subscribed';

/**
 * Check if there's an active push subscription in the browser
 */
const getExistingSubscription = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.warn('Error checking existing subscription:', error);
    return null;
  }
};

export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      updateViaCache: 'none'
    });
    console.log('Service worker registered');

    // Check for updates periodically (every 30 minutes in production)
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);

    // Handle service worker updates - DON'T auto-reload, just log
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available - it will be used on next natural page load
            console.log('New version available. Will be used on next visit.');
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return 'denied';
};

export const subscribeToPush = async (registration) => {
  try {
    const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('VAPID public key not configured');
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
};

/**
 * Initialize push notifications - call after user is authenticated
 * Requests permission, subscribes to push, and sends subscription to backend
 */
export const initializePushNotifications = async () => {
  // First, check if there's already an active subscription in the browser
  const existingSubscription = await getExistingSubscription();
  if (existingSubscription) {
    // Already subscribed - just ensure backend knows about it
    const subscriptionJSON = existingSubscription.toJSON();
    localStorage.setItem(PUSH_SUBSCRIPTION_KEY, subscriptionJSON.endpoint);
    
    // Re-register with backend (in case user logged in on new device or cleared backend data)
    try {
      await apiClient.post('/push/subscribe', {
        endpoint: subscriptionJSON.endpoint,
        keys: subscriptionJSON.keys,
      });
    } catch (error) {
      // Ignore errors - subscription might already exist
      console.log('Backend subscription sync:', error.message);
    }
    
    return { success: true, alreadySubscribed: true };
  }

  // Check localStorage flag to avoid re-prompting if user already declined
  if (localStorage.getItem(PUSH_SUBSCRIPTION_KEY) === 'declined') {
    return { success: false, error: 'User previously declined', alreadyDeclined: true };
  }

  // Don't auto-prompt - user must explicitly enable from settings
  // Just return current status
  if (Notification.permission === 'default') {
    return { success: false, error: 'Permission not yet requested', notPrompted: true };
  }

  if (Notification.permission === 'denied') {
    return { success: false, error: 'Notification permission denied' };
  }

  // Permission is granted but no subscription exists - create one
  try {
    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, error: 'Service worker registration failed' };
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Request notification permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return { success: false, error: `Notification permission ${permission}` };
    }

    // Subscribe to push
    const subscription = await subscribeToPush(registration);
    if (!subscription) {
      return { success: false, error: 'Push subscription failed' };
    }

    // Send subscription to backend
    const subscriptionJSON = subscription.toJSON();
    await apiClient.post('/push/subscribe', {
      endpoint: subscriptionJSON.endpoint,
      keys: subscriptionJSON.keys,
    });

    // Mark as subscribed in localStorage (persists across sessions)
    localStorage.setItem(PUSH_SUBSCRIPTION_KEY, subscriptionJSON.endpoint);

    console.log('Push notifications initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('Push notification initialization failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unsubscribe from push notifications - call on logout
 */
export const unsubscribeFromPush = async () => {
  try {
    const endpoint = localStorage.getItem(PUSH_SUBSCRIPTION_KEY);
    if (endpoint && endpoint !== 'declined') {
      // Notify backend
      try {
        await apiClient.post('/push/unsubscribe', { endpoint });
      } catch (apiError) {
        console.warn('Failed to unsubscribe on backend:', apiError);
      }
    }

    // Unsubscribe locally
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Clear flag
    localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);

    console.log('Push notifications unsubscribed');
    return { success: true };
  } catch (error) {
    console.error('Push unsubscribe failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if push notifications are supported and subscribed
 */
export const getPushNotificationStatus = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, subscribed: false, permission: 'unsupported' };
  }

  const permission = Notification.permission;
  
  // Check actual subscription state from PushManager
  const existingSubscription = await getExistingSubscription();
  const subscribed = !!existingSubscription;
  
  // Sync localStorage with actual state
  if (subscribed && existingSubscription) {
    localStorage.setItem(PUSH_SUBSCRIPTION_KEY, existingSubscription.endpoint);
  } else if (!subscribed) {
    const storedValue = localStorage.getItem(PUSH_SUBSCRIPTION_KEY);
    if (storedValue && storedValue !== 'declined') {
      localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);
    }
  }

  return { supported: true, subscribed, permission };
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
