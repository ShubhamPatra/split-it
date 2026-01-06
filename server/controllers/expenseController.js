import Expense from '../models/Expense.js';
import Group from '../models/Group.js';

// @desc    Get all expenses for user's groups
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id });
    const groupIds = groups.map(g => g._id);

    const expenses = await Expense.find({ groupId: { $in: groupIds } })
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('groupId', 'name')
      .sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get expenses by group
// @route   GET /api/expenses/group/:groupId
// @access  Private
export const getExpensesByGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const expenses = await Expense.find({ groupId: req.params.groupId })
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('groupId', 'name members');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a group member
    const group = expense.groupId;
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = async (req, res) => {
  try {
    const { groupId, description, amount, currency, category, paidBy, date, splitAmong, splitConfig } = req.body;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const expense = await Expense.create({
      groupId,
      description,
      amount,
      currency: currency || 'INR',
      category,
      paidBy,
      date,
      splitAmong,
      splitConfig,
    });

    const populatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('groupId', 'name');

    res.status(201).json(populatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate('groupId');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a group member
    if (!expense.groupId.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { description, amount, currency, category, paidBy, date, splitAmong, splitConfig } = req.body;

    if (description !== undefined) expense.description = description;
    if (amount !== undefined) expense.amount = amount;
    if (currency !== undefined) expense.currency = currency;
    if (category !== undefined) expense.category = category;
    if (paidBy !== undefined) expense.paidBy = paidBy;
    if (date !== undefined) expense.date = date;
    if (splitAmong !== undefined) expense.splitAmong = splitAmong;
    if (splitConfig !== undefined) expense.splitConfig = splitConfig;

    await expense.save();

    const updatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('groupId', 'name');

    res.json(updatedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate('groupId');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a group member
    if (!expense.groupId.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Expense.findByIdAndDelete(req.params.id);

    res.json({ message: 'Expense deleted successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
