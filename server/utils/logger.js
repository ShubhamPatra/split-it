/**
 * Production-safe logger utility for server
 * 
 * Logs are suppressed in production to avoid exposing sensitive info
 * and to prevent performance overhead in log aggregation systems.
 * 
 * All log outputs are automatically sanitized to remove PII.
 */

import sanitizer from './logSanitizer.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Sanitize arguments before logging
 * @param {Array} args - Arguments to sanitize
 * @returns {Array} Sanitized arguments
 */
const sanitizeArgs = (args) => {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return sanitizer.sanitize(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      return sanitizer.sanitizeObject(arg);
    }
    return arg;
  });
};

const logger = {
  log: (...args) => {
    if (isDev) console.log(...sanitizeArgs(args));
  },
  warn: (...args) => {
    if (isDev) console.warn(...sanitizeArgs(args));
  },
  error: (...args) => {
    // Always log errors in production (they're important)
    console.error(...sanitizeArgs(args));
  },
  debug: (...args) => {
    if (isDev) console.debug(...sanitizeArgs(args));
  },
  info: (...args) => {
    if (isDev) console.info(...sanitizeArgs(args));
  },
  // Request logging (for development)
  request: (req, message) => {
    if (isDev) {
      const sanitizedMessage = sanitizer.sanitize(message);
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${sanitizedMessage}`);
    }
  },
  // Performance timing
  time: (label) => {
    if (isDev) console.time(label);
  },
  timeEnd: (label) => {
    if (isDev) console.timeEnd(label);
  },
};

export default logger;
