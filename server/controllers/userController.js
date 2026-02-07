import User from '../models/User.js';
import crypto from 'crypto';
import { logAuthEvent } from '../middleware/auditMiddleware.js';

// Helper to generate ETag from data
const generateETag = (data) => {
  const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  return `"${hash}"`;
};

// @desc    Get user profile (used for profile page)
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
      emailPreferences: user.emailPreferences || {},
      budgetSettings: user.budgetSettings || {},
    };

    // Generate ETag
    const etag = `"user-${user._id}-${user.updatedAt?.getTime() || Date.now()}"`;
    res.set('ETag', etag);
    res.set('Cache-Control', 'private, max-age=60');

    // Check If-None-Match
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.json(responseData);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, upiId } = req.body;

    if (name) user.name = name;
    if (email) {
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }
    if (upiId !== undefined) user.upiId = upiId;

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
      emailPreferences: user.emailPreferences || {},
      budgetSettings: user.budgetSettings || {},
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get email preferences
// @route   GET /api/users/email-preferences
// @access  Private
export const getEmailPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('emailPreferences');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const responseData = user.emailPreferences || {};

    // Generate ETag for caching
    const etag = generateETag(responseData);

    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      return res.status(304).end(); // Not Modified
    }

    // Set ETag header and send response
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update email preferences
// @route   PUT /api/users/email-preferences
// @access  Private
export const updateEmailPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validPreferences = [
      'weeklyDigest', 'monthlyDigest',
      'expenseAdded', 'settlementConfirmation', 'paymentReminders',
      'recurringExpenseReminder', 'recurringExpenseGenerated',
      'memberJoined', 'groupInvite',
      'budgetAlerts', 'exportReports'
    ];

    // Update only valid preference fields
    for (const key of validPreferences) {
      if (req.body[key] !== undefined) {
        user.emailPreferences[key] = Boolean(req.body[key]);
      }
    }

    await user.save();
    res.json(user.emailPreferences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get budget settings
// @route   GET /api/users/budget-settings
// @access  Private
export const getBudgetSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('budgetSettings');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const responseData = user.budgetSettings || {};

    // Generate ETag for caching
    const etag = generateETag(responseData);

    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      return res.status(304).end(); // Not Modified
    }

    // Set ETag header and send response
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update budget settings
// @route   PUT /api/users/budget-settings
// @access  Private
export const updateBudgetSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { monthlyLimit, categoryLimits, alertThreshold } = req.body;

    if (monthlyLimit !== undefined) {
      user.budgetSettings.monthlyLimit = Math.max(0, Number(monthlyLimit));
    }
    if (categoryLimits !== undefined) {
      user.budgetSettings.categoryLimits = categoryLimits;
    }
    if (alertThreshold !== undefined) {
      user.budgetSettings.alertThreshold = Math.min(100, Math.max(1, Number(alertThreshold)));
    }

    await user.save();
    res.json(user.budgetSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user spending and budget status
// @route   GET /api/users/spending
// @access  Private
export const getUserSpending = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('budgetSettings');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get all groups user is a member of
    const Group = (await import('../models/Group.js')).default;
    const Expense = (await import('../models/Expense.js')).default;

    const groups = await Group.find({ members: req.user._id });
    const groupIds = groups.map(g => g._id);

    // Calculate current month spending
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get all expenses from user's groups in current month
    const expenses = await Expense.find({
      groupId: { $in: groupIds },
      date: { $gte: startOfMonth },
    });

    // Calculate total spending (only count expenses where user is involved)
    let totalSpending = 0;
    const categorySpending = {};

    expenses.forEach(expense => {
      // Check if user is involved in this expense (paid or split among)
      const isPayer = expense.paidBy?.toString() === req.user._id.toString();
      const isSplitAmong = expense.splitAmong?.some(id => id.toString() === req.user._id.toString());

      if (isPayer || isSplitAmong) {
        // Calculate user's share of the expense
        let userShare = 0;

        if (expense.splitConfig?.type === 'equal') {
          // Equal split
          userShare = expense.amount / (expense.splitAmong?.length || 1);
        } else if (expense.splitConfig?.type === 'exact') {
          // Exact split - find user's amount
          const userSplit = expense.splitConfig.splits?.find(
            s => s.userId?.toString() === req.user._id.toString()
          );
          userShare = userSplit?.amount || 0;
        } else if (expense.splitConfig?.type === 'percentage') {
          // Percentage split
          const userSplit = expense.splitConfig.splits?.find(
            s => s.userId?.toString() === req.user._id.toString()
          );
          userShare = (expense.amount * (userSplit?.percentage || 0)) / 100;
        } else if (expense.splitConfig?.type === 'itemized') {
          // Itemized split - sum user's items
          expense.lineItems?.forEach(item => {
            if (item.assignedTo?.some(id => id.toString() === req.user._id.toString())) {
              userShare += item.amount / (item.assignedTo?.length || 1);
            }
          });
        } else {
          // Default to equal split
          userShare = expense.amount / (expense.splitAmong?.length || 1);
        }

        totalSpending += userShare;

        // Track by category
        const category = expense.category || 'other';
        categorySpending[category] = (categorySpending[category] || 0) + userShare;
      }
    });

    // Calculate budget status
    const budgetSettings = user.budgetSettings || {};
    const monthlyLimit = budgetSettings.monthlyLimit || 0;
    const alertThreshold = budgetSettings.alertThreshold || 80;

    const percentUsed = monthlyLimit > 0 ? (totalSpending / monthlyLimit) * 100 : 0;
    const isOverBudget = monthlyLimit > 0 && totalSpending > monthlyLimit;
    const isNearLimit = monthlyLimit > 0 && percentUsed >= alertThreshold && percentUsed < 100;

    // Calculate category budget status
    const categoryBudgetStatus = {};
    if (budgetSettings.categoryLimits) {
      const categoryLimitsObj = budgetSettings.categoryLimits instanceof Map
        ? Object.fromEntries(budgetSettings.categoryLimits)
        : budgetSettings.categoryLimits;

      Object.entries(categoryLimitsObj).forEach(([categoryId, limit]) => {
        const spent = categorySpending[categoryId] || 0;
        const categoryLimit = Number(limit) || 0;
        const categoryPercentUsed = categoryLimit > 0 ? (spent / categoryLimit) * 100 : 0;

        categoryBudgetStatus[categoryId] = {
          limit: categoryLimit,
          spent,
          remaining: Math.max(0, categoryLimit - spent),
          percentUsed: categoryPercentUsed,
          isOverBudget: categoryLimit > 0 && spent > categoryLimit,
          isNearLimit: categoryLimit > 0 && categoryPercentUsed >= alertThreshold && categoryPercentUsed < 100,
        };
      });
    }

    res.json({
      budgetSettings,
      totalSpending,
      monthlyLimit,
      remaining: Math.max(0, monthlyLimit - totalSpending),
      percentUsed,
      isOverBudget,
      isNearLimit,
      categorySpending,
      categoryBudgetStatus,
      groupCount: groups.length,
      expenseCount: expenses.length,
    });
  } catch (error) {
    console.error('Error getting user spending:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID (for group members)
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
    };

    // Generate ETag for caching
    const etag = generateETag(responseData);

    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      return res.status(304).end(); // Not Modified
    }

    // Set ETag header and send response
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search users by email or name
// @route   GET /api/users/search?q=query
// @access  Private
export const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    })
      .select('-password')
      .limit(10);

    res.json(users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      upiId: u.upiId || '',
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user account (GDPR-compliant)
// @route   DELETE /api/users/account
// @access  Private
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password, confirmText } = req.body;

    // Validate confirmation text
    if (confirmText !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({
        message: 'Please type "DELETE MY ACCOUNT" to confirm deletion',
        code: 'INVALID_CONFIRMATION',
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password (skip for Google OAuth users)
    if (!user.googleId) {
      if (!password) {
        return res.status(400).json({ message: 'Password is required to delete account' });
      }
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        // Log failed deletion attempt
        await logAuthEvent('user.delete', userId, 'failure', req, {
          message: 'Invalid password provided for account deletion',
          code: 'INVALID_PASSWORD',
        });

        return res.status(401).json({ message: 'Invalid password' });
      }
    }

    // Import models
    const Group = (await import('../models/Group.js')).default;
    const Expense = (await import('../models/Expense.js')).default;
    const Settlement = (await import('../models/Settlement.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Message = (await import('../models/Message.js')).default;
    const Invite = (await import('../models/Invite.js')).default;
    const PushSubscription = (await import('../models/PushSubscription.js')).default;

    // Start transaction for data consistency
    const session = await User.startSession();
    session.startTransaction();

    try {
      // 1. Remove user from all groups
      const userGroups = await Group.find({ members: userId }).session(session);

      for (const group of userGroups) {
        // Remove from members array
        group.members = group.members.filter(m => m.toString() !== userId.toString());

        // Remove from memberRoles map
        group.memberRoles.delete(userId.toString());

        // If user was the creator and group has other members, transfer ownership
        if (group.createdBy.toString() === userId.toString()) {
          if (group.members.length > 0) {
            // Transfer to first remaining admin, or first member
            const firstAdmin = Array.from(group.memberRoles.entries())
              .find(([id, role]) => role === 'admin' && id !== userId.toString());

            const newCreator = firstAdmin ? firstAdmin[0] : group.members[0].toString();
            group.createdBy = newCreator;
            group.memberRoles.set(newCreator, 'admin');
          } else {
            // No members left, delete the group
            await Group.deleteOne({ _id: group._id }).session(session);

            // Delete all expenses in this group
            await Expense.deleteMany({ groupId: group._id }).session(session);

            // Delete all settlements in this group
            await Settlement.deleteMany({ groupId: group._id }).session(session);

            // Delete all messages in this group
            await Message.deleteMany({ groupId: group._id }).session(session);

            // Delete all invites for this group
            await Invite.deleteMany({ groupId: group._id }).session(session);

            continue; // Skip saving since group is deleted
          }
        }

        await group.save({ session });
      }

      // 2. Anonymize expenses (keep for balance integrity)
      // Replace user references with a special "Deleted User" marker
      const deletedUserName = `[Deleted User ${userId.toString().slice(-6)}]`;

      await Expense.updateMany(
        { paidBy: userId },
        {
          $set: {
            paidBy: null, // Set to null to indicate deleted user
            'metadata.deletedUserName': deletedUserName,
          }
        },
        { session }
      );

      // Remove from splitAmong arrays
      await Expense.updateMany(
        { splitAmong: userId },
        { $pull: { splitAmong: userId } },
        { session }
      );

      // Remove from line item assignments
      await Expense.updateMany(
        { 'lineItems.assignedTo': userId },
        { $pull: { 'lineItems.$[].assignedTo': userId } },
        { session }
      );

      // 3. Anonymize settlements (keep for audit trail)
      await Settlement.updateMany(
        { $or: [{ fromUserId: userId }, { toUserId: userId }] },
        {
          $set: {
            'metadata.deletedUserName': deletedUserName,
          }
        },
        { session }
      );

      // 4. Delete all notifications for this user
      await Notification.deleteMany({ userId }, { session });

      // 5. Anonymize messages (soft delete)
      await Message.updateMany(
        { senderId: userId },
        {
          $set: {
            deletedAt: new Date(),
            deletedBy: userId,
            content: '[Message from deleted user]',
          }
        },
        { session }
      );

      // Remove from readBy arrays
      await Message.updateMany(
        { readBy: userId },
        { $pull: { readBy: userId } },
        { session }
      );

      // 6. Revoke all invites created by this user
      await Invite.updateMany(
        { inviterId: userId, status: 'pending' },
        { $set: { status: 'revoked' } },
        { session }
      );

      // 7. Delete push subscriptions
      await PushSubscription.deleteMany({ userId }, { session });

      // 8. Anonymize user data before deletion (for audit trail)
      user.name = deletedUserName;
      user.email = `deleted_${userId}@deleted.local`;
      user.password = undefined;
      user.googleId = undefined;
      user.upiId = '';
      user.emailPreferences = undefined;
      user.budgetSettings = undefined;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      user.verificationToken = undefined;
      user.verificationTokenExpire = undefined;

      // Mark as deleted with timestamp
      user.deletedAt = new Date();
      await user.save({ session });

      // Actually delete the user document
      await User.deleteOne({ _id: userId }, { session });

      // Log account deletion (before committing transaction)
      await logAuthEvent('user.delete', userId, 'success', req, {
        message: 'Account permanently deleted',
        deletedUserName,
      });

      // Commit transaction
      await session.commitTransaction();

      // Clear auth cookies
      res.cookie('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(0),
      });

      res.cookie('refresh_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(0),
      });

      res.json({
        success: true,
        message: 'Your account has been permanently deleted. We\'re sorry to see you go.',
      });

    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      message: 'Error deleting account. Please try again or contact support.'
    });
  }
};
