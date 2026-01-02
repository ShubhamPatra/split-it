import express from 'express';
import { register, login, getMe, googleAuth } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { registerValidation, loginValidation, validate } from '../middleware/validation.js';
import { authRateLimit } from '../middleware/security.js';

const router = express.Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', authRateLimit, registerValidation, validate, register);
router.post('/login', authRateLimit, loginValidation, validate, login);
router.post('/google', authRateLimit, googleAuth);
router.get('/me', protect, getMe);

export default router;
