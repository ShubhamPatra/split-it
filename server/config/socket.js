import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { notifyUsers } from '../jobs/notificationService.js';
import { verifyTokenWithBlacklist } from '../middleware/authMiddleware.js';
import { checkRateLimit, getRateLimitInfo } from '../utils/rateLimiter.js';

const isDev = process.env.NODE_ENV !== 'production';

// Debug log helper (lazy loaded)
const logSocketEvt = async (event, data = {}) => {
  if (process.env.DEBUG_ENABLED === 'true') {
    try {
      const { logSocketEvent } = await import('../internal/debug/logCollector.js');
      logSocketEvent(event, data);
    } catch (e) {
      // Debug portal not available, ignore
    }
  }
};

// Redis adapter for horizontal scaling (Comment 5)
// Only loaded when REDIS_URL is configured
let createAdapter = null;
let Redis = null;
if (process.env.REDIS_URL) {
  try {
    const { createAdapter: ca } = await import('@socket.io/redis-adapter');
    const { default: IORedis } = await import('ioredis');
    createAdapter = ca;
    Redis = IORedis;
    console.log('Socket.IO: Redis adapter modules loaded');
  } catch (err) {
    console.warn('Socket.IO: Redis adapter not available, running in single-instance mode');
    console.warn('  Install with: npm install @socket.io/redis-adapter ioredis');
  }
}

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

// In-memory state management (used when Redis is not available)
// Comment 2: Changed from Set to Map<userId, count> for per-user connection counting
// This correctly handles multiple tabs/windows from the same user
// Comment 1: These are local fallbacks; when Redis is enabled, presence is stored in Redis
const onlineUsers = new Map(); // groupId -> Map<userId, connectionCount> (local fallback)
const typingUsers = new Map(); // groupId -> Map<userId, {userName, timestamp}> (local fallback)
const groupMembershipCache = new Map(); // groupId -> {name, memberIds, expiry}

// Redis clients for horizontal scaling (Comment 5)
// These are initialized when REDIS_URL is set
let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;
let useRedisState = false;

// Cache TTL
const GROUP_CACHE_TTL = 300000; // 5 minutes
const PRESENCE_REDIS_TTL = 3600; // 1 hour in seconds (for Redis expiry)
const TYPING_REDIS_TTL = 10; // 10 seconds for typing indicators

// Redis key prefixes for presence state
const REDIS_PRESENCE_PREFIX = 'socket:presence:'; // Hash: groupId -> {userId: connectionCount}
const REDIS_TYPING_PREFIX = 'socket:typing:'; // Hash: groupId -> {userId: JSON({userName, timestamp})}

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
 * Add user to group presence (with connection counting for multi-tab support)
 * Comment 1 & 2: Uses Redis when available for cross-node consistency, falls back to in-memory Map
 * @returns {Promise<boolean>} true if this is the first connection (should broadcast online)
 */
const addUserPresence = async (groupId, userId) => {
  if (useRedisState && redisClient) {
    try {
      const key = `${REDIS_PRESENCE_PREFIX}${groupId}`;
      const currentCount = await redisClient.hincrby(key, userId, 1);
      await redisClient.expire(key, PRESENCE_REDIS_TTL);
      return currentCount === 1; // First connection if count is now 1
    } catch (err) {
      console.error('Redis addUserPresence error, falling back to local:', err.message);
    }
  }
  // Local fallback
  if (!onlineUsers.has(groupId)) {
    onlineUsers.set(groupId, new Map());
  }
  const groupUsers = onlineUsers.get(groupId);
  const currentCount = groupUsers.get(userId) || 0;
  groupUsers.set(userId, currentCount + 1);
  // Return true if this is the first connection (user just came online)
  return currentCount === 0;
};

/**
 * Remove user from group presence (with connection counting for multi-tab support)
 * Comment 1 & 2: Uses Redis when available for cross-node consistency, falls back to in-memory Map
 * @returns {Promise<boolean>} true if this was the last connection (should broadcast offline)
 */
export const removeUserPresence = async (groupId, userId) => {
  if (useRedisState && redisClient) {
    try {
      const key = `${REDIS_PRESENCE_PREFIX}${groupId}`;
      const currentCount = await redisClient.hincrby(key, userId, -1);
      if (currentCount <= 0) {
        // Remove user from hash if count is 0 or negative
        await redisClient.hdel(key, userId);
        return true; // User went offline
      }
      return false; // User still has other connections
    } catch (err) {
      console.error('Redis removeUserPresence error, falling back to local:', err.message);
    }
  }
  // Local fallback
  const groupUsers = onlineUsers.get(groupId);
  if (!groupUsers) return false;
  
  const currentCount = groupUsers.get(userId) || 0;
  if (currentCount <= 1) {
    // Last connection, remove user entirely
    groupUsers.delete(userId);
    if (groupUsers.size === 0) {
      onlineUsers.delete(groupId);
    }
    return true; // User went offline
  } else {
    // Decrement count, user still has other connections
    groupUsers.set(userId, currentCount - 1);
    return false; // User still online
  }
};

/**
 * Get all online users for a group
 * Comment 1 & 2: Uses Redis when available for cross-node consistency
 */
const getGroupOnlineUsers = async (groupId) => {
  if (useRedisState && redisClient) {
    try {
      const key = `${REDIS_PRESENCE_PREFIX}${groupId}`;
      const users = await redisClient.hkeys(key);
      return users;
    } catch (err) {
      console.error('Redis getGroupOnlineUsers error, falling back to local:', err.message);
    }
  }
  // Local fallback
  const groupUsers = onlineUsers.get(groupId);
  return groupUsers ? Array.from(groupUsers.keys()) : [];
};

/**
 * Set user typing status
 * Comment 1: Uses Redis when available for cross-node consistency
 */
const setUserTyping = async (groupId, userId, userName) => {
  if (useRedisState && redisClient) {
    try {
      const key = `${REDIS_TYPING_PREFIX}${groupId}`;
      await redisClient.hset(key, userId, JSON.stringify({ userName, timestamp: Date.now() }));
      await redisClient.expire(key, TYPING_REDIS_TTL);
      return;
    } catch (err) {
      console.error('Redis setUserTyping error, falling back to local:', err.message);
    }
  }
  // Local fallback
  if (!typingUsers.has(groupId)) {
    typingUsers.set(groupId, new Map());
  }
  typingUsers.get(groupId).set(userId, { userName, timestamp: Date.now() });
};

/**
 * Remove user typing status
 * Comment 1: Uses Redis when available for cross-node consistency
 */
export const removeUserTyping = async (groupId, userId) => {
  if (useRedisState && redisClient) {
    try {
      const key = `${REDIS_TYPING_PREFIX}${groupId}`;
      await redisClient.hdel(key, userId);
      return;
    } catch (err) {
      console.error('Redis removeUserTyping error, falling back to local:', err.message);
    }
  }
  // Local fallback
  const groupTyping = typingUsers.get(groupId);
  if (groupTyping) {
    groupTyping.delete(userId);
    if (groupTyping.size === 0) {
      typingUsers.delete(groupId);
    }
  }
};

// Cleanup stale typing indicators every 5 seconds
// Comment 1: Only cleans up local typing state; Redis typing keys auto-expire via TTL
let typingCleanupInterval = null;

const startTypingCleanup = () => {
  if (typingCleanupInterval) return;

  typingCleanupInterval = setInterval(async () => {
    const now = Date.now();
    
    // Clean up local typing state
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
    
    // Redis typing keys auto-expire via TYPING_REDIS_TTL, no manual cleanup needed
  }, 5000);
};

// Stop typing cleanup (for graceful shutdown)
export const stopTypingCleanup = () => {
  if (typingCleanupInterval) {
    clearInterval(typingCleanupInterval);
    typingCleanupInterval = null;
  }
};

// Comment 5: Cleanup Redis connections on shutdown
export const cleanupRedisConnections = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (redisPubClient) {
    await redisPubClient.quit();
    redisPubClient = null;
  }
  if (redisSubClient) {
    await redisSubClient.quit();
    redisSubClient = null;
  }
  useRedisState = false;
};

// Start cleanup immediately
startTypingCleanup();

/**
 * Initialize Socket.io server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} Socket.io server instance
 */
export const initializeSocket = async (httpServer) => {
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

  // Comment 5: Set up Redis adapter for horizontal scaling
  // When REDIS_URL is configured, use Redis adapter for cross-instance communication
  if (process.env.REDIS_URL && createAdapter && Redis) {
    try {
      redisPubClient = new Redis(process.env.REDIS_URL);
      redisSubClient = redisPubClient.duplicate();
      redisClient = redisPubClient.duplicate();
      
      // Wait for connections
      await Promise.all([
        new Promise((resolve, reject) => {
          redisPubClient.on('connect', resolve);
          redisPubClient.on('error', reject);
        }),
        new Promise((resolve, reject) => {
          redisSubClient.on('connect', resolve);
          redisSubClient.on('error', reject);
        }),
      ]);
      
      io.adapter(createAdapter(redisPubClient, redisSubClient));
      useRedisState = true;
      console.log('Socket.IO: Redis adapter connected - horizontal scaling enabled');
      console.log('  Presence and typing state synced across instances via Redis');
    } catch (err) {
      console.error('Socket.IO: Failed to connect Redis adapter:', err.message);
      console.log('Socket.IO: Falling back to single-instance mode');
      useRedisState = false;
    }
  } else {
    console.log('Socket.IO: Running in single-instance mode (no REDIS_URL configured)');
    console.log('  For horizontal scaling, set REDIS_URL environment variable');
  }

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
    
    // Log connection for debug portal
    logSocketEvt('connection', { userId, socketId: socket.id });

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

        // Track online user (returns true if first connection)
        const isFirstConnection = await addUserPresence(groupId, userId);

        // Only broadcast user online status if this is their first connection
        // Comment 2: Prevents duplicate online broadcasts for multi-tab users
        if (isFirstConnection) {
          socket.to(`group:${groupId}`).emit('chat:userOnline', { userId, groupId });
        }

        // Send current online users to the joining user
        socket.emit('chat:onlineUsers', {
          groupId,
          users: await getGroupOnlineUsers(groupId),
        });
      } catch (error) {
        console.error('Join group error:', error);
        socket.emit('error', { message: 'Failed to join group' });
      }
    });

    socket.on('leave:group', async (groupId) => {
      socket.leave(`group:${groupId}`);
      // Comment 2: Only emit offline if this was the user's last connection
      const wentOffline = await removeUserPresence(groupId, userId);
      await removeUserTyping(groupId, userId);
      if (wentOffline) {
        socket.to(`group:${groupId}`).emit('chat:userOffline', { userId, groupId });
      }
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
          await setUserTyping(groupId, userId, userName || 'Someone');
        } else {
          await removeUserTyping(groupId, userId);
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

      // Comment 3: Rate limit check before any DB operations
      const withinLimit = checkRateLimit(userId, groupId);
      if (!withinLimit) {
        const { resetIn } = getRateLimitInfo(userId, groupId);
        if (typeof ackCallback === 'function') {
          ackCallback({ 
            success: false, 
            error: 'Rate limit exceeded. Please slow down.',
            retryAfter: Math.ceil(resetIn / 1000)
          });
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

    // Comment 2 & 5: Use 'disconnecting' instead of 'disconnect' so socket.rooms is still available
    // This ensures we can properly clean up presence and typing for all rooms
    socket.on('disconnecting', async () => {
      // Clean up online/typing status BEFORE rooms are cleared
      // socket.rooms is still populated at this point
      const socketRooms = Array.from(socket.rooms || []);
      for (const room of socketRooms) {
        if (room.startsWith('group:')) {
          const groupId = room.replace('group:', '');
          // Comment 2: Only emit offline if this was the user's last connection
          const wentOffline = await removeUserPresence(groupId, userId);
          await removeUserTyping(groupId, userId);
          if (wentOffline) {
            io.to(`group:${groupId}`).emit('chat:userOffline', { userId, groupId });
          }
          io.to(`group:${groupId}`).emit('chat:typing', {
            userId,
            isTyping: false,
            groupId,
          });
        }
      }
    });

    socket.on('disconnect', () => {
      // Log disconnect for debug portal
      logSocketEvt('disconnect', { userId, socketId: socket.id });
      
      // Decrement connection count (presence cleanup already done in disconnecting)
      const count = userConnections.get(userId) - 1;
      if (count <= 0) {
        userConnections.delete(userId);
      } else {
        userConnections.set(userId, count);
      }
    });
  });

  return io;
};

/**
 * Get online users for a group
 * Comment 1: Async to support Redis-backed presence
 */
export const getOnlineUsers = async (groupId) => {
  return await getGroupOnlineUsers(groupId);
};

/**
 * Check if a user is online in a group
 * Comment 1: Async to support Redis-backed presence
 */
export const isUserOnline = async (groupId, userId) => {
  const onlineUsersList = await getGroupOnlineUsers(groupId);
  return onlineUsersList.includes(userId);
};

/**
 * Get the Socket.io instance
 */
export const getSocketIO = () => ioInstance;
