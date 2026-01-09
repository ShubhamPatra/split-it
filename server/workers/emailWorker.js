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
      </div>
    `,
  }),
};

export default initEmailWorker;
