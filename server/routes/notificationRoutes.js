import express from 'express';
import {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { 
  addSubscription, 
  removeSubscriptionByEndpoint, 
  getVapidPublicKey 
} from '../utils/pushNotifications.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
  .get(getNotifications)
  .post(createNotification)
  .delete(clearNotifications);

router.put('/read-all', markAllAsRead);

router.route('/:id')
  .delete(deleteNotification);

router.put('/:id/read', markAsRead);

// Push notification routes
router.get('/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(500).json({ message: 'Push notifications not configured' });
  }
  res.json({ publicKey });
});

router.post('/push-subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    addSubscription(req.user._id.toString(), subscription);
    res.json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/push-unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    removeSubscriptionByEndpoint(endpoint);
    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
