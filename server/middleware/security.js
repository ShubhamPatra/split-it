// Security middleware for rate limiting and request sanitization
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis, { isRedisAvailable } from '../config/redis.js';

// Check if request is from localhost (handles both IPv4 and IPv6)
const isLocalhost = (ip) => {
  return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip?.includes('localhost');
};

/**
 * Check if Redis is ready for use with rate limiting.
 * Returns true if Redis client exists and is in 'ready' status.
 */
const isRedisReady = () => {
  return redis && redis.status === 'ready';
};

/**
 * Create a rate limit store based on Redis availability.
 * Falls back to in-memory store if Redis is not ready.
 */
const createRateLimitStore = () => {
  if (isRedisReady()) {
    return new RedisStore({
      // Use sendCommand for ioredis compatibility (rate-limit-redis v4+)
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rl:',
    });
  }
  
  // Fall back to in-memory store (express-rate-limit default)
  console.warn('Rate limiter: Redis not ready, using in-memory store');
  return undefined;
};

// Rate limiting middleware with Redis (falls back to in-memory if Redis unavailable)
export const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const windowSeconds = Math.ceil(windowMs / 1000);
  
  // Determine store at middleware creation time
  const store = createRateLimitStore();
  
  return rateLimit({
    windowMs,
    max: options.max || 100,
    message: options.message || 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
    ...(store && { store }), // Only set store if Redis is available
    skip: (req) => process.env.NODE_ENV === 'development' && isLocalhost(req.ip),
    handler: (req, res, next, options) => {
      // Add Retry-After header with window duration in seconds
      res.setHeader('Retry-After', String(windowSeconds));
      res.status(429).json({
        message: options.message || `Too many requests. Please wait ${windowSeconds} seconds.`,
        retryAfter: windowSeconds,
      });
    },
  });
};

/**
 * Wait for Redis to be ready before creating rate limiter with Redis store.
 * Use this for deferred rate limiter initialization in server startup.
 * @param {number} timeoutMs - Maximum time to wait for Redis (default: 5000ms)
 * @returns {Promise<boolean>} - True if Redis is ready, false otherwise
 */
export const waitForRedis = async (timeoutMs = 5000) => {
  if (!redis) return false;
  if (redis.status === 'ready') return true;
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('Rate limiter: Timeout waiting for Redis, using in-memory store');
      resolve(false);
    }, timeoutMs);
    
    const onReady = () => {
      clearTimeout(timeout);
      redis.off('ready', onReady);
      redis.off('error', onError);
      resolve(true);
    };
    
    const onError = () => {
      clearTimeout(timeout);
      redis.off('ready', onReady);
      redis.off('error', onError);
      resolve(false);
    };
    
    redis.once('ready', onReady);
    redis.once('error', onError);
  });
};

// Create rate limiters lazily to allow Redis to connect first
// These will be initialized with proper Redis store if Redis is ready at creation time
let _authRateLimit = null;
let _inviteJoinRateLimit = null;
let _inviteValidateRateLimit = null;

export const authRateLimit = (req, res, next) => {
  if (!_authRateLimit) {
    _authRateLimit = rateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many login attempts. Please try again in a few minutes.',
    });
  }
  return _authRateLimit(req, res, next);
};

export const inviteJoinRateLimit = (req, res, next) => {
  if (!_inviteJoinRateLimit) {
    _inviteJoinRateLimit = rateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: 'Too many join attempts. Please try again later.',
    });
  }
  return _inviteJoinRateLimit(req, res, next);
};

export const inviteValidateRateLimit = (req, res, next) => {
  if (!_inviteValidateRateLimit) {
    _inviteValidateRateLimit = rateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: 'Too many validation attempts. Please try again later.',
    });
  }
  return _inviteValidateRateLimit(req, res, next);
};

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs to prevent XSS
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        obj[key] = sanitize(obj[key]);
      });
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (for HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

const securityMiddleware = {
  rateLimiter,
  authRateLimit,
  inviteJoinRateLimit,
  inviteValidateRateLimit,
  sanitizeInput,
  securityHeaders,
};

export default securityMiddleware;
