import express from 'express';
import {
  reconcileGroupBalances,
  getBalanceDetails,
  invalidateGroupBalanceCache,
} from '../controllers/balanceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { rateLimiter } from '../middleware/security.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Rate limiting for balance operations (20 per hour per user)
const balanceOperationRateLimit = rateLimiter({
  max: 20,
  windowMs: 60 * 60 * 1000,
  message: 'Too many balance operations. Please try again later.',
});

// Get balance calculation details for a group
router.get('/details/:groupId', getBalanceDetails);

// Reconcile balances (compare cached vs fresh calculation)
router.post('/reconcile/:groupId', balanceOperationRateLimit, reconcileGroupBalances);

// Invalidate balance cache and force recalculation
router.post('/invalidate/:groupId', balanceOperationRateLimit, invalidateGroupBalanceCache);

export default router;
