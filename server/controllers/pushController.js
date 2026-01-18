import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// Check if VAPID is configured
const isVapidConfigured = () => {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
};

export const subscribe = async (req, res) => {
  try {
    if (!isVapidConfigured()) {
      return res.status(503).json({ message: 'Push notifications not configured on server' });
    }

    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription data' });
    }

    // Remove old subscriptions for this user
    await PushSubscription.deleteMany({ userId: req.user._id });

    // Save new subscription
    await PushSubscription.create({
      userId: req.user._id,
      endpoint,
      keys,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ message: 'Failed to save subscription' });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ userId: req.user._id, endpoint });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
};

export const sendTestNotification = async (req, res) => {
  try {
    if (!isVapidConfigured()) {
      return res.status(503).json({ message: 'Push notifications not configured on server' });
    }

    const subscriptionDoc = await PushSubscription.findOne({ userId: req.user._id });
    if (!subscriptionDoc) {
      return res.status(404).json({ message: 'No subscription found' });
    }

    // Format subscription object for web-push library
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
    res.json({ success: true });
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
    
    res.status(500).json({ message: 'Failed to send notification', error: error.message });
  }
};
