// Security middleware for rate limiting and request sanitization
import rateLimit from 'express-rate-limit';

// Check if request is from localhost (handles both IPv4 and IPv6)
const isLocalhost = (ip) => {
  return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip?.includes('localhost');
};

/**
 * Rate limiting middleware using in-memory store.
 * Simple and reliable for single-instance deployments.
 */
export const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const windowSeconds = Math.ceil(windowMs / 1000);

  // Capture caller-provided skip function to merge with default localhost bypass
  const userSkip = options.skip;

  return rateLimit({
    windowMs,
    max: options.max || 100,
    message: options.message || 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for localhost in development
    skip: (req) => {
      // Skip if in development and from localhost
      if (process.env.NODE_ENV === 'development' && isLocalhost(req.ip)) {
        return true;
      }
      // Also skip if caller-provided skip function returns true
      if (userSkip && userSkip(req)) {
        return true;
      }
      return false;
    },
    handler: (req, res, next, opts) => {
      // Add Retry-After header with window duration in seconds
      res.setHeader('Retry-After', String(windowSeconds));
      res.status(429).json({
        message: opts.message || `Too many requests. Please wait ${windowSeconds} seconds.`,
        retryAfter: windowSeconds,
      });
    },
  });
};

// Pre-configured rate limiters for specific routes
export const authRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many login attempts. Please try again in a few minutes.',
});

export const inviteJoinRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many join attempts. Please try again later.',
});

export const inviteValidateRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
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
