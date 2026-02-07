import express from 'express';
import {
  getCrossGroupBalancesForUser,
  getPersonBalance,
  createCrossGroupSettlement,
  getCrossGroupSettlements,
  confirmCrossGroupSettlement,
  rejectCrossGroupSettlement,
  sendCrossGroupPaymentReminder,
} from '../controllers/crossGroupController.js';
import { protect } from '../middleware/authMiddleware.js';
import { rateLimiter } from '../middleware/security.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Rate limiting for settlement creation (30 per hour)
const settlementCreateRateLimit = rateLimiter({
  max: 30,
  windowMs: 60 * 60 * 1000,
  message: 'Too many settlements created. Please try again later.',
});

// Rate limiting for settlement actions (50 per hour)
const settlementActionRateLimit = rateLimiter({
  max: 50,
  windowMs: 60 * 60 * 1000,
  message: 'Too many settlement actions. Please try again later.',
});

// Rate limiting for reminders (10 per hour)
const reminderRateLimit = rateLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Too many reminders sent. Please try again later.',
});

// Get cross-group balances for current user
router.get('/balances', getCrossGroupBalancesForUser);

// Get balance breakdown with a specific person
router.get('/person/:personId', getPersonBalance);

// Cross-group settlement endpoints
router.post('/settlements', settlementCreateRateLimit, createCrossGroupSettlement);
router.get('/settlements', getCrossGroupSettlements);
router.post('/settlements/:id/confirm', settlementActionRateLimit, confirmCrossGroupSettlement);
router.post('/settlements/:id/reject', settlementActionRateLimit, rejectCrossGroupSettlement);
router.post('/settlements/:id/remind', reminderRateLimit, sendCrossGroupPaymentReminder);

export default router;
