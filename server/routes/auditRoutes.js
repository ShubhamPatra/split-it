import express from 'express';
import {
  getMyActivity,
  getEntityHistory,
  getGroupActivity,
  getFailedActions,
  getSuspiciousActivity,
} from '../controllers/auditController.js';
import { protect } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// User's own activity
router.get('/my-activity', getMyActivity);

// Entity history (requires access verification in controller)
router.get('/entity/:entityType/:entityId', getEntityHistory);

// Group activity (requires group membership)
router.get('/group/:groupId', getGroupActivity);

// Security monitoring endpoints (admin only)
router.get('/failed-actions', isAdmin, getFailedActions);
router.get('/suspicious-activity', isAdmin, getSuspiciousActivity);

export default router;
