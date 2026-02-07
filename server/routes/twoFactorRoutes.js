/**
 * Two-Factor Authentication Routes
 */

import express from 'express';
import {
  setup2FA,
  verify2FA,
  validate2FA,
  disable2FA,
  get2FAStatus,
  regenerateBackupCodes,
} from '../controllers/twoFactorController.js';
import { protect } from '../middleware/authMiddleware.js';
import { rateLimiter } from '../middleware/security.js';

const router = express.Router();

// Rate limiting for 2FA operations
const twoFactorRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many 2FA requests, please try again later',
});

// Get 2FA status
router.get('/status', protect, get2FAStatus);

// Setup 2FA (generate secret and QR code)
router.post('/setup', protect, twoFactorRateLimit, setup2FA);

// Verify and enable 2FA
router.post('/verify', protect, twoFactorRateLimit, verify2FA);

// Validate 2FA token during login (public but requires session)
router.post('/validate', twoFactorRateLimit, validate2FA);

// Disable 2FA
router.post('/disable', protect, twoFactorRateLimit, disable2FA);

// Regenerate backup codes
router.post('/backup-codes', protect, twoFactorRateLimit, regenerateBackupCodes);

export default router;
