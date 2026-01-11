import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import Message from '../models/Message.js';
import redis from '../config/redis.js';
import { notificationQueue } from '../config/queue.js';
import { saveReceiptFiles, deleteReceiptFiles } from '../middleware/upload.js';
import { generateAndEmailReport } from '../utils/exportService.js';
import { checkAndSendBudgetAlert } from '../utils/emailUtils.js';

// Helper: Calculate current month spending using aggregation (optimized)
const getMonthlySpending = async (groupId) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await Expense.aggregate([
    {
      $match: {
        groupId: new mongoose.Types.ObjectId(groupId),
        date: { $gte: startOfMonth },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]);

  return result.length > 0 ? result[0].total : 0;
};

// Helper: Invalidate balance cache when expense changes
const invalidateBalanceCache = async (groupId) => {
  try {
    await redis.del(`balances:${groupId}`);
  } catch (e) {
    console.error('Failed to invalidate balance cache:', e);
  }
};

// @desc    Get all expenses for user's groups
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res) => {
  try {
    // Pagination params with defaults and maximums
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 100;
    const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const skip = Math.max(parseInt(req.query.skip) || 0, 0);

    // Use aggregation to avoid N+1 query pattern
    // Single pipeline instead of: 1) find groups 2) find expenses
    const pipeline = [
      // Stage 1: Lookup groups where user is a member
      {
        $lookup: {
          from: 'groups',
          localField: 'groupId',
          foreignField: '_id',
          as: 'group',
          pipeline: [
            { $match: { members: req.user._id } },
            { $project: { name: 1 } },
          ],
        },
      },
      // Stage 2: Filter to only expenses in user's groups
      {
        $match: {
          'group.0': { $exists: true },
        },
      },
      // Stage 3: Sort by date
      { $sort: { date: -1 } },
      // Stage 4: Facet for pagination and count
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            // Lookup paidBy user
            {
              $lookup: {
                from: 'users',
                localField: 'paidBy',
                foreignField: '_id',
                as: 'paidByUser',
                pipeline: [{ $project: { name: 1, email: 1 } }],
              },
            },
            // Lookup splitAmong users
            {
              $lookup: {
                from: 'users',
                localField: 'splitAmong',
                foreignField: '_id',
                as: 'splitAmongUsers',
                pipeline: [{ $project: { name: 1, email: 1 } }],
              },
            },
            // Transform to expected format
            {
              $addFields: {
                paidBy: { $arrayElemAt: ['$paidByUser', 0] },
                splitAmong: '$splitAmongUsers',
                groupId: { $arrayElemAt: ['$group', 0] },
              },
            },
            {
              $project: {
                paidByUser: 0,
                splitAmongUsers: 0,
                group: 0,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Expense.aggregate(pipeline);
    const expenses = result.data || [];
    const total = result.total[0]?.count || 0;

    // Return with pagination metadata
    res.json({
      data: expenses,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + expenses.length < total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Redis cache keys and TTL
const EXPENSE_CACHE_TTL = 30; // 30 seconds cache
const EXPENSE_CACHE_PREFIX = 'expenses:group:';

// Helper to invalidate expense cache for a group
export const invalidateExpenseCache = async (groupId) => {
  try {
    // Delete main cache and any paginated variants
    const keys = await redis.keys(`${EXPENSE_CACHE_PREFIX}${groupId}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Failed to invalidate expense cache:', error);
  }
};

// @desc    Get expenses by group
// @route   GET /api/expenses/group/:groupId
// @access  Private
export const getExpensesByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const cacheKey = `${EXPENSE_CACHE_PREFIX}${groupId}:${skip}:${limit}`;

    // Try Redis cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (cacheErr) {
      console.error('Redis cache read error:', cacheErr);
      // Continue without cache on error
    }

    const group = await Group.findById(groupId).lean();

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const expenses = await Expense.find({ groupId })
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .sort({ date: -1 })
      .lean()
      .limit(limit)
      .skip(skip);

    // Cache the result
    try {
      await redis.setex(cacheKey, EXPENSE_CACHE_TTL, JSON.stringify(expenses));
    } catch (cacheErr) {
      console.error('Redis cache write error:', cacheErr);
      // Continue without caching on error
    }

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
      .populate('groupId', 'name members')
      .lean();

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a group member
    const group = expense.groupId;
    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
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
    const { 
      groupId, description, amount, currency, category, paidBy, date, 
      splitAmong, splitConfig, lineItems, receipts, recurrence 
    } = req.body;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate paidBy is a group member
    const memberStrings = group.members.map(m => m.toString());
    if (!memberStrings.includes(paidBy.toString())) {
      return res.status(400).json({ message: 'Payer must be a group member' });
    }

    // Validate all splitAmong are group members
    if (splitAmong && splitAmong.length > 0) {
      const invalidParticipants = splitAmong.filter(id => !memberStrings.includes(id.toString()));
      if (invalidParticipants.length > 0) {
        return res.status(400).json({ message: 'All participants must be group members' });
      }
    }

    // Calculate split from line items if itemized (Comment 5)
    let finalSplitConfig = splitConfig;
    if (lineItems && lineItems.length > 0 && splitConfig?.type === 'itemized') {
      const shares = {};
      for (const item of lineItems) {
        if (item.assignedTo && item.assignedTo.length > 0) {
          const perPersonAmount = item.totalPrice / item.assignedTo.length;
          for (const userId of item.assignedTo) {
            shares[userId.toString()] = (shares[userId.toString()] || 0) + perPersonAmount;
          }
        }
      }
      finalSplitConfig = { type: 'itemized', shares };
    }

    // Check budget limits if enabled (Comment 4)
    // Optimized: Uses aggregation instead of fetching all expenses
    if (group.budget?.enabled && group.budget?.monthlyLimit > 0) {
      const currentSpending = await getMonthlySpending(groupId);
      const newTotal = currentSpending + amount;
      const percentUsed = (newTotal / group.budget.monthlyLimit) * 100;

      // Warn if over threshold
      if (percentUsed >= group.budget.alertThreshold) {
        // Enqueue bulk notifications for all members (Comment 12)
        const notificationJobs = group.members.map(memberId => ({
          data: {
            userId: memberId.toString(),
            type: 'warning',
            title: 'Budget Alert',
            message: percentUsed >= 100 
              ? `Group "${group.name}" has exceeded its monthly budget!`
              : `Group "${group.name}" has used ${percentUsed.toFixed(0)}% of its monthly budget.`,
            data: { groupId, actionType: 'budget_alert' },
          },
        }));
        await notificationQueue.addBulk(notificationJobs).catch(err => console.error('Notification queue error:', err));
      }
    }

    const expenseData = {
      groupId,
      description,
      amount,
      currency: currency || 'INR',
      category,
      paidBy,
      date: date ? new Date(date) : new Date(),
      splitAmong,
      splitConfig: finalSplitConfig,
    };

    // Add line items if provided (Comment 5)
    if (lineItems && lineItems.length > 0) {
      expenseData.lineItems = lineItems;
    }

    // Add receipts if provided (Comment 6)
    if (receipts && receipts.length > 0) {
      expenseData.receipts = receipts;
    }

    // Add recurrence if provided (Comment 3)
    if (recurrence && recurrence.enabled) {
      expenseData.recurrence = {
        enabled: true,
        frequency: recurrence.frequency,
        interval: recurrence.interval || 1,
        endDate: recurrence.endDate ? new Date(recurrence.endDate) : null,
      };
      
      // Calculate next run date
      const tempExpense = new Expense(expenseData);
      expenseData.recurrence.nextRunAt = tempExpense.calculateNextRunDate();
    }

    const expense = await Expense.create(expenseData);

    const populatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('groupId', 'name')
      .lean();

    // Invalidate caches for this group
    await invalidateBalanceCache(groupId);
    await invalidateExpenseCache(groupId);

    // Enqueue bulk notifications for expense participants (optimized)
    const payerName = populatedExpense.paidBy?.name || 'Someone';
    const notifyIds = (splitAmong || []).filter(id => id.toString() !== paidBy.toString());
    if (notifyIds.length > 0) {
      const notificationJobs = notifyIds.map(memberId => ({
        data: {
          userId: memberId.toString(),
          type: 'info',
          actionType: 'navigate',
          title: 'New Expense Added',
          message: `${payerName} added "${description}" for ₹${amount}`,
          data: { groupId, expenseId: expense._id.toString() },
        },
      }));
      await notificationQueue.addBulk(notificationJobs).catch(err => console.error('Notification queue error:', err));
    }

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup, emitAnalyticsUpdate } = await import('../utils/socketEmitter.js');
      emitToGroup(io, groupId, 'expense:created', populatedExpense);
      
      // Emit analytics update
      emitAnalyticsUpdate(io, groupId, {
        action: 'expenseAdded',
        amount,
        category,
        totalExpenses: await Expense.countDocuments({ groupId }),
      });
      
      // Create system message for chat
      try {
        const systemMessage = await Message.create({
          groupId,
          senderId: req.user._id,
          content: `${populatedExpense.paidBy?.name || 'Someone'} added expense "${description}" for ${currency || 'INR'}${amount}`,
          type: 'system',
          metadata: {
            expenseId: expense._id,
            action: 'created',
          },
          readBy: [req.user._id],
        });
        
        const populatedSystemMessage = await Message.findById(systemMessage._id)
          .populate('senderId', 'name email')
          .lean();
        
        emitToGroup(io, groupId, 'chat:new', populatedSystemMessage);
      } catch (msgError) {
        console.error('Error creating system message for expense:', msgError);
        // Don't fail the request if message creation fails
      }
    }

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
    const memberStringsForAuth = expense.groupId.members.map(m => m.toString());
    if (!memberStringsForAuth.includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check role-based permissions (Comment 10)
    const isPayer = expense.paidBy.toString() === req.user._id.toString();
    const isAdmin = expense.groupId.isAdmin ? expense.groupId.isAdmin(req.user._id) : 
                    expense.groupId.createdBy.toString() === req.user._id.toString();
    if (!isPayer && !isAdmin) {
      return res.status(403).json({ message: 'Only the payer or group admin can modify this expense' });
    }

    const { 
      description, amount, currency, category, paidBy, date, 
      splitAmong, splitConfig, lineItems, receipts, recurrence 
    } = req.body;

    // Validate paidBy and splitAmong against group members if provided
    const memberStrings = expense.groupId.members.map(m => m.toString());
    
    if (paidBy !== undefined) {
      if (!memberStrings.includes(paidBy.toString())) {
        return res.status(400).json({ message: 'Payer must be a group member' });
      }
    }
    
    if (splitAmong !== undefined && splitAmong.length > 0) {
      const invalidParticipants = splitAmong.filter(id => !memberStrings.includes(id.toString()));
      if (invalidParticipants.length > 0) {
        return res.status(400).json({ message: 'All participants must be group members' });
      }
    }

    if (description !== undefined) expense.description = description;
    if (amount !== undefined) expense.amount = amount;
    if (currency !== undefined) expense.currency = currency;
    if (category !== undefined) expense.category = category;
    if (paidBy !== undefined) expense.paidBy = paidBy;
    if (date !== undefined) expense.date = date;
    if (splitAmong !== undefined) expense.splitAmong = splitAmong;
    if (splitConfig !== undefined) expense.splitConfig = splitConfig;
    
    // Update line items (Comment 5)
    if (lineItems !== undefined) {
      expense.lineItems = lineItems;
      // Recalculate split from items if itemized
      if (expense.splitConfig?.type === 'itemized') {
        const itemSplit = expense.calculateSplitFromItems();
        if (itemSplit) {
          expense.splitConfig = itemSplit;
        }
      }
    }
    
    // Update receipts (Comment 6)
    if (receipts !== undefined) {
      expense.receipts = receipts;
    }
    
    // Update recurrence (Comment 3)
    if (recurrence !== undefined) {
      if (recurrence.enabled) {
        expense.recurrence = {
          ...expense.recurrence,
          enabled: true,
          frequency: recurrence.frequency,
          interval: recurrence.interval || 1,
          endDate: recurrence.endDate ? new Date(recurrence.endDate) : null,
        };
        expense.recurrence.nextRunAt = expense.calculateNextRunDate();
      } else {
        expense.recurrence.enabled = false;
      }
    }

    await expense.save();

    const updatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('groupId', 'name')
      .lean();

    // Invalidate caches for this group
    await invalidateBalanceCache(expense.groupId._id.toString());
    await invalidateExpenseCache(expense.groupId._id.toString());

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup, emitAnalyticsUpdate } = await import('../utils/socketEmitter.js');
      emitToGroup(io, expense.groupId._id.toString(), 'expense:updated', updatedExpense);
      
      // Emit analytics update
      emitAnalyticsUpdate(io, expense.groupId._id.toString(), {
        action: 'expenseUpdated',
        amount: updatedExpense.amount,
        category: updatedExpense.category,
      });
    }

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
    const expense = await Expense.findById(req.params.id).populate('groupId').lean();

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a group member
    if (!expense.groupId.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Only payer or group creator (admin) can delete expense
    const isPayer = expense.paidBy.toString() === req.user._id.toString();
    const isAdmin = expense.groupId.createdBy.toString() === req.user._id.toString();
    if (!isPayer && !isAdmin) {
      return res.status(403).json({ message: 'Only the payer or group admin can delete this expense' });
    }

    const groupId = expense.groupId._id;
    await Expense.findByIdAndDelete(req.params.id);

    // Invalidate caches for this group
    await invalidateBalanceCache(groupId.toString());
    await invalidateExpenseCache(groupId.toString());

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup, emitAnalyticsUpdate } = await import('../utils/socketEmitter.js');
      emitToGroup(io, groupId.toString(), 'expense:deleted', { expenseId: req.params.id });
      
      // Emit analytics update
      emitAnalyticsUpdate(io, groupId.toString(), {
        action: 'expenseRemoved',
        expenseId: req.params.id,
      });
    }

    res.json({ message: 'Expense deleted successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload receipts to an expense
// @route   POST /api/expenses/:id/receipts
// @access  Private
export const uploadExpenseReceipts = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate('groupId');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a group member
    if (!expense.groupId.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check role-based permissions - only payer or admin can upload receipts
    const isPayer = expense.paidBy.toString() === req.user._id.toString();
    const isAdmin = expense.groupId.createdBy.toString() === req.user._id.toString();
    if (!isPayer && !isAdmin) {
      return res.status(403).json({ message: 'Only the payer or group admin can upload receipts' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Check total receipts limit (5 max)
    const currentCount = expense.receipts?.length || 0;
    if (currentCount + req.files.length > 5) {
      return res.status(400).json({ 
        message: `Maximum 5 receipts allowed. Current: ${currentCount}, Trying to add: ${req.files.length}` 
      });
    }

    // Save receipt files to disk and get metadata
    const savedReceipts = await saveReceiptFiles(req.files, expense._id.toString());

    if (savedReceipts.length === 0) {
      return res.status(500).json({ message: 'Failed to save receipt files' });
    }

    // Add new receipts to expense
    expense.receipts = [...(expense.receipts || []), ...savedReceipts];
    await expense.save();

    const updatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('groupId', 'name');

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup } = await import('../utils/socketEmitter.js');
      emitToGroup(io, expense.groupId._id.toString(), 'expense:updated', updatedExpense);
    }

    res.json({ 
      success: true, 
      receipts: savedReceipts,
      expense: updatedExpense 
    });
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a receipt from an expense
// @route   DELETE /api/expenses/:id/receipts/:receiptId
// @access  Private
export const deleteExpenseReceipt = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).populate('groupId');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a group member
    if (!expense.groupId.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check role-based permissions
    const isPayer = expense.paidBy.toString() === req.user._id.toString();
    const isAdmin = expense.groupId.createdBy.toString() === req.user._id.toString();
    if (!isPayer && !isAdmin) {
      return res.status(403).json({ message: 'Only the payer or group admin can delete receipts' });
    }

    // Find the receipt to delete
    const receiptIndex = expense.receipts?.findIndex(
      r => r._id.toString() === req.params.receiptId
    );

    if (receiptIndex === -1 || receiptIndex === undefined) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    // Delete the file from disk
    const receiptToDelete = expense.receipts[receiptIndex];
    await deleteReceiptFiles([receiptToDelete]);

    // Remove from expense
    expense.receipts.splice(receiptIndex, 1);
    await expense.save();

    res.json({ success: true, message: 'Receipt deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export expenses report and email to user
// @route   POST /api/expenses/export
// @access  Private
export const exportExpensesReport = async (req, res) => {
  try {
    const { groupId, startDate, endDate, format } = req.body;

    const result = await generateAndEmailReport(req.user._id, {
      groupId,
      startDate,
      endDate,
      format: format || 'csv',
    });

    if (!result.success) {
      if (result.reason === 'preference_disabled') {
        return res.status(400).json({ 
          message: 'Export reports are disabled in your email preferences. Enable them to receive reports via email.',
          code: 'PREFERENCE_DISABLED'
        });
      }
      if (result.reason === 'no_groups') {
        return res.status(400).json({ 
          message: 'You need to be a member of at least one group to export expenses. Create or join a group first.',
          code: 'NO_GROUPS'
        });
      }
      // Catch any other failure reasons
      return res.status(400).json({ message: result.reason || 'Failed to generate export' });
    }

    res.json({ 
      success: true, 
      message: 'Export report has been sent to your email',
      expenses: result.expenses,
      settlements: result.settlements,
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check and send budget alerts for user
// @route   POST /api/expenses/check-budget
// @access  Private
export const checkUserBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user's groups and calculate current month spending
    const groups = await Group.find({ members: userId }).lean();
    const groupIds = groups.map(g => g._id);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Calculate total spending for current month
    const result = await Expense.aggregate([
      {
        $match: {
          groupId: { $in: groupIds },
          date: { $gte: startOfMonth },
          splitAmong: userId,
        },
      },
      {
        $unwind: '$splitConfig.shares',
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: [{ $toString: '$splitConfig.shares.k' }, userId.toString()] },
                '$splitConfig.shares.v',
                0
              ]
            }
          },
        },
      },
    ]);

    // Simpler calculation - just get user's share from all expenses
    const expenses = await Expense.find({
      groupId: { $in: groupIds },
      date: { $gte: startOfMonth },
      splitAmong: userId,
    }).lean();

    let currentSpend = 0;
    expenses.forEach(exp => {
      const shares = exp.splitConfig?.shares || {};
      if (shares[userId.toString()]) {
        currentSpend += shares[userId.toString()];
      }
    });

    // Check and potentially send budget alert
    await checkAndSendBudgetAlert(userId, currentSpend);

    res.json({ 
      currentSpend,
      month: startOfMonth.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
