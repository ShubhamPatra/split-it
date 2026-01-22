import express from 'express';
import {
  getSettlements,
  getSettlementsByGroup,
  createSettlement,
  updateSettlement,
  deleteSettlement,
  confirmPaymentReceipt,
  rejectPaymentReceipt,
  getPeopleWithBalances,
  getPersonBalance,
  createCrossGroupSettlement,
  getGroupsWithBalances,
  getSettlementHistory,
  createRepaymentRequest,
  getRepaymentRequestHistory,
  cancelRepaymentRequest,
  getMyRepaymentRequests,
  updateRepaymentRequestStatus,
} from '../controllers/settlementController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All routes are protected

// Cross-group settlement routes (must be before parametric routes)
router.get('/people', getPeopleWithBalances);
router.get('/people/:otherUserId', getPersonBalance);
router.post('/cross-group', createCrossGroupSettlement);
router.get('/groups', getGroupsWithBalances);
router.get('/history', getSettlementHistory);

// Repayment request routes
router.post('/repayment-request', createRepaymentRequest);
router.get('/repayment-request/history/:otherUserId', getRepaymentRequestHistory);
router.get('/repayment-request/my-requests', getMyRepaymentRequests);
router.patch('/repayment-request/:requestId/status', updateRepaymentRequestStatus);
router.delete('/repayment-request/:requestId', cancelRepaymentRequest);

router.route('/')
  .get(getSettlements)
  .post(createSettlement);

router.get('/group/:groupId', getSettlementsByGroup);

router.post('/:id/confirm', confirmPaymentReceipt);
router.post('/:id/reject', rejectPaymentReceipt);

router.route('/:id')
  .put(updateSettlement)
  .delete(deleteSettlement);

export default router;

