/**
 * Structured Logger for Split-It
 * 
 * Provides structured logging with:
 * - JSON format for production (machine-readable)
 * - Pretty format for development (human-readable)
 * - Request ID tracking
 * - User ID tracking
 * - Performance timing
 * - Log levels (error, warn, info, http, debug)
 * - Automatic metadata enrichment
 * - PII sanitization for all log outputs
 * 
 * Uses Winston for production-grade logging
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import sanitizer from './logSanitizer.js';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Determine environment
const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log colors for development
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Custom format for development (pretty, colorized)
const developmentFormat = printf(({ level, message, timestamp, requestId, userId, duration, ...metadata }) => {
  let msg = `${timestamp} [${level}]`;
  
  if (requestId) msg += ` [req:${requestId.substring(0, 8)}]`;
  if (userId) msg += ` [user:${userId.substring(0, 8)}]`;
  if (duration !== undefined) msg += ` [${duration}ms]`;
  
  msg += `: ${message}`;
  
  // Add metadata if present
  const metaKeys = Object.keys(metadata);
  if (metaKeys.length > 0) {
    msg += ` ${JSON.stringify(metadata, null, 2)}`;
  }
  
  return msg;
});

// Custom format for production (JSON, structured)
const productionFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json()
);

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  levels,
  format: isDevelopment
    ? combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        developmentFormat
      )
    : productionFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      silent: isTest, // Suppress logs in test environment
    }),
    // File transports for production
    ...(isDevelopment ? [] : [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
    ]),
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false,
});

/**
 * Structured Logger Class
 * Provides context-aware logging with automatic metadata enrichment
 */
class StructuredLogger {
  constructor() {
    this.logger = winstonLogger;
  }

  /**
   * Create a child logger with context
   * @param {Object} context - Context to add to all logs (requestId, userId, etc.)
   * @returns {StructuredLogger} Child logger with context
   */
  child(context = {}) {
    const childLogger = new StructuredLogger();
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  /**
   * Log with level and metadata
   * Automatically sanitizes PII from messages and metadata
   * @private
   */
  _log(level, message, meta = {}) {
    // Sanitize message
    const sanitizedMessage = sanitizer.sanitize(message);
    
    // Sanitize metadata (context + meta)
    const combinedMeta = {
      ...this.context,
      ...meta,
    };
    const sanitizedMeta = sanitizer.sanitizeObject(combinedMeta);
    
    const logData = {
      message: sanitizedMessage,
      ...sanitizedMeta,
    };
    
    this.logger.log(level, logData);
  }

  /**
   * Error level logging
   * Sanitizes error messages and stack traces
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or metadata
   */
  error(message, error = {}) {
    const meta = error instanceof Error
      ? { 
          error: sanitizer.sanitize(error.message), 
          stack: sanitizer.sanitizeStackTrace(error.stack || ''),
          ...error 
        }
      : error;
    
    this._log('error', message, meta);
  }

  /**
   * Warning level logging
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  /**
   * Info level logging
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  /**
   * HTTP level logging (for request/response)
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  http(message, meta = {}) {
    this._log('http', message, meta);
  }

  /**
   * Debug level logging
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  /**
   * Log request start
   * @param {Object} req - Express request object
   * @returns {string} Request ID
   */
  logRequest(req) {
    const requestId = req.id || uuidv4();
    req.id = requestId;
    req.startTime = Date.now();
    
    this.http('Request started', {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: req.user?._id?.toString(),
    });
    
    return requestId;
  }

  /**
   * Log request completion
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  logResponse(req, res) {
    const duration = Date.now() - (req.startTime || Date.now());
    
    this.http('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?._id?.toString(),
    });
  }

  /**
   * Log database query
   * @param {string} operation - Database operation (find, create, update, delete)
   * @param {string} collection - Collection name
   * @param {Object} meta - Additional metadata
   */
  logQuery(operation, collection, meta = {}) {
    this.debug('Database query', {
      operation,
      collection,
      ...meta,
    });
  }

  /**
   * Log performance timing
   * @param {string} label - Timer label
   * @param {number} duration - Duration in milliseconds
   * @param {Object} meta - Additional metadata
   */
  logTiming(label, duration, meta = {}) {
    this.debug('Performance timing', {
      label,
      duration,
      ...meta,
    });
  }

  /**
   * Log authentication event
   * @param {string} event - Auth event (login, logout, register, etc.)
   * @param {string} userId - User ID
   * @param {boolean} success - Whether the event was successful
   * @param {Object} meta - Additional metadata
   */
  logAuth(event, userId, success, meta = {}) {
    const level = success ? 'info' : 'warn';
    this._log(level, `Auth: ${event}`, {
      event,
      userId,
      success,
      ...meta,
    });
  }

  /**
   * Log security event
   * @param {string} event - Security event
   * @param {Object} meta - Additional metadata
   */
  logSecurity(event, meta = {}) {
    this.warn(`Security: ${event}`, meta);
  }

  /**
   * Log business event
   * @param {string} event - Business event (expense_created, settlement_confirmed, etc.)
   * @param {Object} meta - Additional metadata
   */
  logEvent(event, meta = {}) {
    this.info(`Event: ${event}`, meta);
  }
}

// Create default logger instance
const logger = new StructuredLogger();

/**
 * Express middleware for request logging
 * Adds request ID and logs request/response
 * Excludes sensitive headers (authorization, cookie) and sensitive body fields
 */
export const requestLoggingMiddleware = (req, res, next) => {
  // Generate request ID
  const requestId = uuidv4();
  req.id = requestId;
  req.startTime = Date.now();
  
  // Create request-scoped logger
  req.logger = logger.child({ requestId });
  
  // Sanitize request data - exclude sensitive headers
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders.cookie;
  delete sanitizedHeaders['x-api-key'];
  
  // Log request (body is not logged to avoid PII exposure)
  req.logger.http('Request started', {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    // Headers are sanitized by sanitizeObject in _log method
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    
    req.logger.http('Request completed', {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?._id?.toString(),
    });
  });
  
  next();
};

/**
 * Express middleware to add user ID to logger context
 * Should be used after authentication middleware
 */
export const userContextMiddleware = (req, res, next) => {
  if (req.user && req.logger) {
    req.logger = req.logger.child({ userId: req.user._id.toString() });
  }
  next();
};

/**
 * Performance timer utility
 * @param {string} label - Timer label
 * @returns {Function} Function to end timer and log duration
 */
export const timer = (label) => {
  const start = Date.now();
  return (meta = {}) => {
    const duration = Date.now() - start;
    logger.logTiming(label, duration, meta);
    return duration;
  };
};

/**
 * Async function wrapper with error logging
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function
 */
export const withErrorLogging = (fn, context) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in ${context}`, error);
      throw error;
    }
  };
};

export default logger;
