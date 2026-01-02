import express from 'express';
import {
  getSettlements,
  getSettlementsByGroup,
  createSettlement,
  updateSettlement,
  deleteSettlement,
  confirmPaymentReceipt,
} from '../controllers/settlementController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
  .get(getSettlements)
  .post(createSettlement);

router.get('/group/:groupId', getSettlementsByGroup);

router.post('/:id/confirm', confirmPaymentReceipt);

router.route('/:id')
  .put(updateSettlement)
  .delete(deleteSettlement);

export default router;
