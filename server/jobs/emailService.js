/**
 * Email Service
 * 
 * Direct email sending service using nodemailer.
 * Replaces the email queue/worker system with simple async calls.
 */

import { transporter } from '../config/email.js';
import { executeJob } from './jobRunner.js';

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

// Debug log helper (lazy loaded)
const logEmailEvt = async (event, data = {}) => {
  if (process.env.DEBUG_ENABLED === 'true') {
    try {
      const { logEmailEvent } = await import('../internal/debug/logCollector.js');
      logEmailEvent(event, data);
    } catch (e) {
      // Debug portal not available, ignore
    }
  }
};
/**
 * Email templates using the Split-It design system
 */
export const emailTemplates = {
  // ============================================
  // WELCOME EMAIL
  // ============================================
  welcome: (userName) => ({
    subject: 'Welcome to Split-It',
    html: buildEmail(
      { title: 'Welcome to Split-It', subtitle: 'Simplified expense management' },
      `
        ${greetingComponent(userName)}
        ${textComponent("Thank you for joining Split-It. We'll help you manage group expenses efficiently.")}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td>
                <p style="margin: 0 0 8px; font-family: ${brand.fonts.headingFamily}; font-weight: 600; color: ${brand.colors.textPrimary};">Get Started</p>
                <ol style="margin: 0; padding-left: 20px; color: ${brand.colors.textSecondary};">
                  <li style="margin-bottom: 4px;">Create or join a group</li>
                  <li style="margin-bottom: 4px;">Add expenses and split them</li>
                  <li>Settle up with a single tap</li>
                </ol>
              </td>
            </tr>
          </table>
        `)}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Access Dashboard', `${brand.clientUrl}/dashboard`, { size: 'large' })}
          </td></tr>
        </table>
      `,
      { showPreferences: false }
    ),
  }),

  // ============================================
  // NEW MEMBER JOINED
  // ============================================
  newMemberJoined: (groupName, memberName, recipientName) => ({
    subject: `New member joined ${groupName}`,
    html: buildEmail(
      { title: 'New Member Joined' },
      `
        ${greetingComponent(recipientName)}
        ${textComponent(`<strong>${memberName}</strong> has joined your group <strong>"${groupName}"</strong> via invite link.`)}
        
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
    subject: `Expense added: ${description} in ${groupName}`,
    html: buildEmail(
      { title: 'New Expense Added' },
      `
        ${textComponent(`<strong>${payerName}</strong> added a new expense in <strong>"${groupName}"</strong>:`)}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center">
                <p style="margin: 0 0 8px; font-size: ${brand.fonts.sizeLarge}; font-weight: 600; color: ${brand.colors.textPrimary};">${description}</p>
                <p style="margin: 0; font-size: ${brand.fonts.size2XL}; font-weight: 600; color: ${brand.colors.accent};">${formatCurrency(amount, currency)}</p>
              </td>
            </tr>
          </table>
        `, { variant: 'default', padding: 'large' })}
        
        ${textComponent(`Check your share and settle up when ready.`, { variant: 'muted' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('View Expense', `${brand.clientUrl}/groups`)}
          </td></tr>
        </table>
      `
    ),
  }),

  // ============================================
  // SETTLEMENT REMINDER
  // ============================================
  settlementReminder: (fromName, toName, amount, groupName, currency = 'INR') => ({
    subject: `Payment due: ${formatCurrency(amount, currency)} to ${fromName}`,
    html: buildEmail(
      { title: 'Payment Reminder', variant: 'warning' },
      `
        ${greetingComponent(toName)}
        ${textComponent(`This is a reminder that you owe <strong>${fromName}</strong>:`)}
        
        ${amountDisplayComponent(amount, { currency, variant: 'danger', label: 'Amount Due', sublabel: `in group "${groupName}"` })}
        
        ${alertComponent(`Settle this balance to keep your accounts clear.`, { variant: 'warning' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Complete Payment', `${brand.clientUrl}/groups`, { variant: 'primary', size: 'large' })}
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
      { title: 'Group Invitation', subtitle: `Join ${groupName} on Split-It` },
      `
        ${textComponent('Hello,')}
        ${textComponent(`<strong>${inviterName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on Split-It.`)}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td>
                <p style="margin: 0 0 4px; font-size: ${brand.fonts.sizeLarge}; font-weight: 600; color: ${brand.colors.textPrimary};">${groupName}</p>
                <p style="margin: 0; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted};">Invited by ${inviterName}</p>
              </td>
            </tr>
          </table>
        `, { padding: 'large' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Join Group', inviteUrl, { variant: 'primary', size: 'large' })}
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
      { title: 'New Member Joined' },
      `
        ${textComponent(`<strong>${memberName}</strong> has joined your group <strong>"${groupName}"</strong>.`)}
        
        ${alertComponent(`The group now has a new member. You can start splitting expenses together.`, { variant: 'success' })}
        
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
      ? `Payment received: ${formatCurrency(amount, currency)} from ${payerName}`
      : `Payment sent: ${formatCurrency(amount, currency)} to ${receiverName}`,
    html: buildEmail(
      {
        title: isReceiver ? 'Payment Received' : 'Payment Sent',
        subtitle: isReceiver ? 'Funds received' : 'Settlement complete',
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
      subject: `${periodLabel} expense summary`,
      html: buildEmail(
        { title: `${periodLabel} Expense Summary`, subtitle: `Here's your expense overview, ${userName}` },
        `
          ${statsRowComponent([
          { label: "You're Owed", value: formatCurrency(youAreOwed), valueColor: brand.colors.success },
          { label: 'You Owe', value: formatCurrency(youOwe), valueColor: brand.colors.danger },
        ])}
          
          ${cardComponent(`
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              ${infoRowComponent('Total Expenses', formatCurrency(totalExpenses), { highlight: true })}
              ${infoRowComponent('Total Settled', formatCurrency(totalSettled))}
            </table>
          `)}
          
          <p style="margin: 24px 0 12px; font-family: ${brand.fonts.headingFamily}; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">Top Groups</p>
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
          
          <p style="margin: 24px 0 12px; font-family: ${brand.fonts.headingFamily}; font-size: ${brand.fonts.sizeMedium}; font-weight: 600; color: ${brand.colors.textPrimary};">Spending by Category</p>
          <div style="margin-bottom: 24px;">
            ${categoriesHtml}
          </div>
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
            <tr><td align="center">
              ${buttonComponent('View Analytics', `${brand.clientUrl}/analytics`)}
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
      subject: `Recurring expense reminder: ${expenses.length} expense${expenses.length > 1 ? 's' : ''} due soon`,
      html: buildEmail(
        { title: 'Recurring Expenses Reminder', subtitle: `${expenses.length} expense${expenses.length > 1 ? 's' : ''} coming up`, variant: 'warning' },
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
              ${buttonComponent('Review Expenses', `${brand.clientUrl}/dashboard`)}
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
        ? `Budget exceeded: ${category} spending is over limit`
        : `Budget alert: ${percentage}% of ${category} limit reached`,
      html: buildEmail(
        {
          title: isOverBudget ? 'Budget Exceeded' : 'Budget Alert',
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
                  <p style="margin: 0; font-size: ${brand.fonts.size3XL}; font-weight: 600; color: ${isOverBudget ? brand.colors.danger : brand.colors.warning};">${formatCurrency(currentSpend)}</p>
                  <p style="margin: 4px 0 16px; font-size: ${brand.fonts.sizeBase}; color: ${brand.colors.textMuted};">of ${formatCurrency(limit)} limit</p>
                  ${progressBarComponent(percentage, { variant: isOverBudget ? 'danger' : 'warning' })}
                </td>
              </tr>
            </table>
          `, { variant: isOverBudget ? 'danger' : 'warning', padding: 'large' })}
          
          ${alertComponent(
          isOverBudget
            ? "Consider reviewing your spending habits and adjusting your budget if needed."
            : "You're approaching your budget limit. Keep an eye on your spending.",
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
    subject: `Export ready: ${reportType} for ${groupName || 'all groups'}`,
    html: buildEmail(
      { title: 'Export Ready', subtitle: 'Your report is ready to download' },
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
            ${buttonComponent('Download Report', downloadUrl, { variant: 'success', size: 'large' })}
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
    subject: `Complete your profile - ${formatCurrency(pendingAmount)} pending`,
    html: buildEmail(
      { title: 'Complete Your Profile', subtitle: 'Set up payments to receive money', variant: 'warning' },
      `
        ${greetingComponent(userName)}
        ${textComponent(`You have <strong>${formatCurrency(pendingAmount)}</strong> in pending settlements, but your payment details are incomplete.`)}
        
        ${alertComponent(`<strong>Add your UPI ID</strong> to receive payments directly to your account.`, { variant: 'warning' })}
        
        ${cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
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
            ${buttonComponent('Add Payment Method', `${brand.clientUrl}/profile`, { size: 'large' })}
          </td></tr>
        </table>
      `
    ),
  }),

  // ============================================
  // REPAYMENT REQUEST
  // ============================================
  repaymentRequest: (receiverName, requesterName, amount, message, groupNames, currency = 'INR') => ({
    subject: `Payment request: ${requesterName} is requesting ${formatCurrency(amount, currency)}`,
    html: buildEmail(
      { title: 'Payment Request', subtitle: 'Action required', variant: 'warning' },
      `
        ${greetingComponent(receiverName)}
        ${textComponent(`<strong>${requesterName}</strong> has requested payment:`)}
        
        ${amountDisplayComponent(amount, {
          currency,
          variant: 'warning',
          label: 'Requested Amount',
          sublabel: groupNames ? `Across ${groupNames}` : 'Direct payment'
        })}
        
        ${message ? cardComponent(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td>
                <p style="margin: 0 0 8px; font-weight: 600; color: ${brand.colors.textPrimary};">Message from ${requesterName}:</p>
                <p style="margin: 0; color: ${brand.colors.textSecondary}; font-style: italic;">"${message}"</p>
              </td>
            </tr>
          </table>
        `, { variant: 'info' }) : ''}
        
        ${alertComponent(`This is a friendly reminder from your group member to settle outstanding balances.`, { variant: 'info' })}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              ${buttonComponent('View Details & Pay', `${brand.clientUrl}/settlements?tab=people`, { variant: 'primary', size: 'large' })}
            </td>
          </tr>
          <tr>
            <td align="center">
              ${buttonComponent('View Balance', `${brand.clientUrl}/settlements`, { variant: 'secondary' })}
            </td>
          </tr>
        </table>
        
        ${textComponent("This is a friendly reminder from your group member. You can settle this balance at your convenience.", { variant: 'small', align: 'center' })}
      `
    ),
  }),

  // ============================================
  // REPAYMENT CONFIRMED (Comment 7)
  // ============================================
  repaymentConfirmed: (receiverName, requesterName, amount, totalAmount, status, groupNames, currency = 'INR') => ({
    subject: `Payment confirmed: ${requesterName} confirmed receiving ${formatCurrency(amount, currency)}`,
    html: buildEmail(
      { title: 'Payment Confirmed', subtitle: 'Payment received', variant: 'success' },
      `
        ${greetingComponent(receiverName)}
        ${textComponent(`<strong>${requesterName}</strong> has confirmed receiving your payment:`)}
        
        ${amountDisplayComponent(amount, {
          currency,
          variant: 'success',
          label: status === 'settled' ? 'Payment Confirmed' : 'Partial Payment Confirmed',
          sublabel: groupNames ? `Across ${groupNames}` : 'Direct payment'
        })}
        
        ${status === 'partially_paid' ? alertComponent(
          `This is a partial payment of ${formatCurrency(totalAmount, currency)}. Remaining balance: ${formatCurrency(totalAmount - amount, currency)}`,
          { variant: 'info' }
        ) : ''}
        
        ${status === 'settled' ? alertComponent(
          `Your payment has been confirmed and the balance is now settled. Thank you!`,
          { variant: 'success' }
        ) : ''}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr>
            <td align="center">
              ${buttonComponent('View Settlement History', `${brand.clientUrl}/settlements?tab=history`, { variant: 'primary' })}
            </td>
          </tr>
        </table>
        
        ${textComponent("Keep track of all your settlements in the app.", { variant: 'small', align: 'center' })}
      `
    ),
  }),
};

/**
 * Process email data and generate final email content
 * @param {Object} emailData - Raw email data
 * @returns {Object} Processed email with subject and html
 */
const processEmailData = (emailData) => {
  const { to, subject, html, text, from, template, data, attachments } = emailData;

  let emailSubject = subject;
  let emailHtml = html;

  if (template && data) {
    const templateFn = emailTemplates[template];
    if (templateFn) {
      let generatedEmail;

      switch (template) {
        case 'groupInvite':
          generatedEmail = templateFn(data.inviterName, data.groupName, data.inviteUrl, data.expiresAt);
          break;
        case 'memberJoined':
          generatedEmail = templateFn(data.memberName, data.groupName);
          break;
        case 'newMemberJoined':
          generatedEmail = templateFn(data.groupName, data.memberName, data.recipientName);
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
        case 'repaymentRequest':
          generatedEmail = templateFn(
            data.receiverName, data.requesterName, data.amount,
            data.message, data.groupNames, data.currency
          );
          break;
        case 'repaymentConfirmed':
          generatedEmail = templateFn(
            data.receiverName, data.requesterName, data.amount,
            data.totalAmount, data.status, data.groupNames, data.currency
          );
          break;
        default:
          generatedEmail = templateFn(...Object.values(data));
      }

      emailSubject = generatedEmail.subject;
      emailHtml = generatedEmail.html;
    }
  }

  return {
    to,
    from: from || `"Split-It" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    subject: emailSubject,
    html: emailHtml,
    text,
    attachments,
  };
};

/**
 * Send an email directly
 * @param {Object} emailData - Email data { to, subject, html, template, data, etc }
 * @returns {Promise<Object>} Result with success status
 */
export const sendEmail = async (emailData) => {
  const processedEmail = processEmailData(emailData);

  if (!processedEmail.to || !processedEmail.subject) {
    throw new Error('Missing required email fields: to, subject');
  }

  // Skip sending if SMTP is not configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[Email] SMTP not configured, skipping email to ${processedEmail.to}`);
    return { skipped: true, reason: 'SMTP not configured' };
  }

  const mailOptions = {
    from: processedEmail.from,
    to: processedEmail.to,
    subject: processedEmail.subject,
    html: processedEmail.html,
    ...(processedEmail.text && { text: processedEmail.text }),
    ...(processedEmail.attachments && { attachments: processedEmail.attachments }),
  };

  const result = await transporter.sendMail(mailOptions);

  console.log(`[Email] Sent to ${processedEmail.to}: ${processedEmail.subject}`);
  logEmailEvt('sent', { to: processedEmail.to, subject: processedEmail.subject, messageId: result.messageId });

  return {
    success: true,
    messageId: result.messageId,
    to: processedEmail.to,
    subject: processedEmail.subject,
  };
};

/**
 * Send an email with automatic retry
 * @param {Object} emailData - Email data
 * @param {number} retries - Number of retries (default: 3)
 * @returns {Promise<Object>} Result with success status
 */
export const sendEmailWithRetry = async (emailData, retries = 3) => {
  const result = await executeJob('Email', sendEmail, emailData, {
    maxRetries: retries,
    timeout: 30000,
    initialDelay: 2000,
  });

  return result;
};

/**
 * Send multiple emails in parallel with error isolation
 * @param {Array<Object>} emails - Array of email data objects
 * @returns {Promise<Array<Object>>} Array of results
 */
export const sendBulkEmails = async (emails) => {
  const results = await Promise.all(
    emails.map(emailData => sendEmailWithRetry(emailData))
  );
  return results;
};

const emailService = {
  sendEmail,
  sendEmailWithRetry,
  sendBulkEmails,
  emailTemplates,
};

export default emailService;
