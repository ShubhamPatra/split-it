/**
 * Balance Calculation Service
 * 
 * Direct balance calculation service with in-memory caching.
 * Replaces the balance queue/worker system with simple async calls.
 */

import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';

// In-memory cache with TTL
const balanceCache = new Map();
const CACHE_TTL = 900000; // 15 minutes in milliseconds

// Debounce tracking
const debounceMap = new Map();
const DEBOUNCE_TTL = 5000; // 5 seconds in milliseconds

// Cleanup intervals
let cacheCleanupInterval = null;
let debounceCleanupInterval = null;

/**
 * Initialize cache cleanup intervals
 */
export const initializeBalanceService = () => {
    // Clean up expired cache entries every 5 minutes
    if (!cacheCleanupInterval) {
        cacheCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, { expiry }] of balanceCache.entries()) {
                if (expiry < now) {
                    balanceCache.delete(key);
                }
            }
        }, 300000);
    }

    // Clean up expired debounce entries every minute
    if (!debounceCleanupInterval) {
        debounceCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, expiry] of debounceMap.entries()) {
                if (expiry < now) {
                    debounceMap.delete(key);
                }
            }
        }, 60000);
    }
};

/**
 * Stop cleanup intervals (for graceful shutdown)
 */
export const stopBalanceService = () => {
    if (cacheCleanupInterval) {
        clearInterval(cacheCleanupInterval);
        cacheCleanupInterval = null;
    }
    if (debounceCleanupInterval) {
        clearInterval(debounceCleanupInterval);
        debounceCleanupInterval = null;
    }
    balanceCache.clear();
    debounceMap.clear();
};

/**
 * Calculate balances using MongoDB aggregation (optimized)
 * @param {string} groupId - The group ID
 * @returns {Promise<Object>} Balances object with per-user balances and suggestions
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
    const [expenseCredits, expenseDebits, settlementTotals, expenseSum, settlementSum] = await Promise.all([
        // Credits: Amount paid by each user
        Expense.aggregate([
            { $match: { groupId: groupObjectId } },
            { $group: { _id: '$paidBy', totalPaid: { $sum: '$amount' } } },
        ]),

        // Debits: Fetch fields for processing
        Expense.find({ groupId: groupObjectId })
            .select('splitConfig splitAmong amount')
            .lean(),

        // Settlement totals per user (only count confirmed settlements)
        Settlement.aggregate([
            { $match: { groupId: groupObjectId, paymentStatus: 'confirmed' } },
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

    // Generate settlement suggestions
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

/**
 * Generate MINIMAL settlement suggestions using greedy algorithm
 * @param {Object} balances - Object mapping user IDs to balance amounts
 * @returns {Array} Array of suggested transactions
 */
export const generateSettlementSuggestions = (balances) => {
    // Separate debtors and creditors
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
        if (balance < -0.01) {
            debtors.push({ userId, amount: Math.abs(balance) });
        } else if (balance > 0.01) {
            creditors.push({ userId, amount: balance });
        }
    });

    // Sort by amount (largest first)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    // Greedy matching
    const suggestions = [];
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

        debtor.amount = Math.round((debtor.amount - settleAmount) * 100) / 100;
        creditor.amount = Math.round((creditor.amount - settleAmount) * 100) / 100;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return suggestions;
};

/**
 * Calculate group balances with caching and debouncing
 * @param {string} groupId - The group ID
 * @param {boolean} forceRefresh - Force recalculation ignoring cache
 * @returns {Promise<Object>} Balances object
 */
export const calculateGroupBalances = async (groupId, forceRefresh = false) => {
    const cacheKey = `balances:${groupId}`;
    const debounceKey = `debounce:${groupId}`;
    const now = Date.now();

    // Check debounce (unless force refresh)
    if (!forceRefresh) {
        const debounceExpiry = debounceMap.get(debounceKey);
        if (debounceExpiry && debounceExpiry > now) {
            // Return cached result if available
            const cached = balanceCache.get(cacheKey);
            if (cached && cached.expiry > now) {
                return cached.data;
            }
        }
    }

    // Set debounce flag
    debounceMap.set(debounceKey, now + DEBOUNCE_TTL);

    // Calculate balances
    const result = await calculateGroupBalancesOptimized(groupId);

    // Cache the result
    balanceCache.set(cacheKey, {
        data: result,
        expiry: now + CACHE_TTL,
    });

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Balance] Calculated for group ${groupId}`);
    }

    return result;
};

/**
 * Invalidate balance cache for a group
 * @param {string} groupId - The group ID
 */
export const invalidateBalanceCache = (groupId) => {
    const cacheKey = `balances:${groupId}`;
    const debounceKey = `debounce:${groupId}`;

    balanceCache.delete(cacheKey);
    debounceMap.delete(debounceKey);

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Balance] Cache invalidated for group ${groupId}`);
    }
};

/**
 * Get cached balance if available
 * @param {string} groupId - The group ID
 * @returns {Object|null} Cached balance or null
 */
export const getCachedBalance = (groupId) => {
    const cacheKey = `balances:${groupId}`;
    const cached = balanceCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    return null;
};

// Initialize on module load
initializeBalanceService();

export default {
    calculateGroupBalances,
    calculateGroupBalancesOptimized,
    generateSettlementSuggestions,
    invalidateBalanceCache,
    getCachedBalance,
    initializeBalanceService,
    stopBalanceService,
};
