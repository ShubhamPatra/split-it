/**
 * Cross-Group Balance Service
 * 
 * Calculates person-to-person balances across all groups.
 * Aggregates balances from multiple groups to show global debt/credit relationships.
 */

import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import User from '../models/User.js';

// In-memory cache for cross-group balances
const crossGroupCache = new Map();
const CACHE_TTL = 900000; // 15 minutes

/**
 * Calculate person-to-person balances across all groups for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Cross-group balances
 */
export const calculateCrossGroupBalances = async (userId) => {
  // Ensure userId is a string for consistent comparisons
  const userIdStr = userId.toString();
  const userObjectId = new mongoose.Types.ObjectId(userIdStr);

  console.log('[CrossGroupBalance] Calculating for userId:', userIdStr);

  // Get all groups the user is a member of
  const userGroups = await Group.find({ members: userObjectId })
    .select('_id name')
    .lean();

  console.log('[CrossGroupBalance] Found groups:', userGroups.length);

  if (userGroups.length === 0) {
    return {
      balances: {},
      people: {},
      suggestions: [],
      totalOwed: 0,
      totalOwing: 0,
      groupBreakdown: [],
      calculatedAt: new Date().toISOString(),
    };
  }

  // Initialize person-to-person balance tracking
  // personBalances[otherUserId] = net amount (positive = they owe me, negative = I owe them)
  const personBalances = {};
  const groupBreakdown = {}; // Track which groups contribute to each person's balance

  // Process each group
  for (const group of userGroups) {
    const groupId = group._id;

    // Get all expenses in this group
    const expenses = await Expense.find({ groupId })
      .select('paidBy splitConfig splitAmong amount description')
      .lean();

    console.log(`[CrossGroupBalance] Group ${group.name}: ${expenses.length} expenses`);

    // Get all confirmed settlements in this group
    const settlements = await Settlement.find({
      groupId,
      paymentStatus: 'confirmed'
    })
      .select('fromUserId toUserId amount')
      .lean();

    // Calculate what I paid vs what I owe in this group
    const groupBalances = {};

    // Process expenses
    for (const expense of expenses) {
      // FIX: Convert all IDs to strings for consistent comparisons
      const paidBy = expense.paidBy.toString();
      const splitAmong = (expense.splitAmong || []).map(id => id.toString());
      const amount = expense.amount;
      const splitType = expense.splitConfig?.type || 'equal';
      // FIX: shares object keys may be ObjectIds or strings - ensure string comparison
      const shares = expense.splitConfig?.shares || {};

      // If I paid this expense
      if (paidBy === userIdStr) {
        // I'm owed by everyone who shared it (except myself)
        if (splitType === 'equal') {
          const shareAmount = amount / splitAmong.length;
          splitAmong.forEach(memberId => {
            if (memberId !== userIdStr) {
              groupBalances[memberId] = (groupBalances[memberId] || 0) + shareAmount;
            }
          });
        } else if (splitType === 'exact' || splitType === 'itemized') {
          Object.entries(shares).forEach(([memberId, shareAmount]) => {
            if (memberId !== userIdStr) {
              groupBalances[memberId] = (groupBalances[memberId] || 0) + shareAmount;
            }
          });
        } else if (splitType === 'percentage') {
          Object.entries(shares).forEach(([memberId, percentage]) => {
            if (memberId !== userIdStr) {
              const shareAmount = (percentage / 100) * amount;
              groupBalances[memberId] = (groupBalances[memberId] || 0) + shareAmount;
            }
          });
        }
      }

      // If I'm part of the split
      if (splitAmong.includes(userIdStr)) {
        let myShare = 0;

        if (splitType === 'equal') {
          myShare = amount / splitAmong.length;
        } else if (splitType === 'exact' || splitType === 'itemized') {
          myShare = shares[userIdStr] || 0;
        } else if (splitType === 'percentage') {
          myShare = ((shares[userIdStr] || 0) / 100) * amount;
        }

        // If someone else paid, I owe them
        if (paidBy !== userIdStr) {
          groupBalances[paidBy] = (groupBalances[paidBy] || 0) - myShare;
        }
      }
    }

    // Process settlements
    for (const settlement of settlements) {
      const fromUser = settlement.fromUserId.toString();
      const toUser = settlement.toUserId.toString();
      const amount = settlement.amount;

      // If I paid someone
      if (fromUser === userIdStr) {
        groupBalances[toUser] = (groupBalances[toUser] || 0) + amount;
      }

      // If someone paid me
      if (toUser === userIdStr) {
        groupBalances[fromUser] = (groupBalances[fromUser] || 0) - amount;
      }
    }

    console.log(`[CrossGroupBalance] Group ${group.name} balances:`, groupBalances);

    // Aggregate group balances into person balances
    Object.entries(groupBalances).forEach(([otherUserId, balance]) => {
      if (Math.abs(balance) > 0.01) {
        personBalances[otherUserId] = (personBalances[otherUserId] || 0) + balance;

        // Track group breakdown
        if (!groupBreakdown[otherUserId]) {
          groupBreakdown[otherUserId] = [];
        }
        groupBreakdown[otherUserId].push({
          groupId: groupId.toString(),
          groupName: group.name,
          balance: Math.round(balance * 100) / 100,
        });
      }
    });
  }

  // Round all balances
  Object.keys(personBalances).forEach(key => {
    personBalances[key] = Math.round(personBalances[key] * 100) / 100;
  });

  // Get user details for all people involved
  const otherUserIds = Object.keys(personBalances);
  const users = await User.find({ _id: { $in: otherUserIds } })
    .select('name email upiId')
    .lean();

  const people = {};
  users.forEach(user => {
    people[user._id.toString()] = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
    };
  });

  // Handle deleted/missing users (edge case)
  otherUserIds.forEach(userId => {
    if (!people[userId]) {
      // User was deleted or not found
      const userIdShort = userId.substring(userId.length - 6);
      people[userId] = {
        id: userId,
        name: `[Deleted User ${userIdShort}]`,
        email: '',
        upiId: '',
        isDeleted: true,
      };
    }
  });

  // Calculate totals
  let totalOwed = 0; // Total amount others owe me
  let totalOwing = 0; // Total amount I owe others

  Object.values(personBalances).forEach(balance => {
    if (balance > 0) {
      totalOwed += balance;
    } else if (balance < 0) {
      totalOwing += Math.abs(balance);
    }
  });

  totalOwed = Math.round(totalOwed * 100) / 100;
  totalOwing = Math.round(totalOwing * 100) / 100;

  console.log('[CrossGroupBalance] Final personBalances:', personBalances);
  console.log('[CrossGroupBalance] Final totals - Owed:', totalOwed, 'Owing:', totalOwing);

  // Generate settlement suggestions
  const suggestions = generateCrossGroupSuggestions(personBalances);

  return {
    balances: personBalances,
    people,
    suggestions,
    totalOwed,
    totalOwing,
    netBalance: Math.round((totalOwed - totalOwing) * 100) / 100,
    groupBreakdown,
    calculatedAt: new Date().toISOString(),
  };
};

/**
 * Generate settlement suggestions for cross-group balances
 * @param {Object} personBalances - Person-to-person balances
 * @returns {Array} Settlement suggestions
 */
export const generateCrossGroupSuggestions = (personBalances) => {
  const suggestions = [];

  Object.entries(personBalances).forEach(([otherUserId, balance]) => {
    if (Math.abs(balance) > 0.01) {
      if (balance > 0) {
        // They owe me
        suggestions.push({
          type: 'receive',
          from: otherUserId,
          to: 'me',
          amount: balance,
          description: 'Across all groups',
        });
      } else {
        // I owe them
        suggestions.push({
          type: 'pay',
          from: 'me',
          to: otherUserId,
          amount: Math.abs(balance),
          description: 'Across all groups',
        });
      }
    }
  });

  // Sort by amount (largest first)
  suggestions.sort((a, b) => b.amount - a.amount);

  return suggestions;
};

/**
 * Calculate cross-group balances with caching
 * @param {string} userId - The user ID
 * @param {boolean} forceRefresh - Force recalculation
 * @returns {Promise<Object>} Cross-group balances
 */
export const getCrossGroupBalances = async (userId, forceRefresh = false) => {
  const cacheKey = `cross-group:${userId}`;
  const now = Date.now();

  // Check cache
  if (!forceRefresh) {
    const cached = crossGroupCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return cached.data;
    }
  }

  // Calculate fresh
  const result = await calculateCrossGroupBalances(userId);

  // Cache result
  crossGroupCache.set(cacheKey, {
    data: result,
    expiry: now + CACHE_TTL,
  });

  return result;
};

/**
 * Invalidate cross-group balance cache for a user
 * @param {string} userId - The user ID
 */
export const invalidateCrossGroupCache = (userId) => {
  const cacheKey = `cross-group:${userId}`;
  crossGroupCache.delete(cacheKey);
};

/**
 * Invalidate cross-group cache for all members of a group
 * @param {Array} memberIds - Array of user IDs
 */
export const invalidateCrossGroupCacheForMembers = (memberIds) => {
  memberIds.forEach(memberId => {
    invalidateCrossGroupCache(memberId.toString());
  });
};

/**
 * Clear all cross-group cache
 */
export const clearCrossGroupCache = () => {
  crossGroupCache.clear();
};

export default {
  calculateCrossGroupBalances,
  getCrossGroupBalances,
  invalidateCrossGroupCache,
  invalidateCrossGroupCacheForMembers,
  clearCrossGroupCache,
  generateCrossGroupSuggestions,
};
