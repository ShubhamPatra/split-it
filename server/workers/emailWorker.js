/**
 * Email Worker
 * 
 * Processes email jobs from the email queue using nodemailer.
 * Handles welcome emails, notifications, password resets, etc.
 * 
 * Uses BullMQ for production-grade Redis Cluster compatibility.
 * Uses the modern Split-It email template system for consistent branding.
 */

import { createWorker, emailQueue, BULLMQ_QUEUE_NAMES, getQueueBackend } from '../config/queue.js';
import { recordJobCompleted, recordJobFailed } from '../utils/queueMonitor.js';
import { sendEmail, transporter } from '../config/email.js';
import {
  brand,
  formatCurrency,
  formatDate,
  buildEmail,
  emailWrapper,
  emailHeader,
  emailContent,
  emailFooter,
  buttonComponent,
  cardComponent,
  alertComponent,
  infoRowComponent,
  tableComponent,
  amountDisplayComponent,
  progressBarComponent,
  dividerComponent,
  textComponent,
  greetingComponent,
  statsRowComponent,
  badgeComponent,
} from '../utils/emailTemplates.js';

/**
 * Process a single email job
 * Extracted to allow direct calls when Redis is unavailable
 */
const processEmailJob = async (job) => {
  console.log(`[EmailWorker] Processing job ${job.id}:`, {
    template: job.data?.template,
    to: job.data?.to,
    hasData: !!job.data
  });

  const { to, subject, html, text, from, template, data, attachments } = job.data;

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
      ...(attachments && { attachments }),
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
};

/**
 * Initialize the email worker processor
 * Returns the worker instance for graceful shutdown
 */
export const initEmailWorker = async () => {
  const backend = getQueueBackend();
  console.log(`Email worker initializing with ${backend || 'auto'} queue backend...`);

  // Create worker using unified queue interface (works with both Redis and MongoDB)
  const worker = await createWorker('email', async (job) => {
    const startTime = Date.now();
    try {
      const result = await processEmailJob(job);
      recordJobCompleted('email', Date.now() - startTime);
      return result;
    } catch (error) {
      recordJobFailed('email');
      throw error;
    }
  }, {
    concurrency: 5,
  });

  console.log(`Email worker initialized (backend: ${getQueueBackend()}, concurrency: 5)`);
  return worker;
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
 * Email templates using the new Split-It design system
 */
export const emailTemplates = {
  // ============================================
  // WELCOME EMAIL
  // ============================================
  welcome: (userName) => ({
    subject: 'Welcome to Split-It! 🎉',
    html: buildEmail(
      { title: 'Welcome to Split-It!', subtitle: "Let's make splitting expenses effortless", icon: '👋', variant: 'gradient' },
      `
        ${greetingComponent(userName)}
        ${textComponent("Thank you for joining Split-It! We're excited to help you manage group expenses effortlessly.")}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size: 24px; padding-right: 12px; vertical-align: top;">✨</td>
              <td>
                <p style="margin: 0 0 8px; font-weight: 600; color: ${brand.colors.textPrimary};">Get Started in 3 Easy Steps</p>
                <ol style="margin: 0; padding-left: 20px; color: ${brand.colors.textSecondary};">
                  <li style="margin-bottom: 4px;">Create or join a group</li>
                  <li style="margin-bottom: 4px;">Add expenses and split them fairly</li>
                  <li>Settle up with a single tap</li>
                </ol>
              </td>
            </tr>
          </table>
        `)}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Go to Dashboard', `${brand.clientUrl}/dashboard`, { size: 'large' })}
          </td></tr>
        </table>
        
        ${textComponent("Happy Splitting! 🎉", { variant: 'muted', align: 'center' })}
      `,
      { showPreferences: false }
    ),
  }),

  // ============================================
  // NEW MEMBER JOINED
  // ============================================
  newMemberJoined: (groupName, memberName, recipientName) => ({
    subject: `${memberName} joined ${groupName} 🎉`,
    html: buildEmail(
      { title: 'New Member Joined!', icon: '👥', variant: 'gradient' },
      `
        ${greetingComponent(recipientName)}
        ${textComponent(`Great news! <strong>${memberName}</strong> has joined your group <strong>"${groupName}"</strong> via invite link.`)}
        
        ${alertComponent(`<strong>${memberName}</strong> can now view expenses and participate in the group.`, { variant: 'success' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('View Group', `${brand.clientUrl}/groups`)}
          </td></tr>
        </table>
      `
    ),
  }),

  // ============================================
  // EXPENSE ADDED
  // ============================================
  expenseAdded: (groupName, payerName, description, amount, currency = 'INR') => ({
    subject: `New expense in ${groupName}: ${description}`,
    html: buildEmail(
      { title: 'New Expense Added', icon: '💳', variant: 'gradient' },
      `
        ${textComponent(`<strong>${payerName}</strong> added a new expense in <strong>"${groupName}"</strong>:`)}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center">
                <p style="margin: 0 0 8px; font-size: ${brand.fonts.sizeLarge}; font-weight: 600; color: ${brand.colors.textPrimary};">${description}</p>
                <p style="margin: 0; font-size: ${brand.fonts.size2XL}; font-weight: 700; color: ${brand.colors.primary};">${formatCurrency(amount, currency)}</p>
              </td>
            </tr>
          </table>
        `, { variant: 'default', padding: 'large' })}
        
        ${textComponent(`Check your share and settle up when ready.`, { variant: 'muted' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('View Details', `${brand.clientUrl}/groups`)}
          </td></tr>
        </table>
      `
    ),
  }),

  // ============================================
  // SETTLEMENT REMINDER
  // ============================================
  settlementReminder: (fromName, toName, amount, groupName, currency = 'INR') => ({
    subject: `⏰ Reminder: You owe ${fromName} ${formatCurrency(amount, currency)}`,
    html: buildEmail(
      { title: 'Payment Reminder', icon: '⏰', variant: 'warning' },
      `
        ${greetingComponent(toName)}
        ${textComponent(`This is a friendly reminder that you owe <strong>${fromName}</strong>:`)}
        
        ${amountDisplayComponent(amount, { currency, variant: 'danger', label: 'Amount Due', sublabel: `in group "${groupName}"` })}
        
        ${alertComponent(`Settle this balance to keep your accounts clear and friendships strong! 🤝`, { variant: 'warning' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Settle Now', `${brand.clientUrl}/groups`, { variant: 'primary', size: 'large' })}
          </td></tr>
        </table>
      `
    ),
  }),

  // ============================================
  // GROUP INVITE
  // ============================================
  groupInvite: (inviterName, groupName, inviteUrl, expiresAt) => ({
    subject: `${inviterName} invited you to join "${groupName}" on Split-It`,
    html: buildEmail(
      { title: "You're Invited!", subtitle: `Join ${groupName} on Split-It`, icon: '🎉', variant: 'gradient' },
      `
        ${textComponent('Hi there!')}
        ${textComponent(`<strong>${inviterName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on Split-It.`)}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size: 28px; padding-right: 16px; vertical-align: middle;">👥</td>
              <td>
                <p style="margin: 0 0 4px; font-size: ${brand.fonts.sizeLarge}; font-weight: 600; color: ${brand.colors.textPrimary};">${groupName}</p>
                <p style="margin: 0; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted};">Invited by ${inviterName}</p>
              </td>
            </tr>
          </table>
        `, { padding: 'large' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Accept Invitation', inviteUrl, { variant: 'primary', size: 'large' })}
          </td></tr>
        </table>
        
        ${textComponent(`This invite expires on <strong>${formatDate(expiresAt, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.`, { variant: 'muted', align: 'center' })}
        ${textComponent("If you don't have an account, you'll be prompted to create one.", { variant: 'small', align: 'center' })}
        
        ${dividerComponent()}
        ${textComponent("If you weren't expecting this invitation, you can safely ignore this email.", { variant: 'small', align: 'center' })}
      `,
      { showPreferences: false }
    ),
  }),

  // ============================================
  // MEMBER JOINED
  // ============================================
  memberJoined: (memberName, groupName) => ({
    subject: `${memberName} joined ${groupName}`,
    html: buildEmail(
      { title: 'New Member Joined!', icon: '🎉', variant: 'gradient' },
      `
        ${textComponent(`<strong>${memberName}</strong> has joined your group <strong>"${groupName}"</strong>.`)}
        
        ${alertComponent(`The group now has a new member! You can start splitting expenses together.`, { variant: 'success' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('View Group', `${brand.clientUrl}/groups`)}
          </td></tr>
        </table>
      `
    ),
  }),

  // ============================================
  // SETTLEMENT CONFIRMATION
  // ============================================
  settlementConfirmation: (payerName, receiverName, amount, groupName, transactionRef, paymentMethod, isReceiver = false, currency = 'INR') => ({
    subject: isReceiver
      ? `✅ Payment received: ${formatCurrency(amount, currency)} from ${payerName}`
      : `✅ Payment sent: ${formatCurrency(amount, currency)} to ${receiverName}`,
    html: buildEmail(
      {
        title: isReceiver ? 'Payment Received' : 'Payment Sent',
        subtitle: isReceiver ? 'You got paid!' : 'Settlement complete',
        icon: isReceiver ? '💰' : '✅',
        variant: 'success'
      },
      `
        ${amountDisplayComponent(amount, {
        currency,
        variant: 'success',
        label: isReceiver ? 'Amount Received' : 'Amount Sent',
        sublabel: isReceiver ? `From ${payerName}` : `To ${receiverName}`
      })}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${infoRowComponent('Group', groupName)}
            ${infoRowComponent('Payment Method', (paymentMethod || 'Cash').toUpperCase())}
            ${infoRowComponent('Reference', transactionRef || 'N/A')}
            ${infoRowComponent('Date', formatDate(new Date()))}
          </table>
        `)}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('View Settlement', `${brand.clientUrl}/groups`)}
          </td></tr>
        </table>
        
        ${textComponent("This is an automated confirmation from Split-It.", { variant: 'small', align: 'center' })}
      `
    ),
  }),

  // ============================================
  // DIGEST (WEEKLY/MONTHLY SUMMARY)
  // ============================================
  digest: (userName, period, summaryData) => {
    const { totalExpenses = 0, totalSettled = 0, youOwe = 0, youAreOwed = 0, topGroups = [], topCategories = [] } = summaryData;
    const periodLabel = period === 'weekly' ? 'Weekly' : 'Monthly';

    const groupRows = topGroups.length
      ? topGroups.map(g => [g.name, `<strong>${formatCurrency(g.total)}</strong>`])
      : [['No activity this period', '-']];

    const categoriesHtml = topCategories.length
      ? topCategories.map(c => badgeComponent(`${c.name}: ${formatCurrency(c.total)}`, { variant: 'primary' })).join(' ')
      : `<span style="color: ${brand.colors.textMuted};">No expenses this period</span>`;

    return {
      subject: `📊 Your ${periodLabel} Split-It Summary`,
      html: buildEmail(
        { title: `${periodLabel} Summary`, subtitle: `Here's your expense overview, ${userName}`, icon: '📊', variant: 'gradient' },
        `
          ${statsRowComponent([
          { label: "You're Owed", value: formatCurrency(youAreOwed), bg: brand.colors.successLight, valueColor: brand.colors.success },
          { label: 'You Owe', value: formatCurrency(youOwe), bg: brand.colors.dangerLight, valueColor: brand.colors.danger },
        ])}
          
          ${cardComponent(`
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              ${infoRowComponent('Total Expenses', formatCurrency(totalExpenses), { highlight: true })}
              ${infoRowComponent('Total Settled', formatCurrency(totalSettled))}
            </table>
          `)}
          
          <p style="margin: 24px 0 12px; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">Top Groups</p>
          ${cardComponent(`
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              ${groupRows.map(([name, total]) => `
                <tr>
                  <td style="padding: 8px 0; color: ${brand.colors.textPrimary};">${name}</td>
                  <td style="padding: 8px 0; text-align: right; color: ${brand.colors.textPrimary};">${total}</td>
                </tr>
              `).join('')}
            </table>
          `)}
          
          <p style="margin: 24px 0 12px; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">Spending by Category</p>
          <div style="margin-bottom: 24px;">
            ${categoriesHtml}
          </div>
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
            <tr><td align="center">
              ${buttonComponent('View Full Analytics', `${brand.clientUrl}/analytics`)}
            </td></tr>
          </table>
        `,
        { showPreferences: true }
      ),
    };
  },

  // ============================================
  // RECURRING EXPENSE REMINDER
  // ============================================
  recurringExpenseReminder: (userName, expenses) => {
    const expenseRows = expenses.map(e => [
      e.description,
      e.groupName,
      `<strong>${formatCurrency(e.amount)}</strong>`,
      formatDate(e.nextRunAt, { day: 'numeric', month: 'short' })
    ]);

    return {
      subject: `🔄 Upcoming: ${expenses.length} recurring expense${expenses.length > 1 ? 's' : ''} due soon`,
      html: buildEmail(
        { title: 'Recurring Expenses Reminder', subtitle: `${expenses.length} expense${expenses.length > 1 ? 's' : ''} coming up`, icon: '🔄', variant: 'warning' },
        `
          ${greetingComponent(userName)}
          ${textComponent(`You have <strong>${expenses.length} recurring expense${expenses.length > 1 ? 's' : ''}</strong> coming up soon:`)}
          
          ${tableComponent(
          ['Description', 'Group', 'Amount', 'Due'],
          expenseRows
        )}
          
          ${alertComponent('Review these expenses to ensure they still apply to your group.', { variant: 'info' })}
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
            <tr><td align="center">
              ${buttonComponent('View Dashboard', `${brand.clientUrl}/dashboard`)}
            </td></tr>
          </table>
        `
      ),
    };
  },

  // ============================================
  // BUDGET ALERT
  // ============================================
  budgetAlert: (userName, alertType, data) => {
    const { currentSpend = 0, limit = 0, percentage = 0, category = 'Monthly' } = data;
    const isOverBudget = percentage >= 100;

    return {
      subject: isOverBudget
        ? `🚨 Budget exceeded: ${category} spending is over limit`
        : `⚠️ Budget alert: ${percentage}% of ${category} limit reached`,
      html: buildEmail(
        {
          title: isOverBudget ? 'Budget Exceeded!' : 'Budget Alert',
          icon: isOverBudget ? '🚨' : '⚠️',
          variant: isOverBudget ? 'danger' : 'warning'
        },
        `
          ${greetingComponent(userName)}
          ${textComponent(isOverBudget
          ? `You've <strong>exceeded</strong> your ${category} budget limit.`
          : `You've reached <strong>${percentage}%</strong> of your ${category} budget limit.`
        )}
          
          ${cardComponent(`
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td align="center">
                  <p style="margin: 0 0 4px; font-size: ${brand.fonts.sizeSmall}; text-transform: uppercase; color: ${brand.colors.textMuted};">Current Spending</p>
                  <p style="margin: 0; font-size: ${brand.fonts.size3XL}; font-weight: 700; color: ${isOverBudget ? brand.colors.danger : brand.colors.warning};">${formatCurrency(currentSpend)}</p>
                  <p style="margin: 4px 0 16px; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted};">of ${formatCurrency(limit)} limit</p>
                  ${progressBarComponent(percentage, { variant: isOverBudget ? 'danger' : 'warning' })}
                </td>
              </tr>
            </table>
          `, { variant: isOverBudget ? 'danger' : 'warning', padding: 'large' })}
          
          ${alertComponent(
          isOverBudget
            ? "Consider reviewing your spending habits and adjusting your budget if needed."
            : "You're approaching your budget limit. Keep an eye on your spending!",
          { variant: isOverBudget ? 'danger' : 'warning' }
        )}
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
            <tr><td align="center">
              ${buttonComponent('View Spending Details', `${brand.clientUrl}/analytics`)}
            </td></tr>
          </table>
        `,
        { showPreferences: true }
      ),
    };
  },

  // ============================================
  // EXPORT REPORT
  // ============================================
  exportReport: (userName, reportType, groupName, dateRange, downloadUrl) => ({
    subject: `📄 Your ${reportType} export for ${groupName || 'all groups'} is ready`,
    html: buildEmail(
      { title: 'Export Ready', subtitle: 'Your report is ready to download', icon: '📄', variant: 'gradient' },
      `
        ${greetingComponent(userName)}
        ${textComponent(`Your <strong>${reportType}</strong> export is ready for download.`)}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${infoRowComponent('Report Type', reportType)}
            ${infoRowComponent('Group', groupName || 'All Groups')}
            ${infoRowComponent('Date Range', dateRange || 'All Time')}
          </table>
        `)}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('📥 Download Report', downloadUrl, { variant: 'success', size: 'large' })}
          </td></tr>
        </table>
        
        ${textComponent('This download link expires in 24 hours.', { variant: 'muted', align: 'center' })}
      `
    ),
  }),

  // ============================================
  // PAYMENT METHOD REMINDER
  // ============================================
  paymentMethodReminder: (userName, pendingAmount) => ({
    subject: `💳 Add your UPI ID - ${formatCurrency(pendingAmount)} waiting for you!`,
    html: buildEmail(
      { title: 'Complete Your Profile', subtitle: 'Set up payments to receive money easily', icon: '💳', variant: 'warning' },
      `
        ${greetingComponent(userName)}
        ${textComponent(`You have <strong>${formatCurrency(pendingAmount)}</strong> in pending settlements, but your payment details are incomplete.`)}
        
        ${alertComponent(`<strong>Add your UPI ID</strong> to receive payments directly to your account.`, { variant: 'warning' })}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size: 24px; padding-right: 12px; vertical-align: top;">💡</td>
              <td>
                <p style="margin: 0 0 8px; font-weight: 600; color: ${brand.colors.textPrimary};">Why add your UPI ID?</p>
                <ul style="margin: 0; padding-left: 20px; color: ${brand.colors.textSecondary};">
                  <li style="margin-bottom: 4px;">Receive payments instantly</li>
                  <li style="margin-bottom: 4px;">Friends can pay you directly</li>
                  <li>Easy settlement tracking</li>
                </ul>
              </td>
            </tr>
          </table>
        `, { variant: 'info' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Update Payment Details', `${brand.clientUrl}/profile`, { size: 'large' })}
          </td></tr>
        </table>
      `
    ),
  }),
};

export default initEmailWorker;
