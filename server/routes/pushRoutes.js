import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { subscribe, unsubscribe, sendTestNotification, getPushConfig } from '../controllers/pushController.js';

const router = express.Router();

// Get push notification configuration
router.get('/config', authMiddleware, getPushConfig);

// Subscribe to push notifications (web or mobile)
router.post('/subscribe', authMiddleware, subscribe);

// Unsubscribe from push notifications
router.post('/unsubscribe', authMiddleware, unsubscribe);

// Send test notification
router.post('/test', authMiddleware, sendTestNotification);

export default router;
