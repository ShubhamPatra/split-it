/**
 * Group Authorization Middleware
 * 
 * Reusable middleware for verifying group membership with Redis caching.
 * Reduces redundant database queries across controllers.
 */

import Group from '../models/Group.js';
import redis from '../config/redis.js';

// Cache TTL for membership checks (5 minutes)
const MEMBERSHIP_CACHE_TTL = 300;

/**
 * Middleware to verify user is a member of the group
 * Caches membership status in Redis to reduce DB queries
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.groupIdParam - Request param name for group ID (default: 'groupId' or 'id')
 * @param {boolean} options.loadGroup - Whether to load full group document (default: false)
 * @param {string} options.select - Fields to select if loadGroup is true
 */
export const requireGroupMember = (options = {}) => {
  const { 
    groupIdParam = null,
    loadGroup = false,
    select = 'name members createdBy memberRoles'
  } = options;

  return async (req, res, next) => {
    try {
      // Get groupId from params - check multiple common param names
      const groupId = req.params[groupIdParam] || req.params.groupId || req.params.id;
      
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required' });
      }

      const userId = req.user._id.toString();
      const cacheKey = `membership:${groupId}:${userId}`;

      // Check Redis cache first
      let isMember = null;
      try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          isMember = cached === '1';
        }
      } catch (cacheError) {
        console.error('Redis cache error in groupAuth:', cacheError.message);
        // Continue without cache
      }

      // If not in cache, query database
      if (isMember === null) {
        const group = await Group.findById(groupId)
          .select('members')
          .lean();

        if (!group) {
          // Cache negative result with shorter TTL
          try {
            await redis.setex(cacheKey, 60, '0');
          } catch (e) { /* ignore cache errors */ }
          return res.status(404).json({ message: 'Group not found' });
        }

        isMember = group.members.some(m => m.toString() === userId);

        // Cache the membership result
        try {
          await redis.setex(cacheKey, MEMBERSHIP_CACHE_TTL, isMember ? '1' : '0');
        } catch (e) { /* ignore cache errors */ }
      }

      if (!isMember) {
        return res.status(403).json({ message: 'Not authorized to access this group' });
      }

      // Optionally load full group document
      if (loadGroup) {
        req.group = await Group.findById(groupId).select(select);
        if (!req.group) {
          return res.status(404).json({ message: 'Group not found' });
        }
      }

      // Store groupId on request for easy access
      req.groupId = groupId;
      next();
    } catch (error) {
      console.error('Group auth middleware error:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
};

/**
 * Middleware to verify user is an admin of the group
 */
export const requireGroupAdmin = (options = {}) => {
  const { groupIdParam = null } = options;

  return async (req, res, next) => {
    try {
      const groupId = req.params[groupIdParam] || req.params.groupId || req.params.id;
      
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required' });
      }

      const userId = req.user._id.toString();
      const cacheKey = `admin:${groupId}:${userId}`;

      // Check Redis cache first
      let isAdmin = null;
      try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          isAdmin = cached === '1';
        }
      } catch (cacheError) {
        // Continue without cache
      }

      if (isAdmin === null) {
        const group = await Group.findById(groupId)
          .select('members createdBy memberRoles')
          .lean();

        if (!group) {
          return res.status(404).json({ message: 'Group not found' });
        }

        // Check if user is a member first
        const isMember = group.members.some(m => m.toString() === userId);
        if (!isMember) {
          return res.status(403).json({ message: 'Not authorized' });
        }

        // Check admin status
        isAdmin = group.createdBy.toString() === userId ||
          (group.memberRoles && group.memberRoles.get?.(userId) === 'admin') ||
          (group.memberRoles && group.memberRoles[userId] === 'admin');

        // Cache the result
        try {
          await redis.setex(cacheKey, MEMBERSHIP_CACHE_TTL, isAdmin ? '1' : '0');
        } catch (e) { /* ignore */ }
      }

      if (!isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      req.groupId = groupId;
      req.isAdmin = true;
      next();
    } catch (error) {
      console.error('Group admin middleware error:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
};

/**
 * Invalidate membership cache for a group
 * Call this when members are added/removed
 */
export const invalidateMembershipCache = async (groupId, userId = null) => {
  try {
    if (userId) {
      await redis.del(`membership:${groupId}:${userId}`);
      await redis.del(`admin:${groupId}:${userId}`);
    } else {
      // Invalidate for all users - use pattern matching
      const memberKeys = await redis.keys(`membership:${groupId}:*`);
      const adminKeys = await redis.keys(`admin:${groupId}:*`);
      const allKeys = [...memberKeys, ...adminKeys];
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
      }
    }
  } catch (error) {
    console.error('Error invalidating membership cache:', error);
  }
};

/**
 * Invalidate group membership cache in socket.js when needed
 */
export const invalidateGroupMembershipCache = invalidateMembershipCache;

export default {
  requireGroupMember,
  requireGroupAdmin,
  invalidateMembershipCache,
};
