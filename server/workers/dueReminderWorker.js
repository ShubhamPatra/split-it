/**
 * Due Reminder Worker
 * 
 * Sends daily reminders to users with uncleared dues older than 24 hours.
 * Runs on a schedule via Bull queue.
 */

import Bull from 'bull';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import { emailQueue, notificationQueue } from '../config/queue.js';

// Redis configuration with ElastiCache support
const buildRedisConfig = () => {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  };

  // Add password/auth token (ElastiCache AUTH token or Redis password)
  if (process.env.REDIS_PASSWORD || process.env.REDIS_AUTH_TOKEN) {
    config.password = process.env.REDIS_AUTH_TOKEN || process.env.REDIS_PASSWORD;
  }

  // ElastiCache TLS configuration
  if (process.env.REDIS_TLS === 'true' || process.env.ELASTICACHE_TLS === 'true') {
    config.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  return config;
};

const redisConfig = buildRedisConfig();

// Create due reminder queue
export const dueReminderQueue = new Bull('dueReminder', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

/**
 * Calculate user's outstanding dues across all groups
 * Only considers dues older than 24 hours
 * @param {string} userId - User ID
 * @returns {Object} - Object with dues details (what user owes and what user is owed)
 */
async function calculateUserDues(userId) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // Get user's groups
  const groups = await Group.find({ members: userId }).populate('members', 'name email').lean();
  const groupIds = groups.map(g => g._id);
  
  if (groupIds.length === 0) {
    return { totalOwed: 0, totalOwedToUser: 0, duesByGroup: [], receivablesByGroup: [] };
  }

  // Get all expenses older than 24 hours in user's groups
  const expenses = await Expense.find({
    groupId: { $in: groupIds },
    createdAt: { $lte: twentyFourHoursAgo },
  }).populate('paidBy', 'name email').populate('groupId', 'name').lean();

  // Get all settlements in user's groups
  const settlements = await Settlement.find({
    groupId: { $in: groupIds },
  }).lean();

  // Build a map of net balances per group - what user owes
  const groupBalances = {};
  // Build a map of what is owed TO the user
  const groupReceivables = {};

  // Process expenses - calculate what user owes AND what user is owed
  for (const expense of expenses) {
    const groupId = expense.groupId._id.toString();
    const groupName = expense.groupId.name;
    const paidById = expense.paidBy._id.toString();
    const paidByName = expense.paidBy.name;
    
    if (!groupBalances[groupId]) {
      groupBalances[groupId] = {
        groupName,
        owedTo: {}, // userId -> { amount, name }
      };
    }
    
    if (!groupReceivables[groupId]) {
      groupReceivables[groupId] = {
        groupName,
        owedBy: {}, // userId -> { amount, name }
      };
    }

    const splitType = expense.splitConfig?.type || 'equal';
    const shares = expense.splitConfig?.shares || {};
    const splitAmong = (expense.splitAmong || []).map(id => id.toString());

    // If user paid for this expense, calculate what others owe them
    if (paidById === userId.toString()) {
      for (const memberId of splitAmong) {
        if (memberId === userId.toString()) continue; // Skip self
        
        let memberShare = 0;
        if (splitType === 'equal') {
          memberShare = expense.amount / splitAmong.length;
        } else if (splitType === 'exact' || splitType === 'itemized') {
          memberShare = shares[memberId] || 0;
        } else if (splitType === 'percentage') {
          const percentage = shares[memberId] || 0;
          memberShare = (percentage / 100) * expense.amount;
        }
        
        if (memberShare > 0) {
          // Find member name from group
          const member = groups.find(g => g._id.toString() === groupId)?.members.find(m => m._id.toString() === memberId);
          const memberName = member?.name || 'Unknown';
          
          if (!groupReceivables[groupId].owedBy[memberId]) {
            groupReceivables[groupId].owedBy[memberId] = { amount: 0, name: memberName };
          }
          groupReceivables[groupId].owedBy[memberId].amount += memberShare;
        }
      }
      continue; // Skip calculating what user owes for expenses they paid
    }

    // Calculate user's share (what they owe)
    let userShare = 0;

    // Check if user is part of this expense
    const isInSplit = splitAmong.includes(userId.toString()) || shares[userId.toString()] !== undefined;
    
    if (!isInSplit) {
      continue;
    }

    if (splitType === 'equal') {
      userShare = expense.amount / splitAmong.length;
    } else if (splitType === 'exact' || splitType === 'itemized') {
      userShare = shares[userId.toString()] || 0;
    } else if (splitType === 'percentage') {
      const percentage = shares[userId.toString()] || 0;
      userShare = (percentage / 100) * expense.amount;
    }

    if (userShare > 0) {
      if (!groupBalances[groupId].owedTo[paidById]) {
        groupBalances[groupId].owedTo[paidById] = { amount: 0, name: paidByName };
      }
      groupBalances[groupId].owedTo[paidById].amount += userShare;
    }
  }

  // Process settlements - reduce owed amounts (both directions)
  for (const settlement of settlements) {
    const groupId = settlement.groupId.toString();
    const fromUserId = settlement.fromUserId.toString();
    const toUserId = settlement.toUserId.toString();

    // If user paid someone (fromUserId is the user) - reduce what user owes
    if (fromUserId === userId.toString()) {
      if (groupBalances[groupId]?.owedTo[toUserId]) {
        groupBalances[groupId].owedTo[toUserId].amount -= settlement.amount;
      }
    }
    
    // If someone paid the user (toUserId is the user) - reduce what is owed to user
    if (toUserId === userId.toString()) {
      if (groupReceivables[groupId]?.owedBy[fromUserId]) {
        groupReceivables[groupId].owedBy[fromUserId].amount -= settlement.amount;
      }
    }
  }

  // Compile final dues by group (what user owes)
  const duesByGroup = [];
  let totalOwed = 0;

  for (const [groupId, data] of Object.entries(groupBalances)) {
    const groupDues = [];
    
    for (const [creditorId, creditorData] of Object.entries(data.owedTo)) {
      const roundedAmount = Math.round(creditorData.amount * 100) / 100;
      if (roundedAmount > 0.01) {
        groupDues.push({
          creditorId,
          creditorName: creditorData.name,
          amount: roundedAmount,
        });
        totalOwed += roundedAmount;
      }
    }

    if (groupDues.length > 0) {
      duesByGroup.push({
        groupId,
        groupName: data.groupName,
        dues: groupDues,
        groupTotal: groupDues.reduce((sum, d) => sum + d.amount, 0),
      });
    }
  }

  // Compile final receivables by group (what is owed to user)
  const receivablesByGroup = [];
  let totalOwedToUser = 0;

  for (const [groupId, data] of Object.entries(groupReceivables)) {
    const groupReceivablesList = [];
    
    for (const [debtorId, debtorData] of Object.entries(data.owedBy)) {
      const roundedAmount = Math.round(debtorData.amount * 100) / 100;
      if (roundedAmount > 0.01) {
        groupReceivablesList.push({
          debtorId,
          debtorName: debtorData.name,
          amount: roundedAmount,
        });
        totalOwedToUser += roundedAmount;
      }
    }

    if (groupReceivablesList.length > 0) {
      receivablesByGroup.push({
        groupId,
        groupName: data.groupName,
        receivables: groupReceivablesList,
        groupTotal: groupReceivablesList.reduce((sum, r) => sum + r.amount, 0),
      });
    }
  }

  // Sort by group total (highest first)
  duesByGroup.sort((a, b) => b.groupTotal - a.groupTotal);
  receivablesByGroup.sort((a, b) => b.groupTotal - a.groupTotal);

  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwedToUser: Math.round(totalOwedToUser * 100) / 100,
    duesByGroup,
    receivablesByGroup,
  };
}

/**
 * Generate HTML email content for due reminder
 * @param {Object} data - Email data
 * @returns {string} - HTML content
 */
function generateDueReminderEmailHtml(data) {
  const { userName, totalOwed, duesByGroup, currency = 'INR' } = data;
  
  const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;
  
  let groupsHtml = '';
  for (const group of duesByGroup) {
    let duesHtml = '';
    for (const due of group.dues) {
      duesHtml += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${due.creditorName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500; color: #dc2626;">${currencySymbol}${due.amount.toFixed(2)}</td>
        </tr>
      `;
    }
    
    groupsHtml += `
      <div style="margin-bottom: 20px; background: #f9fafb; border-radius: 8px; padding: 16px;">
        <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px;">${group.groupName}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #e5e7eb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Owed To</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${duesHtml}
          </tbody>
          <tfoot>
            <tr style="background: #fee2e2;">
              <td style="padding: 10px 12px; font-weight: 600;">Group Total</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: #dc2626;">${currencySymbol}${group.groupTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">💸 Payment Reminder</h1>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${userName}</strong>,</p>
        
        <p style="margin-bottom: 20px;">You have outstanding dues that haven't been cleared yet. Here's a summary of what you owe:</p>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;">Total Outstanding</p>
          <p style="margin: 8px 0 0 0; color: #dc2626; font-size: 28px; font-weight: 700;">${currencySymbol}${totalOwed.toFixed(2)}</p>
        </div>
        
        ${groupsHtml}
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Settle Now</a>
        </div>
        
        <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">Settling your dues keeps friendships strong! 🤝</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          You're receiving this because you have payment reminders enabled in your preferences.<br>
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings" style="color: #667eea;">Manage email preferences</a>
        </p>
        
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 16px;">
          Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #667eea;">notifications.splitit@gmail.com</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email content for UPI setup reminder
 * @param {Object} data - Email data
 * @returns {string} - HTML content
 */
function generateUpiReminderEmailHtml(data) {
  const { userName, totalOwedToUser, receivablesByGroup, currency = 'INR' } = data;
  
  const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;
  
  let groupsHtml = '';
  for (const group of receivablesByGroup) {
    let receivablesHtml = '';
    for (const receivable of group.receivables) {
      receivablesHtml += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${receivable.debtorName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500; color: #16a34a;">${currencySymbol}${receivable.amount.toFixed(2)}</td>
        </tr>
      `;
    }
    
    groupsHtml += `
      <div style="margin-bottom: 20px; background: #f9fafb; border-radius: 8px; padding: 16px;">
        <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px;">${group.groupName}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #e5e7eb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Owed By</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${receivablesHtml}
          </tbody>
          <tfoot>
            <tr style="background: #dcfce7;">
              <td style="padding: 10px 12px; font-weight: 600;">Group Total</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: #16a34a;">${currencySymbol}${group.groupTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">💳 Add Your UPI ID</h1>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${userName}</strong>,</p>
        
        <p style="margin-bottom: 20px;">You have money waiting to be collected! Add your UPI ID to make it easy for others to pay you.</p>
        
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; color: #166534; font-size: 14px;">Total Amount Owed to You</p>
          <p style="margin: 8px 0 0 0; color: #16a34a; font-size: 28px; font-weight: 700;">${currencySymbol}${totalOwedToUser.toFixed(2)}</p>
        </div>
        
        ${groupsHtml}
        
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>💡 Why add your UPI ID?</strong><br>
            When you add your UPI ID, others can easily pay you directly through apps like Google Pay, PhonePe, Paytm, etc. No more awkward payment reminders!
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Add UPI ID Now</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          You're receiving this because you have payment reminders enabled in your preferences.<br>
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings" style="color: #10b981;">Manage email preferences</a>
        </p>
        
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 16px;">
          Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #10b981;">notifications.splitit@gmail.com</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Process due reminders for all users with pending dues
 */
async function processDueReminders() {
  console.log('Processing due reminders...');
  
  const now = new Date();
  
  // Get all users who have payment reminders enabled
  const users = await User.find({
    $or: [
      { 'emailPreferences.paymentReminders': true },
      { 'emailPreferences.paymentReminders': { $exists: false } }, // Default to true
    ],
  }).lean();

  console.log(`Found ${users.length} users with payment reminders enabled`);

  let emailsSent = 0;
  let notificationsSent = 0;
  let upiRemindersSent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const { totalOwed, totalOwedToUser, duesByGroup, receivablesByGroup } = await calculateUserDues(user._id);

      // Send due reminder if user owes money
      if (totalOwed >= 1) {
        // Send email notification for dues
        const emailHtml = generateDueReminderEmailHtml({
          userName: user.name,
          totalOwed,
          duesByGroup,
          currency: 'INR',
        });

        await emailQueue.add({
          to: user.email,
          subject: `💸 Reminder: You have ₹${totalOwed.toFixed(2)} in pending dues`,
          html: emailHtml,
        });
        emailsSent++;

        // Send in-app notification for dues
        await notificationQueue.add({
          userId: user._id.toString(),
          type: 'warning',
          title: 'Pending Dues Reminder',
          message: `You have ₹${totalOwed.toFixed(2)} in outstanding dues across ${duesByGroup.length} group${duesByGroup.length > 1 ? 's' : ''}. Settle your dues to keep your accounts clear!`,
          data: {
            actionType: 'due_reminder',
            totalOwed,
            groupCount: duesByGroup.length,
          },
        });
        notificationsSent++;
      }

      // Send UPI reminder if user is owed money but doesn't have UPI ID set
      if (totalOwedToUser >= 1 && !user.upiId) {
        // Send email notification for UPI setup
        const upiEmailHtml = generateUpiReminderEmailHtml({
          userName: user.name,
          totalOwedToUser,
          receivablesByGroup,
          currency: 'INR',
        });

        await emailQueue.add({
          to: user.email,
          subject: `💳 Add your UPI ID - ₹${totalOwedToUser.toFixed(2)} waiting for you!`,
          html: upiEmailHtml,
        });

        // Send in-app notification for UPI setup
        await notificationQueue.add({
          userId: user._id.toString(),
          type: 'info',
          title: 'Add Your UPI ID',
          message: `You have ₹${totalOwedToUser.toFixed(2)} pending from others. Add your UPI ID to make it easy for them to pay you!`,
          data: {
            actionType: 'add_upi',
            totalOwedToUser,
            groupCount: receivablesByGroup.length,
          },
        });
        upiRemindersSent++;
      }

      // Skip count if no action was taken
      if (totalOwed < 1 && (totalOwedToUser < 1 || user.upiId)) {
        skipped++;
      }

    } catch (error) {
      console.error(`Failed to process due reminder for ${user.email}:`, error.message);
      skipped++;
    }
  }

  console.log(`Due reminders complete: ${emailsSent} due emails, ${upiRemindersSent} UPI reminders, ${notificationsSent} notifications, ${skipped} skipped`);
  return { emailsSent, notificationsSent, upiRemindersSent, skipped };
}

/**
 * Initialize the due reminder worker
 */
export const initDueReminderWorker = () => {
  // Process due reminder jobs
  dueReminderQueue.process(async (job) => {
    const { type } = job.data;
    
    if (type === 'daily') {
      return processDueReminders();
    }
    
    throw new Error(`Unknown due reminder type: ${type}`);
  });

  // Schedule daily due reminder - Every day at 10 AM
  // You can customize the time by changing the cron expression
  dueReminderQueue.add(
    { type: 'daily' },
    {
      repeat: {
        cron: '0 10 * * *', // Every day at 10:00 AM
      },
      jobId: 'daily-due-reminder-scheduler',
    }
  ).catch(err => console.error('Failed to schedule daily due reminder:', err.message));

  console.log('Due reminder worker initialized (daily: 10 AM)');
};

/**
 * Manually trigger due reminder processing (for testing)
 */
export const triggerDueReminder = async () => {
  return dueReminderQueue.add({ type: 'daily' }, { priority: 1 });
};

/**
 * Get pending dues for a specific user (utility function)
 * Can be used by controllers if needed
 */
export const getUserPendingDues = calculateUserDues;

export default initDueReminderWorker;
