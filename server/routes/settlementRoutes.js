import express from 'express';
import {
  getSettlements,
  getSettlementsByGroup,
  createSettlement,
  updateSettlement,
  deleteSettlement,
  confirmPaymentReceipt,
  rejectPaymentReceipt,
  sendPaymentReminder,
} from '../controllers/settlementController.js';
import { protect } from '../middleware/authMiddleware.js';
import { rateLimiter } from '../middleware/security.js';
import { auditMutation, captureBeforeState } from '../middleware/auditMiddleware.js';
import Settlement from '../models/Settlement.js';

const router = express.Router();

router.use(protect); // All routes are protected

// Rate limiting for settlement creation (30 per hour per user)
const settlementCreateRateLimit = rateLimiter({
  max: 30,
  windowMs: 60 * 60 * 1000,
  message: 'Too many settlements created. Please try again later.',
});

// Rate limiting for settlement actions (50 per hour per user)
const settlementActionRateLimit = rateLimiter({
  max: 50,
  windowMs: 60 * 60 * 1000,
  message: 'Too many settlement actions. Please try again later.',
});

// Rate limiting for reminders (10 per hour per user)
const reminderRateLimit = rateLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Too many reminders sent. Please try again later.',
});

router.route('/')
  .get(getSettlements)
  .post(settlementCreateRateLimit, auditMutation('settlement.create', 'Settlement'), createSettlement);

router.get('/group/:groupId', getSettlementsByGroup);

router.post('/:id/confirm', settlementActionRateLimit, captureBeforeState(Settlement), auditMutation('settlement.confirm', 'Settlement'), confirmPaymentReceipt);
router.post('/:id/reject', settlementActionRateLimit, captureBeforeState(Settlement), auditMutation('settlement.reject', 'Settlement'), rejectPaymentReceipt);
router.post('/:id/remind', reminderRateLimit, sendPaymentReminder);

router.route('/:id')
  .put(settlementActionRateLimit, captureBeforeState(Settlement), auditMutation('settlement.update', 'Settlement'), updateSettlement)
  .delete(settlementActionRateLimit, captureBeforeState(Settlement), auditMutation('settlement.delete', 'Settlement'), deleteSettlement);

export default router;
