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

    const subscription = await PushSubscription.findOne({ userId: req.user._id });
    if (!subscription) {
      return res.status(404).json({ message: 'No subscription found' });
    }

    const payload = JSON.stringify({
      title: 'Test Notification',
      body: 'Push notifications are working!',
      icon: '/logo192.png',
      badge: '/logo192.png',
    });

    await webpush.sendNotification(subscription, payload);
    res.json({ success: true });
  } catch (error) {
    console.error('Push send error:', error);
    res.status(500).json({ message: 'Failed to send notification' });
  }
};
