/**
 * Email Worker
 * 
 * Processes email jobs from the email queue using nodemailer.
 * Handles welcome emails, notifications, password resets, etc.
 */

import { emailQueue } from '../config/queue.js';
import { sendEmail, transporter } from '../config/email.js';

/**
 * Initialize the email worker processor
 */
export const initEmailWorker = () => {
  emailQueue.process(async (job) => {
    const { to, subject, html, text, from, template, data } = job.data;

    // Handle template-based emails
    let emailSubject = subject;
    let emailHtml = html;

    if (template && data) {
      const templateFn = emailTemplates[template];
      if (templateFn) {
        const { inviterName, groupName, inviteUrl, expiresAt, memberName, recipientName, ...rest } = data;
        let generatedEmail;
        
        switch (template) {
          case 'groupInvite':
            generatedEmail = templateFn(inviterName, groupName, inviteUrl, expiresAt);
            break;
          case 'memberJoined':
            generatedEmail = templateFn(memberName, groupName);
            break;
          case 'newMemberJoined':
            generatedEmail = templateFn(groupName, memberName, recipientName);
            break;
          case 'welcome':
            generatedEmail = templateFn(data.userName || 'User');
            break;
          case 'settlementConfirmation':
            generatedEmail = templateFn(
              data.payerName, data.receiverName, data.amount, 
              data.groupName, data.transactionRef, data.paymentMethod, 
              data.isReceiver, data.currency
            );
            break;
          case 'digest':
            generatedEmail = templateFn(data.userName, data.period, data.summaryData);
            break;
          case 'recurringExpenseReminder':
            generatedEmail = templateFn(data.userName, data.expenses);
            break;
          case 'budgetAlert':
            generatedEmail = templateFn(data.userName, data.alertType, data.alertData);
            break;
          case 'exportReport':
            generatedEmail = templateFn(data.userName, data.reportType, data.groupName, data.dateRange, data.downloadUrl);
            break;
          case 'paymentMethodReminder':
            generatedEmail = templateFn(data.userName, data.pendingAmount);
            break;
          case 'expenseAdded':
            generatedEmail = templateFn(data.groupName, data.payerName, data.description, data.amount, data.currency);
            break;
          case 'settlementReminder':
            generatedEmail = templateFn(data.fromName, data.toName, data.amount, data.groupName, data.currency);
            break;
          default:
            generatedEmail = templateFn(...Object.values(data));
        }
        
        emailSubject = generatedEmail.subject;
        emailHtml = generatedEmail.html;
      }
    }

    if (!to || (!emailSubject && !subject)) {
      throw new Error('Missing required email fields: to, subject');
    }

    // Skip sending if SMTP is not configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.log(`Email worker: SMTP not configured, skipping email to ${to}`);
      return { skipped: true, reason: 'SMTP not configured' };
    }

    try {
      // Use the sendEmail utility or send directly
      const mailOptions = {
        from: from || `"Split-It" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: emailSubject,
        html: emailHtml,
        ...(text && { text }),
      };

      const result = await transporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully to ${to}: ${emailSubject}`);
      
      return {
        success: true,
        messageId: result.messageId,
        to,
        subject: emailSubject,
      };
    } catch (error) {
      console.error(`Email worker failed for ${to}:`, error.message);
      throw error; // Rethrow to trigger Bull retry
    }
  });

  console.log('Email worker initialized');
};

/**
 * Add an email job to the queue (convenience function)
 * @param {Object} emailData - Email data { to, subject, html, text }
 * @param {Object} options - Bull job options
 */
export const queueEmail = async (emailData, options = {}) => {
  return emailQueue.add(emailData, options);
};

/**
 * Email templates
 */
export const emailTemplates = {
  welcome: (userName) => ({
    subject: 'Welcome to Split-It!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Welcome to Split-It, ${userName}!</h1>
        <p>Thank you for joining Split-It. Start splitting expenses with your friends and family today.</p>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Go to Dashboard
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Happy Splitting!</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
      </div>
    `,
  }),

  newMemberJoined: (groupName, memberName, recipientName) => ({
    subject: `New member joined ${groupName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Member Alert</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${memberName}</strong> has joined your group <strong>"${groupName}"</strong> via invite link.</p>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/groups" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Group
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
      </div>
    `,
  }),

  expenseAdded: (groupName, payerName, description, amount, currency = 'INR') => ({
    subject: `New expense in ${groupName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Expense Added</h2>
        <p><strong>${payerName}</strong> added a new expense in <strong>"${groupName}"</strong>:</p>
        <div style="background-color: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-size: 18px;"><strong>${description}</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 24px; color: #4F46E5;">${currency === 'INR' ? '₹' : currency}${amount}</p>
        </div>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/groups" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Details
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
      </div>
    `,
  }),

  settlementReminder: (fromName, toName, amount, groupName, currency = 'INR') => ({
    subject: `Payment reminder from ${fromName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Payment Reminder</h2>
        <p>Hi ${toName},</p>
        <p>This is a friendly reminder that you owe <strong>${fromName}</strong>:</p>
        <div style="background-color: #FEF3C7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-size: 24px; color: #D97706;">${currency === 'INR' ? '₹' : currency}${amount}</p>
          <p style="margin: 8px 0 0 0; color: #92400E;">in group "${groupName}"</p>
        </div>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/groups" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Settle Now
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
      </div>
    `,
  }),

  groupInvite: (inviterName, groupName, inviteUrl, expiresAt) => ({
    subject: `${inviterName} invited you to join "${groupName}" on Split-It`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">You're Invited!</h1>
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on Split-It.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${inviteUrl}" 
             style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
            Join Group
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">This invite expires on ${new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.</p>
        <p style="color: #666; font-size: 14px;">If you don't have an account, you'll be prompted to create one.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
        <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 16px;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
      </div>
    `,
  }),

  memberJoined: (memberName, groupName) => ({
    subject: `${memberName} joined ${groupName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Member Joined!</h2>
        <p><strong>${memberName}</strong> has joined your group <strong>"${groupName}"</strong>.</p>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/groups" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Group
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
      </div>
    `,
  }),

  // Settlement Confirmation Email - sent to both payer and receiver
  settlementConfirmation: (payerName, receiverName, amount, groupName, transactionRef, paymentMethod, isReceiver = false, currency = 'INR') => ({
    subject: isReceiver 
      ? `Payment received: ${currency === 'INR' ? '₹' : currency}${amount} from ${payerName}`
      : `Payment sent: ${currency === 'INR' ? '₹' : currency}${amount} to ${receiverName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ${isReceiver ? '💰 Payment Received' : '✅ Payment Sent'}
          </h1>
        </div>
        <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <p style="font-size: 48px; font-weight: bold; color: #10B981; margin: 0;">
              ${currency === 'INR' ? '₹' : currency}${amount.toLocaleString()}
            </p>
            <p style="color: #6B7280; margin: 8px 0 0 0;">
              ${isReceiver ? `From ${payerName}` : `To ${receiverName}`}
            </p>
          </div>
          
          <div style="background-color: #F9FAFB; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Group</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${groupName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Payment Method</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${paymentMethod?.toUpperCase() || 'CASH'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Reference</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${transactionRef || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Date</td>
                <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              </tr>
            </table>
          </div>

          <div style="margin: 24px 0; text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/groups" 
               style="background-color: #4F46E5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Settlement
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
            This is an automated email from Split-It. Please do not reply.
          </p>
          <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 12px;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
        </div>
      </div>
    `,
  }),

  // Weekly/Monthly Digest Email
  digest: (userName, period, summaryData) => {
    const { totalExpenses, totalSettled, youOwe, youAreOwed, topGroups, topCategories } = summaryData;
    const periodLabel = period === 'weekly' ? 'Weekly' : 'Monthly';
    
    const groupsHtml = topGroups?.length ? topGroups.map(g => 
      `<tr>
        <td style="padding: 8px 0;">${g.name}</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">₹${g.total.toLocaleString()}</td>
      </tr>`
    ).join('') : '<tr><td colspan="2" style="padding: 8px 0; color: #9CA3AF;">No activity this period</td></tr>';

    const categoriesHtml = topCategories?.length ? topCategories.map(c => 
      `<span style="display: inline-block; background: #EEF2FF; color: #4F46E5; padding: 4px 12px; border-radius: 16px; margin: 4px; font-size: 13px;">
        ${c.name}: ₹${c.total.toLocaleString()}
      </span>`
    ).join('') : '<span style="color: #9CA3AF;">No expenses this period</span>';

    return {
      subject: `Your ${periodLabel} Split-It Summary`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📊 ${periodLabel} Summary</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">Hi ${userName}, here's your expense overview</p>
          </div>
          
          <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
            <!-- Balance Cards -->
            <div style="display: flex; gap: 16px; margin-bottom: 24px;">
              <div style="flex: 1; background: #ECFDF5; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="color: #059669; font-size: 12px; margin: 0; text-transform: uppercase;">You're Owed</p>
                <p style="color: #047857; font-size: 24px; font-weight: bold; margin: 4px 0 0 0;">₹${(youAreOwed || 0).toLocaleString()}</p>
              </div>
              <div style="flex: 1; background: #FEF2F2; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="color: #DC2626; font-size: 12px; margin: 0; text-transform: uppercase;">You Owe</p>
                <p style="color: #B91C1C; font-size: 24px; font-weight: bold; margin: 4px 0 0 0;">₹${(youOwe || 0).toLocaleString()}</p>
              </div>
            </div>

            <!-- Stats -->
            <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Total Expenses</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #4F46E5;">₹${(totalExpenses || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6B7280;">Total Settled</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #10B981;">₹${(totalSettled || 0).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <!-- Top Groups -->
            <h3 style="color: #374151; font-size: 16px; margin: 0 0 12px 0;">Top Groups</h3>
            <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                ${groupsHtml}
              </table>
            </div>

            <!-- Categories -->
            <h3 style="color: #374151; font-size: 16px; margin: 0 0 12px 0;">Spending by Category</h3>
            <div style="margin-bottom: 24px;">
              ${categoriesHtml}
            </div>

            <div style="text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/analytics" 
                 style="background-color: #4F46E5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Full Analytics
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings/notifications" style="color: #6B7280;">Manage email preferences</a>
            </p>
            <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 12px;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
          </div>
        </div>
      `,
    };
  },

  // Recurring Expense Reminder (upcoming expense)
  recurringExpenseReminder: (userName, expenses) => {
    const expenseRows = expenses.map(e => 
      `<tr>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${e.groupName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">₹${e.amount.toLocaleString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${new Date(e.nextRunAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
      </tr>`
    ).join('');

    return {
      subject: `Upcoming recurring expenses - ${expenses.length} due soon`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔄 Recurring Expenses Reminder</h1>
          </div>
          <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
            <p>Hi ${userName},</p>
            <p>You have <strong>${expenses.length} recurring expense${expenses.length > 1 ? 's' : ''}</strong> coming up soon:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <thead>
                <tr style="background: #F9FAFB;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; color: #6B7280; text-transform: uppercase;">Description</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; color: #6B7280; text-transform: uppercase;">Group</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; color: #6B7280; text-transform: uppercase;">Amount</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; color: #6B7280; text-transform: uppercase;">Due</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRows}
              </tbody>
            </table>

            <div style="margin: 24px 0; text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
                 style="background-color: #4F46E5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Dashboard
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
          </div>
        </div>
      `,
    };
  },

  // Budget Alert Email
  budgetAlert: (userName, alertType, data) => {
    const { currentSpend, limit, percentage, category, period } = data;
    const isOverBudget = percentage >= 100;
    const alertColor = isOverBudget ? '#DC2626' : '#F59E0B';
    const alertBg = isOverBudget ? '#FEF2F2' : '#FFFBEB';
    
    return {
      subject: isOverBudget 
        ? `⚠️ Budget exceeded: ${category || 'Monthly'} spending`
        : `Budget alert: ${percentage}% of ${category || 'monthly'} limit reached`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${alertColor}; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              ${isOverBudget ? '🚨 Budget Exceeded!' : '⚠️ Budget Alert'}
            </h1>
          </div>
          <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
            <p>Hi ${userName},</p>
            <p>${isOverBudget 
              ? `You've exceeded your ${category || 'monthly'} budget limit.`
              : `You've reached ${percentage}% of your ${category || 'monthly'} budget limit.`
            }</p>
            
            <div style="background: ${alertBg}; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
              <p style="color: #6B7280; font-size: 14px; margin: 0;">Current Spending</p>
              <p style="font-size: 36px; font-weight: bold; color: ${alertColor}; margin: 8px 0;">₹${currentSpend.toLocaleString()}</p>
              <p style="color: #6B7280; margin: 0;">of ₹${limit.toLocaleString()} limit</p>
              
              <!-- Progress bar -->
              <div style="background: #E5E7EB; height: 8px; border-radius: 4px; margin-top: 16px; overflow: hidden;">
                <div style="background: ${alertColor}; height: 100%; width: ${Math.min(percentage, 100)}%;"></div>
              </div>
              <p style="color: ${alertColor}; font-size: 14px; margin: 8px 0 0 0; font-weight: 600;">${percentage}% used</p>
            </div>

            <div style="margin: 24px 0; text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/analytics" 
                 style="background-color: #4F46E5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Spending Details
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings/notifications" style="color: #6B7280;">Manage budget alerts</a>
            </p>
            <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 12px;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
          </div>
        </div>
      `,
    };
  },

  // Export Report Email (with attachment info)
  exportReport: (userName, reportType, groupName, dateRange, downloadUrl) => ({
    subject: `Your ${reportType} export for ${groupName || 'all groups'} is ready`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📄 Export Ready</h1>
        </div>
        <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
          <p>Hi ${userName},</p>
          <p>Your ${reportType} export is ready for download.</p>
          
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
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${dateRange || 'All Time'}</td>
              </tr>
            </table>
          </div>

          <div style="margin: 24px 0; text-align: center;">
            <a href="${downloadUrl}" 
               style="background-color: #10B981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              📥 Download Report
            </a>
          </div>
          
          <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
            This download link expires in 24 hours.
          </p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
          <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
        </div>
      </div>
    `,
  }),

  // Payment Method Reminder
  paymentMethodReminder: (userName, pendingAmount) => ({
    subject: 'Complete your payment profile to receive settlements',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">💳 Complete Your Profile</h1>
        </div>
        <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
          <p>Hi ${userName},</p>
          <p>You have <strong>₹${pendingAmount.toLocaleString()}</strong> in pending settlements, but your payment details are incomplete.</p>
          
          <div style="background: #FFFBEB; border: 1px solid #FCD34D; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #92400E;">
              <strong>Add your UPI ID</strong> to receive payments directly to your account.
            </p>
          </div>

          <div style="margin: 24px 0; text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/profile" 
               style="background-color: #4F46E5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Update Payment Details
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
          <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Need help? Contact us at <a href="mailto:notifications.splitit@gmail.com" style="color: #4F46E5;">notifications.splitit@gmail.com</a></p>
        </div>
      </div>
    `,
  }),
};

export default initEmailWorker;
