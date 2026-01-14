import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Group from '../models/Group.js';
import { notifyUsers } from '../jobs/notificationService.js';
import { emitToGroup } from '../utils/socketEmitter.js';

// Cache TTL constants
const CACHE_TTL_MESSAGES = 60; // 60 seconds
const CACHE_TTL_UNREAD = 30; // 30 seconds

// Rate limiting tracking (in-memory)
const MESSAGE_RATE_LIMIT = 100; // messages per minute per user per group
const RATE_LIMIT_WINDOW = 60; // seconds
const rateLimitMap = new Map();

// In-memory caches (replacing Redis)
const messageCache = new Map();
const unreadCache = new Map();

/**
 * Strip dangerous HTML/script content from message
 */
const sanitizeContent = (content) => {
  if (!content) return '';

  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]*>/g, '') // Strip all HTML tags
    .trim();
};

/**
 * Check rate limit for user in group (in-memory)
 */
const checkRateLimit = (userId, groupId) => {
  const key = `${groupId}:${userId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW * 1000) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return true;
  }

  entry.count++;
  return entry.count <= MESSAGE_RATE_LIMIT;
};

/**
 * Invalidate cache for group messages
 */
const invalidateCache = (groupId) => {
  messageCache.delete(`${groupId}:latest`);
};

/**
 * Invalidate unread count cache for user
 */
const invalidateUnreadCache = (groupId, userId) => {
  unreadCache.delete(`${groupId}:${userId}`);
};

// Cleanup stale cache entries every 60 seconds
let cacheCleanupInterval = null;

const startCacheCleanup = () => {
  if (cacheCleanupInterval) return;

  cacheCleanupInterval = setInterval(() => {
    const now = Date.now();

    // Clean up expired rate limit entries
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.timestamp > RATE_LIMIT_WINDOW * 1000) {
        rateLimitMap.delete(key);
      }
    }

    // Clean up expired message cache entries
    for (const [key, entry] of messageCache) {
      if (entry.expiry <= now) {
        messageCache.delete(key);
      }
    }

    // Clean up expired unread cache entries
    for (const [key, entry] of unreadCache) {
      if (entry.expiry <= now) {
        unreadCache.delete(key);
      }
    }
  }, 60000); // Run every 60 seconds
};

// Stop cache cleanup (for graceful shutdown)
export const stopCacheCleanup = () => {
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
  }
};

// Start cleanup immediately on module load
startCacheCleanup();

// @desc    Get messages for a group (with pagination)
// @route   GET /api/groups/:groupId/messages
// @access  Private (group members only)
export const getMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to view messages in this group' });
    }

    // Parse and validate limit
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);

    // Try in-memory cache for first page (no 'before' cursor)
    if (!before) {
      const cached = messageCache.get(`${groupId}:latest`);
      if (cached && cached.expiry > Date.now()) {
        return res.json(cached.data);
      }
    }

    // Build query
    const query = {
      groupId,
      deletedAt: null,
    };

    if (before) {
      query._id = { $lt: before };
    }

    // Fetch messages using _id cursor for efficient pagination
    const messages = await Message.find(query)
      .populate('senderId', 'name email')
      .populate('metadata.expenseId', 'description amount currency')
      .populate('metadata.settlementId', 'amount currency')
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .lean();

    const hasMore = messages.length > parsedLimit;
    if (hasMore) {
      messages.pop();
    }

    // Transform messages to safe objects (hide deleted content)
    const safeMessages = messages.map(msg => {
      if (msg.deletedAt) {
        return {
          ...msg,
          content: '[Message deleted]',
          metadata: {},
        };
      }
      return msg;
    });

    // Reverse to get chronological order
    const result = {
      messages: safeMessages.reverse(),
      hasMore,
      oldestMessageId: safeMessages.length > 0 ? safeMessages[0]._id : null,
    };

    // Cache first page in memory
    if (!before) {
      messageCache.set(`${groupId}:latest`, {
        data: result,
        expiry: Date.now() + CACHE_TTL_MESSAGES * 1000,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a message to a group
// @route   POST /api/groups/:groupId/messages
// @access  Private (group members only)
// Security: Only 'text' type messages allowed from clients.
// System/expense/settlement messages must be created via createSystemMessage internally.
export const sendMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;
    // Security: Ignore client-provided 'type' and 'metadata' to prevent forged system messages
    // Only 'text' type is allowed from REST/Socket.IO clients

    // Verify group exists and user is a member
    const group = await Group.findById(groupId).populate('members', 'name email');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to send messages in this group' });
    }

    // Validate content
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const sanitizedContent = sanitizeContent(content);

    if (sanitizedContent.length < 1) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    if (sanitizedContent.length > 2000) {
      return res.status(400).json({ message: 'Message cannot exceed 2000 characters' });
    }

    // Check for excessive newlines
    const newlineCount = (sanitizedContent.match(/\n/g) || []).length;
    if (newlineCount > 20) {
      return res.status(400).json({ message: 'Message contains too many newlines' });
    }

    // Check rate limit
    const withinLimit = checkRateLimit(req.user._id.toString(), groupId);
    if (!withinLimit) {
      return res.status(429).json({ message: 'Rate limit exceeded. Please slow down.' });
    }

    // Create message - always 'text' type for client-sent messages
    // No metadata allowed from clients to prevent cross-group references
    const messageData = {
      groupId,
      senderId: req.user._id,
      content: sanitizedContent,
      type: 'text', // Security: Force 'text' type for all client messages
      readBy: [req.user._id], // Sender has automatically read their own message
    };

    const message = await Message.create(messageData);

    // Populate sender info
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name email')
      .populate('metadata.expenseId', 'description amount currency')
      .populate('metadata.settlementId', 'amount currency')
      .lean();

    // Emit socket event to group
    const io = req.app.get('io');
    if (io) {
      emitToGroup(io, groupId, 'chat:new', populatedMessage);
    }

    // Send notifications to offline members
    const otherMemberIds = group.members
      .filter(m => m._id.toString() !== req.user._id.toString())
      .map(m => m._id.toString());

    if (otherMemberIds.length > 0) {
      notifyUsers(otherMemberIds, {
        type: 'info',
        title: `New message in ${group.name}`,
        message: `${req.user.name}: ${sanitizedContent.substring(0, 50)}${sanitizedContent.length > 50 ? '...' : ''}`,
        data: {
          groupId,
          messageId: message._id.toString(),
          actionType: 'chat_message',
        },
      }).catch(err => console.error('Chat notification error:', err));

      // Invalidate unread cache for members
      for (const memberId of otherMemberIds) {
        invalidateUnreadCache(groupId, memberId);
      }
    }

    // Invalidate messages cache
    invalidateCache(groupId);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Edit a message
// @route   PUT /api/groups/:groupId/messages/:messageId
// @access  Private (message sender only, within 15 minutes)
export const editMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const { content } = req.body;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.groupId.toString() !== groupId) {
      return res.status(400).json({ message: 'Message does not belong to this group' });
    }

    // Check if user can edit
    if (!message.isEditable(req.user._id)) {
      return res.status(403).json({
        message: 'Cannot edit this message. Only the sender can edit within 15 minutes of sending.'
      });
    }

    // Validate new content
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const sanitizedContent = sanitizeContent(content);

    if (sanitizedContent.length < 1 || sanitizedContent.length > 2000) {
      return res.status(400).json({ message: 'Message must be 1-2000 characters' });
    }

    // Update message
    message.content = sanitizedContent;
    message.editedAt = new Date();
    await message.save();

    // Get populated message
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name email')
      .lean();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      emitToGroup(io, groupId, 'chat:edit', populatedMessage);
    }

    // Invalidate cache
    await invalidateCache(groupId);

    res.json(populatedMessage);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a message (soft delete)
// @route   DELETE /api/groups/:groupId/messages/:messageId
// @access  Private (message sender or admin)
export const deleteMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.groupId.toString() !== groupId) {
      return res.status(400).json({ message: 'Message does not belong to this group' });
    }

    // Check if user can delete (sender or admin)
    const isAdmin = group.createdBy.toString() === req.user._id.toString();
    if (!message.isDeletable(req.user._id, isAdmin)) {
      return res.status(403).json({ message: 'Cannot delete this message' });
    }

    // Soft delete
    message.deletedAt = new Date();
    message.deletedBy = req.user._id;
    await message.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      emitToGroup(io, groupId, 'chat:delete', { messageId });
    }

    // Invalidate cache
    await invalidateCache(groupId);

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark messages as read
// @route   POST /api/groups/:groupId/messages/read
// @access  Private (group members only)
export const markMessagesAsRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { messageIds } = req.body;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate messageIds
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: 'messageIds must be a non-empty array' });
    }

    if (messageIds.length > 50) {
      return res.status(400).json({ message: 'Cannot mark more than 50 messages at once' });
    }

    // Bulk update
    const result = await Message.updateMany(
      {
        _id: { $in: messageIds },
        groupId,
        readBy: { $ne: req.user._id },
      },
      {
        $addToSet: { readBy: req.user._id },
      }
    );

    // Emit socket event for read receipts
    const io = req.app.get('io');
    if (io) {
      emitToGroup(io, groupId, 'chat:read', {
        userId: req.user._id,
        messageIds,
      });
    }

    // Invalidate unread cache
    invalidateUnreadCache(groupId, req.user._id.toString());

    res.json({ success: true, count: result.modifiedCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get unread message count for a group
// @route   GET /api/groups/:groupId/messages/unread
// @access  Private (group members only)
export const getUnreadCount = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Try in-memory cache first
    const cacheKey = `${groupId}:${req.user._id}`;
    const cached = unreadCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return res.json({ count: cached.count });
    }

    // Count unread messages
    const count = await Message.countDocuments({
      groupId,
      deletedAt: null,
      senderId: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
    });

    // Cache the result in memory
    unreadCache.set(cacheKey, {
      count,
      expiry: Date.now() + CACHE_TTL_UNREAD * 1000,
    });

    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get unread message counts for multiple groups (batch)
// @route   POST /api/messages/unread-counts
// @access  Private
export const getBatchUnreadCounts = async (req, res) => {
  try {
    const { groupIds } = req.body;

    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ message: 'groupIds must be a non-empty array' });
    }

    // Limit to 50 groups max
    const limitedGroupIds = groupIds.slice(0, 50);
    const userId = req.user._id.toString();

    // Get groups user is a member of
    const groups = await Group.find({
      _id: { $in: limitedGroupIds },
      members: req.user._id,
    }).select('_id');

    const validGroupIds = groups.map(g => g._id.toString());
    const counts = {};

    // Check in-memory cache first for all groups
    const uncachedGroupIds = [];
    for (const groupId of validGroupIds) {
      const cacheKey = `${groupId}:${userId}`;
      const cached = unreadCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        counts[groupId] = cached.count;
      } else {
        uncachedGroupIds.push(groupId);
      }
    }

    // Fetch uncached counts from database
    if (uncachedGroupIds.length > 0) {
      const pipeline = [
        {
          $match: {
            groupId: { $in: uncachedGroupIds.map(id => new mongoose.Types.ObjectId(id)) },
            deletedAt: null,
            senderId: { $ne: req.user._id },
            readBy: { $ne: req.user._id },
          },
        },
        {
          $group: {
            _id: '$groupId',
            count: { $sum: 1 },
          },
        },
      ];

      const results = await Message.aggregate(pipeline);

      // Process results and cache them in memory
      for (const groupId of uncachedGroupIds) {
        const result = results.find(r => r._id.toString() === groupId);
        const count = result ? result.count : 0;
        counts[groupId] = count;

        // Cache the result in memory
        const cacheKey = `${groupId}:${userId}`;
        unreadCache.set(cacheKey, {
          count,
          expiry: Date.now() + CACHE_TTL_UNREAD * 1000,
        });
      }
    }

    res.json({ counts });
  } catch (error) {
    console.error('Error getting batch unread counts:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a system message (internal use only - NOT exposed via REST/Socket.IO)
// @param   {string} groupId - The group ID this message belongs to
// @param   {string} senderId - The user ID creating this message
// @param   {string} content - The message content
// @param   {object} metadata - Optional metadata (expenseId, settlementId, action)
// @param   {string} type - Message type: 'system', 'expense', or 'settlement'
// Security: Verifies expense/settlement references belong to the same group
export const createSystemMessage = async (groupId, senderId, content, metadata = {}, type = 'system') => {
  try {
    // Security: Validate that type is a valid internal type (not 'text')
    const validInternalTypes = ['system', 'expense', 'settlement'];
    const messageType = validInternalTypes.includes(type) ? type : 'system';

    // Security: Verify expense/settlement references belong to the same group
    if (metadata.expenseId) {
      const Expense = (await import('../models/Expense.js')).default;
      const expense = await Expense.findById(metadata.expenseId).lean();
      if (!expense || expense.groupId.toString() !== groupId.toString()) {
        console.error(`createSystemMessage: Expense ${metadata.expenseId} does not belong to group ${groupId}`);
        // Remove invalid reference instead of failing completely
        delete metadata.expenseId;
      }
    }

    if (metadata.settlementId) {
      const Settlement = (await import('../models/Settlement.js')).default;
      const settlement = await Settlement.findById(metadata.settlementId).lean();
      if (!settlement || settlement.groupId.toString() !== groupId.toString()) {
        console.error(`createSystemMessage: Settlement ${metadata.settlementId} does not belong to group ${groupId}`);
        // Remove invalid reference instead of failing completely
        delete metadata.settlementId;
      }
    }

    const message = await Message.create({
      groupId,
      senderId,
      content,
      type: messageType,
      metadata,
      readBy: [senderId],
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name email')
      .populate('metadata.expenseId', 'description amount currency')
      .populate('metadata.settlementId', 'amount currency')
      .lean();

    return populatedMessage;
  } catch (error) {
    console.error('Error creating system message:', error);
    return null;
  }
};
