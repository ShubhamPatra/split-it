/**
 * Recurring Expense Job
 * 
 * Processes recurring expenses and generates new expense instances.
 * Called by the cron scheduler.
 */

import Expense from '../models/Expense.js';
import { sendEmailWithRetry } from './emailService.js';
import { notifyUsers } from './notificationService.js';
import { checkEmailPreference } from '../utils/emailUtils.js';

// Batch size for processing
const BATCH_SIZE = 50;

// Mutex flags to prevent overlapping executions
let isProcessingRecurring = false;
let isProcessingReminders = false;

// Helper for conditional logging
const log = (...args) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(...args);
    }
};

/**
 * Process all due recurring expenses and create new instances
 * @param {any} _data - Unused data parameter (for jobRunner compatibility)
 * @param {Object} options - Execution options
 * @param {AbortSignal} options.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Results object
 */
export const processRecurringExpenses = async (_data, options = {}) => {
    const { signal } = options;

    // Check if already aborted
    if (signal?.aborted) {
        console.log('[RecurringExpense] Aborted before start');
        return { processed: 0, failed: 0, errors: [], aborted: true };
    }

    // Mutex guard: prevent overlapping executions
    if (isProcessingRecurring) {
        console.log('[RecurringExpense] Already running, skipping this execution');
        return { processed: 0, failed: 0, errors: [], skipped: true };
    }

    isProcessingRecurring = true;
    log('[RecurringExpense] Processing recurring expenses...');

    try {
        const now = new Date();

        // Find all enabled recurring expenses that are due
        const dueExpenses = await Expense.find({
            'recurrence.enabled': true,
            'recurrence.nextRunAt': { $lte: now },
            $or: [
                { 'recurrence.endDate': null },
                { 'recurrence.endDate': { $gte: now } },
            ],
        })
            .select('groupId description amount currency category paidBy splitAmong splitConfig lineItems recurrence')
            .populate('paidBy', 'name')
            .populate('groupId', 'name')
            .lean();

        log(`[RecurringExpense] Found ${dueExpenses.length} recurring expenses to process`);

        if (dueExpenses.length === 0) {
            return { processed: 0, failed: 0, errors: [] };
        }

        const results = {
            processed: 0,
            failed: 0,
            errors: [],
        };

        // Process in batches
        for (let i = 0; i < dueExpenses.length; i += BATCH_SIZE) {
            // Check for abort signal between batches
            if (signal?.aborted) {
                console.log(`[RecurringExpense] Aborted after processing ${results.processed} expenses`);
                return { ...results, aborted: true };
            }

            const batch = dueExpenses.slice(i, i + BATCH_SIZE);
            await processBatch(batch, now, results);

            // Yield to event loop between batches to prevent blocking
            if (i + BATCH_SIZE < dueExpenses.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        console.log('[RecurringExpense] Processing complete:', results);
        return results;
    } catch (error) {
        console.error('[RecurringExpense] Error:', error);
        throw error;
    } finally {
        isProcessingRecurring = false;
    }
};

/**
 * Process a batch of recurring expenses
 */
async function processBatch(expenses, now, results) {
    const newExpensesToInsert = [];
    const parentUpdates = [];
    const notificationsToSend = [];

    for (const expense of expenses) {
        try {
            // Prepare new expense data
            const newExpenseData = {
                groupId: expense.groupId._id,
                description: expense.description,
                amount: expense.amount,
                currency: expense.currency,
                category: expense.category,
                paidBy: expense.paidBy._id,
                date: new Date(),
                splitAmong: expense.splitAmong,
                splitConfig: expense.splitConfig,
                lineItems: expense.lineItems,
                recurrence: {
                    enabled: false,
                    parentExpenseId: expense._id,
                },
            };

            newExpensesToInsert.push(newExpenseData);

            // Calculate next run date
            const tempExpense = new Expense({
                ...expense,
                recurrence: {
                    ...expense.recurrence,
                    lastGeneratedAt: now,
                },
            });
            const nextRunAt = tempExpense.calculateNextRunDate();

            // Prepare parent update
            parentUpdates.push({
                updateOne: {
                    filter: { _id: expense._id },
                    update: {
                        $set: {
                            'recurrence.lastGeneratedAt': now,
                            'recurrence.nextRunAt': nextRunAt,
                            'recurrence.enabled': nextRunAt !== null,
                        },
                        $inc: { 'recurrence.generatedCount': 1 },
                    },
                },
            });

            // Prepare notifications for participants
            const groupName = expense.groupId?.name || 'your group';
            for (const memberId of expense.splitAmong || []) {
                notificationsToSend.push({
                    userId: memberId.toString(),
                    type: 'info',
                    title: 'Recurring Expense Generated',
                    message: `Recurring expense "${expense.description}" for ₹${expense.amount} has been added to ${groupName}`,
                    data: {
                        actionType: 'navigate',
                        groupId: expense.groupId._id.toString(),
                    },
                });
            }

            results.processed++;
        } catch (expenseError) {
            console.error(`[RecurringExpense] Error preparing expense ${expense._id}:`, expenseError);
            results.failed++;
            results.errors.push({
                expenseId: expense._id.toString(),
                error: expenseError.message,
            });
        }
    }

    // Bulk insert new expenses
    if (newExpensesToInsert.length > 0) {
        try {
            await Expense.insertMany(newExpensesToInsert, { ordered: false });
            log(`[RecurringExpense] Bulk inserted ${newExpensesToInsert.length} new expenses`);
        } catch (insertError) {
            console.error('[RecurringExpense] Bulk insert error:', insertError.message);
        }
    }

    // Bulk update parent expenses
    if (parentUpdates.length > 0) {
        try {
            await Expense.bulkWrite(parentUpdates, { ordered: false });
            log(`[RecurringExpense] Bulk updated ${parentUpdates.length} parent expenses`);
        } catch (updateError) {
            console.error('[RecurringExpense] Bulk update error:', updateError.message);
        }
    }

    // Send notifications (in background, don't wait)
    if (notificationsToSend.length > 0) {
        // Group by userId to use notifyUsers
        const userIds = [...new Set(notificationsToSend.map(n => n.userId))];
        const notificationData = notificationsToSend[0]; // Use first as template

        notifyUsers(userIds, {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data,
        }).catch(err => {
            console.error('[RecurringExpense] Notification error:', err.message);
        });
    }
}

/**
 * Send reminder emails for upcoming recurring expenses
 * @param {any} _data - Unused data parameter (for jobRunner compatibility)
 * @param {Object} options - Execution options
 * @param {AbortSignal} options.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Results object
 */
export const sendRecurringExpenseReminders = async (_data, options = {}) => {
    const { signal } = options;

    // Check if already aborted
    if (signal?.aborted) {
        console.log('[RecurringExpense] Reminders aborted before start');
        return { sent: 0, aborted: true };
    }

    // Mutex guard: prevent overlapping executions
    if (isProcessingReminders) {
        console.log('[RecurringExpense] Reminders already running, skipping this execution');
        return { sent: 0, skipped: true };
    }

    isProcessingReminders = true;
    log('[RecurringExpense] Sending reminders...');

    try {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);

        // Find recurring expenses due in the next 24 hours
        const upcomingExpenses = await Expense.find({
            'recurrence.enabled': true,
            'recurrence.nextRunAt': { $lte: tomorrow, $gte: now },
        })
            .populate('paidBy', 'name email emailPreferences')
            .populate('groupId', 'name')
            .lean();

        if (upcomingExpenses.length === 0) {
            log('[RecurringExpense] No upcoming recurring expenses');
            return { sent: 0 };
        }

        // Group by user
        const userExpenses = {};
        for (const expense of upcomingExpenses) {
            const userId = expense.paidBy._id.toString();
            if (!userExpenses[userId]) {
                userExpenses[userId] = {
                    user: expense.paidBy,
                    expenses: [],
                };
            }
            userExpenses[userId].expenses.push({
                description: expense.description,
                amount: expense.amount,
                groupName: expense.groupId?.name || 'Unknown',
                nextRunAt: expense.recurrence.nextRunAt,
            });
        }

        let sent = 0;
        for (const userId of Object.keys(userExpenses)) {
            const { user, expenses } = userExpenses[userId];

            // Check if user has preference enabled
            const isEnabled = await checkEmailPreference(userId, 'recurringExpenseReminder');
            if (!isEnabled) continue;

            try {
                await sendEmailWithRetry({
                    to: user.email,
                    template: 'recurringExpenseReminder',
                    data: {
                        userName: user.name,
                        expenses,
                    },
                });
                sent++;
            } catch (emailError) {
                console.error(`[RecurringExpense] Email failed for ${user.email}:`, emailError.message);
            }
        }

        console.log(`[RecurringExpense] Reminders sent: ${sent}`);
        return { sent };
    } catch (error) {
        console.error('[RecurringExpense] Error sending reminders:', error);
        throw error;
    } finally {
        isProcessingReminders = false;
    }
};

export default {
    processRecurringExpenses,
    sendRecurringExpenseReminders,
};
