import express from 'express';
import {
  getExpenses,
  getExpensesByGroup,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';
import { createExpenseValidation, idValidation, validate } from '../middleware/validation.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
  .get(getExpenses)
  .post(createExpenseValidation, validate, createExpense);

router.get('/group/:groupId', idValidation, validate, getExpensesByGroup);

router.route('/:id')
  .get(idValidation, validate, getExpenseById)
  .put(idValidation, validate, updateExpense)
  .delete(idValidation, validate, deleteExpense);

export default router;
