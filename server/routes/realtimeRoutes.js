import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getRealtimeEvents } from '../controllers/realtimeController.js';

const router = express.Router();

router.get('/events', protect, getRealtimeEvents);

export default router;