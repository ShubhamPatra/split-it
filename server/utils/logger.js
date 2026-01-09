/**
 * Production-safe logger utility for server
 * 
 * Logs are suppressed in production to avoid exposing sensitive info
 * and to prevent performance overhead in log aggregation systems.
 */

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  error: (...args) => {
    // Always log errors in production (they're important)
    console.error(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  // Request logging (for development)
  request: (req, message) => {
    if (isDev) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${message}`);
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
