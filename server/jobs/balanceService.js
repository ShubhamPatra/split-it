/**
 * Balance Calculation Service
 * 
 * Balance calculation service with Redis caching (fallback to in-memory).
 * Supports horizontal scaling when Redis is available.
 */

import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import { RedisCache } from '../config/redis.js';

// Redis cache for balances (with in-memory fallback)
const balanceCache = new RedisCache('balances', 900); // 15 minutes TTL
const debounceCache = new RedisCache('balance:debounce', 5); // 5 seconds TTL

// Cache TTL constants
const CACHE_TTL = 900; // 15 minutes in seconds
const DEBOUNCE_TTL = 5; // 5 seconds in seconds

// Cleanup interval for in-memory fallback
let cacheCleanupInterval = null;

/**
 * Initialize balance service
 */
export const initializeBalanceService = () => {
    // Clean up expired cache entries every 5 minutes (for in-memory fallback)
    if (!cacheCleanupInterval) {
        cacheCleanupInterval = setInterval(() => {
            balanceCache.cleanup();
            debounceCache.cleanup();
        }, 300000);
    }
};

/**
 * Stop balance service (for graceful shutdown)
 */
export const stopBalanceService = () => {
    if (cacheCleanupInterval) {
        clearInterval(cacheCleanupInterval);
        cacheCleanupInterval = null;
    }
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
        // Credits: Amount paid by each user (use converted amount for balance calculation)
        Expense.aggregate([
            { $match: { groupId: groupObjectId } },
            { 
                $group: { 
                    _id: '$paidBy', 
                    totalPaid: { 
                        $sum: { 
                            $ifNull: ['$amountInBaseCurrency', '$amount'] // Fallback to amount for old expenses
                        } 
                    } 
                } 
            },
        ]),

        // Debits: Fetch fields for processing
        Expense.find({ groupId: groupObjectId })
            .select('splitConfig splitAmong amount amountInBaseCurrency')
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

        // Total expenses (for stats) - use converted amounts
        Expense.aggregate([
            { $match: { groupId: groupObjectId } },
            { 
                $group: { 
                    _id: null, 
                    total: { 
                        $sum: { 
                            $ifNull: ['$amountInBaseCurrency', '$amount'] 
                        } 
                    } 
                } 
            },
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
        // Use converted amount for balance calculation, fallback to original amount for old expenses
        const amount = expense.amountInBaseCurrency || expense.amount;

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
    const cacheKey = groupId;
    const debounceKey = groupId;

    // If force refresh, skip all caching and debouncing
    if (forceRefresh) {
        const result = await calculateGroupBalancesOptimized(groupId);
        
        // Cache the result
        await balanceCache.set(cacheKey, result, CACHE_TTL);
        
        // Reset debounce timer
        await debounceCache.set(debounceKey, true, DEBOUNCE_TTL);
        
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Balance] Force calculated for group ${groupId}`);
        }
        
        return result;
    }

    // Check cache first (before debounce check)
    const cached = await balanceCache.get(cacheKey);
    if (cached) {
        // Check if we're within debounce window - if so, return cached
        const debounced = await debounceCache.exists(debounceKey);
        if (debounced) {
            return cached;
        }
    }

    // Set debounce flag
    await debounceCache.set(debounceKey, true, DEBOUNCE_TTL);

    // Calculate balances
    const result = await calculateGroupBalancesOptimized(groupId);

    // Cache the result
    await balanceCache.set(cacheKey, result, CACHE_TTL);

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Balance] Calculated for group ${groupId}`);
    }

    return result;
};

/**
 * Invalidate balance cache for a group
 * @param {string} groupId - The group ID
 */
export const invalidateBalanceCache = async (groupId) => {
    const cacheKey = groupId;
    const debounceKey = groupId;

    await balanceCache.delete(cacheKey);
    await debounceCache.delete(debounceKey);

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Balance] Cache invalidated for group ${groupId}`);
    }
};

/**
 * Get cached balance if available
 * @param {string} groupId - The group ID
 * @returns {Promise<Object|null>} Cached balance or null
 */
export const getCachedBalance = async (groupId) => {
    const cacheKey = groupId;
    return await balanceCache.get(cacheKey);
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
