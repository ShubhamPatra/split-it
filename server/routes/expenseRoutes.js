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

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
  .get(getExpenses)
  .post(createExpenseValidation, validate, createExpense);

// Export and budget routes
router.post('/export', exportExpensesReport);
router.post('/check-budget', checkUserBudget);

router.get('/group/:groupId', groupIdValidation, validate, getExpensesByGroup);

router.route('/:id')
  .get(idValidation, validate, getExpenseById)
  .put(idValidation, validate, updateExpense)
  .delete(idValidation, validate, deleteExpense);

// Receipt upload endpoints
router.post('/:id/receipts', idValidation, validate, uploadReceipts, uploadExpenseReceipts);
router.delete('/:id/receipts/:receiptId', idValidation, validate, deleteExpenseReceipt);

export default router;
