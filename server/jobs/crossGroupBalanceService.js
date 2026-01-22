/**
 * Cross-Group Balance Aggregation Service
 * 
 * Calculates net balances between users across all shared groups,
 * with intelligent distribution algorithms for partial payments.
 */

import mongoose from 'mongoose';
import Group from '../models/Group.js';
import { calculateGroupBalances, invalidateBalanceCache } from './balanceService.js';

// In-memory cache for cross-group balances
const crossGroupCache = new Map();
const CROSS_GROUP_CACHE_TTL = 900000; // 15 minutes

// Cleanup interval
let crossGroupCleanupInterval = null;

/**
 * Initialize cross-group balance service
 */
export const initializeCrossGroupBalanceService = () => {
    if (!crossGroupCleanupInterval) {
        crossGroupCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, { expiry }] of crossGroupCache.entries()) {
                if (expiry < now) {
                    crossGroupCache.delete(key);
                }
            }
        }, 300000); // Clean every 5 minutes
    }
};

/**
 * Stop cross-group balance service cleanup
 */
export const stopCrossGroupBalanceService = () => {
    if (crossGroupCleanupInterval) {
        clearInterval(crossGroupCleanupInterval);
        crossGroupCleanupInterval = null;
    }
    crossGroupCache.clear();
};

/**
 * Invalidate cross-group balance cache for a user
 * @param {string} userId - The user ID
 */
export const invalidateCrossGroupCache = (userId) => {
    const cacheKey = `crossGroup:${userId}`;
    crossGroupCache.delete(cacheKey);

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[CrossGroupBalance] Cache invalidated for user ${userId}`);
    }
};

/**
 * Calculate cross-group balances for a user
 * Aggregates balances by person across all shared groups
 * 
 * @param {string} userId - The current user ID
 * @param {boolean} forceRefresh - Force recalculation ignoring cache
 * @returns {Promise<Object>} Cross-group balances with people list
 */
export const calculateCrossGroupBalances = async (userId, forceRefresh = false) => {
    const cacheKey = `crossGroup:${userId}`;
    const now = Date.now();

    // Ensure userId is a string for consistent Map lookups
    const userIdStr = userId?.toString?.() || userId;

    // Check cache
    if (!forceRefresh) {
        const cached = crossGroupCache.get(cacheKey);
        if (cached && cached.expiry > now) {
            return cached.data;
        }
    }

    // Fetch all groups where user is a member
    const groups = await Group.find({ members: userId })
        .populate('members', 'name email')
        .lean();

    if (!groups || groups.length === 0) {
        return { people: [], totalPeople: 0 };
    }

    // Aggregate balances by person across all groups
    const personBalances = new Map();

    for (const group of groups) {
        try {
            // Get pairwise balances for this group
            // Using direct expense calculation instead of suggestions for accuracy
            const pairwiseLedger = await calculatePairwiseBalances(group._id.toString());
            const userLedger = pairwiseLedger.get(userIdStr);

            if (!userLedger) {
                console.log(`[CrossGroupBalance] No ledger found for user ${userIdStr} in group ${group._id}`);
                console.log(`[CrossGroupBalance] Available ledger keys:`, Array.from(pairwiseLedger.keys()));
                continue;
            }

            // Process each member balance from the ledger
            for (const [memberId, balance] of userLedger.entries()) {
                if (Math.abs(balance) > 0.01) {
                    // Get member info
                    const member = group.members.find(m => m._id.toString() === memberId);

                    // Get or initialize person aggregate
                    if (!personBalances.has(memberId)) {
                        personBalances.set(memberId, {
                            userId: memberId,
                            name: member?.name || 'Unknown',
                            email: member?.email || '',
                            netBalance: 0,
                            groupsInvolved: [],
                            totalGroups: 0,
                        });
                    }

                    const personData = personBalances.get(memberId);

                    personData.netBalance += balance;
                    personData.groupsInvolved.push({
                        groupId: group._id.toString(),
                        groupName: group.name,
                        balance: balance,
                    });
                    personData.totalGroups++;
                }
            }
        } catch (error) {
            console.error(`Error calculating balance for group ${group._id}:`, error);
            // Continue with other groups
        }
    }

    // Convert to array and filter out zero balances
    const people = Array.from(personBalances.values())
        .filter(person => Math.abs(person.netBalance) > 0.01)
        .map(person => ({
            ...person,
            netBalance: Math.round(person.netBalance * 100) / 100,
            groupsInvolved: person.groupsInvolved.map(g => ({
                ...g,
                balance: Math.round(g.balance * 100) / 100,
            })),
        }))
        .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

    const result = {
        people,
        totalPeople: people.length,
        calculatedAt: new Date().toISOString(),
    };

    // Cache the result
    crossGroupCache.set(cacheKey, {
        data: result,
        expiry: now + CROSS_GROUP_CACHE_TTL,
    });

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[CrossGroupBalance] Calculated for user ${userId}: ${people.length} people`);
    }

    return result;
};

/**
 * Calculate detailed balance between two specific users across all shared groups
 * 
 * @param {string} currentUserId - Current user ID
 * @param {string} otherUserId - Other user ID
 * @returns {Promise<Object>} Detailed breakdown by group
 */
export const calculatePersonBalance = async (currentUserId, otherUserId) => {
    // Validate input parameters
    if (!currentUserId || !otherUserId) {
        console.error('[calculatePersonBalance] Missing required user IDs:', { currentUserId, otherUserId });
        throw new Error('Both currentUserId and otherUserId are required');
    }

    // Ensure both IDs are strings for consistent Map lookups
    const currentUserIdStr = currentUserId?.toString?.() || currentUserId;
    const otherUserIdStr = otherUserId?.toString?.() || otherUserId;

    console.log('[calculatePersonBalance] Calculating balance:', { currentUserIdStr, otherUserIdStr });

    // Find all groups where both users are members
    // Use original IDs for MongoDB query (it auto-casts strings to ObjectIds)
    let sharedGroups;
    try {
        sharedGroups = await Group.find({
            members: { $all: [currentUserId, otherUserId] }
        }).populate('members', 'name email upiId').lean();

        console.log('[calculatePersonBalance] Shared groups found:', sharedGroups?.length || 0);
    } catch (queryError) {
        console.error('[calculatePersonBalance] Error querying shared groups:', queryError);
        throw new Error('Failed to query shared groups: ' + queryError.message);
    }

    if (!sharedGroups || sharedGroups.length === 0) {
        console.log('[calculatePersonBalance] No shared groups found');
        return {
            otherUserId,
            sharedGroups: 0,
            netBalance: 0,
            groupBreakdown: [],
            settlementSuggestion: null,
            hasMixedDirections: false,
        };
    }

    const groupBreakdown = [];
    let netBalance = 0;
    let hasPositiveBalance = false;
    let hasNegativeBalance = false;

    for (const group of sharedGroups) {
        try {
            const pairwiseLedger = await calculatePairwiseBalances(group._id.toString());
            
            if (!pairwiseLedger) {
                console.error('[calculatePersonBalance] Null pairwise ledger for group:', group._id);
                continue;
            }

            const userLedger = pairwiseLedger.get(currentUserIdStr);

            // Get balance with other user
            const balanceInGroup = userLedger ? (userLedger.get(otherUserIdStr) || 0) : 0;

            if (Math.abs(balanceInGroup) > 0.01) {
                groupBreakdown.push({
                    groupId: group._id.toString(),
                    groupName: group.name,
                    balance: Math.round(balanceInGroup * 100) / 100,
                    members: group.members.length,
                });
                netBalance += balanceInGroup;

                // Track direction
                if (balanceInGroup > 0.01) {
                    hasPositiveBalance = true;
                } else if (balanceInGroup < -0.01) {
                    hasNegativeBalance = true;
                }
            }
        } catch (error) {
            console.error(`[calculatePersonBalance] Error calculating balance for group ${group._id}:`, error);
            // Continue with other groups instead of failing completely
        }
    }

    netBalance = Math.round(netBalance * 100) / 100;

    // Detect mixed-direction balances
    const hasMixedDirections = hasPositiveBalance && hasNegativeBalance;

    // Get other user info
    const otherUserInGroup = sharedGroups[0]?.members?.find(
        m => m._id.toString() === otherUserIdStr
    );

    return {
        otherUserId,
        otherUserName: otherUserInGroup?.name || 'Unknown',
        otherUserEmail: otherUserInGroup?.email || '',
        otherUserUpiId: otherUserInGroup?.upiId || null,
        sharedGroups: sharedGroups.length,
        netBalance,
        groupBreakdown: groupBreakdown.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
        settlementSuggestion: {
            amount: Math.abs(netBalance),
            direction: netBalance > 0 ? 'theyOweYou' : 'youOweThem',
            affectedGroups: groupBreakdown.length,
        },
        hasMixedDirections,
        mixedDirectionWarning: hasMixedDirections
            ? 'You have balances in both directions across different groups. Settling the net amount may not clear all individual group debts.'
            : null,
    };
};

/**
 * Calculate distribution plan for a settlement amount across groups
 * Strategy: Settle largest balances first (greedy approach)
 * Handles mixed-direction balances (positive and negative group breakdowns)
 * 
 * @param {string} currentUserId - Payer user ID
 * @param {string} otherUserId - Receiver user ID
 * @param {number} amount - Settlement amount
 * @returns {Promise<Object>} Distribution plan
 */
export const distributeSettlementAmount = async (currentUserId, otherUserId, amount) => {
    console.log('[distributeSettlementAmount] Starting distribution:', { currentUserId, otherUserId, amount });

    let personBalance;
    try {
        personBalance = await calculatePersonBalance(currentUserId, otherUserId);
    } catch (balanceError) {
        console.error('[distributeSettlementAmount] Error calculating person balance:', balanceError);
        throw new Error('Failed to calculate balance for distribution: ' + balanceError.message);
    }

    if (!personBalance) {
        console.error('[distributeSettlementAmount] Null person balance returned');
        throw new Error('No balance data found between users');
    }

    if (!personBalance.groupBreakdown || personBalance.groupBreakdown.length === 0) {
        console.error('[distributeSettlementAmount] Empty group breakdown');
        throw new Error('No balances found between users');
    }

    console.log('[distributeSettlementAmount] Person balance:', {
        netBalance: personBalance.netBalance,
        groupBreakdownCount: personBalance.groupBreakdown.length
    });

    // Filter groups where current user owes other user (negative balance)
    const groupsWhereIOwe = personBalance.groupBreakdown
        .filter(g => g.balance < 0)
        .sort((a, b) => a.balance - b.balance); // Most negative first

    // Filter groups where other user owes current user (positive balance)
    const groupsWhereTheyOwe = personBalance.groupBreakdown
        .filter(g => g.balance > 0)
        .sort((a, b) => b.balance - a.balance); // Most positive first

    // Check for mixed-direction balances
    const hasMixedDirections = groupsWhereIOwe.length > 0 && groupsWhereTheyOwe.length > 0;

    console.log('[distributeSettlementAmount] Group distribution:', {
        groupsWhereIOwe: groupsWhereIOwe.length,
        groupsWhereTheyOwe: groupsWhereTheyOwe.length,
        hasMixedDirections
    });

    if (hasMixedDirections) {
        // Mixed-direction case: net out balances across all groups
        // Allocate payment to clear all outstanding balances proportionally
        const distributions = [];
        let remainingAmount = amount;

        console.log('[distributeSettlementAmount] Processing mixed-direction settlement');

        // First, settle debts where current user owes (negative balances)
        for (const group of groupsWhereIOwe) {
            if (remainingAmount <= 0.01) break;

            const debtAmount = Math.abs(group.balance);
            const settleAmount = Math.min(remainingAmount, debtAmount);

            distributions.push({
                groupId: group.groupId,
                groupName: group.groupName,
                amount: Math.round(settleAmount * 100) / 100,
                originalBalance: group.balance,
                remainingBalance: Math.round((Math.abs(group.balance) - settleAmount) * 100) / 100 * Math.sign(group.balance),
            });

            remainingAmount -= settleAmount;
        }

        // If amount exceeds debts, apply excess to groups where they owe us (positive balances)
        // This handles overpayment scenarios or when settling the full net balance
        if (remainingAmount > 0.01 && groupsWhereTheyOwe.length > 0) {
            console.log('[distributeSettlementAmount] Applying excess to positive balances:', remainingAmount);
            for (const group of groupsWhereTheyOwe) {
                if (remainingAmount <= 0.01) break;

                const creditAmount = Math.abs(group.balance);
                const settleAmount = Math.min(remainingAmount, creditAmount);

                distributions.push({
                    groupId: group.groupId,
                    groupName: group.groupName,
                    amount: Math.round(settleAmount * 100) / 100,
                    originalBalance: group.balance,
                    remainingBalance: Math.round((Math.abs(group.balance) - settleAmount) * 100) / 100 * Math.sign(group.balance),
                });

                remainingAmount -= settleAmount;
            }
        }

        const totalDistributed = Math.round((amount - remainingAmount) * 100) / 100;
        const remainingDebt = Math.round(
            (Math.abs(personBalance.netBalance) - totalDistributed) * 100
        ) / 100;

        console.log('[distributeSettlementAmount] Mixed-direction distribution complete:', {
            distributionsCount: distributions.length,
            totalDistributed,
            remainingDebt
        });

        return {
            distributions,
            totalDistributed,
            remainingDebt: Math.max(0, remainingDebt),
            isPartial: remainingDebt > 0.01,
            strategy: remainingDebt > 0.01 ? 'partial' : 'full',
            affectedGroupCount: distributions.length,
            hasMixedDirections: true,
        };
    }

    // Single-direction case: only debts or only credits
    const distributions = [];
    let remainingAmount = amount;

    // Determine direction based on who initiated the settlement
    // If currentUser is paying, they are settling debts where they owe
    const relevantGroups = groupsWhereIOwe.length > 0 ? groupsWhereIOwe : groupsWhereTheyOwe;

    console.log('[distributeSettlementAmount] Processing single-direction settlement:', {
        relevantGroupsCount: relevantGroups.length
    });

    if (relevantGroups.length === 0) {
        console.error('[distributeSettlementAmount] No relevant groups found for distribution');
        throw new Error('No groups available for settlement distribution');
    }

    for (const group of relevantGroups) {
        if (remainingAmount <= 0.01) break;

        const debtAmount = Math.abs(group.balance);
        const settleAmount = Math.min(remainingAmount, debtAmount);

        distributions.push({
            groupId: group.groupId,
            groupName: group.groupName,
            amount: Math.round(settleAmount * 100) / 100,
            originalBalance: group.balance,
            remainingBalance: Math.round((Math.abs(group.balance) - settleAmount) * 100) / 100 * Math.sign(group.balance),
        });

        remainingAmount -= settleAmount;
    }

    const totalDistributed = Math.round((amount - remainingAmount) * 100) / 100;
    const remainingDebt = Math.round(
        (Math.abs(personBalance.netBalance) - totalDistributed) * 100
    ) / 100;

    console.log('[distributeSettlementAmount] Single-direction distribution complete:', {
        distributionsCount: distributions.length,
        totalDistributed,
        remainingDebt
    });

    return {
        distributions,
        totalDistributed,
        remainingDebt: Math.max(0, remainingDebt),
        isPartial: remainingDebt > 0.01,
        strategy: remainingDebt > 0.01 ? 'partial' : 'full',
        affectedGroupCount: distributions.length,
        hasMixedDirections: false,
    };
};

/**
 * Get all groups with their balance summaries for a user
 * Used for Group Mode in the settlements page
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Groups with balance summaries
 */
export const getGroupsWithBalances = async (userId) => {
    const groups = await Group.find({ members: userId })
        .populate('members', 'name email upiId')
        .populate('createdBy', 'name email')
        .lean();

    console.log(`[getGroupsWithBalances] Found ${groups.length} groups for user ${userId}`);

    const result = [];

    for (const group of groups) {
        try {
            const balanceResult = await calculateGroupBalances(group._id.toString());

            console.log(`[getGroupsWithBalances] Group ${group.name}:`, {
                balances: balanceResult.balances,
                suggestions: balanceResult.suggestions,
            });

            // Calculate summary stats
            // Ensure userId is a string for consistent lookup
            const userIdStr = userId?.toString?.() || userId;
            const userBalance = balanceResult.balances?.[userIdStr] || 0;
            const suggestions = balanceResult.suggestions || [];

            let userOwes = 0;
            let userIsOwed = 0;

            for (const suggestion of suggestions) {
                if (suggestion.from === userIdStr) {
                    userOwes += suggestion.amount;
                } else if (suggestion.to === userIdStr) {
                    userIsOwed += suggestion.amount;
                }
            }

            console.log(`[getGroupsWithBalances] User stats for ${group.name}:`, {
                userIdStr,
                userBalance,
                userOwes,
                userIsOwed,
                suggestionsCount: suggestions.length,
            });

            result.push({
                groupId: group._id.toString(),
                groupName: group.name,
                membersCount: group.members.length,
                members: group.members.map(m => ({
                    userId: m._id.toString(),
                    name: m.name,
                    email: m.email,
                    upiId: m.upiId,
                })),
                totalExpenses: balanceResult.totalExpenses || 0,
                userBalance: Math.round(userBalance * 100) / 100,
                userOwes: Math.round(userOwes * 100) / 100,
                userIsOwed: Math.round(userIsOwed * 100) / 100,
                // Return ALL suggestions for full in-group settlement visibility
                suggestions: suggestions,
                createdBy: group.createdBy?._id?.toString(),
            });
        } catch (error) {
            console.error(`Error getting balance for group ${group._id}:`, error);
            // Include group with zero balances on error
            result.push({
                groupId: group._id.toString(),
                groupName: group.name,
                membersCount: group.members.length,
                members: group.members.map(m => ({
                    userId: m._id.toString(),
                    name: m.name,
                    email: m.email,
                    upiId: m.upiId,
                })),
                totalExpenses: 0,
                userBalance: 0,
                userOwes: 0,
                userIsOwed: 0,
                suggestions: [],
                createdBy: group.createdBy?._id?.toString(),
            });
        }
    }

    // Sort by userOwes + userIsOwed (most activity first)
    return result.sort((a, b) => {
        const aActivity = a.userOwes + a.userIsOwed;
        const bActivity = b.userOwes + b.userIsOwed;
        return bActivity - aActivity;
    });
};

/**
 * Calculate pairwise balances from expense splits (payer vs participants)
 * Returns a deterministic ledger of direct person-to-person balances
 * 
 * @param {string} groupId - The group ID
 * @returns {Promise<Map<string, Map<string, number>>>} Pairwise balance ledger
 */
export const calculatePairwiseBalances = async (groupId) => {
    // Dynamic imports to avoid circular dependencies if any
    const Expense = (await import('../models/Expense.js')).default;
    const Settlement = (await import('../models/Settlement.js')).default;
    const mongoose = (await import('mongoose')).default;

    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    // Fetch all expenses and confirmed settlements for this group
    const [expenses, settlements] = await Promise.all([
        Expense.find({ groupId: groupObjectId })
            .select('paidBy splitConfig splitAmong amount')
            .lean(),
        Settlement.find({ groupId: groupObjectId, paymentStatus: 'confirmed' })
            .select('fromUserId toUserId amount')
            .lean(),
    ]);

    // Initialize pairwise ledger: Map<userId, Map<otherUserId, netBalance>>
    // Positive balance means userId is owed by otherUserId
    // Negative balance means userId owes otherUserId
    const pairwiseLedger = new Map();

    const getOrCreateUserLedger = (userId) => {
        // Ensure userId is always a string for consistent Map keys
        const userIdStr = userId?.toString?.() || userId;
        if (!pairwiseLedger.has(userIdStr)) {
            pairwiseLedger.set(userIdStr, new Map());
        }
        return pairwiseLedger.get(userIdStr);
    };

    const addPairwiseDebt = (fromUser, toUser, amount) => {
        // Ensure both user IDs are strings
        const fromUserStr = fromUser?.toString?.() || fromUser;
        const toUserStr = toUser?.toString?.() || toUser;
        
        // fromUser owes toUser the amount
        const fromLedger = getOrCreateUserLedger(fromUserStr);
        const toLedger = getOrCreateUserLedger(toUserStr);

        // Update fromUser's ledger (negative = owes)
        const currentFromBalance = fromLedger.get(toUserStr) || 0;
        fromLedger.set(toUserStr, currentFromBalance - amount);

        // Update toUser's ledger (positive = owed)
        const currentToBalance = toLedger.get(fromUserStr) || 0;
        toLedger.set(fromUserStr, currentToBalance + amount);
    };

    // Process expenses: calculate payer-to-participant debts
    for (const expense of expenses) {
        // Ensure paidBy is a string ID
        const payer = expense.paidBy._id ? expense.paidBy._id.toString() : expense.paidBy.toString();

        const splitType = expense.splitConfig?.type || 'equal';
        const shares = expense.splitConfig?.shares || {};
        const splitAmong = (expense.splitAmong || []).map(id => id.toString());
        const totalAmount = expense.amount;

        if (splitType === 'equal') {
            const shareAmount = totalAmount / splitAmong.length;
            for (const participant of splitAmong) {
                if (participant !== payer) {
                    addPairwiseDebt(participant, payer, shareAmount);
                }
            }
        } else if (splitType === 'exact' || splitType === 'itemized') {
            // Check if shares is a Map or Object
            const sharesEntries = shares instanceof Map ? shares.entries() : Object.entries(shares);
            for (const [participant, shareAmount] of sharesEntries) {
                if (participant !== payer && Number(shareAmount) > 0) {
                    addPairwiseDebt(participant, payer, Number(shareAmount));
                }
            }
        } else if (splitType === 'percentage') {
            const sharesEntries = shares instanceof Map ? shares.entries() : Object.entries(shares);
            for (const [participant, percentage] of sharesEntries) {
                if (participant !== payer && Number(percentage) > 0) {
                    const shareAmount = (Number(percentage) / 100) * totalAmount;
                    addPairwiseDebt(participant, payer, shareAmount);
                }
            }
        }
    }

    // Process confirmed settlements: reduce debts
    for (const settlement of settlements) {
        const fromUser = settlement.fromUserId.toString();
        const toUser = settlement.toUserId.toString();
        const amount = settlement.amount;

        // Settlement reduces the debt fromUser owes toUser
        addPairwiseDebt(toUser, fromUser, amount); // Reverse debt logic to reduce balance
    }

    return pairwiseLedger;
};

/**
 * Calculate balances for people who owe the current user money
 * Used for "Owed to Me" view with repayment request details
 * 
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} People who owe money with request details
 */
export const calculateOwedToMeBalances = async (userId) => {
    const result = await calculateCrossGroupBalances(userId);

    // Filter only people who owe current user (netBalance > 0)
    const owedToMe = result.people.filter(person => person.netBalance > 0);

    // For each person, get additional details
    const RepaymentRequest = (await import('../models/RepaymentRequest.js')).default;
    const User = (await import('../models/User.js')).default;

    const enrichedBalances = await Promise.all(owedToMe.map(async (person) => {
        // Get user details
        const userDetails = await User.findById(person.userId, 'name email avatar');

        // Get last repayment request details
        const lastRequest = await RepaymentRequest.findOne({
            requesterId: userId,
            receiverId: person.userId,
        })
            .sort({ requestedAt: -1 })
            .lean();

        // Get pending requests count
        const pendingCount = await RepaymentRequest.countDocuments({
            requesterId: userId,
            receiverId: person.userId,
            status: { $in: ['pending', 'partially_paid'] },
        });

        return {
            ...person,
            user: userDetails,
            lastRequest,
            pendingRequestsCount: pendingCount,
            // Map groupsInvolved to groups for frontend compatibility
            groups: person.groupsInvolved?.map(group => ({
                groupId: group.groupId,
                groupName: group.groupName,
                amount: group.balance // Map balance to amount for frontend
            })) || []
        };
    }));

    // Sort by amount descending
    enrichedBalances.sort((a, b) => b.netBalance - a.netBalance);

    return {
        people: enrichedBalances,
        totalOwed: enrichedBalances.reduce((sum, person) => sum + person.netBalance, 0),
        totalPeople: enrichedBalances.length,
    };
};

// Initialize on module load
initializeCrossGroupBalanceService();

export default {
    calculateCrossGroupBalances,
    calculatePersonBalance,
    distributeSettlementAmount,
    getGroupsWithBalances,
    invalidateCrossGroupCache,
    initializeCrossGroupBalanceService,
    stopCrossGroupBalanceService,
    calculatePairwiseBalances,
    calculateOwedToMeBalances,
};
