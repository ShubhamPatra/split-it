/**
 * Balance Calculation Worker
 * 
 * Processes balance calculation jobs for groups.
 * Handles complex balance computations offloaded from request handlers.
 * 
 * Optimizations:
 * - Uses MongoDB aggregation instead of loading all expenses/settlements
 * - Caches results with longer TTL
 * - Debounces rapid recalculations
 */

import mongoose from 'mongoose';
import { balanceQueue } from '../config/queue.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import redis from '../config/redis.js';

// Cache TTL for balance results (15 minutes - longer since we recalc on changes)
const BALANCE_CACHE_TTL = 900;

// Debounce key TTL (5 seconds - prevent rapid recalculations)
const DEBOUNCE_TTL = 5;

/**
 * Initialize the balance worker processor
 */
export const initBalanceWorker = () => {
  balanceQueue.process(async (job) => {
    const { groupId, userId } = job.data;

    if (!groupId) {
      throw new Error('Missing required field: groupId');
    }

    // Check debounce - skip if recently calculated
    const debounceKey = `balance:debounce:${groupId}`;
    const isDebounced = await redis.get(debounceKey);
    if (isDebounced) {
      // Return cached result instead
      const cached = await redis.get(`balances:${groupId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      // Set debounce flag
      await redis.setex(debounceKey, DEBOUNCE_TTL, '1');
      
      const result = await calculateGroupBalancesOptimized(groupId);
      
      // Cache the result
      const cacheKey = `balances:${groupId}`;
      await redis.setex(cacheKey, BALANCE_CACHE_TTL, JSON.stringify(result));

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Balance calculated for group ${groupId}`);
      }

      return result;
    } catch (error) {
      console.error(`Balance worker failed for group ${groupId}:`, error.message);
      throw error;
    }
  });

  console.log('Balance worker initialized');
};

/**
 * Calculate balances using MongoDB aggregation (optimized)
 * @param {string} groupId - The group ID
 * @returns {Object} Balances object with per-user balances and suggestions
 */
export const calculateGroupBalancesOptimized = async (groupId) => {
  const groupObjectId = new mongoose.Types.ObjectId(groupId);
  
  // Fetch group members (required for member map)
  const group = await Group.findById(groupId).populate('members', 'name email').lean();
  if (!group) {
    throw new Error('Group not found');
  }

  // Build member map and initialize balances
  const balances = {};
  const memberMap = {};
  group.members.forEach(member => {
    const memberId = member._id.toString();
    balances[memberId] = 0;
    memberMap[memberId] = {
      id: memberId,
      name: member.name,
      email: member.email,
    };
  });

  // Use aggregation to calculate expense totals per user
  // This is much more efficient than loading all expenses into memory
  const [expenseCredits, expenseDebits, settlementTotals, expenseSum, settlementSum] = await Promise.all([
    // Credits: Amount paid by each user
    Expense.aggregate([
      { $match: { groupId: groupObjectId } },
      { $group: { _id: '$paidBy', totalPaid: { $sum: '$amount' } } },
    ]),
    
    // Debits: We need to process these more carefully due to split types
    // For now, fetch only the required fields
    Expense.find({ groupId: groupObjectId })
      .select('splitConfig splitAmong amount')
      .lean(),
    
    // Settlement totals per user
    Settlement.aggregate([
      { $match: { groupId: groupObjectId } },
      {
        $facet: {
          fromUser: [
            { $group: { _id: '$fromUserId', total: { $sum: '$amount' } } },
          ],
          toUser: [
            { $group: { _id: '$toUserId', total: { $sum: '$amount' } } },
          ],
        },
      },
    ]),
    
    // Total expenses (for stats)
    Expense.aggregate([
      { $match: { groupId: groupObjectId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    
    // Total settlements (for stats)
    Settlement.aggregate([
      { $match: { groupId: groupObjectId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  // Apply expense credits (what each person paid)
  expenseCredits.forEach(({ _id, totalPaid }) => {
    const memberId = _id.toString();
    if (balances[memberId] !== undefined) {
      balances[memberId] += totalPaid;
    }
  });

  // Apply expense debits (what each person owes)
  for (const expense of expenseDebits) {
    const shares = expense.splitConfig?.shares || {};
    const splitType = expense.splitConfig?.type || 'equal';
    const splitAmong = (expense.splitAmong || []).map(id => id.toString());
    const amount = expense.amount;

    if (splitType === 'equal') {
      const shareAmount = amount / splitAmong.length;
      splitAmong.forEach(memberId => {
        if (balances[memberId] !== undefined) {
          balances[memberId] -= shareAmount;
        }
      });
    } else if (splitType === 'exact' || splitType === 'itemized') {
      Object.entries(shares).forEach(([memberId, shareAmount]) => {
        if (balances[memberId] !== undefined) {
          balances[memberId] -= shareAmount;
        }
      });
    } else if (splitType === 'percentage') {
      Object.entries(shares).forEach(([memberId, percentage]) => {
        if (balances[memberId] !== undefined) {
          balances[memberId] -= (percentage / 100) * amount;
        }
      });
    }
  }

  // Apply settlement adjustments
  const settlements = settlementTotals[0] || { fromUser: [], toUser: [] };
  
  settlements.fromUser.forEach(({ _id, total }) => {
    const memberId = _id.toString();
    if (balances[memberId] !== undefined) {
      balances[memberId] += total;
    }
  });
  
  settlements.toUser.forEach(({ _id, total }) => {
    const memberId = _id.toString();
    if (balances[memberId] !== undefined) {
      balances[memberId] -= total;
    }
  });

  // Round balances to 2 decimal places
  Object.keys(balances).forEach(key => {
    balances[key] = Math.round(balances[key] * 100) / 100;
  });

  // Generate settlement suggestions using greedy algorithm
  const suggestions = generateSettlementSuggestions(balances);

  return {
    balances,
    members: memberMap,
    suggestions,
    totalExpenses: expenseSum[0]?.total || 0,
    totalSettlements: settlementSum[0]?.total || 0,
    calculatedAt: new Date().toISOString(),
  };
};

// Keep legacy function for backwards compatibility
export const calculateGroupBalances = calculateGroupBalancesOptimized;

/**
 * Generate optimal settlement suggestions using greedy algorithm
 * @param {Object} balances - Object mapping user IDs to balance amounts
 * @returns {Array} Array of suggested transactions
 */
export const generateSettlementSuggestions = (balances) => {
  const suggestions = [];
  
  // Separate debtors (negative balance) and creditors (positive balance)
  const debtors = [];
  const creditors = [];
  
  Object.entries(balances).forEach(([userId, balance]) => {
    if (balance < -0.01) {
      debtors.push({ userId, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ userId, amount: balance });
    }
  });

  // Sort by amount (largest first for optimal matching)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Greedy matching
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) {
      suggestions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return suggestions;
};

/**
 * Queue a balance calculation job
 * @param {string} groupId - The group ID
 * @param {Object} options - Bull job options
 */
export const queueBalanceCalculation = async (groupId, options = {}) => {
  return balanceQueue.add({ groupId }, options);
};

/**
 * Invalidate balance cache for a group
 * @param {string} groupId - The group ID
 */
export const invalidateBalanceCache = async (groupId) => {
  const cacheKey = `balances:${groupId}`;
  await redis.del(cacheKey);
};

export default initBalanceWorker;
