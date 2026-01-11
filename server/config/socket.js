import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import redis, { isRedisAvailable } from './redis.js';

const isDev = process.env.NODE_ENV !== 'production';

// Redis keys for presence and typing state (shared across nodes)
const PRESENCE_KEY_PREFIX = 'socket:presence:';
const TYPING_KEY_PREFIX = 'socket:typing:';
const GROUP_MEMBERS_PREFIX = 'group:members:';
const PRESENCE_TTL = 120; // 2 minutes TTL for presence
const TYPING_TTL = 10; // 10 seconds TTL for typing indicators
const GROUP_MEMBERS_TTL = 300; // 5 minutes TTL for group membership cache

// In-memory fallback for when Redis is not available
const memoryPresence = new Map(); // groupId -> Set of userIds
const memoryTyping = new Map(); // groupId -> Map of userId -> data
const memoryGroupCache = new Map(); // groupId -> membership data

// Helper functions for Redis-based presence management
const getPresenceKey = (groupId) => `${PRESENCE_KEY_PREFIX}${groupId}`;
const getTypingKey = (groupId) => `${TYPING_KEY_PREFIX}${groupId}`;
const getGroupMembersKey = (groupId) => `${GROUP_MEMBERS_PREFIX}${groupId}`;

// Safe Redis operation wrapper
const safeRedisOp = async (operation, fallback = null) => {
  if (!isRedisAvailable() || !redis) {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
  try {
    return await operation();
  } catch (error) {
    if (isDev) {
      // Silently fall back in dev
      return typeof fallback === 'function' ? fallback() : fallback;
    }
    throw error;
  }
};

// Get or cache group membership for fast authorization checks
const getGroupMembership = async (groupId) => {
  // Try Redis cache first
  const cached = await safeRedisOp(async () => {
    const cacheKey = getGroupMembersKey(groupId);
    const data = await redis.get(cacheKey);
    return data ? JSON.parse(data) : null;
  }, () => memoryGroupCache.get(groupId));
  
  if (cached) return cached;
  
  // Fetch from DB with lean projection (only member IDs)
  const Group = (await import('../models/Group.js')).default;
  const group = await Group.findById(groupId).select('name members').lean();
  
  if (!group) return null;
  
  const memberIds = group.members.map(m => m.toString());
  const membership = { name: group.name, memberIds };
  
  // Cache in Redis or memory
  await safeRedisOp(async () => {
    const cacheKey = getGroupMembersKey(groupId);
    await redis.setex(cacheKey, GROUP_MEMBERS_TTL, JSON.stringify(membership));
  }, () => {
    memoryGroupCache.set(groupId, membership);
    // Auto-expire memory cache
    setTimeout(() => memoryGroupCache.delete(groupId), GROUP_MEMBERS_TTL * 1000);
  });
  
  return membership;
};

// Invalidate group membership cache (call when members change)
const invalidateGroupMembershipCache = async (groupId) => {
  await safeRedisOp(
    () => redis.del(getGroupMembersKey(groupId)),
    () => memoryGroupCache.delete(groupId)
  );
};

// Add user to group presence
const addUserPresence = async (groupId, userId) => {
  await safeRedisOp(async () => {
    const key = getPresenceKey(groupId);
    await redis.sadd(key, userId);
    await redis.expire(key, PRESENCE_TTL);
  }, () => {
    if (!memoryPresence.has(groupId)) {
      memoryPresence.set(groupId, new Set());
    }
    memoryPresence.get(groupId).add(userId);
  });
};

// Remove user from group presence
const removeUserPresence = async (groupId, userId) => {
  await safeRedisOp(
    () => redis.srem(getPresenceKey(groupId), userId),
    () => memoryPresence.get(groupId)?.delete(userId)
  );
};

// Get all online users for a group
const getGroupOnlineUsersFromRedis = async (groupId) => {
  return await safeRedisOp(
    () => redis.smembers(getPresenceKey(groupId)),
    () => Array.from(memoryPresence.get(groupId) || [])
  );
};

// Set user typing status
const setUserTyping = async (groupId, userId, userName) => {
  await safeRedisOp(async () => {
    const key = getTypingKey(groupId);
    await redis.hset(key, userId, JSON.stringify({ userName, timestamp: Date.now() }));
    await redis.expire(key, TYPING_TTL);
  }, () => {
    if (!memoryTyping.has(groupId)) {
      memoryTyping.set(groupId, new Map());
    }
    memoryTyping.get(groupId).set(userId, { userName, timestamp: Date.now() });
  });
};

// Remove user typing status
const removeUserTyping = async (groupId, userId) => {
  await safeRedisOp(
    () => redis.hdel(getTypingKey(groupId), userId),
    () => memoryTyping.get(groupId)?.delete(userId)
  );
};

// Cleanup stale typing indicators every 5 seconds
let typingCleanupInterval = null;

const startTypingCleanup = () => {
  if (typingCleanupInterval) return;
  
  typingCleanupInterval = setInterval(async () => {
    try {
      const now = Date.now();
      
      if (isRedisAvailable() && redis) {
        // Redis-based cleanup
        const keys = await redis.keys(`${TYPING_KEY_PREFIX}*`);
        for (const key of keys) {
          const typingData = await redis.hgetall(key);
          for (const [userId, dataStr] of Object.entries(typingData)) {
            try {
              const data = JSON.parse(dataStr);
              if (now - data.timestamp > 5000) {
                await redis.hdel(key, userId);
              }
            } catch (e) {
              await redis.hdel(key, userId);
            }
          }
        }
      } else {
        // Memory-based cleanup
        for (const [groupId, users] of memoryTyping) {
          for (const [userId, data] of users) {
            if (now - data.timestamp > 5000) {
              users.delete(userId);
            }
          }
          if (users.size === 0) {
            memoryTyping.delete(groupId);
          }
        }
      }
    } catch (error) {
      // Suppress errors in dev when Redis isn't available
      if (!isDev || isRedisAvailable()) {
        console.error('Typing cleanup error:', error);
      }
    }
  }, 5000);
};

// Start cleanup immediately
startTypingCleanup();

// Store io instance for exports
let ioInstance = null;

// Create Redis adapter - exported for server.js to call before handlers
export const createRedisAdapter = () => {
  if (!isRedisAvailable()) {
    console.log('Socket.IO: Redis not available, running without adapter (single-node mode)');
    return null;
  }
  
  try {
    // Create dedicated pub/sub clients for the adapter
    const pubClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    
    const subClient = pubClient.duplicate();
    
    return { pubClient, subClient, adapter: createAdapter(pubClient, subClient) };
  } catch (error) {
    console.warn('Socket.IO: Failed to create Redis adapter:', error.message);
    return null;
  }
};

export const initializeSocket = (httpServer, redisAdapter = null) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,  // 1MB
    transports: ['websocket'],  // Disable long polling
    perMessageDeflate: false,
  });

  // Attach Redis adapter for horizontal scaling if provided
  if (redisAdapter) {
    io.adapter(redisAdapter);
    console.log('Socket.IO: Redis adapter attached for horizontal scaling');
  }

  // Store io instance for exports
  ioInstance = io;

  // Authentication middleware - use cookie-based auth
  io.use(async (socket, next) => {
    try {
      // Parse cookies from handshake headers
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies.auth_token;
      
      if (!token) return next(new Error('Authentication error'));
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
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
        // Load Group model dynamically
        const Group = (await import('../models/Group.js')).default;
        const group = await Group.findById(groupId).lean();
        
        if (!group) {
          socket.emit('error', { message: 'Group not found' });
          return;
        }
        
        // Check if user is a member
        const isMember = group.members.some(m => m.toString() === userId);
        if (!isMember) {
          socket.emit('error', { message: 'Not authorized to join this group' });
          return;
        }
        
        socket.join(`group:${groupId}`);
        
        // Track online user for chat presence in Redis (cross-node)
        await addUserPresence(groupId, userId);
        
        // Broadcast user online status to group (propagates via Redis adapter)
        socket.to(`group:${groupId}`).emit('chat:userOnline', { userId, groupId });
        
        // Send current online users to the joining user (from Redis)
        const onlineUsers = await getGroupOnlineUsersFromRedis(groupId);
        socket.emit('chat:onlineUsers', {
          groupId,
          users: onlineUsers,
        });
      } catch (error) {
        console.error('Join group error:', error);
        socket.emit('error', { message: 'Failed to join group' });
      }
    });

    socket.on('leave:group', async (groupId) => {
      socket.leave(`group:${groupId}`);
      
      // Remove from online users in Redis
      await removeUserPresence(groupId, userId);
      
      // Remove from typing users in Redis
      await removeUserTyping(groupId, userId);
      
      // Broadcast user offline status (propagates via Redis adapter)
      socket.to(`group:${groupId}`).emit('chat:userOffline', { userId, groupId });
    });

    // Chat typing indicator
    socket.on('chat:typing', async (data) => {
      const { groupId, isTyping, userName } = data;
      
      if (!groupId) return;
      
      try {
        // Verify user is a member of the group
        const Group = (await import('../models/Group.js')).default;
        const group = await Group.findById(groupId).lean();
        
        if (!group || !group.members.some(m => m.toString() === userId)) {
          return;
        }
        
        // Update typing status in Redis (cross-node)
        if (isTyping) {
          await setUserTyping(groupId, userId, userName || 'Someone');
        } else {
          await removeUserTyping(groupId, userId);
        }
        
        // Broadcast to group (except sender) - propagates via Redis adapter
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

    // Chat message read receipts via socket (alternative to REST)
    socket.on('chat:markRead', async (data) => {
      const { groupId, messageIds } = data;
      
      if (!groupId || !Array.isArray(messageIds) || messageIds.length === 0) return;
      
      try {
        // Verify user is a member
        const Group = (await import('../models/Group.js')).default;
        const group = await Group.findById(groupId).lean();
        
        if (!group || !group.members.some(m => m.toString() === userId)) {
          return;
        }
        
        // Update messages in database
        const Message = (await import('../models/Message.js')).default;
        await Message.updateMany(
          {
            _id: { $in: messageIds.slice(0, 50) }, // Limit to 50
            groupId,
            readBy: { $ne: userId },
          },
          {
            $addToSet: { readBy: userId },
          }
        );
        
        // Broadcast read receipts to group
        io.to(`group:${groupId}`).emit('chat:read', {
          userId,
          messageIds: messageIds.slice(0, 50),
          groupId,
        });
      } catch (error) {
        console.error('Chat mark read error:', error);
      }
    });

    // Chat message send via socket with delivery confirmation
    // Security: Only 'text' type messages allowed; metadata is ignored
    // Optimized: Uses cached group membership, Redis pipeline, bulk notifications
    socket.on('chat:send', async (data, ackCallback) => {
      const { groupId, content, tempId } = data;
      
      // Validate required fields
      if (!groupId || !content || typeof content !== 'string') {
        if (typeof ackCallback === 'function') {
          ackCallback({ success: false, error: 'Invalid message data' });
        }
        return;
      }
      
      try {
        // Load models dynamically (these are cached by Node.js module system)
        const Message = (await import('../models/Message.js')).default;
        const { notificationQueue } = await import('./queue.js');
        
        // Use cached group membership for fast authorization
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
        
        // Sanitize content - strip dangerous HTML/script content
        const sanitizedContent = content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/<[^>]*>/g, '')
          .trim();
        
        // Validate sanitized content
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
        
        // Check for excessive newlines
        const newlineCount = (sanitizedContent.match(/\n/g) || []).length;
        if (newlineCount > 20) {
          if (typeof ackCallback === 'function') {
            ackCallback({ success: false, error: 'Message contains too many newlines' });
          }
          return;
        }
        
        // Rate limiting using Redis (with in-memory fallback)
        const rateLimitKey = `chat:ratelimit:${groupId}:${userId}`;
        const rateLimited = await safeRedisOp(async () => {
          const count = await redis.incr(rateLimitKey);
          if (count === 1) {
            await redis.expire(rateLimitKey, 60); // 60 second window
          }
          return count > 30; // 30 messages per minute per user per group
        }, () => false); // Skip rate limiting if Redis unavailable
        
        if (rateLimited) {
          if (typeof ackCallback === 'function') {
            ackCallback({ success: false, error: 'Rate limit exceeded. Please slow down.' });
          }
          return;
        }
        
        // Create message - always 'text' type for client messages
        const message = await Message.create({
          groupId,
          senderId: userId,
          content: sanitizedContent,
          type: 'text',
          readBy: [userId],
        });
        
        // Populate sender info for response
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name email')
          .lean();
        
        // Send ack to sender FIRST (keep hot path free of serial awaits)
        if (typeof ackCallback === 'function') {
          ackCallback({ success: true, tempId, message: populatedMessage });
        }
        
        // Broadcast to all group members (including sender for other tabs/devices)
        io.to(`group:${groupId}`).emit('chat:new', populatedMessage);
        
        // --- Background tasks (non-blocking) ---
        // Use setImmediate to defer non-critical operations
        setImmediate(async () => {
          try {
            const senderName = populatedMessage.senderId?.name || 'Someone';
            const otherMemberIds = membership.memberIds.filter(id => id !== userId);
            
            // Use Redis pipeline for batch cache invalidation (if available)
            await safeRedisOp(async () => {
              const pipeline = redis.pipeline();
              pipeline.del(`chat:${groupId}:latest`);
              for (const memberId of otherMemberIds) {
                pipeline.del(`chat:${groupId}:unread:${memberId}`);
              }
              await pipeline.exec();
            });
            
            // Use addBulk for parallel notification enqueueing
            if (otherMemberIds.length > 0) {
              const notificationJobs = otherMemberIds.map(memberId => ({
                data: {
                  userId: memberId,
                  type: 'info',
                  title: `New message in ${membership.name}`,
                  message: `${senderName}: ${sanitizedContent.substring(0, 50)}${sanitizedContent.length > 50 ? '...' : ''}`,
                  data: {
                    groupId,
                    messageId: message._id.toString(),
                    actionType: 'chat_message',
                  },
                },
              }));
              
              await notificationQueue.addBulk(notificationJobs);
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

    socket.on('disconnect', async () => {
      const count = userConnections.get(userId) - 1;
      if (count <= 0) {
        userConnections.delete(userId);
      } else {
        userConnections.set(userId, count);
      }
      
      // Clean up online/typing status from all groups user was in
      // Get groups from socket rooms (rooms starting with 'group:')
      const socketRooms = Array.from(socket.rooms || []);
      for (const room of socketRooms) {
        if (room.startsWith('group:')) {
          const groupId = room.replace('group:', '');
          
          // Remove from presence in Redis
          await removeUserPresence(groupId, userId);
          
          // Remove from typing in Redis
          await removeUserTyping(groupId, userId);
          
          // Broadcast offline status (propagates via Redis adapter)
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

// Export helpers for getting online users (now async since they use Redis)
export const getOnlineUsers = async (groupId) => {
  return await getGroupOnlineUsersFromRedis(groupId);
};

export const isUserOnline = async (groupId, userId) => {
  const onlineUsers = await getGroupOnlineUsersFromRedis(groupId);
  return onlineUsers.includes(userId);
};
