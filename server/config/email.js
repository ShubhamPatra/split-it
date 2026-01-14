import nodemailer from 'nodemailer';

// Determine if TLS should be used:
// - SMTP_SECURE env flag takes precedence if set
// - Port 465 uses implicit TLS (secure: true)
// - Other ports use STARTTLS (secure: false)
const getSecureOption = () => {
  if (process.env.SMTP_SECURE !== undefined) {
    return process.env.SMTP_SECURE === 'true';
  }
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  return port === 465;
};

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: getSecureOption(),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Connection pooling for better performance
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

export const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"Split-It" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};
