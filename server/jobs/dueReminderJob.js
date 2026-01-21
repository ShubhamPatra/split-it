/**
 * Due Reminder Job
 * 
 * Sends daily reminders to users with uncleared dues older than 24 hours.
 * Called by the cron scheduler.
 */

import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import { sendEmailWithRetry } from './emailService.js';
import { notifyUser } from './notificationService.js';
import {
  brand,
  formatCurrency,
  formatDate,
  buildEmail,
  buttonComponent,
  cardComponent,
  alertComponent,
  amountDisplayComponent,
  textComponent,
  greetingComponent,
} from '../utils/emailTemplates.js';

// Mutex flag to prevent overlapping executions
let isProcessingDueReminders = false;

/**
 * Calculate user's outstanding dues across all groups
 * Only considers dues older than 24 hours
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Object with dues details
 */
export const calculateUserDues = async (userId) => {
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

  // Build a map of net balances per group
  // Use the same logic as frontend getGroupBalances - use pre-computed splitConfig.shares
  const groupBalances = {};
  const groupReceivables = {};

  // Process expenses - use splitConfig.shares directly like frontend
  for (const expense of expenses) {
    const groupId = expense.groupId._id.toString();
    const groupName = expense.groupId.name;
    const paidById = expense.paidBy._id.toString();
    const paidByName = expense.paidBy.name;

    if (!groupBalances[groupId]) {
      groupBalances[groupId] = { groupName, owedTo: {} };
    }
    if (!groupReceivables[groupId]) {
      groupReceivables[groupId] = { groupName, owedBy: {} };
    }

    // Use pre-computed shares from splitConfig (consistent with frontend)
    const shares = expense.splitConfig?.shares || {};

    // If user paid, calculate what others owe them (from their shares)
    if (paidById === userId.toString()) {
      for (const [memberId, memberShare] of Object.entries(shares)) {
        if (memberId === userId.toString()) continue;
        if (memberShare <= 0) continue;

        const member = groups.find(g => g._id.toString() === groupId)?.members.find(m => m._id.toString() === memberId);
        const memberName = member?.name || 'Unknown';

        if (!groupReceivables[groupId].owedBy[memberId]) {
          groupReceivables[groupId].owedBy[memberId] = { amount: 0, name: memberName };
        }
        groupReceivables[groupId].owedBy[memberId].amount += memberShare;
      }
      continue;
    }

    // Calculate user's share (what they owe) - use pre-computed share
    const userShare = shares[userId.toString()] || 0;
    if (userShare <= 0) continue;

    if (!groupBalances[groupId].owedTo[paidById]) {
      groupBalances[groupId].owedTo[paidById] = { amount: 0, name: paidByName };
    }
    groupBalances[groupId].owedTo[paidById].amount += userShare;
  }

  // Process settlements
  for (const settlement of settlements) {
    const groupId = settlement.groupId.toString();
    const fromUserId = settlement.fromUserId.toString();
    const toUserId = settlement.toUserId.toString();

    if (fromUserId === userId.toString()) {
      if (groupBalances[groupId]?.owedTo[toUserId]) {
        groupBalances[groupId].owedTo[toUserId].amount -= settlement.amount;
      }
    }
    if (toUserId === userId.toString()) {
      if (groupReceivables[groupId]?.owedBy[fromUserId]) {
        groupReceivables[groupId].owedBy[fromUserId].amount -= settlement.amount;
      }
    }
  }

  // Compile final dues
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

  // Compile final receivables
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

  // Sort by group total
  duesByGroup.sort((a, b) => b.groupTotal - a.groupTotal);
  receivablesByGroup.sort((a, b) => b.groupTotal - a.groupTotal);

  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwedToUser: Math.round(totalOwedToUser * 100) / 100,
    duesByGroup,
    receivablesByGroup,
  };
};

/**
 * Generate HTML email content for due reminder
 */
function generateDueReminderEmailHtml(data) {
  const { userName, totalOwed, duesByGroup, currency = 'INR' } = data;

  let groupsContent = '';
  for (const group of duesByGroup) {
    groupsContent += `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 20px;">
        <tr>
          <td style="background-color: ${brand.colors.borderLight}; border: 1px solid ${brand.colors.border}; border-radius: ${brand.borderRadius.md}; padding: 16px;">
            <p style="margin: 0 0 12px; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">
              ${group.groupName}
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
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
    { title: 'Payment Reminder', subtitle: 'You have pending dues to settle', variant: 'danger' },
    `
      ${greetingComponent(userName)}
      ${textComponent("You have outstanding balances that require attention. Below is a summary of your pending payments.")}
      
      ${amountDisplayComponent(totalOwed, { currency, variant: 'danger', label: 'Total Outstanding' })}
      
      ${groupsContent}
      
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
        <tr><td align="center">
          ${buttonComponent('Settle Now', brand.clientUrl, { variant: 'primary', size: 'large' })}
        </td></tr>
      </table>
      
      ${alertComponent('Timely settlements help maintain accurate group balances.', { variant: 'info' })}
    `,
    { showPreferences: true }
  );
}

/**
 * Generate HTML email content for UPI setup reminder
 */
function generateUpiReminderEmailHtml(data) {
  const { userName, totalOwedToUser, receivablesByGroup, currency = 'INR' } = data;

  let groupsContent = '';
  for (const group of receivablesByGroup) {
    groupsContent += `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 20px;">
        <tr>
          <td style="background-color: ${brand.colors.borderLight}; border: 1px solid ${brand.colors.border}; border-radius: ${brand.borderRadius.md}; padding: 16px;">
            <p style="margin: 0 0 12px; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">
              ${group.groupName}
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
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
    { title: 'Add Your UPI ID', subtitle: 'Complete your payment profile', variant: 'success' },
    `
      ${greetingComponent(userName)}
      ${textComponent("You have receivables pending from group members. Add your UPI ID to enable direct payments.")}
      
      ${amountDisplayComponent(totalOwedToUser, { currency, variant: 'success', label: 'Total Owed to You' })}
      
      ${groupsContent}
      
      ${cardComponent(`
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td>
              <p style="margin: 0 0 8px; font-weight: 600; color: ${brand.colors.textPrimary};">Benefits of adding your UPI ID</p>
              <ul style="margin: 0; padding-left: 20px; color: ${brand.colors.textSecondary};">
                <li style="margin-bottom: 4px;">Receive payments directly via UPI-enabled apps</li>
                <li style="margin-bottom: 4px;">Streamlined settlement process</li>
                <li>Faster transaction completion</li>
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
 * @param {any} _data - Unused data parameter (for jobRunner compatibility)
 * @param {Object} options - Execution options
 * @param {AbortSignal} options.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Results object
 */
export const processDueReminders = async (_data, options = {}) => {
  const { signal } = options;

  // Check if already aborted
  if (signal?.aborted) {
    console.log('[DueReminder] Aborted before start');
    return { emailsSent: 0, notificationsSent: 0, upiRemindersSent: 0, skipped: 0, aborted: true };
  }

  // Mutex guard: prevent overlapping executions
  if (isProcessingDueReminders) {
    console.log('[DueReminder] Already running, skipping this execution');
    return { emailsSent: 0, notificationsSent: 0, upiRemindersSent: 0, skipped: 0, alreadyRunning: true };
  }

  isProcessingDueReminders = true;
  console.log('[DueReminder] Processing due reminders...');

  try {
    // Get all users who have payment reminders enabled
    const users = await User.find({
      $or: [
        { 'emailPreferences.paymentReminders': true },
        { 'emailPreferences.paymentReminders': { $exists: false } },
      ],
    }).lean();

    console.log(`[DueReminder] Found ${users.length} users with payment reminders enabled`);

    let emailsSent = 0;
    let notificationsSent = 0;
    let upiRemindersSent = 0;
    let skipped = 0;

    // Process in batches of 50 to avoid blocking event loop
    const BATCH_SIZE = 50;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      // Check for abort signal between batches
      if (signal?.aborted) {
        console.log(`[DueReminder] Aborted after processing ${i} users`);
        return { emailsSent, notificationsSent, upiRemindersSent, skipped, aborted: true };
      }

      const batch = users.slice(i, i + BATCH_SIZE);

      for (const user of batch) {
        try {
          const { totalOwed, totalOwedToUser, duesByGroup, receivablesByGroup } = await calculateUserDues(user._id);

          // Send due reminder if user owes money
          if (totalOwed >= 1) {
            const emailHtml = generateDueReminderEmailHtml({
              userName: user.name,
              totalOwed,
              duesByGroup,
              currency: 'INR',
            });

            await sendEmailWithRetry({
              to: user.email,
              subject: `Payment Reminder: ${formatCurrency(totalOwed, 'INR')} outstanding`,
              html: emailHtml,
            });
            emailsSent++;

            // Send in-app notification
            notifyUser(user._id.toString(), {
              type: 'warning',
              title: 'Pending Dues Reminder',
              message: `You have ₹${totalOwed.toFixed(2)} in outstanding dues across ${duesByGroup.length} group${duesByGroup.length > 1 ? 's' : ''}. Settle your dues to keep your accounts clear!`,
              data: {
                actionType: 'due_reminder',
                totalOwed,
                groupCount: duesByGroup.length,
              },
            }).catch(err => console.error('[DueReminder] Notification error:', err.message));
            notificationsSent++;
          }

          // Send UPI reminder if user is owed money but doesn't have UPI ID
          if (totalOwedToUser >= 1 && !user.upiId) {
            const upiEmailHtml = generateUpiReminderEmailHtml({
              userName: user.name,
              totalOwedToUser,
              receivablesByGroup,
              currency: 'INR',
            });

            await sendEmailWithRetry({
              to: user.email,
              subject: `Action Required: Add UPI ID to receive ${formatCurrency(totalOwedToUser, 'INR')}`,
              html: upiEmailHtml,
            });

            notifyUser(user._id.toString(), {
              type: 'info',
              title: 'Add Your UPI ID',
              message: `You have ₹${totalOwedToUser.toFixed(2)} pending from others. Add your UPI ID to make it easy for them to pay you!`,
              data: {
                actionType: 'navigate',
                url: '/profile',
                totalOwedToUser,
                groupCount: receivablesByGroup.length,
              },
            }).catch(err => console.error('[DueReminder] Notification error:', err.message));
            upiRemindersSent++;
          }

          if (totalOwed < 1 && (totalOwedToUser < 1 || user.upiId)) {
            skipped++;
          }
        } catch (error) {
          console.error(`[DueReminder] Failed for ${user.email}:`, error.message);
          skipped++;
        }
      }

      // Yield to event loop between batches to prevent blocking
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    console.log(`[DueReminder] Complete: ${emailsSent} due emails, ${upiRemindersSent} UPI reminders, ${notificationsSent} notifications, ${skipped} skipped`);
    return { emailsSent, notificationsSent, upiRemindersSent, skipped };
  } finally {
    isProcessingDueReminders = false;
  }
};

export default {
  calculateUserDues,
  processDueReminders,
};
