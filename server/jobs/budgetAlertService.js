/**
 * Budget Alert Service
 * 
 * Checks user and group budgets and sends alerts when thresholds are exceeded.
 * Can be called after expense creation or run periodically.
 */

import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import { notifyUsers } from './notificationService.js';
import { checkAndSendBudgetAlert } from '../utils/emailUtils.js';

/**
 * Check and send personal budget alerts for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Alert status
 */
export const checkPersonalBudgetAlert = async (userId) => {
  try {
    const user = await User.findById(userId).select('name budgetSettings emailPreferences');
    
    if (!user || !user.budgetSettings?.monthlyLimit || user.budgetSettings.monthlyLimit <= 0) {
      return { checked: false, reason: 'No budget set' };
    }

    // Get all groups user is a member of
    const groups = await Group.find({ members: userId });
    const groupIds = groups.map(g => g._id);

    // Calculate current month spending
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const expenses = await Expense.find({
      groupId: { $in: groupIds },
      date: { $gte: startOfMonth },
    });

    // Calculate user's share of expenses
    let totalSpending = 0;
    const categorySpending = {};

    expenses.forEach(expense => {
      const isPayer = expense.paidBy?.toString() === userId.toString();
      const isSplitAmong = expense.splitAmong?.some(id => id.toString() === userId.toString());
      
      if (isPayer || isSplitAmong) {
        let userShare = 0;
        
        if (expense.splitConfig?.type === 'equal') {
          userShare = expense.amount / (expense.splitAmong?.length || 1);
        } else if (expense.splitConfig?.type === 'exact') {
          const userSplit = expense.splitConfig.splits?.find(
            s => s.userId?.toString() === userId.toString()
          );
          userShare = userSplit?.amount || 0;
        } else if (expense.splitConfig?.type === 'percentage') {
          const userSplit = expense.splitConfig.splits?.find(
            s => s.userId?.toString() === userId.toString()
          );
          userShare = (expense.amount * (userSplit?.percentage || 0)) / 100;
        } else if (expense.splitConfig?.type === 'itemized') {
          expense.lineItems?.forEach(item => {
            if (item.assignedTo?.some(id => id.toString() === userId.toString())) {
              userShare += item.amount / (item.assignedTo?.length || 1);
            }
          });
        } else {
          userShare = expense.amount / (expense.splitAmong?.length || 1);
        }

        totalSpending += userShare;
        
        const category = expense.category || 'other';
        categorySpending[category] = (categorySpending[category] || 0) + userShare;
      }
    });

    const monthlyLimit = user.budgetSettings.monthlyLimit;
    const alertThreshold = user.budgetSettings.alertThreshold || 80;
    const percentUsed = (totalSpending / monthlyLimit) * 100;

    // Check if alert should be sent
    if (percentUsed < alertThreshold) {
      return { checked: true, alertSent: false, percentUsed, reason: 'Below threshold' };
    }

    // Send in-app notification
    const alertType = percentUsed >= 100 ? 'exceeded' : 'warning';
    const title = percentUsed >= 100 ? 'Budget Exceeded!' : 'Budget Alert';
    const message = percentUsed >= 100
      ? `You've exceeded your monthly budget of ₹${monthlyLimit.toLocaleString()}. Current spending: ₹${totalSpending.toLocaleString()}`
      : `You've used ${percentUsed.toFixed(0)}% of your monthly budget (₹${totalSpending.toLocaleString()} of ₹${monthlyLimit.toLocaleString()})`;

    await notifyUsers([userId.toString()], {
      type: alertType === 'exceeded' ? 'error' : 'warning',
      title,
      message,
      data: {
        actionType: 'budget_alert',
        budgetType: 'personal',
        totalSpending,
        monthlyLimit,
        percentUsed,
      },
    });

    // Send email alert if enabled
    if (user.emailPreferences?.budgetAlerts) {
      await checkAndSendBudgetAlert(userId, totalSpending);
    }

    return {
      checked: true,
      alertSent: true,
      alertType,
      percentUsed,
      totalSpending,
      monthlyLimit,
    };
  } catch (error) {
    console.error('Error checking personal budget alert:', error);
    return { checked: false, error: error.message };
  }
};

/**
 * Check and send group budget alerts
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Alert status
 */
export const checkGroupBudgetAlert = async (groupId) => {
  try {
    const group = await Group.findById(groupId).populate('members', 'name email emailPreferences');
    
    if (!group || !group.budget?.enabled || !group.budget?.monthlyLimit || group.budget.monthlyLimit <= 0) {
      return { checked: false, reason: 'No budget set' };
    }

    // Calculate current month spending
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const expenses = await Expense.find({
      groupId: group._id,
      date: { $gte: startOfMonth },
    });

    const totalSpending = expenses.reduce((sum, e) => sum + e.amount, 0);
    const categorySpending = {};
    
    expenses.forEach(expense => {
      const category = expense.category || 'other';
      categorySpending[category] = (categorySpending[category] || 0) + expense.amount;
    });

    const monthlyLimit = group.budget.monthlyLimit;
    const alertThreshold = group.budget.alertThreshold || 80;
    const percentUsed = (totalSpending / monthlyLimit) * 100;

    // Check overall budget
    let overallAlertSent = false;
    if (percentUsed >= alertThreshold) {
      const alertType = percentUsed >= 100 ? 'exceeded' : 'warning';
      const title = percentUsed >= 100 ? 'Group Budget Exceeded!' : 'Group Budget Alert';
      const message = percentUsed >= 100
        ? `Group "${group.name}" has exceeded its monthly budget of ₹${monthlyLimit.toLocaleString()}. Current spending: ₹${totalSpending.toLocaleString()}`
        : `Group "${group.name}" has used ${percentUsed.toFixed(0)}% of its monthly budget (₹${totalSpending.toLocaleString()} of ₹${monthlyLimit.toLocaleString()})`;

      const memberIds = group.members.map(m => m._id.toString());
      
      await notifyUsers(memberIds, {
        type: alertType === 'exceeded' ? 'error' : 'warning',
        title,
        message,
        data: {
          actionType: 'budget_alert',
          budgetType: 'group',
          groupId: group._id.toString(),
          groupName: group.name,
          totalSpending,
          monthlyLimit,
          percentUsed,
        },
      });

      overallAlertSent = true;
    }

    // Check category budgets
    const categoryAlerts = [];
    if (group.budget.categoryLimits) {
      const categoryLimitsObj = group.budget.categoryLimits instanceof Map
        ? Object.fromEntries(group.budget.categoryLimits)
        : group.budget.categoryLimits;

      for (const [categoryId, limitData] of Object.entries(categoryLimitsObj)) {
        const categoryLimit = limitData.limit || 0;
        const categoryThreshold = limitData.alertThreshold || alertThreshold;
        const categorySpent = categorySpending[categoryId] || 0;
        const categoryPercentUsed = categoryLimit > 0 ? (categorySpent / categoryLimit) * 100 : 0;

        if (categoryLimit > 0 && categoryPercentUsed >= categoryThreshold) {
          const alertType = categoryPercentUsed >= 100 ? 'exceeded' : 'warning';
          const categoryName = getCategoryName(categoryId);
          const title = categoryPercentUsed >= 100 
            ? `${categoryName} Budget Exceeded!` 
            : `${categoryName} Budget Alert`;
          const message = categoryPercentUsed >= 100
            ? `Group "${group.name}" has exceeded its ${categoryName} budget of ₹${categoryLimit.toLocaleString()}. Current spending: ₹${categorySpent.toLocaleString()}`
            : `Group "${group.name}" has used ${categoryPercentUsed.toFixed(0)}% of its ${categoryName} budget (₹${categorySpent.toLocaleString()} of ₹${categoryLimit.toLocaleString()})`;

          const memberIds = group.members.map(m => m._id.toString());
          
          await notifyUsers(memberIds, {
            type: alertType === 'exceeded' ? 'error' : 'warning',
            title,
            message,
            data: {
              actionType: 'budget_alert',
              budgetType: 'group_category',
              groupId: group._id.toString(),
              groupName: group.name,
              category: categoryId,
              categoryName,
              totalSpending: categorySpent,
              monthlyLimit: categoryLimit,
              percentUsed: categoryPercentUsed,
            },
          });

          categoryAlerts.push({
            category: categoryId,
            categoryName,
            alertType,
            percentUsed: categoryPercentUsed,
            spent: categorySpent,
            limit: categoryLimit,
          });
        }
      }
    }

    return {
      checked: true,
      overallAlertSent,
      categoryAlerts,
      percentUsed,
      totalSpending,
      monthlyLimit,
    };
  } catch (error) {
    console.error('Error checking group budget alert:', error);
    return { checked: false, error: error.message };
  }
};

/**
 * Check budgets after expense creation
 * @param {string} groupId - Group ID
 * @param {string} userId - User ID who created the expense
 * @returns {Promise<Object>} Alert status
 */
export const checkBudgetsAfterExpense = async (groupId, userId) => {
  try {
    const [groupAlert, personalAlert] = await Promise.all([
      checkGroupBudgetAlert(groupId),
      checkPersonalBudgetAlert(userId),
    ]);

    return {
      groupAlert,
      personalAlert,
    };
  } catch (error) {
    console.error('Error checking budgets after expense:', error);
    return { error: error.message };
  }
};

/**
 * Get category display name
 * @param {string} categoryId - Category ID
 * @returns {string} Category name
 */
const getCategoryName = (categoryId) => {
  const categories = {
    food: 'Food & Drinks',
    travel: 'Travel',
    entertainment: 'Entertainment',
    shopping: 'Shopping',
    housing: 'Housing',
    transport: 'Transport',
    healthcare: 'Healthcare',
    utilities: 'Utilities',
    other: 'Other',
  };
  return categories[categoryId] || categoryId;
};
