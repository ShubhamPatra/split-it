import express from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/security.js';
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markMessagesAsRead,
  getUnreadCount,
  getBatchUnreadCounts,
} from '../controllers/chatController.js';

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// POST /api/groups/batch/unread-counts - Get unread counts for multiple groups
// NOTE: This route MUST come before /:groupId routes to avoid matching "batch" as a groupId
router.post(
  '/batch/unread-counts',
  rateLimiter({ max: 30, windowMs: 60000 }), // 30 requests per minute
  body('groupIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('groupIds must be an array of 1-50 IDs'),
  body('groupIds.*').isMongoId().withMessage('Invalid group ID in array'),
  validate,
  getBatchUnreadCounts
);

// POST /api/messages/unread-counts - Get unread counts for multiple groups (alternative path)
// This route is for when chatRoutes is mounted at /api/messages
router.post(
  '/unread-counts',
  rateLimiter({ max: 30, windowMs: 60000 }), // 30 requests per minute
  body('groupIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('groupIds must be an array of 1-50 IDs'),
  body('groupIds.*').isMongoId().withMessage('Invalid group ID in array'),
  validate,
  getBatchUnreadCounts
);

// GET /api/groups/:groupId/messages - Get messages with pagination
router.get(
  '/:groupId/messages',
  rateLimiter({ max: 200, windowMs: 60000 }), // 200 requests per minute for read operations
  param('groupId').isMongoId().withMessage('Invalid group ID'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('before').optional().isMongoId().withMessage('Invalid cursor ID'),
  validate,
  getMessages
);

// POST /api/groups/:groupId/messages - Send a message
// Security: Only 'text' type messages allowed from clients.
// System/expense/settlement messages are created internally by controllers.
router.post(
  '/:groupId/messages',
  rateLimiter({ max: 100, windowMs: 60000 }), // 100 requests per minute
  param('groupId').isMongoId().withMessage('Invalid group ID'),
  body('content')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Message content is required')
    .isString()
    .withMessage('Message content must be a string')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters'),
  // Note: 'type' and 'metadata' are intentionally not validated here
  // as they are ignored/overridden by the controller for security
  validate,
  sendMessage
);

// PUT /api/groups/:groupId/messages/:messageId - Edit a message
router.put(
  '/:groupId/messages/:messageId',
  rateLimiter({ max: 20, windowMs: 60000 }), // 20 requests per minute
  param('groupId').isMongoId().withMessage('Invalid group ID'),
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters'),
  validate,
  editMessage
);

// DELETE /api/groups/:groupId/messages/:messageId - Delete a message
router.delete(
  '/:groupId/messages/:messageId',
  rateLimiter({ max: 20, windowMs: 60000 }), // 20 requests per minute
  param('groupId').isMongoId().withMessage('Invalid group ID'),
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  validate,
  deleteMessage
);

// POST /api/groups/:groupId/messages/read - Mark messages as read
router.post(
  '/:groupId/messages/read',
  rateLimiter({ max: 30, windowMs: 60000 }), // 30 requests per minute
  param('groupId').isMongoId().withMessage('Invalid group ID'),
  body('messageIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('messageIds must be an array of 1-50 IDs'),
  body('messageIds.*').isMongoId().withMessage('Invalid message ID in array'),
  validate,
  markMessagesAsRead
);

// GET /api/groups/:groupId/messages/unread - Get unread count
router.get(
  '/:groupId/messages/unread',
  rateLimiter({ max: 200, windowMs: 60000 }), // 200 requests per minute for read operations
  param('groupId').isMongoId().withMessage('Invalid group ID'),
  validate,
  getUnreadCount
);

export default router;
