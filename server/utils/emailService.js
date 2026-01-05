import nodemailer from 'nodemailer';

// Create transporter (configure based on your email service)
const createTransporter = () => {
  // For production, use a real email service like SendGrid, AWS SES, etc.
  // For development, you can use ethereal.email or mailtrap.io
  
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Development: Use console logging instead of actual emails
  return {
    sendMail: async (options) => {
      console.log('📧 Email would be sent:', {
        to: options.to,
        subject: options.subject,
      });
      return { messageId: 'dev-' + Date.now() };
    },
  };
};

const transporter = createTransporter();

// Email templates
const templates = {
  expenseAdded: (data) => ({
    subject: `New expense in ${data.groupName}: ${data.description}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Expense Added</h2>
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.paidByName}</strong> added a new expense in <strong>${data.groupName}</strong>:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Description:</strong> ${data.description}</p>
          <p style="margin: 8px 0 0;"><strong>Amount:</strong> ₹${data.amount.toFixed(2)}</p>
          <p style="margin: 8px 0 0;"><strong>Your share:</strong> ₹${data.yourShare.toFixed(2)}</p>
        </div>
        <a href="${process.env.CLIENT_URL}/groups/${data.groupId}" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
          View Expense
        </a>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          You're receiving this email because you're a member of ${data.groupName} on Split-It.
        </p>
      </div>
    `,
  }),

  settlementReceived: (data) => ({
    subject: `Payment received from ${data.fromName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Payment Received!</h2>
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.fromName}</strong> has recorded a payment to you:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Amount:</strong> ₹${data.amount.toFixed(2)}</p>
          <p style="margin: 8px 0 0;"><strong>Group:</strong> ${data.groupName}</p>
        </div>
        <p>Please confirm receipt of this payment in the app.</p>
        <a href="${process.env.CLIENT_URL}/groups/${data.groupId}" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
          Confirm Payment
        </a>
      </div>
    `,
  }),

  budgetAlert: (data) => ({
    subject: `Budget alert for ${data.groupName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">⚠️ Budget Alert</h2>
        <p>Hi ${data.recipientName},</p>
        <p>The group <strong>${data.groupName}</strong> has reached <strong>${data.percentage}%</strong> of its budget limit.</p>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Budget Limit:</strong> ₹${data.budgetLimit.toFixed(2)}</p>
          <p style="margin: 8px 0 0;"><strong>Spent:</strong> ₹${data.spent.toFixed(2)}</p>
          <p style="margin: 8px 0 0;"><strong>Remaining:</strong> ₹${data.remaining.toFixed(2)}</p>
        </div>
        <a href="${process.env.CLIENT_URL}/groups/${data.groupId}" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
          View Group
        </a>
      </div>
    `,
  }),

  recurringExpenseReminder: (data) => ({
    subject: `Recurring expense reminder: ${data.description}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Recurring Expense Due</h2>
        <p>Hi ${data.recipientName},</p>
        <p>A recurring expense is due in <strong>${data.groupName}</strong>:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Description:</strong> ${data.description}</p>
          <p style="margin: 8px 0 0;"><strong>Amount:</strong> ₹${data.amount.toFixed(2)}</p>
          <p style="margin: 8px 0 0;"><strong>Due Date:</strong> ${data.dueDate}</p>
        </div>
        <a href="${process.env.CLIENT_URL}/groups/${data.groupId}/add-expense" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
          Add Expense
        </a>
      </div>
    `,
  }),

  memberJoined: (data) => ({
    subject: `${data.newMemberName} joined ${data.groupName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Member Joined!</h2>
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.newMemberName}</strong> has joined your group <strong>${data.groupName}</strong>.</p>
        <a href="${process.env.CLIENT_URL}/groups/${data.groupId}" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
          View Group
        </a>
      </div>
    `,
  }),

  paymentReminder: (data) => ({
    subject: `⏰ Payment reminder: You owe ₹${data.amount.toFixed(2)} to ${data.payeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">⏰ Payment Reminder</h2>
        <p>Hi ${data.payerName},</p>
        <p>This is a friendly reminder that you have an outstanding payment in <strong>${data.groupName}</strong>.</p>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 18px;"><strong>Amount Due:</strong> ₹${data.amount.toFixed(2)}</p>
          <p style="margin: 8px 0 0;"><strong>Pay to:</strong> ${data.payeeName}</p>
          <p style="margin: 8px 0 0;"><strong>Pending since:</strong> ${data.daysPending} day(s)</p>
          ${data.payeeUpiId ? `<p style="margin: 8px 0 0;"><strong>UPI ID:</strong> ${data.payeeUpiId}</p>` : ''}
        </div>
        <p>Please settle this payment at your earliest convenience to keep the group expenses balanced.</p>
        <a href="${process.env.CLIENT_URL}/groups/${data.groupId}" 
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-right: 8px;">
          View Group
        </a>
        ${data.payeeUpiId ? `
        <a href="upi://pay?pa=${data.payeeUpiId}&pn=${encodeURIComponent(data.payeeName)}&am=${data.amount.toFixed(2)}&cu=INR" 
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
          Pay with UPI
        </a>
        ` : ''}
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          This is reminder #${data.reminderCount}. You'll receive reminders until the payment is settled.
        </p>
      </div>
    `,
  }),
};

// Send email function
export const sendEmail = async (to, templateName, data) => {
  try {
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Unknown email template: ${templateName}`);
    }

    const { subject, html } = template(data);

    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Split-It" <noreply@split-it.app>',
      to,
      subject,
      html,
    });

    console.log(`Email sent to ${to}: ${subject}`);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Send email to multiple recipients
export const sendBulkEmail = async (recipients, templateName, dataGenerator) => {
  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const data = dataGenerator(recipient);
      return sendEmail(recipient.email, templateName, data);
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`Bulk email: ${successful} sent, ${failed} failed`);
  return { successful, failed };
};

export default {
  sendEmail,
  sendBulkEmail,
};
