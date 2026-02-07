import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { generateToken, generateRefreshToken } from '../middleware/authMiddleware.js';
import crypto from 'crypto';
import { logAuthEvent } from '../middleware/auditMiddleware.js';
import backupCodeService from '../services/backupCodeService.js';

import {
  brand,
  buildEmail,
  buttonComponent,
  cardComponent,
  alertComponent,
  textComponent,
  greetingComponent,
  dividerComponent,
} from '../utils/emailTemplates.js';

// Helper to create UPI reminder notification
const createUpiReminderIfNeeded = async (user) => {
  if (!user.upiId) {
    // Check if we already sent a reminder in the last 7 days
    const existingReminder = await Notification.findOne({
      userId: user._id,
      title: 'Add Your UPI ID',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    if (!existingReminder) {
      await Notification.create({
        userId: user._id,
        type: 'warning',
        title: 'Add Your UPI ID',
        message: 'Add your UPI ID to receive payments directly from group members.',
        actionType: 'navigate',
        data: { url: '/profile' },
      });
    }
  }
};
import { OAuth2Client } from 'google-auth-library';
import { sendEmailWithRetry } from '../jobs/emailService.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'This email is already registered. Try logging in instead.' });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    // Create user with verification token
    const user = await User.create({
      name,
      email,
      password,
      emailVerified: false,
      verificationToken: hashedToken,
      verificationTokenExpire: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    if (user) {
      // Create verification URL
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

      // Send verification email
      const html = buildEmail(
        { title: 'Verify Your Email', subtitle: 'Welcome to Split-It!', variant: 'primary' },
        `
          ${greetingComponent(user.name)}
          ${textComponent("Thank you for signing up for Split-It! To get started, please verify your email address by clicking the button below:")}
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
            <tr><td align="center">
              ${buttonComponent('Verify Email Address', verificationUrl, { variant: 'primary', size: 'large' })}
            </td></tr>
          </table>
          
          ${cardComponent(`
            <p style="margin: 0 0 8px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted};">Or copy and paste this link in your browser:</p>
            <p style="margin: 0; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.primary}; word-break: break-all;">${verificationUrl}</p>
          `, { variant: 'default', padding: 'medium' })}
          
          ${alertComponent('<strong>This link will expire in 24 hours.</strong> If you didn\'t create this account, please ignore this email.', { variant: 'info' })}
          
          ${dividerComponent()}
          ${textComponent("Once verified, you'll be able to create groups, track expenses, and settle up with friends!", { variant: 'small', align: 'center' })}
        `,
        { showPreferences: false, showSupport: true }
      );

      await sendEmailWithRetry({
        to: user.email,
        subject: 'Verify Your Email - Split-It',
        html,
      }).catch(err => console.error('Verification email error:', err));

      // Log registration event
      await logAuthEvent('user.register', user._id, 'success', req);

      // Return success without tokens (user must verify first)
      res.status(201).json({
        success: true,
        needsVerification: true,
        message: 'Registration successful! Please check your email to verify your account.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          emailVerified: false,
        },
      });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: error.message || 'Error creating user' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password, twoFactorToken, useBackupCode } = req.body;

    // Find user by email (include 2FA fields)
    const user = await User.findOne({ email }).select('+twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if email is verified (skip for Google OAuth users)
    if (!user.emailVerified && !user.googleId) {
      // Log failed login attempt
      await logAuthEvent('auth.failed.login', user._id, 'failure', req, {
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
      });

      return res.status(403).json({
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Log failed login attempt
      await logAuthEvent('auth.failed.login', user._id, 'failure', req, {
        message: 'Invalid password',
      });

      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // If no 2FA token provided, request it
      if (!twoFactorToken) {
        return res.status(200).json({
          requires2FA: true,
          userId: user._id,
          message: 'Please enter your 2FA code',
        });
      }

      // Verify 2FA token
      const speakeasy = (await import('speakeasy')).default;
      let verified = false;
      let remainingCodes = 0;

      if (useBackupCode) {
        // Use atomic consume function to verify and remove in single operation (fixes TOCTOU race)
        const result = await backupCodeService.consumeBackupCode(user._id, twoFactorToken);
        verified = result.valid;
        remainingCodes = result.remainingCodes;

        if (verified) {
          // Log backup code usage
          await logAuthEvent('user.2fa.backup_code_used', user._id, 'success', req, {
            remainingCodes,
          });
        }
      } else {
        // Verify TOTP token using decrypted secret
        const decryptedSecret = user.getDecryptedTwoFactorSecret ?
          user.getDecryptedTwoFactorSecret() : user.twoFactorSecret;
        verified = speakeasy.totp.verify({
          secret: decryptedSecret,
          encoding: 'base32',
          token: twoFactorToken,
          window: 2, // Allow 2 time steps before/after for clock skew
        });
      }

      if (!verified) {
        // Log failed 2FA attempt
        await logAuthEvent('auth.failed.2fa', user._id, 'failure', req, {
          message: 'Invalid 2FA code',
          useBackupCode,
        });

        return res.status(401).json({
          message: useBackupCode ? 'Invalid backup code' : 'Invalid 2FA code',
          requires2FA: true,
          userId: user._id,
        });
      }

      // Log successful 2FA verification
      await logAuthEvent('user.2fa.verified', user._id, 'success', req);
    }

    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    // Set HttpOnly cookies
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send UPI reminder notification if not set
    createUpiReminderIfNeeded(user).catch(err => console.error('UPI reminder error:', err));

    // Log successful login
    await logAuthEvent('user.login', user._id, 'success', req);

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: user.upiId || '',
        twoFactorEnabled: user.twoFactorEnabled || false,
      },
      // Tokens returned for mobile client (uses Bearer auth since cookies don't work in RN)
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Error logging in' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching user' });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    // Import token stores from authMiddleware for revocation
    const { tokenBlacklist, refreshTokens } = await import('../middleware/authMiddleware.js');

    // Get the current auth token
    const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];

    if (token) {
      // Blacklist token until its expiry
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.decode(token);
        if (decoded?.exp) {
          const expiryTime = decoded.exp * 1000; // Convert to ms
          if (expiryTime > Date.now()) {
            tokenBlacklist.set(token, expiryTime);
          }
        }
      } catch (e) {
        console.error('Token blacklist error:', e.message);
      }
    }

    // Delete refresh token from store
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }

    // Log logout event
    await logAuthEvent('user.logout', req.user._id, 'success', req);

    // Clear both cookies
    res.cookie('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
    });

    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
    });

    // Response instructs client to disconnect sockets
    res.json({
      message: 'Logged out successfully',
      socketDisconnect: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error logging out' });
  }
};

// @desc    Google OAuth Login
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'No credential provided' });
    }

    // Verify the ID token with Google's library
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError);
      return res.status(401).json({ message: 'Invalid Google credential' });
    }

    const payload = ticket.getPayload();

    // Verify issuer
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
      return res.status(401).json({ message: 'Invalid token issuer' });
    }

    // Verify audience
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ message: 'Invalid token audience' });
    }

    // Verify token expiry
    if (payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ message: 'Token expired' });
    }

    // Verify email is verified
    if (!payload.email_verified) {
      return res.status(401).json({ message: 'Email not verified with Google' });
    }

    const { email, name, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // User exists, update googleId if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.emailVerified = true; // Google emails are pre-verified
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        googleId,
        name,
        email,
        emailVerified: true, // Google emails are pre-verified
      });
      isNewUser = true;
    }

    // Generate token and set as HttpOnly cookie
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send welcome email for new Google users
    if (isNewUser) {
      sendEmailWithRetry({
        template: 'welcome',
        to: user.email,
        data: {
          userName: user.name,
        },
      }).catch(err => console.error('Welcome email error:', err));
    }

    // Send UPI reminder notification if not set
    createUpiReminderIfNeeded(user).catch(err => console.error('UPI reminder error:', err));

    // Log successful Google OAuth login
    await logAuthEvent('user.login', user._id, 'success', req);

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: user.upiId || '',
      },
      // Tokens returned for mobile client (uses Bearer auth since cookies don't work in RN)
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: error.message || 'Error authenticating with Google' });
  }
};

// @desc    Forgot Password - Send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide an email address' });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // For security, don't reveal if email exists or not
      return res.status(200).json({
        message: 'If an account with that email exists, you will receive a password reset email shortly.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token for storage
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token and expiry to user (valid for 1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Log password reset request
    await logAuthEvent('user.password.reset.request', user._id, 'success', req);

    // Create reset URL to send via email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    const html = buildEmail(
      { title: 'Reset Your Password', subtitle: 'Password recovery request', variant: 'warning' },
      `
        ${greetingComponent(user.name)}
        ${textComponent("You requested a password reset for your Split-It account. Click the button below to create a new password:")}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Reset Password', resetUrl, { variant: 'primary', size: 'large' })}
          </td></tr>
        </table>
        
        ${cardComponent(`
          <p style="margin: 0 0 8px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted};">Or copy and paste this link in your browser:</p>
          <p style="margin: 0; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.primary}; word-break: break-all;">${resetUrl}</p>
        `, { variant: 'default', padding: 'medium' })}
        
        ${alertComponent('<strong>This link will expire in 1 hour.</strong> If you didn\'t request a password reset, please ignore this email.', { variant: 'warning' })}
        
        ${dividerComponent()}
        ${textComponent("For security reasons, never share this link with anyone.", { variant: 'small', align: 'center' })}
      `,
      { showPreferences: false, showSupport: true }
    );

    // Send email
    await sendEmailWithRetry({
      to: user.email,
      subject: 'Password Reset Request - Split-It',
      html,
    });

    // Return success message (don't reveal if email was sent successfully for security)
    res.status(200).json({
      message: 'If an account with that email exists, you will receive a password reset email shortly.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Error processing password reset request' });
  }
};

// @desc    Reset Password - Update password with token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Please provide token and new password' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Hash the token to match what's in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching reset token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      // Log failed password reset attempt
      await logAuthEvent('auth.failed.password.reset', 'unknown', 'failure', req, {
        message: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN',
      });

      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Log successful password reset
    await logAuthEvent('user.password.reset.complete', user._id, 'success', req);

    // Send confirmation email
    const html = buildEmail(
      { title: 'Password Reset Successful', subtitle: 'Your password has been changed', variant: 'success' },
      `
        ${greetingComponent(user.name)}
        ${alertComponent('Your password has been successfully reset.', { variant: 'success' })}
        
        ${textComponent("You can now log in to your Split-It account with your new password.")}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Login to Split-It', `${brand.clientUrl}/login`, { variant: 'primary', size: 'large' })}
          </td></tr>
        </table>
        
        ${alertComponent('<strong>Security Notice:</strong> If you didn\'t make this change, please contact our support team immediately at ' + brand.supportEmail, { variant: 'warning' })}
      `,
      { showPreferences: false, showSupport: true }
    );

    await sendEmailWithRetry({
      to: user.email,
      subject: 'Password Reset Confirmation - Split-It',
      html,
    });

    res.status(200).json({
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
};

// @desc    Change Password (for authenticated users)
// @route   POST /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    // Get user with password field
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is Google OAuth user (no password)
    if (user.googleId && !user.password) {
      return res.status(400).json({
        message: 'Cannot change password for Google OAuth accounts. Please use Google to manage your account security.'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // SECURITY: Invalidate all sessions by revoking all tokens
    // This forces re-authentication on all devices
    const { revokeAllUserTokens, tokenBlacklist } = await import('../middleware/authMiddleware.js');

    // Revoke all refresh tokens for this user (with audit logging)
    await revokeAllUserTokens(user._id.toString(), req);

    // Blacklist the current access token
    const currentToken = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
    if (currentToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.decode(currentToken);
        if (decoded?.exp) {
          const expiryTime = decoded.exp * 1000; // Convert to ms
          if (expiryTime > Date.now()) {
            tokenBlacklist.set(currentToken, expiryTime);
          }
        }
      } catch (e) {
        console.error('Token blacklist error:', e.message);
      }
    }

    // Clear cookies for current session
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // Log the password change event
    await logAuthEvent('user.password.change', user._id, 'success', req, {
      message: 'Password changed successfully, all sessions invalidated',
    });

    // Send confirmation email
    const html = buildEmail(
      { title: 'Password Changed', subtitle: 'Your password has been updated', variant: 'success' },
      `
        ${greetingComponent(user.name)}
        ${alertComponent('Your password has been successfully changed.', { variant: 'success' })}
        
        ${textComponent("For your security, you have been logged out of all devices and will need to log in again with your new password.")}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Login to Split-It', `${brand.clientUrl}/login`, { variant: 'primary', size: 'large' })}
          </td></tr>
        </table>
        
        ${dividerComponent()}
        
        ${alertComponent('<strong>Security Notice:</strong> If you didn\'t make this change, please contact our support team immediately at ' + brand.supportEmail + '. Your account may have been compromised.', { variant: 'warning' })}
        
        ${textComponent('<strong>What happened:</strong><br>• Your password was changed<br>• All active sessions were terminated<br>• You need to log in again on all devices', { style: 'margin-top: 16px;' })}
      `,
      { showPreferences: false, showSupport: true }
    );

    await sendEmailWithRetry({
      to: user.email,
      subject: 'Password Changed - Split-It',
      html,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
};

// @desc    Verify Email - Confirm email with token
// @route   GET /api/auth/verify-email/:token
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    // Hash the token to match what's in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching verification token that hasn't expired
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpire: { $gt: Date.now() },
    }).select('+verificationToken +verificationTokenExpire');

    if (!user) {
      // Log failed verification attempt
      await logAuthEvent('auth.failed.verification', 'unknown', 'failure', req, {
        message: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      });

      return res.status(400).json({
        message: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    // Log successful email verification
    await logAuthEvent('user.email.verify', user._id, 'success', req);

    // Generate tokens and log user in
    const authToken = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    // Set HttpOnly cookies
    res.cookie('auth_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send welcome email now that email is verified
    sendEmailWithRetry({
      template: 'welcome',
      to: user.email,
      data: {
        userName: user.name,
      },
    }).catch(err => console.error('Welcome email error:', err));

    // Create UPI reminder notification
    createUpiReminderIfNeeded(user).catch(err => console.error('UPI reminder error:', err));

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to Split-It.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: true,
        upiId: user.upiId || '',
      },
      // Tokens returned for mobile client
      token: authToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Error verifying email' });
  }
};

// @desc    Resend Verification Email
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // For security, don't reveal if email exists
      return res.status(200).json({
        message: 'If an unverified account with that email exists, a verification email has been sent.'
      });
    }

    // Check if already verified - return same generic message to prevent timing-based enumeration
    if (user.emailVerified) {
      // Return same message as "not found" case to prevent timing leak
      return res.status(200).json({
        message: 'If an unverified account with that email exists, a verification email has been sent.'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    // Update user with new token
    user.verificationToken = hashedToken;
    user.verificationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // Create verification URL
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    const html = buildEmail(
      { title: 'Verify Your Email', subtitle: 'Email verification request', variant: 'primary' },
      `
        ${greetingComponent(user.name)}
        ${textComponent("You requested a new verification email for your Split-It account. Click the button below to verify your email address:")}
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
          <tr><td align="center">
            ${buttonComponent('Verify Email Address', verificationUrl, { variant: 'primary', size: 'large' })}
          </td></tr>
        </table>
        
        ${cardComponent(`
          <p style="margin: 0 0 8px; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.textMuted};">Or copy and paste this link in your browser:</p>
          <p style="margin: 0; font-size: ${brand.fonts.sizeSmall}; color: ${brand.colors.primary}; word-break: break-all;">${verificationUrl}</p>
        `, { variant: 'default', padding: 'medium' })}
        
        ${alertComponent('<strong>This link will expire in 24 hours.</strong> If you didn\'t request this, please ignore this email.', { variant: 'info' })}
      `,
      { showPreferences: false, showSupport: true }
    );

    await sendEmailWithRetry({
      to: user.email,
      subject: 'Verify Your Email - Split-It',
      html,
    });

    res.status(200).json({
      message: 'If an unverified account with that email exists, a verification email has been sent.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Error sending verification email' });
  }
};
