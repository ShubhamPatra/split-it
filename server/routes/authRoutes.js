import express from 'express';
import { register, login, getMe, googleAuth, logout, forgotPassword, resetPassword, verifyEmail, resendVerification } from '../controllers/authController.js';
import { protect, refreshAccessToken } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation, validate } from '../middleware/validation.js';
import { authRateLimit } from '../middleware/security.js';

const router = express.Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', authRateLimit, registerValidation, validate, register);
router.post('/login', authRateLimit, loginValidation, validate, login);
router.post('/google', authRateLimit, googleAuth);
router.post('/logout', logout);
router.get('/me', protect, getMe);

// Email verification endpoints - rate limited to prevent enumeration
router.get('/verify-email/:token', authRateLimit, verifyEmail);
router.post('/resend-verification', authRateLimit, resendVerification);

// Password reset endpoints
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/reset-password', authRateLimit, resetPassword);

// Refresh token endpoint (Comment 11)
router.post('/refresh', refreshAccessToken);

export default router;
