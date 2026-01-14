import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { notifyUsers } from '../jobs/notificationService.js';
import { verifyTokenWithBlacklist } from '../middleware/authMiddleware.js';

const isDev = process.env.NODE_ENV !== 'production';

// Parse allowed origins from environment
const parseAllowedOrigins = () => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  // Combine CLIENT_URL with any additional allowed origins
  const origins = new Set([clientUrl, ...allowedOrigins]);

  // In development, also allow common dev ports
  if (isDev) {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
};

const allowedOrigins = parseAllowedOrigins();

// In-memory state management (single instance, no Redis needed)
const onlineUsers = new Map(); // groupId -> Set<userId>
const typingUsers = new Map(); // groupId -> Map<userId, {userName, timestamp}>
const groupMembershipCache = new Map(); // groupId -> {name, memberIds, expiry}

// Cache TTL
const GROUP_CACHE_TTL = 300000; // 5 minutes

// Store io instance for exports
let ioInstance = null;

/**
 * Get or cache group membership for fast authorization checks
 */
const getGroupMembership = async (groupId) => {
  const cached = groupMembershipCache.get(groupId);
  if (cached && cached.expiry > Date.now()) {
    return cached;
  }

  // Fetch from DB
  const Group = (await import('../models/Group.js')).default;
  const group = await Group.findById(groupId).select('name members').lean();

  if (!group) return null;

  const memberIds = group.members.map(m => m.toString());
  const membership = { name: group.name, memberIds, expiry: Date.now() + GROUP_CACHE_TTL };

  groupMembershipCache.set(groupId, membership);
  return membership;
};

/**
 * Invalidate group membership cache (call when members change)
 */
export const invalidateGroupMembershipCache = (groupId) => {
  groupMembershipCache.delete(groupId);
};

/**
 * Add user to group presence
 */
const addUserPresence = (groupId, userId) => {
  if (!onlineUsers.has(groupId)) {
    onlineUsers.set(groupId, new Set());
  }
  onlineUsers.get(groupId).add(userId);
};

/**
 * Remove user from group presence
 */
const removeUserPresence = (groupId, userId) => {
  const groupUsers = onlineUsers.get(groupId);
  if (groupUsers) {
    groupUsers.delete(userId);
    if (groupUsers.size === 0) {
      onlineUsers.delete(groupId);
    }
  }
};

/**
 * Get all online users for a group
 */
const getGroupOnlineUsers = (groupId) => {
  return Array.from(onlineUsers.get(groupId) || []);
};

/**
 * Set user typing status
 */
const setUserTyping = (groupId, userId, userName) => {
  if (!typingUsers.has(groupId)) {
    typingUsers.set(groupId, new Map());
  }
  typingUsers.get(groupId).set(userId, { userName, timestamp: Date.now() });
};

/**
 * Remove user typing status
 */
const removeUserTyping = (groupId, userId) => {
  const groupTyping = typingUsers.get(groupId);
  if (groupTyping) {
    groupTyping.delete(userId);
    if (groupTyping.size === 0) {
      typingUsers.delete(groupId);
    }
  }
};

// Cleanup stale typing indicators every 5 seconds
let typingCleanupInterval = null;

const startTypingCleanup = () => {
  if (typingCleanupInterval) return;

  typingCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [groupId, users] of typingUsers) {
      for (const [userId, data] of users) {
        if (now - data.timestamp > 5000) {
          users.delete(userId);
        }
      }
      if (users.size === 0) {
        typingUsers.delete(groupId);
      }
    }
  }, 5000);
};

// Stop typing cleanup (for graceful shutdown)
export const stopTypingCleanup = () => {
  if (typingCleanupInterval) {
    clearInterval(typingCleanupInterval);
    typingCleanupInterval = null;
  }
};

// Start cleanup immediately
startTypingCleanup();

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: Array.from(allowedOrigins),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket'], // Disable long polling
    perMessageDeflate: false,
  });

  // Store io instance for exports
  ioInstance = io;

  console.log('Socket.IO: Initialized (single-instance mode, no Redis adapter)');

  // Authentication middleware - use cookie-based auth with blacklist check and origin verification
  io.use(async (socket, next) => {
    try {
      // Origin verification - reject connections from unauthorized origins
      const origin = socket.handshake.headers.origin || socket.handshake.headers.referer;
      if (origin) {
        // Extract origin from referer if present (strip path)
        const originUrl = origin.includes('/') && !origin.endsWith('/')
          ? new URL(origin).origin
          : origin.replace(/\/$/, '');

        if (!allowedOrigins.has(originUrl)) {
          console.warn(`Socket.IO: Rejected connection from unauthorized origin: ${originUrl}`);
          return next(new Error('Origin not allowed'));
        }
      } else if (process.env.NODE_ENV === 'production') {
        // In production, require origin header
        console.warn('Socket.IO: Rejected connection with no origin header');
        return next(new Error('Origin required'));
      }

      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies.auth_token;

      if (!token) return next(new Error('Authentication error'));

      // Use shared verification helper that checks blacklist
      const decoded = verifyTokenWithBlacklist(token);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      if (error.code === 'TOKEN_REVOKED') {
        return next(new Error('Token revoked'));
      }
      next(new Error('Authentication error'));
    }
  });

  // Connection limit per user
  const userConnections = new Map();
  const MAX_CONNECTIONS_PER_USER = 3;

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Enforce connection limit
    const connections = userConnections.get(userId) || 0;
    if (connections >= MAX_CONNECTIONS_PER_USER) {
      socket.disconnect(true);
      return;
    }
    userConnections.set(userId, connections + 1);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Join group rooms (with authentication)
    socket.on('join:group', async (groupId) => {
      try {
        const membership = await getGroupMembership(groupId);

        if (!membership) {
          socket.emit('error', { message: 'Group not found' });
          return;
        }

        if (!membership.memberIds.includes(userId)) {
          socket.emit('error', { message: 'Not authorized to join this group' });
          return;
        }

        socket.join(`group:${groupId}`);

        // Track online user
        addUserPresence(groupId, userId);

        // Broadcast user online status to group
        socket.to(`group:${groupId}`).emit('chat:userOnline', { userId, groupId });

        // Send current online users to the joining user
        socket.emit('chat:onlineUsers', {
          groupId,
          users: getGroupOnlineUsers(groupId),
        });
      } catch (error) {
        console.error('Join group error:', error);
        socket.emit('error', { message: 'Failed to join group' });
      }
    });

    socket.on('leave:group', (groupId) => {
      socket.leave(`group:${groupId}`);
      removeUserPresence(groupId, userId);
      removeUserTyping(groupId, userId);
      socket.to(`group:${groupId}`).emit('chat:userOffline', { userId, groupId });
    });

    // Chat typing indicator
    socket.on('chat:typing', async (data) => {
      const { groupId, isTyping, userName } = data;

      if (!groupId) return;

      try {
        const membership = await getGroupMembership(groupId);
        if (!membership || !membership.memberIds.includes(userId)) {
          return;
        }

        if (isTyping) {
          setUserTyping(groupId, userId, userName || 'Someone');
        } else {
          removeUserTyping(groupId, userId);
        }

        socket.to(`group:${groupId}`).emit('chat:typing', {
          userId,
          userName: userName || 'Someone',
          isTyping,
          groupId,
        });
      } catch (error) {
        console.error('Chat typing error:', error);
      }
    });

    // Chat message read receipts
    socket.on('chat:markRead', async (data) => {
      const { groupId, messageIds } = data;

      if (!groupId || !Array.isArray(messageIds) || messageIds.length === 0) return;

      try {
        const membership = await getGroupMembership(groupId);
        if (!membership || !membership.memberIds.includes(userId)) {
          return;
        }

        const Message = (await import('../models/Message.js')).default;
        await Message.updateMany(
          {
            _id: { $in: messageIds.slice(0, 50) },
            groupId,
            readBy: { $ne: userId },
          },
          {
            $addToSet: { readBy: userId },
          }
        );

        io.to(`group:${groupId}`).emit('chat:read', {
          userId,
          messageIds: messageIds.slice(0, 50),
          groupId,
        });
      } catch (error) {
        console.error('Chat mark read error:', error);
      }
    });

    // Chat message send via socket
    socket.on('chat:send', async (data, ackCallback) => {
      const { groupId, content, tempId } = data;

      if (!groupId || !content || typeof content !== 'string') {
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: 'Invalid message data' });
        }
        return;
      }

      try {
        const Message = (await import('../models/Message.js')).default;
        const membership = await getGroupMembership(groupId);

        if (!membership) {
          if (typeof ackCallback === 'function') {
            ackCallback({ success: false, error: 'Group not found' });
          }
          return;
        }

        if (!membership.memberIds.includes(userId)) {
          if (typeof ackCallback === 'function') {
            ackCallback({ success: false, error: 'Not authorized to send messages in this group' });
          }
          return;
        }

        // Sanitize content
        const sanitizedContent = content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/<[^>]*>/g, '')
          .trim();

        if (sanitizedContent.length < 1) {
          if (typeof ackCallback === 'function') {
            ackCallback({ success: false, error: 'Message content cannot be empty' });
          }
          return;
        }

        if (sanitizedContent.length > 2000) {
          if (typeof ackCallback === 'function') {
            ackCallback({ success: false, error: 'Message cannot exceed 2000 characters' });
          }
          return;
        }

        const newlineCount = (sanitizedContent.match(/\n/g) || []).length;
        if (newlineCount > 20) {
          if (typeof ackCallback === 'function') {
            ackCallback({ success: false, error: 'Message contains too many newlines' });
          }
          return;
        }

        // Create message
        const message = await Message.create({
          groupId,
          senderId: userId,
          content: sanitizedContent,
          type: 'text',
          readBy: [userId],
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name email')
          .lean();

        // Send ack to sender
        if (typeof ackCallback === 'function') {
          ackCallback({ success: true, tempId, message: populatedMessage });
        }

        // Broadcast to all group members
        io.to(`group:${groupId}`).emit('chat:new', populatedMessage);

        // Background: Send notifications to other members
        setImmediate(async () => {
          try {
            const senderName = populatedMessage.senderId?.name || 'Someone';
            const otherMemberIds = membership.memberIds.filter(id => id !== userId);

            if (otherMemberIds.length > 0) {
              notifyUsers(otherMemberIds, {
                type: 'info',
                title: `New message in ${membership.name}`,
                message: `${senderName}: ${sanitizedContent.substring(0, 50)}${sanitizedContent.length > 50 ? '...' : ''}`,
                data: {
                  groupId,
                  messageId: message._id.toString(),
                  actionType: 'chat_message',
                },
              }).catch(err => console.error('Chat notification error:', err.message));
            }
          } catch (bgError) {
            console.error('Chat send background tasks error:', bgError);
          }
        });
      } catch (error) {
        console.error('Chat send error:', error);
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: 'Failed to send message' });
        }
      }
    });

    socket.on('disconnect', () => {
      const count = userConnections.get(userId) - 1;
      if (count <= 0) {
        userConnections.delete(userId);
      } else {
        userConnections.set(userId, count);
      }

      // Clean up online/typing status
      const socketRooms = Array.from(socket.rooms || []);
      for (const room of socketRooms) {
        if (room.startsWith('group:')) {
          const groupId = room.replace('group:', '');
          removeUserPresence(groupId, userId);
          removeUserTyping(groupId, userId);
          io.to(`group:${groupId}`).emit('chat:userOffline', { userId, groupId });
          io.to(`group:${groupId}`).emit('chat:typing', {
            userId,
            isTyping: false,
            groupId,
          });
        }
      }
    });
  });

  return io;
};

/**
 * Get online users for a group
 */
export const getOnlineUsers = (groupId) => {
  return getGroupOnlineUsers(groupId);
};

/**
 * Check if a user is online in a group
 */
export const isUserOnline = (groupId, userId) => {
  return getGroupOnlineUsers(groupId).includes(userId);
};

/**
 * Get the Socket.io instance
 */
export const getSocketIO = () => ioInstance;
