/**
 * Production-safe logger utility
 * 
 * Logs are suppressed in production to avoid exposing sensitive info
 * and to prevent performance overhead.
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  error: (...args) => {
    // Always log errors, but you could filter sensitive data here
    console.error(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  // Group logging for better organization
  group: (label) => {
    if (isDev) console.group(label);
  },
  groupEnd: () => {
    if (isDev) console.groupEnd();
  },
  // Time measurements
  time: (label) => {
    if (isDev) console.time(label);
  },
  timeEnd: (label) => {
    if (isDev) console.timeEnd(label);
  },
};

export default logger;
