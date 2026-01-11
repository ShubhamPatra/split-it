/**
 * Digest Worker
 * 
 * Sends weekly and monthly expense digest emails to subscribed users.
 * Runs on a schedule via Bull queue.
 */

import Bull from 'bull';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import { emailQueue } from '../config/queue.js';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
};

if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

// Create digest queue
export const digestQueue = new Bull('digest', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

/**
 * Calculate user's expense summary for a given period
 */
async function calculateUserSummary(userId, startDate, endDate) {
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
}

/**
 * Process weekly digest for all subscribed users
 */
async function processWeeklyDigest() {
  console.log('Processing weekly digest...');
  
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

  console.log(`Found ${users.length} users for weekly digest`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const summary = await calculateUserSummary(user._id, startDate, now);
      
      // Skip if no activity
      if (summary.totalExpenses === 0 && summary.totalSettled === 0) {
        continue;
      }

      // Queue email
      await emailQueue.add({
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
      console.error(`Failed to send weekly digest to ${user.email}:`, error.message);
      failed++;
    }
  }

  console.log(`Weekly digest complete: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

/**
 * Process monthly digest for all subscribed users
 */
async function processMonthlyDigest() {
  console.log('Processing monthly digest...');
  
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of last month
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month

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

  console.log(`Found ${users.length} users for monthly digest`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const summary = await calculateUserSummary(user._id, startDate, endDate);
      
      // Skip if no activity
      if (summary.totalExpenses === 0 && summary.totalSettled === 0) {
        continue;
      }

      // Queue email
      await emailQueue.add({
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
      console.error(`Failed to send monthly digest to ${user.email}:`, error.message);
      failed++;
    }
  }

  console.log(`Monthly digest complete: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

/**
 * Initialize the digest worker
 */
export const initDigestWorker = () => {
  // Process digest jobs
  digestQueue.process(async (job) => {
    const { type } = job.data;
    
    if (type === 'weekly') {
      return processWeeklyDigest();
    } else if (type === 'monthly') {
      return processMonthlyDigest();
    }
    
    throw new Error(`Unknown digest type: ${type}`);
  });

  // Schedule weekly digest - Every Monday at 9 AM
  digestQueue.add(
    { type: 'weekly' },
    {
      repeat: {
        cron: '0 9 * * 1', // Monday at 9:00 AM
      },
      jobId: 'weekly-digest-scheduler',
    }
  ).catch(err => console.error('Failed to schedule weekly digest:', err.message));

  // Schedule monthly digest - First day of month at 9 AM
  digestQueue.add(
    { type: 'monthly' },
    {
      repeat: {
        cron: '0 9 1 * *', // 1st of month at 9:00 AM
      },
      jobId: 'monthly-digest-scheduler',
    }
  ).catch(err => console.error('Failed to schedule monthly digest:', err.message));

  console.log('Digest worker initialized (weekly: Monday 9AM, monthly: 1st 9AM)');
};

/**
 * Manually trigger digest processing (for testing)
 */
export const triggerDigest = async (type = 'weekly') => {
  return digestQueue.add({ type }, { priority: 1 });
};

export default initDigestWorker;
