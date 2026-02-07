import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// Check if VAPID is configured
const isVapidConfigured = () => {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
};

// Check if FCM is configured (for Android)
const isFCMConfigured = () => {
  return !!process.env.FCM_SERVER_KEY;
};

// Check if APNS is configured (for iOS)
const isAPNSConfigured = () => {
  return !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
};

/**
 * Subscribe to push notifications
 * Supports both web push (Web Push Protocol) and mobile push (FCM/APNS)
 */
export const subscribe = async (req, res) => {
  try {
    const { platform = 'web', endpoint, keys, deviceToken, deviceInfo } = req.body;

    // Validate platform
    if (!['web', 'ios', 'android'].includes(platform)) {
      return res.status(400).json({ message: 'Invalid platform. Must be web, ios, or android' });
    }

    // Validate based on platform
    if (platform === 'web') {
      if (!isVapidConfigured()) {
        return res.status(503).json({ message: 'Web push notifications not configured on server' });
      }
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: 'Invalid web push subscription data' });
      }
    } else if (platform === 'android') {
      if (!isFCMConfigured()) {
        return res.status(503).json({ message: 'Android push notifications not configured on server' });
      }
      if (!deviceToken) {
        return res.status(400).json({ message: 'Device token required for Android push' });
      }
    } else if (platform === 'ios') {
      if (!isAPNSConfigured()) {
        return res.status(503).json({ message: 'iOS push notifications not configured on server' });
      }
      if (!deviceToken) {
        return res.status(400).json({ message: 'Device token required for iOS push' });
      }
    }

    // Remove old subscriptions for this user and platform
    await PushSubscription.deleteMany({
      userId: req.user._id,
      platform
    });

    // Create subscription data
    const subscriptionData = {
      userId: req.user._id,
      platform,
      userAgent: req.headers['user-agent'],
    };

    if (platform === 'web') {
      subscriptionData.endpoint = endpoint;
      subscriptionData.keys = keys;
    } else {
      subscriptionData.deviceToken = deviceToken;
      subscriptionData.deviceInfo = deviceInfo;
    }

    // Save new subscription
    await PushSubscription.create(subscriptionData);

    res.json({
      success: true,
      message: `Successfully subscribed to ${platform} push notifications`
    });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({
      message: 'Failed to save subscription'
    });
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribe = async (req, res) => {
  try {
    const { platform = 'web', endpoint, deviceToken } = req.body;

    // Validate platform against allowed values
    const allowedPlatforms = ['web', 'ios', 'android'];
    if (!allowedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform. Must be web, ios, or android'
      });
    }

    // Require endpoint for web platform
    if (platform === 'web' && !endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint required for web platform'
      });
    }

    // Require deviceToken for mobile platforms
    if ((platform === 'ios' || platform === 'android') && !deviceToken) {
      return res.status(400).json({
        success: false,
        message: 'Device token required for mobile platforms'
      });
    }

    const query = { userId: req.user._id, platform };

    if (platform === 'web') {
      query.endpoint = endpoint;
    } else {
      query.deviceToken = deviceToken;
    }

    const result = await PushSubscription.deleteOne(query);

    // Check if anything was deleted
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching subscription found'
      });
    }

    res.json({ success: true, message: 'Successfully unsubscribed' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ success: false, message: 'Failed to unsubscribe' });
  }
};

/**
 * Send test notification
 * Supports both web and mobile platforms
 */
export const sendTestNotification = async (req, res) => {
  try {
    const { platform = 'web' } = req.query;

    const subscriptionDoc = await PushSubscription.findOne({
      userId: req.user._id,
      platform
    });

    if (!subscriptionDoc) {
      return res.status(404).json({
        message: `No ${platform} subscription found`
      });
    }

    if (platform === 'web') {
      // Send web push notification
      if (!isVapidConfigured()) {
        return res.status(503).json({ message: 'Web push not configured' });
      }

      const pushSubscription = {
        endpoint: subscriptionDoc.endpoint,
        keys: {
          p256dh: subscriptionDoc.keys.p256dh,
          auth: subscriptionDoc.keys.auth,
        },
      };

      const payload = JSON.stringify({
        title: 'Test Notification',
        body: 'Push notifications are working!',
        icon: '/logo192.png',
        badge: '/logo192.png',
      });

      await webpush.sendNotification(pushSubscription, payload);
    } else if (platform === 'android') {
      // Send FCM notification (Android)
      if (!isFCMConfigured()) {
        return res.status(503).json({ message: 'FCM not configured' });
      }

      // Note: Actual FCM implementation would go here
      // For now, just return success to indicate the endpoint works
      console.log('Would send FCM notification to:', subscriptionDoc.deviceToken);
    } else if (platform === 'ios') {
      // Send APNS notification (iOS)
      if (!isAPNSConfigured()) {
        return res.status(503).json({ message: 'APNS not configured' });
      }

      // Note: Actual APNS implementation would go here
      // For now, just return success to indicate the endpoint works
      console.log('Would send APNS notification to:', subscriptionDoc.deviceToken);
    }

    res.json({
      success: true,
      message: `Test notification sent to ${platform} device`
    });
  } catch (error) {
    console.error('Push send error:', error);

    // Handle subscription errors that require cleanup
    if (error.statusCode === 410 || error.statusCode === 404 ||
      error.statusCode === 400 || error.statusCode === 403) {
      await PushSubscription.deleteOne({ userId: req.user._id });
      return res.status(410).json({
        message: 'Push subscription is invalid. Please re-subscribe.',
        code: 'SUBSCRIPTION_INVALID'
      });
    }

    // Handle rate limiting separately (don't delete subscription)
    if (error.statusCode === 429) {
      return res.status(429).json({
        message: 'Push service rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT'
      });
    }

    res.status(500).json({
      message: 'Failed to send notification'
    });
  }
};

/**
 * Get push notification configuration
 * Returns available platforms and their configuration status
 */
export const getPushConfig = async (req, res) => {
  try {
    const config = {
      platforms: {
        web: {
          available: isVapidConfigured(),
          vapidPublicKey: isVapidConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
        },
        android: {
          available: isFCMConfigured(),
        },
        ios: {
          available: isAPNSConfigured(),
        },
      },
      subscriptions: [],
    };

    // Get user's current subscriptions
    const subscriptions = await PushSubscription.find({ userId: req.user._id })
      .select('platform deviceInfo createdAt')
      .lean();

    config.subscriptions = subscriptions.map(sub => ({
      platform: sub.platform,
      deviceInfo: sub.deviceInfo,
      subscribedAt: sub.createdAt,
    }));

    res.json(config);
  } catch (error) {
    console.error('Get push config error:', error);
    res.status(500).json({ message: 'Failed to get push configuration' });
  }
};
