/**
 * Debug Portal Security Middleware
 * 
 * Multi-layer security for the debug portal:
 * - Email & Password authentication via headers
 * - Rate limiting
 * - Brute force protection
 * - Access logging
 */

import { logAccess } from './accessLogger.js';
import { rateLimiter } from '../../middleware/security.js';

// Brute force protection state
const failedAttempts = new Map(); // IP -> { count, lastAttempt, blockedUntil }
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Check if an IP is currently blocked
 * @param {string} ip - IP address
 * @returns {Object} Block status
 */
const checkBruteForce = (ip) => {
  const record = failedAttempts.get(ip);
  
  if (!record) {
    return { blocked: false };
  }

  // Check if block has expired
  if (record.blockedUntil && Date.now() < record.blockedUntil) {
    return {
      blocked: true,
      remainingTime: Math.ceil((record.blockedUntil - Date.now()) / 1000),
    };
  }

  // Reset if block expired
  if (record.blockedUntil && Date.now() >= record.blockedUntil) {
    failedAttempts.delete(ip);
    return { blocked: false };
  }

  return { blocked: false };
};

/**
 * Record a failed authentication attempt
 * @param {string} ip - IP address
 */
const recordFailedAttempt = (ip) => {
  const record = failedAttempts.get(ip) || { count: 0, lastAttempt: 0, blockedUntil: null };
  
  record.count += 1;
  record.lastAttempt = Date.now();

  // Block if too many failures
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = Date.now() + BLOCK_DURATION;
    console.warn(`[Debug Portal] IP ${ip} blocked for ${BLOCK_DURATION / 60000} minutes after ${record.count} failed attempts`);
  }

  failedAttempts.set(ip, record);
};

/**
 * Clear failed attempts for an IP (on successful auth)
 * @param {string} ip - IP address
 */
const clearFailedAttempts = (ip) => {
  failedAttempts.delete(ip);
};

/**
 * Validate email and password credentials
 */
export const validateCredentials = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  // Check if debug portal is enabled
  if (process.env.DEBUG_ENABLED !== 'true') {
    return res.status(404).json({ message: 'Not found' });
  }

  // Check brute force protection
  const bruteForceCheck = checkBruteForce(ip);
  if (bruteForceCheck.blocked) {
    logAccess({
      ip,
      userAgent,
      action: 'authenticate',
      success: false,
      reason: `IP blocked (${bruteForceCheck.remainingTime}s remaining)`,
      path: req.path,
      method: req.method,
    });

    return res.status(429).json({
      message: 'Too many failed attempts. Please try again later.',
      retryAfter: bruteForceCheck.remainingTime,
    });
  }

  // Get credentials from headers
  const debugEmail = req.get('X-Debug-Email');
  const debugPassword = req.get('X-Debug-Password');

  // Get expected credentials from environment
  const expectedEmail = process.env.DEBUG_EMAIL;
  const expectedPassword = process.env.DEBUG_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    logAccess({
      ip,
      userAgent,
      action: 'authenticate',
      success: false,
      reason: 'Debug credentials not configured on server',
      path: req.path,
      method: req.method,
    });

    return res.status(500).json({ 
      message: 'Debug portal not properly configured' 
    });
  }

  // Validate email
  if (!debugEmail || debugEmail !== expectedEmail) {
    recordFailedAttempt(ip);
    logAccess({
      ip,
      userAgent,
      action: 'authenticate',
      success: false,
      reason: 'Invalid email',
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({ message: 'Access denied' });
  }

  // Validate password (constant-time comparison to prevent timing attacks)
  if (!debugPassword || !constantTimeCompare(debugPassword, expectedPassword)) {
    recordFailedAttempt(ip);
    logAccess({
      ip,
      userAgent,
      action: 'authenticate',
      success: false,
      reason: 'Invalid password',
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({ message: 'Access denied' });
  }

  // Clear failed attempts on successful auth
  clearFailedAttempts(ip);

  // Store auth info for logging
  req.debugAuth = {
    ip,
    userAgent,
    authenticatedAt: new Date().toISOString(),
  };

  next();
};

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings match
 */
const constantTimeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Ensure same length comparison (pad shorter string)
  const maxLen = Math.max(a.length, b.length);
  const aPadded = a.padEnd(maxLen, '\0');
  const bPadded = b.padEnd(maxLen, '\0');

  let result = 0;
  for (let i = 0; i < maxLen; i++) {
    result |= aPadded.charCodeAt(i) ^ bPadded.charCodeAt(i);
  }

  return result === 0 && a.length === b.length;
};

/**
 * Debug-specific rate limiter (10 requests per 5 minutes)
 * Includes custom handler to log rate-limited access attempts
 */
export const debugRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: 'Debug portal rate limit exceeded. Please wait before making more requests.',
  skip: () => false, // Never skip rate limiting for debug portal
  handler: (req, res) => {
    // Log rate-limited access attempt
    const ip = req.debugAuth?.ip || req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.debugAuth?.userAgent || req.get('user-agent') || 'unknown';
    
    logAccess({
      ip,
      userAgent,
      action: 'api_request',
      success: false,
      reason: 'rate_limited',
      path: req.path,
      method: req.method,
    });

    res.status(429).json({
      message: 'Debug portal rate limit exceeded. Please wait before making more requests.',
    });
  },
});

/**
 * Log access middleware (runs after successful auth)
 */
export const logAccessMiddleware = (req, res, next) => {
  const ip = req.debugAuth?.ip || req.ip || 'unknown';
  const userAgent = req.debugAuth?.userAgent || req.get('user-agent') || 'unknown';

  // Log successful access
  logAccess({
    ip,
    userAgent,
    action: req.path.replace(/^\//, '').replace(/\//g, '_') || 'root',
    success: true,
    path: req.path,
    method: req.method,
  });

  next();
};

/**
 * Get brute force protection status (for debugging)
 * @returns {Object} Current brute force state
 */
export const getBruteForceStatus = () => {
  const status = {};
  for (const [ip, record] of failedAttempts) {
    status[ip] = {
      failedAttempts: record.count,
      lastAttempt: new Date(record.lastAttempt).toISOString(),
      blocked: record.blockedUntil ? Date.now() < record.blockedUntil : false,
      blockedUntil: record.blockedUntil ? new Date(record.blockedUntil).toISOString() : null,
    };
  }
  return status;
};

/**
 * Clear brute force state (for testing)
 */
export const clearBruteForceState = () => {
  failedAttempts.clear();
};

export default {
  validateCredentials,
  debugRateLimiter,
  logAccessMiddleware,
  getBruteForceStatus,
  clearBruteForceState,
};
