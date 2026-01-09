import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { inviteJoinRateLimit, inviteValidateRateLimit } from '../middleware/security.js';
import {
  createInvite,
  getGroupInvites,
  validateInvite,
  joinViaInvite,
  revokeInvite,
  regenerateInvite,
} from '../controllers/inviteController.js';

const router = express.Router();

// Public route (no auth required for validation) with rate limiting
router.post('/validate', inviteValidateRateLimit, validateInvite);

// Protected route with rate limiting
router.post('/join', protect, inviteJoinRateLimit, joinViaInvite);

// All routes below require authentication
router.use(protect);

// Group-specific invite routes
router.post('/groups/:groupId/invites', createInvite);
router.get('/groups/:groupId/invites', getGroupInvites);

// Single invite operations
router.delete('/:inviteId', revokeInvite);
router.post('/:inviteId/regenerate', regenerateInvite);

export default router;
