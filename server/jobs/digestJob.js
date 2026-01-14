/**
 * Digest Job
 * 
 * Sends weekly and monthly expense digest emails to subscribed users.
 * Called by the cron scheduler.
 */

import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import { sendEmailWithRetry } from './emailService.js';

// Mutex flags to prevent overlapping executions
let isProcessingWeekly = false;
let isProcessingMonthly = false;

/**
 * Calculate user's expense summary for a given period
 * @param {string} userId - User ID
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @returns {Promise<Object>} Summary data
 */
export const calculateUserSummary = async (userId, startDate, endDate) => {
    // Get user's groups
    const groups = await Group.find({ members: userId }).lean();
    const groupIds = groups.map(g => g._id);

    // Get expenses in the period
    const expenses = await Expense.find({
        groupId: { $in: groupIds },
        date: { $gte: startDate, $lte: endDate },
    }).populate('groupId', 'name').lean();

    // Get settlements in the period
    const settlements = await Settlement.find({
        groupId: { $in: groupIds },
        settledAt: { $gte: startDate, $lte: endDate },
    }).lean();

    // Calculate totals
    let totalExpenses = 0;
    let youOwe = 0;
    let youAreOwed = 0;
    const groupTotals = {};
    const categoryTotals = {};

    expenses.forEach(expense => {
        totalExpenses += expense.amount;

        // Track by group
        const groupName = expense.groupId?.name || 'Unknown';
        groupTotals[groupName] = (groupTotals[groupName] || 0) + expense.amount;

        // Track by category
        const category = expense.category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;

        // Calculate balances
        const shares = expense.splitConfig?.shares || {};
        if (expense.paidBy.toString() === userId.toString()) {
            // User paid - others owe them
            Object.entries(shares).forEach(([memberId, amount]) => {
                if (memberId !== userId.toString()) {
                    youAreOwed += amount;
                }
            });
        } else if (shares[userId.toString()]) {
            // User owes their share
            youOwe += shares[userId.toString()];
        }
    });

    // Adjust for settlements
    settlements.forEach(settlement => {
        if (settlement.fromUserId.toString() === userId.toString()) {
            youOwe -= settlement.amount;
        } else if (settlement.toUserId.toString() === userId.toString()) {
            youAreOwed -= settlement.amount;
        }
    });

    // Calculate total settled
    const totalSettled = settlements
        .filter(s => s.fromUserId.toString() === userId.toString() || s.toUserId.toString() === userId.toString())
        .reduce((sum, s) => sum + s.amount, 0);

    // Format top groups
    const topGroups = Object.entries(groupTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name, total }));

    // Format top categories
    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name, total }));

    return {
        totalExpenses,
        totalSettled,
        youOwe: Math.max(0, youOwe),
        youAreOwed: Math.max(0, youAreOwed),
        topGroups,
        topCategories,
    };
};

/**
 * Process weekly digest for all subscribed users
 * @param {any} _data - Unused data parameter (for jobRunner compatibility)
 * @param {Object} options - Execution options
 * @param {AbortSignal} options.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Results object
 */
export const processWeeklyDigest = async (_data, options = {}) => {
    const { signal } = options;

    // Check if already aborted
    if (signal?.aborted) {
        console.log('[Digest] Weekly digest aborted before start');
        return { sent: 0, failed: 0, aborted: true };
    }

    // Mutex guard: prevent overlapping executions
    if (isProcessingWeekly) {
        console.log('[Digest] Weekly digest already running, skipping this execution');
        return { sent: 0, failed: 0, skipped: true };
    }

    isProcessingWeekly = true;
    console.log('[Digest] Processing weekly digest...');

    try {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);

        // Find users subscribed to weekly digest who haven't received it this week
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 6); // Allow some overlap

        const users = await User.find({
            'emailPreferences.weeklyDigest': true,
            $or: [
                { 'lastDigestSent.weekly': { $lt: oneWeekAgo } },
                { 'lastDigestSent.weekly': { $exists: false } },
            ],
        }).lean();

        console.log(`[Digest] Found ${users.length} users for weekly digest`);

        let sent = 0;
        let failed = 0;

        // Process in batches of 50 to avoid blocking event loop
        const BATCH_SIZE = 50;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            // Check for abort signal between batches
            if (signal?.aborted) {
                console.log(`[Digest] Weekly digest aborted after processing ${sent} users`);
                return { sent, failed, aborted: true };
            }

            const batch = users.slice(i, i + BATCH_SIZE);

            for (const user of batch) {
                try {
                    const summary = await calculateUserSummary(user._id, startDate, now);

                    // Skip if no activity
                    if (summary.totalExpenses === 0 && summary.totalSettled === 0) {
                        continue;
                    }

                    // Send email
                    await sendEmailWithRetry({
                        to: user.email,
                        template: 'digest',
                        data: {
                            userName: user.name,
                            period: 'weekly',
                            summaryData: summary,
                        },
                    });

                    // Update last sent timestamp
                    await User.findByIdAndUpdate(user._id, {
                        'lastDigestSent.weekly': now,
                    });

                    sent++;
                } catch (error) {
                    console.error(`[Digest] Failed for ${user.email}:`, error.message);
                    failed++;
                }
            }

            // Yield to event loop between batches
            if (i + BATCH_SIZE < users.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        console.log(`[Digest] Weekly digest complete: ${sent} sent, ${failed} failed`);
        return { sent, failed };
    } finally {
        isProcessingWeekly = false;
    }
};

/**
 * Process monthly digest for all subscribed users
 * @param {any} _data - Unused data parameter (for jobRunner compatibility)
 * @param {Object} options - Execution options
 * @param {AbortSignal} options.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Results object
 */
export const processMonthlyDigest = async (_data, options = {}) => {
    const { signal } = options;

    // Check if already aborted
    if (signal?.aborted) {
        console.log('[Digest] Monthly digest aborted before start');
        return { sent: 0, failed: 0, aborted: true };
    }

    // Mutex guard: prevent overlapping executions
    if (isProcessingMonthly) {
        console.log('[Digest] Monthly digest already running, skipping this execution');
        return { sent: 0, failed: 0, skipped: true };
    }

    isProcessingMonthly = true;
    console.log('[Digest] Processing monthly digest...');

    try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0);

        // Find users subscribed to monthly digest
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        oneMonthAgo.setDate(oneMonthAgo.getDate() + 1);

        const users = await User.find({
            'emailPreferences.monthlyDigest': true,
            $or: [
                { 'lastDigestSent.monthly': { $lt: oneMonthAgo } },
                { 'lastDigestSent.monthly': { $exists: false } },
            ],
        }).lean();

        console.log(`[Digest] Found ${users.length} users for monthly digest`);

        let sent = 0;
        let failed = 0;

        // Process in batches of 50 to avoid blocking event loop
        const BATCH_SIZE = 50;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            // Check for abort signal between batches
            if (signal?.aborted) {
                console.log(`[Digest] Monthly digest aborted after processing ${sent} users`);
                return { sent, failed, aborted: true };
            }

            const batch = users.slice(i, i + BATCH_SIZE);

            for (const user of batch) {
                try {
                    const summary = await calculateUserSummary(user._id, startDate, endDate);

                    // Skip if no activity
                    if (summary.totalExpenses === 0 && summary.totalSettled === 0) {
                        continue;
                    }

                    // Send email
                    await sendEmailWithRetry({
                        to: user.email,
                        template: 'digest',
                        data: {
                            userName: user.name,
                            period: 'monthly',
                            summaryData: summary,
                        },
                    });

                    // Update last sent timestamp
                    await User.findByIdAndUpdate(user._id, {
                        'lastDigestSent.monthly': now,
                    });

                    sent++;
                } catch (error) {
                    console.error(`[Digest] Failed for ${user.email}:`, error.message);
                    failed++;
                }
            }

            // Yield to event loop between batches
            if (i + BATCH_SIZE < users.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        console.log(`[Digest] Monthly digest complete: ${sent} sent, ${failed} failed`);
        return { sent, failed };
    } finally {
        isProcessingMonthly = false;
    }
};

export default {
    calculateUserSummary,
    processWeeklyDigest,
    processMonthlyDigest,
};
