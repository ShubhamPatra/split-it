/**
 * Email Utility Functions
 * 
 * Helper functions for checking user email preferences and sending
 * preference-aware emails.
 */

import User from '../models/User.js';
import { sendEmailWithRetry } from '../jobs/emailService.js';

/**
 * Check if a user has a specific email preference enabled
 * @param {string} userId - User ID
 * @param {string} preference - Preference key (e.g., 'weeklyDigest', 'settlementConfirmation')
 * @returns {Promise<boolean>}
 */
export async function checkEmailPreference(userId, preference) {
  try {
    const user = await User.findById(userId).select('emailPreferences').lean();
    if (!user || !user.emailPreferences) {
      // Default to true for most notifications if preferences not set
      const defaultEnabled = ['expenseAdded', 'settlementConfirmation', 'paymentReminders',
        'recurringExpenseReminder', 'memberJoined', 'groupInvite', 'budgetAlerts', 'exportReports', 'repaymentRequest'];
      return defaultEnabled.includes(preference);
    }

    // If preference is explicitly set, use that value
    // If not set (undefined), fall back to defaults
    const value = user.emailPreferences[preference];
    if (value === undefined) {
      const defaultEnabled = ['expenseAdded', 'settlementConfirmation', 'paymentReminders',
        'recurringExpenseReminder', 'memberJoined', 'groupInvite', 'budgetAlerts', 'exportReports', 'repaymentRequest'];
      return defaultEnabled.includes(preference);
    }
    return value === true;
  } catch (error) {
    console.error('Error checking email preference:', error);
    return false;
  }
}

/**
 * Send email only if user has the preference enabled
 * @param {string} userId - User ID
 * @param {string} preference - Preference key to check
 * @param {Object} emailData - Email data { to, template, data }
 * @param {Object} options - Bull job options
 * @returns {Promise<boolean>} - Whether email was queued
 */
export async function sendPreferenceEmail(userId, preference, emailData, options = {}) {
  try {
    const isEnabled = await checkEmailPreference(userId, preference);

    if (!isEnabled) {
      console.log(`Email skipped for user ${userId}: ${preference} preference disabled`);
      return false;
    }

    await sendEmailWithRetry(emailData);
    return true;
  } catch (error) {
    console.error('Error sending preference email:', error);
    return false;
  }
}

/**
 * Send email to multiple users, respecting each user's preferences
 * @param {Array<{userId: string, email: string, name: string}>} users - Array of user objects
 * @param {string} preference - Preference key to check
 * @param {Function} emailDataFn - Function that takes user and returns email data
 * @returns {Promise<{sent: number, skipped: number}>}
 */
export async function sendBulkPreferenceEmail(users, preference, emailDataFn) {
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const isEnabled = await checkEmailPreference(user.userId || user._id, preference);

      if (!isEnabled) {
        skipped++;
        continue;
      }

      const emailData = emailDataFn(user);
      await sendEmailWithRetry(emailData);
      sent++;
    } catch (error) {
      console.error(`Error sending email to ${user.email}:`, error);
      skipped++;
    }
  }

  return { sent, skipped };
}

/**
 * Check user's budget and send alert if threshold exceeded
 * @param {string} userId - User ID
 * @param {number} currentSpend - Current spending amount
 * @param {string} category - Optional category (null for overall)
 */
export async function checkAndSendBudgetAlert(userId, currentSpend, category = null) {
  try {
    const user = await User.findById(userId).select('name email emailPreferences budgetSettings').lean();

    if (!user) return;

    // Check if budget alerts are enabled
    if (!user.emailPreferences?.budgetAlerts) return;

    const budgetSettings = user.budgetSettings || {};
    let limit = 0;
    let alertThreshold = budgetSettings.alertThreshold || 80;

    if (category && budgetSettings.categoryLimits) {
      limit = budgetSettings.categoryLimits.get?.(category) || budgetSettings.categoryLimits[category] || 0;
    } else {
      limit = budgetSettings.monthlyLimit || 0;
    }

    // No limit set
    if (limit <= 0) return;

    const percentage = Math.round((currentSpend / limit) * 100);

    // Only alert at threshold or over
    if (percentage < alertThreshold) return;

    // Send budget alert email
    await sendEmailWithRetry({
      to: user.email,
      template: 'budgetAlert',
      data: {
        userName: user.name,
        alertType: percentage >= 100 ? 'exceeded' : 'warning',
        alertData: {
          currentSpend,
          limit,
          percentage,
          category: category || 'Monthly',
          period: 'month',
        },
      },
    });

    console.log(`Budget alert sent to ${user.email}: ${percentage}% of ${category || 'monthly'} limit`);
  } catch (error) {
    console.error('Error checking/sending budget alert:', error);
  }
}

/**
 * Check if user needs a payment method reminder and send if needed
 * @param {string} userId - User ID
 * @param {number} pendingAmount - Amount pending to receive
 */
export async function checkAndSendPaymentMethodReminder(userId, pendingAmount) {
  try {
    if (pendingAmount <= 0) return;

    const user = await User.findById(userId).select('name email upiId emailPreferences').lean();

    if (!user) return;

    // Check if user already has UPI ID
    if (user.upiId) return;

    // Check if payment reminders are enabled
    if (!user.emailPreferences?.paymentReminders) return;

    // Send reminder email
    await sendEmailWithRetry({
      to: user.email,
      template: 'paymentMethodReminder',
      data: {
        userName: user.name,
        pendingAmount,
      },
    });

    console.log(`Payment method reminder sent to ${user.email}: ₹${pendingAmount} pending`);
  } catch (error) {
    console.error('Error sending payment method reminder:', error);
  }
}

export default {
  checkEmailPreference,
  sendPreferenceEmail,
  sendBulkPreferenceEmail,
  checkAndSendBudgetAlert,
  checkAndSendPaymentMethodReminder,
};
