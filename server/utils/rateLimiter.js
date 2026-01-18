/**
 * Shared rate limiter utility for REST and WebSocket endpoints
 * Used by chatController.js and socket.js for consistent rate limiting
 */

// Rate limiting configuration
const MESSAGE_RATE_LIMIT = 100; // messages per minute per user per group
const RATE_LIMIT_WINDOW = 60; // seconds

// In-memory rate limit tracking
const rateLimitMap = new Map();

/**
 * Check rate limit for user in group
 * @param {string} userId - The user ID
 * @param {string} groupId - The group ID
 * @returns {boolean} true if within limit, false if exceeded
 */
export const checkRateLimit = (userId, groupId) => {
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
 * Get remaining rate limit for user in group
 * @param {string} userId - The user ID
 * @param {string} groupId - The group ID
 * @returns {object} { remaining: number, resetIn: number (ms) }
 */
export const getRateLimitInfo = (userId, groupId) => {
  const key = `${groupId}:${userId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW * 1000) {
    return { remaining: MESSAGE_RATE_LIMIT, resetIn: 0 };
  }

  const remaining = Math.max(0, MESSAGE_RATE_LIMIT - entry.count);
  const resetIn = Math.max(0, (entry.timestamp + RATE_LIMIT_WINDOW * 1000) - now);
  
  return { remaining, resetIn };
};

// Cleanup stale rate limit entries every 60 seconds
let cleanupInterval = null;

export const startRateLimitCleanup = () => {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.timestamp > RATE_LIMIT_WINDOW * 1000) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
};

export const stopRateLimitCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

// Start cleanup immediately on module load
startRateLimitCleanup();

// Export constants for consistency
export const RATE_LIMIT_CONFIG = {
  MESSAGE_RATE_LIMIT,
  RATE_LIMIT_WINDOW,
};
