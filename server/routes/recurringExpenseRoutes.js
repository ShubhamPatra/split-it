import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import RecurringExpense from '../models/RecurringExpense.js';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';

const router = express.Router();

// Get all recurring expenses for a group
router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Verify user is member of group
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const recurringExpenses = await RecurringExpense.find({ 
      groupId, 
      isActive: true 
    })
    .populate('paidBy', 'name email')
    .populate('splitAmong', 'name email')
    .populate('createdBy', 'name email')
    .sort({ nextDueDate: 1 });

    res.json(recurringExpenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create recurring expense
router.post('/', protect, async (req, res) => {
  try {
    const { 
      groupId, description, amount, category, paidBy, 
      splitAmong, splitConfig, frequency, startDate, 
      endDate, reminderDaysBefore, autoCreate 
    } = req.body;

    // Verify user is member of group
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const recurringExpense = new RecurringExpense({
      groupId,
      description,
      amount,
      category,
      paidBy,
      splitAmong,
      splitConfig,
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      nextDueDate: new Date(startDate),
      reminderDaysBefore,
      autoCreate,
      createdBy: req.user._id,
    });

    await recurringExpense.save();
    
    await recurringExpense.populate('paidBy', 'name email');
    await recurringExpense.populate('splitAmong', 'name email');

    res.status(201).json(recurringExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update recurring expense
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const recurringExpense = await RecurringExpense.findById(id);
    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    // Verify user is creator or admin
    if (recurringExpense.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    Object.assign(recurringExpense, updates);
    await recurringExpense.save();

    await recurringExpense.populate('paidBy', 'name email');
    await recurringExpense.populate('splitAmong', 'name email');

    res.json(recurringExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete (deactivate) recurring expense
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const recurringExpense = await RecurringExpense.findById(id);
    if (!recurringExpense) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    // Verify user is creator
    if (recurringExpense.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    recurringExpense.isActive = false;
    await recurringExpense.save();

    res.json({ message: 'Recurring expense deactivated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate expense from recurring expense
router.post('/:id/generate', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const recurringExpense = await RecurringExpense.findById(id);
    if (!recurringExpense || !recurringExpense.isActive) {
      return res.status(404).json({ message: 'Recurring expense not found or inactive' });
    }

    // Create actual expense
    const expense = new Expense({
      groupId: recurringExpense.groupId,
      description: recurringExpense.description,
      amount: recurringExpense.amount,
      currency: recurringExpense.currency,
      category: recurringExpense.category,
      paidBy: recurringExpense.paidBy,
      date: new Date().toISOString().split('T')[0],
      splitAmong: recurringExpense.splitAmong,
      splitConfig: recurringExpense.splitConfig,
      recurringExpenseId: recurringExpense._id,
    });

    await expense.save();

    // Update next due date
    recurringExpense.lastGeneratedDate = new Date();
    const nextDue = recurringExpense.calculateNextDueDate();
    if (nextDue) {
      recurringExpense.nextDueDate = nextDue;
    }
    await recurringExpense.save();

    await expense.populate('paidBy', 'name email');
    await expense.populate('splitAmong', 'name email');

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
