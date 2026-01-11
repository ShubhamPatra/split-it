/**
 * Due Reminder Worker
 * 
 * Sends daily reminders to users with uncleared dues older than 24 hours.
 * Runs on a schedule via BullMQ queue.
 * 
 * Uses BullMQ for production-grade Redis Cluster compatibility.
 * Uses the modern Split-It email template system for consistent branding.
 */

import { 
  createWorker, 
  emailQueue, 
  notificationQueue, 
  dueReminderQueue,
  QUEUE_NAMES, 
  getDueReminderQueue 
} from '../config/queueBullMQ.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import {
  brand,
  formatCurrency,
  formatDate,
  buildEmail,
  buttonComponent,
  cardComponent,
  alertComponent,
  infoRowComponent,
  tableComponent,
  amountDisplayComponent,
  dividerComponent,
  textComponent,
  greetingComponent,
} from '../utils/emailTemplates.js';

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
 * Using the modern Split-It email template system
 * @param {Object} data - Email data
 * @returns {string} - HTML content
 */
function generateDueReminderEmailHtml(data) {
  const { userName, totalOwed, duesByGroup, currency = 'INR' } = data;
  
  // Build group tables
  let groupsContent = '';
  for (const group of duesByGroup) {
    const duesRows = group.dues.map(due => [
      due.creditorName,
      `<span style="color: ${brand.colors.danger}; font-weight: 600;">${formatCurrency(due.amount, currency)}</span>`
    ]);
    
    groupsContent += `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 20px;">
        <tr>
          <td style="background-color: ${brand.colors.borderLight}; border: 1px solid ${brand.colors.border}; border-radius: ${brand.borderRadius.md}; padding: 16px;">
            <p style="margin: 0 0 12px; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">
              👥 ${group.groupName}
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
              <thead>
                <tr style="background-color: ${brand.colors.border};">
                  <th style="padding: 8px 12px; text-align: left; font-size: ${brand.fonts.sizeSmall}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted};">Owed To</th>
                  <th style="padding: 8px 12px; text-align: right; font-size: ${brand.fonts.sizeSmall}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted};">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${group.dues.map(due => `
                  <tr>
                    <td style="padding: 10px 12px; border-bottom: 1px solid ${brand.colors.borderLight}; color: ${brand.colors.textPrimary};">${due.creditorName}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid ${brand.colors.borderLight}; text-align: right; font-weight: 600; color: ${brand.colors.danger};">${formatCurrency(due.amount, currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${brand.colors.dangerLight}; border-radius: ${brand.borderRadius.sm};">
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: ${brand.colors.textPrimary};">Group Total</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: ${brand.colors.danger};">${formatCurrency(group.groupTotal, currency)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  return buildEmail(
    { 
      title: 'Payment Reminder', 
      subtitle: 'You have pending dues to settle', 
      icon: '💸', 
      variant: 'danger' 
    },
    `
      ${greetingComponent(userName)}
      ${textComponent("You have outstanding dues that haven't been cleared yet. Here's a summary of what you owe:")}
      
      ${amountDisplayComponent(totalOwed, { 
        currency, 
        variant: 'danger', 
        label: 'Total Outstanding' 
      })}
      
      ${groupsContent}
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
        <tr><td align="center">
          ${buttonComponent('Settle Now', brand.clientUrl, { variant: 'primary', size: 'large' })}
        </td></tr>
      </table>
      
      ${alertComponent('Settling your dues keeps friendships strong! 🤝', { variant: 'info' })}
    `,
    { showPreferences: true }
  );
}

/**
 * Generate HTML email content for UPI setup reminder
 * Using the modern Split-It email template system
 * @param {Object} data - Email data
 * @returns {string} - HTML content
 */
function generateUpiReminderEmailHtml(data) {
  const { userName, totalOwedToUser, receivablesByGroup, currency = 'INR' } = data;
  
  // Build group tables for receivables
  let groupsContent = '';
  for (const group of receivablesByGroup) {
    groupsContent += `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 20px;">
        <tr>
          <td style="background-color: ${brand.colors.borderLight}; border: 1px solid ${brand.colors.border}; border-radius: ${brand.borderRadius.md}; padding: 16px;">
            <p style="margin: 0 0 12px; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">
              👥 ${group.groupName}
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
              <thead>
                <tr style="background-color: ${brand.colors.border};">
                  <th style="padding: 8px 12px; text-align: left; font-size: ${brand.fonts.sizeSmall}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted};">Owed By</th>
                  <th style="padding: 8px 12px; text-align: right; font-size: ${brand.fonts.sizeSmall}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${brand.colors.textMuted};">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${group.receivables.map(receivable => `
                  <tr>
                    <td style="padding: 10px 12px; border-bottom: 1px solid ${brand.colors.borderLight}; color: ${brand.colors.textPrimary};">${receivable.debtorName}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid ${brand.colors.borderLight}; text-align: right; font-weight: 600; color: ${brand.colors.success};">${formatCurrency(receivable.amount, currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${brand.colors.successLight}; border-radius: ${brand.borderRadius.sm};">
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: ${brand.colors.textPrimary};">Group Total</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: ${brand.colors.success};">${formatCurrency(group.groupTotal, currency)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  return buildEmail(
    { 
      title: 'Add Your UPI ID', 
      subtitle: 'Money is waiting for you!', 
      icon: '💳', 
      variant: 'success' 
    },
    `
      ${greetingComponent(userName)}
      ${textComponent("You have money waiting to be collected! Add your UPI ID to make it easy for others to pay you.")}
      
      ${amountDisplayComponent(totalOwedToUser, { 
        currency, 
        variant: 'success', 
        label: 'Total Owed to You' 
      })}
      
      ${groupsContent}
      
      ${cardComponent(`
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="font-size: 24px; padding-right: 12px; vertical-align: top;">💡</td>
            <td>
              <p style="margin: 0 0 8px; font-weight: 600; color: ${brand.colors.textPrimary};">Why add your UPI ID?</p>
              <ul style="margin: 0; padding-left: 20px; color: ${brand.colors.textSecondary};">
                <li style="margin-bottom: 4px;">Others can pay you directly via Google Pay, PhonePe, Paytm, etc.</li>
                <li style="margin-bottom: 4px;">No more awkward payment reminders</li>
                <li>Get paid faster and easier!</li>
              </ul>
            </td>
          </tr>
        </table>
      `, { variant: 'warning' })}
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
        <tr><td align="center">
          ${buttonComponent('Add UPI ID Now', `${brand.clientUrl}/settings`, { variant: 'success', size: 'large' })}
        </td></tr>
      </table>
    `,
    { showPreferences: true }
  );
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
 * Returns the worker instance for graceful shutdown
 */
export const initDueReminderWorker = async () => {
  // Process due reminder job handler
  const processDueReminderJob = async (job) => {
    const { type } = job.data;
    
    if (type === 'daily') {
      return processDueReminders();
    }
    
    throw new Error(`Unknown due reminder type: ${type}`);
  };

  // Create BullMQ Worker with concurrency 1
  const worker = createWorker(QUEUE_NAMES.DUE_REMINDER, processDueReminderJob, {
    concurrency: 1,
  });

  // Schedule daily due reminder - Every day at 10 AM
  const queue = getDueReminderQueue();
  
  try {
    await queue.add(
      'daily',
      { type: 'daily' },
      {
        repeat: {
          pattern: '0 10 * * *', // Every day at 10:00 AM
        },
        jobId: 'daily-due-reminder-scheduler',
      }
    );
    console.log('Due reminder: Daily reminder scheduled (10 AM)');
  } catch (err) {
    console.error('Failed to schedule daily due reminder:', err.message);
  }

  console.log('Due reminder worker initialized (BullMQ, concurrency: 1)');
  return worker;
};

/**
 * Manually trigger due reminder processing (for testing)
 */
export const triggerDueReminder = async () => {
  const queue = getDueReminderQueue();
  return queue.add('daily', { type: 'daily' }, { priority: 1 });
};

/**
 * Get pending dues for a specific user (utility function)
 * Can be used by controllers if needed
 */
export const getUserPendingDues = calculateUserDues;

export default initDueReminderWorker;
