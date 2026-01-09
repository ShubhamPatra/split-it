import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { subscribe, unsubscribe, sendTestNotification } from '../controllers/pushController.js';

const router = express.Router();

router.post('/subscribe', authMiddleware, subscribe);
router.post('/unsubscribe', authMiddleware, unsubscribe);
router.post('/test', authMiddleware, sendTestNotification);

export default router;
