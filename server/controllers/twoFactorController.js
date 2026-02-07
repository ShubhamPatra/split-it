/**
 * Two-Factor Authentication Controller
 * 
 * Handles TOTP-based 2FA setup, verification, and management.
 * Compatible with Google Authenticator, Authy, and other TOTP apps.
 */

import User from '../models/User.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { logAuthEvent } from '../middleware/auditMiddleware.js';
import backupCodeService from '../services/backupCodeService.js';

/**
 * @desc    Generate 2FA secret and QR code
 * @route   POST /api/auth/2fa/setup
 * @access  Private
 */
export const setup2FA = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if 2FA is already enabled
    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorEnabled');

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        message: '2FA is already enabled. Disable it first to set up again.'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Split-It (${user.email})`,
      issuer: 'Split-It',
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (not enabled yet)
    user.twoFactorSecret = secret.base32;
    user.twoFactorVerified = false;
    await user.save();

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntry: secret.base32,
      message: 'Scan the QR code with your authenticator app, then verify with a code to enable 2FA.',
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ message: 'Error setting up 2FA' });
  }
};

/**
 * @desc    Verify and enable 2FA
 * @route   POST /api/auth/2fa/verify
 * @access  Private
 */
export const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;

    if (!token || token.length !== 6) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Get user with secret
    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorEnabled');

    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: 'Please set up 2FA first' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    // Verify token using decrypted secret
    const decryptedSecret = user.getDecryptedTwoFactorSecret ?
      user.getDecryptedTwoFactorSecret() : user.twoFactorSecret;
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after for clock skew
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid verification code. Please try again.' });
    }

    // Generate backup codes using the new service
    const backupCodes = await backupCodeService.generateCodes(userId, 10);

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorVerified = true;
    await user.save();

    // Log 2FA enabled event
    await logAuthEvent('user.2fa.enabled', user._id, 'success', req);

    res.json({
      success: true,
      backupCodes,
      message: '2FA enabled successfully! Save these backup codes in a safe place.',
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ message: 'Error verifying 2FA' });
  }
};

/**
 * @desc    Verify 2FA token during login
 * @route   POST /api/auth/2fa/validate
 * @access  Public (but requires valid session token)
 */
export const validate2FA = async (req, res) => {
  try {
    const { token, userId, useBackupCode } = req.body;

    // Security: Prefer session-based userId if available to prevent enumeration
    const targetUserId = req.user?._id || userId;

    if (!token || !targetUserId) {
      return res.status(400).json({ message: 'Token and user ID are required' });
    }

    // Get user with 2FA secret and backup codes, including lockout fields
    const user = await User.findById(targetUserId).select('+twoFactorSecret +twoFactorBackupCodes +twoFactorEnabled +twoFactorFailedCount +twoFactorLockedUntil');

    if (!user || !user.twoFactorEnabled) {
      // Return generic error to prevent user enumeration
      return res.status(400).json({ message: 'Invalid request' });
    }

    // Check if account is locked due to failed attempts
    if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.twoFactorLockedUntil - new Date()) / 60000);
      return res.status(429).json({
        message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
        lockedUntil: user.twoFactorLockedUntil
      });
    }

    let verified = false;
    let remainingCodes = 0;

    if (useBackupCode) {
      // Use atomic consume function to verify and remove in single operation (fixes TOCTOU race)
      const result = await backupCodeService.consumeBackupCode(targetUserId, token);
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
        token,
        window: 2,
      });
    }

    if (!verified) {
      // Increment failed count and potentially lock account
      const failedCount = (user.twoFactorFailedCount || 0) + 1;
      const update = { twoFactorFailedCount: failedCount };

      // Lock account after 5 failed attempts for 15 minutes
      if (failedCount >= 5) {
        update.twoFactorLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await User.findByIdAndUpdate(targetUserId, update);

      // Log failed 2FA attempt
      await logAuthEvent('auth.failed.2fa', user._id, 'failure', req, {
        message: 'Invalid 2FA code',
        useBackupCode,
        failedCount,
      });

      return res.status(400).json({
        message: useBackupCode ? 'Invalid backup code' : 'Invalid verification code'
      });
    }

    // Reset failed count on successful verification
    await User.findByIdAndUpdate(targetUserId, {
      twoFactorFailedCount: 0,
      twoFactorLockedUntil: null
    });

    // Log successful 2FA verification
    await logAuthEvent('user.2fa.verified', user._id, 'success', req);

    res.json({
      success: true,
      message: '2FA verification successful',
    });
  } catch (error) {
    console.error('2FA validate error:', error);
    res.status(500).json({ message: 'Error validating 2FA' });
  }
};

/**
 * @desc    Disable 2FA
 * @route   POST /api/auth/2fa/disable
 * @access  Private
 */
export const disable2FA = async (req, res) => {
  try {
    const { password, token } = req.body;
    const userId = req.user._id;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to disable 2FA' });
    }

    // Get user with password and 2FA secret
    const user = await User.findById(userId).select('+password +twoFactorSecret +twoFactorEnabled +twoFactorBackupCodes');

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Log failed attempt
      await logAuthEvent('auth.failed.2fa_disable', user._id, 'failure', req, {
        message: 'Invalid password',
      });

      return res.status(400).json({ message: 'Invalid password' });
    }

    // Verify 2FA token using decrypted secret
    const decryptedSecret = user.getDecryptedTwoFactorSecret ?
      user.getDecryptedTwoFactorSecret() : user.twoFactorSecret;
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      // Log failed attempt
      await logAuthEvent('auth.failed.2fa_disable', user._id, 'failure', req, {
        message: 'Invalid 2FA code',
      });

      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorVerified = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    await user.save();

    // Log 2FA disabled event
    await logAuthEvent('user.2fa.disabled', user._id, 'success', req);

    res.json({
      success: true,
      message: '2FA disabled successfully',
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ message: 'Error disabling 2FA' });
  }
};

/**
 * @desc    Get 2FA status
 * @route   GET /api/auth/2fa/status
 * @access  Private
 */
export const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('+twoFactorEnabled +twoFactorBackupCodes');

    res.json({
      enabled: user.twoFactorEnabled || false,
      backupCodesRemaining: user.twoFactorBackupCodes?.length || 0,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ message: 'Error getting 2FA status' });
  }
};

/**
 * @desc    Regenerate backup codes
 * @route   POST /api/auth/2fa/backup-codes
 * @access  Private
 */
export const regenerateBackupCodes = async (req, res) => {
  try {
    const { password, token } = req.body;
    const userId = req.user._id;

    if (!password || !token) {
      return res.status(400).json({ message: 'Password and 2FA token are required' });
    }

    // Get user with password and 2FA secret
    const user = await User.findById(userId).select('+password +twoFactorSecret +twoFactorEnabled +twoFactorBackupCodes');

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Verify 2FA token using decrypted secret
    const decryptedSecret = user.getDecryptedTwoFactorSecret ?
      user.getDecryptedTwoFactorSecret() : user.twoFactorSecret;
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Generate new backup codes using the service
    const backupCodes = await backupCodeService.generateCodes(userId, 10);

    // Log backup codes regeneration
    await logAuthEvent('user.2fa.backup_codes_regenerated', user._id, 'success', req);

    res.json({
      success: true,
      backupCodes,
      message: 'Backup codes regenerated successfully. Save these in a safe place.',
    });
  } catch (error) {
    console.error('2FA regenerate backup codes error:', error);
    res.status(500).json({ message: 'Error regenerating backup codes' });
  }
};

const twoFactorController = {
  setup2FA,
  verify2FA,
  validate2FA,
  disable2FA,
  get2FAStatus,
  regenerateBackupCodes,
};

export default twoFactorController;
