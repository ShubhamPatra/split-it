// Security middleware for rate limiting and request sanitization
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis.js';

// Rate limiting middleware with Redis
export const rateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: options.message || 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // Use sendCommand for ioredis compatibility (rate-limit-redis v4+)
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rl:',
    }),
    skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '::1',
  });
};

export const authRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many login attempts',
});

export const inviteJoinRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many join attempts. Please try again later.',
});

export const inviteValidateRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many validation attempts. Please try again later.',
});

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
