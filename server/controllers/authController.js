import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { generateToken, generateRefreshToken } from '../middleware/authMiddleware.js';
import crypto from 'crypto';

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

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
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

      // Send welcome email using template
      sendEmailWithRetry({
        template: 'welcome',
        to: user.email,
        data: {
          userName: user.name,
        },
      }).catch(err => console.error('Welcome email error:', err));

      // Create UPI reminder notification for new users
      createUpiReminderIfNeeded(user).catch(err => console.error('UPI reminder error:', err));

      res.status(201).json({
        success: true,
        needsConfirmation: false,
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
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
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
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        googleId,
        name,
        email,
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
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

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
