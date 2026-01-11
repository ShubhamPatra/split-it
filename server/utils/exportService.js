/**
 * Export Service
 * 
 * Handles generating and emailing expense reports.
 */

import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { emailQueue } from '../config/queue.js';
import { checkEmailPreference } from './emailUtils.js';

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

    // Queue email with attachment
    await emailQueue.add({
      to: user.email,
      subject: `Your ${reportType} export for ${groupName || 'all groups'} is ready`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📄 Export Ready</h1>
          </div>
          <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
            <p>Hi ${user.name},</p>
            <p>Your ${reportType} export is attached to this email.</p>
            
            <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Report Type</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${reportType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Group</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${groupName || 'All Groups'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Date Range</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${dateRange}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Total Expenses</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${expenses.length}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Total Settlements</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${settlements.length}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 24px 0; text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/analytics" 
                 style="background-color: #4F46E5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Analytics
              </a>
            </div>
          </div>
        </div>
      `,
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
