import express from 'express';
import {
  getExpenses,
  getExpensesByGroup,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadExpenseReceipts,
  deleteExpenseReceipt,
  exportExpensesReport,
  checkUserBudget,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';
import { createExpenseValidation, idValidation, groupIdValidation, validate } from '../middleware/validation.js';
import { uploadReceipts } from '../middleware/upload.js';
import { rateLimiter } from '../middleware/security.js';
import { auditMutation, captureBeforeState } from '../middleware/auditMiddleware.js';
import Expense from '../models/Expense.js';

const router = express.Router();

router.use(protect); // All routes are protected

// Rate limiting for expense creation (60 per hour per user)
const expenseCreateRateLimit = rateLimiter({
  max: 60,
  windowMs: 60 * 60 * 1000,
  message: 'Too many expenses created. Please try again later.',
});

// Rate limiting for expense updates/deletes (100 per hour per user)
const expenseModifyRateLimit = rateLimiter({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many expense modifications. Please try again later.',
});

router.route('/')
  .get(getExpenses)
  .post(expenseCreateRateLimit, createExpenseValidation, validate, auditMutation('expense.create', 'Expense'), createExpense);

// Export and budget routes
router.post('/export', exportExpensesReport);
router.post('/check-budget', checkUserBudget);

router.get('/group/:groupId', groupIdValidation, validate, getExpensesByGroup);

router.route('/:id')
  .get(idValidation, validate, getExpenseById)
  .put(expenseModifyRateLimit, idValidation, validate, captureBeforeState(Expense), auditMutation('expense.update', 'Expense'), updateExpense)
  .delete(expenseModifyRateLimit, idValidation, validate, captureBeforeState(Expense), auditMutation('expense.delete', 'Expense'), deleteExpense);

// Receipt upload endpoints
router.post('/:id/receipts', expenseModifyRateLimit, idValidation, validate, auditMutation('expense.receipt.add', 'Expense'), uploadReceipts, uploadExpenseReceipts);
router.delete('/:id/receipts/:receiptId', expenseModifyRateLimit, idValidation, validate, auditMutation('expense.receipt.delete', 'Expense'), deleteExpenseReceipt);

export default router;
