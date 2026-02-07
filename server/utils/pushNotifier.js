import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

/**
 * Send push notification to a user across all their devices
 * Supports web push, FCM (Android), and APNS (iOS)
 */
export const sendPushToUser = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ userId });

    if (subscriptions.length === 0) {
      return 0;
    }

    const results = await Promise.allSettled(
      subscriptions.map(sub => sendPushToDevice(sub, payload))
    );

    return results.filter(r => r.status === 'fulfilled').length;
  } catch (error) {
    console.error('Push notification error:', error);
    return 0;
  }
};

/**
 * Send push notification to a specific device
 * Routes to appropriate push service based on platform
 */
const sendPushToDevice = async (subscription, payload) => {
  try {
    if (subscription.platform === 'web') {
      // Web Push Protocol
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } else if (subscription.platform === 'android') {
      // Firebase Cloud Messaging (FCM) for Android
      await sendFCMNotification(subscription.deviceToken, payload);
    } else if (subscription.platform === 'ios') {
      // Apple Push Notification Service (APNS) for iOS
      await sendAPNSNotification(subscription.deviceToken, payload);
    }

    return true;
  } catch (error) {
    // Remove expired or invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      await PushSubscription.deleteOne({ _id: subscription._id });
    }
    throw error;
  }
};

/**
 * Send FCM notification (Android)
 * Note: Requires FCM_SERVER_KEY environment variable
 */
const sendFCMNotification = async (deviceToken, payload) => {
  if (!process.env.FCM_SERVER_KEY) {
    console.warn('FCM not configured - skipping Android push notification');
    return;
  }

  // Log redacted info for debugging (mask device token for PII protection)
  const maskToken = (token) => token ? `***${token.slice(-4)}` : '(none)';
  if (process.env.NODE_ENV === 'development') {
    console.log('FCM notification would be sent to:', maskToken(deviceToken), 'payload keys:', Object.keys(payload));
  }

  // Example implementation (requires firebase-admin package):
  /*
  const admin = require('firebase-admin');
  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    token: deviceToken,
  };
  await admin.messaging().send(message);
  */
};

/**
 * Send APNS notification (iOS)
 * Note: Requires APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH environment variables
 */
const sendAPNSNotification = async (deviceToken, payload) => {
  if (!process.env.APNS_KEY_ID || !process.env.APNS_TEAM_ID) {
    console.warn('APNS not configured - skipping iOS push notification');
    return;
  }

  // Log redacted info for debugging (mask device token for PII protection)
  const maskToken = (token) => token ? `***${token.slice(-4)}` : '(none)';
  if (process.env.NODE_ENV === 'development') {
    console.log('APNS notification would be sent to:', maskToken(deviceToken), 'payload keys:', Object.keys(payload));
  }

  // Example implementation (requires apn package):
  /*
  const apn = require('apn');
  const provider = new apn.Provider({
    token: {
      key: process.env.APNS_KEY_PATH,
      keyId: process.env.APNS_KEY_ID,
      teamId: process.env.APNS_TEAM_ID,
    },
    production: process.env.NODE_ENV === 'production',
  });
  
  const notification = new apn.Notification();
  notification.alert = {
    title: payload.title,
    body: payload.body,
  };
  notification.topic = process.env.APNS_BUNDLE_ID;
  notification.payload = payload.data || {};
  
  await provider.send(notification, deviceToken);
  */
};

/**
 * Send push notification to all members of a group
 */
export const sendPushToGroup = async (groupId, payload) => {
  const Group = (await import('../models/Group.js')).default;
  const group = await Group.findById(groupId).lean();

  if (!group) return 0;

  const results = await Promise.all(
    group.members.map(memberId => sendPushToUser(memberId, payload))
  );

  return results.reduce((sum, count) => sum + count, 0);
};
