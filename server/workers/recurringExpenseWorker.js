/**
 * Recurring Expense Worker (Comment 3)
 * 
 * Scheduled worker that generates expense instances from recurring expenses.
 * Uses Bull queue with repeatable jobs (cron) for scheduling.
 * 
 * Optimizations:
 * - Uses lean() for read queries
 * - Batch processes expenses in chunks
 * - Bulk inserts new expenses
 * - Bulk notification queueing
 * - Conditional logging based on environment
 */

import Expense from '../models/Expense.js';
import { recurringQueue, notificationQueue } from '../config/queue.js';

// Batch size for processing
const BATCH_SIZE = 50;

// Helper for conditional logging
const log = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

/**
 * Process all due recurring expenses and create new instances
 */
export const processRecurringExpenses = async () => {
  log('Processing recurring expenses...');
  
  try {
    const now = new Date();
    
    // Find all enabled recurring expenses that are due using lean() for performance
    // Only select the fields we need
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

    log(`Found ${dueExpenses.length} recurring expenses to process`);

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
      const batch = dueExpenses.slice(i, i + BATCH_SIZE);
      await processBatch(batch, now, results);
    }

    log('Recurring expense processing complete:', results);
    return results;
  } catch (error) {
    console.error('Error in recurring expense worker:', error);
    throw error;
  }
};

/**
 * Process a batch of recurring expenses
 */
async function processBatch(expenses, now, results) {
  const newExpensesToInsert = [];
  const parentUpdates = [];
  const notificationJobs = [];

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
        notificationJobs.push({
          data: {
            userId: memberId.toString(),
            type: 'expense',
            title: 'Recurring Expense Generated',
            message: `Recurring expense "${expense.description}" for ₹${expense.amount} has been added to ${groupName}`,
            data: { 
              groupId: expense.groupId._id.toString(),
              actionType: 'recurring_expense',
            },
          },
        });
      }

      results.processed++;
    } catch (expenseError) {
      console.error(`Error preparing recurring expense ${expense._id}:`, expenseError);
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
      const insertedExpenses = await Expense.insertMany(newExpensesToInsert, { ordered: false });
      log(`Bulk inserted ${insertedExpenses.length} new expenses`);
      
      // Update notification jobs with actual expense IDs
      let insertIndex = 0;
      for (let i = 0; i < notificationJobs.length; i++) {
        // Estimate which inserted expense corresponds to this notification
        // Since notifications are added per-member, we need to track expense boundaries
        if (insertedExpenses[insertIndex]) {
          notificationJobs[i].data.data.expenseId = insertedExpenses[insertIndex]._id.toString();
        }
        // Move to next expense when we've processed all members for current one
        const currentExpense = expenses.find(e => 
          e.splitAmong?.some(m => m.toString() === notificationJobs[i].data.userId)
        );
        if (currentExpense && i < notificationJobs.length - 1) {
          const nextNotification = notificationJobs[i + 1];
          if (!currentExpense.splitAmong?.some(m => m.toString() === nextNotification?.data?.userId)) {
            insertIndex++;
          }
        }
      }
    } catch (insertError) {
      console.error('Bulk insert error:', insertError);
      // Some inserts may have succeeded
    }
  }

  // Bulk update parent expenses
  if (parentUpdates.length > 0) {
    try {
      await Expense.bulkWrite(parentUpdates, { ordered: false });
      log(`Bulk updated ${parentUpdates.length} parent expenses`);
    } catch (updateError) {
      console.error('Bulk update error:', updateError);
    }
  }

  // Bulk queue notifications
  if (notificationJobs.length > 0) {
    try {
      await notificationQueue.addBulk(notificationJobs);
      log(`Queued ${notificationJobs.length} notifications`);
    } catch (notifyError) {
      console.error('Notification queue error:', notifyError);
    }
  }
}

/**
 * Initialize the recurring expense worker with Bull queue processor
 * Sets up a repeatable job that runs every hour
 */
export const initRecurringExpenseWorker = () => {
  // Process recurring expense jobs
  recurringQueue.process(async (job) => {
    log(`Recurring expense job ${job.id} started`);
    return processRecurringExpenses();
  });

  // Schedule a repeatable job to run every hour
  // This ensures recurring expenses are checked regularly
  recurringQueue.add(
    { type: 'scheduled_check' },
    {
      repeat: {
        cron: '0 * * * *', // Run at the start of every hour
      },
      jobId: 'recurring-expense-scheduler', // Prevent duplicate scheduled jobs
    }
  ).then(() => {
    log('Recurring expense scheduler initialized (runs hourly)');
  }).catch((err) => {
    console.error('Failed to initialize recurring expense scheduler:', err.message);
  });

  log('Recurring expense worker initialized');
};

/**
 * Manually trigger recurring expense processing
 * Useful for testing or manual runs
 */
export const triggerRecurringExpenseProcessing = async () => {
  return recurringQueue.add(
    { type: 'manual_trigger' },
    { priority: 1 }
  );
};

// If running as standalone script
if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('../config/db.js').then(({ default: connectDB }) => {
    connectDB().then(() => {
      processRecurringExpenses()
        .then(result => {
          console.log('Worker completed:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Worker failed:', error);
          process.exit(1);
        });
    });
  });
}

export default initRecurringExpenseWorker;
