/**
 * Export Service
 * 
 * Handles generating and emailing expense reports.
 * Uses the modern Split-It email template system for consistent branding.
 */

import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { emailQueue } from '../config/queue.js';
import { checkEmailPreference } from './emailUtils.js';
import {
  brand,
  formatDate,
  buildEmail,
  buttonComponent,
  cardComponent,
  infoRowComponent,
  textComponent,
  greetingComponent,
} from './emailTemplates.js';

/**
 * Generate CSV content from expenses
 */
function generateExpenseCSV(expenses, settlements, users) {
  const userMap = {};
  users.forEach(u => { userMap[u._id.toString()] = u.name; });

  // CSV Header
  let csv = 'Date,Type,Description,Amount,Currency,Category,Paid By,Group,Split Among\n';

  // Add expenses
  expenses.forEach(exp => {
    const date = new Date(exp.date).toLocaleDateString('en-IN');
    const paidBy = userMap[exp.paidBy?.toString()] || exp.paidBy?.name || 'Unknown';
    const groupName = exp.groupId?.name || 'Unknown';
    const splitAmong = (exp.splitAmong || []).map(id => userMap[id.toString()] || 'Unknown').join('; ');
    
    // Escape description for CSV
    const description = `"${(exp.description || '').replace(/"/g, '""')}"`;
    
    csv += `${date},Expense,${description},${exp.amount},${exp.currency || 'INR'},${exp.category || 'Other'},${paidBy},${groupName},"${splitAmong}"\n`;
  });

  // Add settlements
  settlements.forEach(set => {
    const date = new Date(set.settledAt).toLocaleDateString('en-IN');
    const from = userMap[set.fromUserId?.toString()] || set.fromUserId?.name || 'Unknown';
    const to = userMap[set.toUserId?.toString()] || set.toUserId?.name || 'Unknown';
    const groupName = set.groupId?.name || 'Unknown';
    
    csv += `${date},Settlement,"Payment from ${from} to ${to}",${set.amount},${set.currency || 'INR'},Settlement,${from},${groupName},"${to}"\n`;
  });

  return csv;
}

/**
 * Generate and email an expense report
 * @param {string} userId - User requesting the report
 * @param {Object} options - Report options
 * @param {string} options.groupId - Optional group ID (null for all groups)
 * @param {Date} options.startDate - Start date
 * @param {Date} options.endDate - End date
 * @param {string} options.format - 'csv' (PDF can be added later)
 */
export async function generateAndEmailReport(userId, options = {}) {
  const { groupId, startDate, endDate, format = 'csv' } = options;

  try {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('User not found');

    // Check if user has preference enabled
    const isEnabled = await checkEmailPreference(userId, 'exportReports');
    if (!isEnabled) {
      console.log(`Export report skipped for ${user.email}: preference disabled`);
      return { success: false, reason: 'preference_disabled' };
    }

    // Get groups
    let groups;
    if (groupId) {
      groups = await Group.find({ _id: groupId, members: userId }).lean();
    } else {
      groups = await Group.find({ members: userId }).lean();
    }
    const groupIds = groups.map(g => g._id);

    if (groupIds.length === 0) {
      return { success: false, reason: 'no_groups' };
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Fetch expenses
    const expenseQuery = { groupId: { $in: groupIds } };
    if (Object.keys(dateFilter).length > 0) {
      expenseQuery.date = dateFilter;
    }

    const expenses = await Expense.find(expenseQuery)
      .populate('groupId', 'name')
      .populate('paidBy', 'name')
      .sort({ date: -1 })
      .lean();

    // Fetch settlements
    const settlementQuery = { groupId: { $in: groupIds } };
    if (Object.keys(dateFilter).length > 0) {
      settlementQuery.settledAt = dateFilter;
    }

    const settlements = await Settlement.find(settlementQuery)
      .populate('groupId', 'name')
      .populate('fromUserId', 'name')
      .populate('toUserId', 'name')
      .sort({ settledAt: -1 })
      .lean();

    // Get all users involved
    const userIds = new Set();
    expenses.forEach(exp => {
      if (exp.paidBy?._id) userIds.add(exp.paidBy._id.toString());
      (exp.splitAmong || []).forEach(id => userIds.add(id.toString()));
    });
    settlements.forEach(set => {
      if (set.fromUserId?._id) userIds.add(set.fromUserId._id.toString());
      if (set.toUserId?._id) userIds.add(set.toUserId._id.toString());
    });

    const users = await User.find({ _id: { $in: Array.from(userIds) } }).select('name').lean();

    // Generate report
    let reportContent;
    let reportType;
    
    if (format === 'csv') {
      reportContent = generateExpenseCSV(expenses, settlements, users);
      reportType = 'CSV';
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    // For now, we'll include the CSV data inline (base64 encoded)
    // In production, you'd upload to S3/cloud storage and provide a download link
    const base64Content = Buffer.from(reportContent).toString('base64');
    
    // Format date range
    let dateRange = 'All Time';
    if (startDate && endDate) {
      dateRange = `${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')}`;
    } else if (startDate) {
      dateRange = `From ${new Date(startDate).toLocaleDateString('en-IN')}`;
    } else if (endDate) {
      dateRange = `Until ${new Date(endDate).toLocaleDateString('en-IN')}`;
    }

    const groupName = groupId ? groups[0]?.name : null;

    // Queue email with attachment using the new template system
    const emailHtml = buildEmail(
      { title: 'Export Ready', subtitle: 'Your report is attached to this email', icon: '📄', variant: 'gradient' },
      `
        ${greetingComponent(user.name)}
        ${textComponent(`Your <strong>${reportType}</strong> export is attached to this email.`)}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${infoRowComponent('Report Type', reportType)}
            ${infoRowComponent('Group', groupName || 'All Groups')}
            ${infoRowComponent('Date Range', dateRange)}
            ${infoRowComponent('Total Expenses', expenses.length.toString())}
            ${infoRowComponent('Total Settlements', settlements.length.toString())}
          </table>
        `)}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('View Analytics', `${brand.clientUrl}/analytics`)}
          </td></tr>
        </table>
        
        ${textComponent('📎 The export file is attached to this email.', { variant: 'muted', align: 'center' })}
      `
    );

    await emailQueue.add({
      to: user.email,
      subject: `📄 Your ${reportType} export for ${groupName || 'all groups'} is ready`,
      html: emailHtml,
      attachments: [
        {
          filename: `split-it-export-${new Date().toISOString().split('T')[0]}.csv`,
          content: base64Content,
          encoding: 'base64',
        },
      ],
    });

    console.log(`Export report sent to ${user.email}`);
    return { success: true, expenses: expenses.length, settlements: settlements.length };

  } catch (error) {
    console.error('Error generating export report:', error);
    throw error;
  }
}

export default { generateAndEmailReport };
