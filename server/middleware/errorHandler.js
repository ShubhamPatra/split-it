/**
 * Error Handler Middleware
 * 
 * Provides secure error handling with sanitization to prevent information leakage.
 * Implements Requirements 1.1, 1.3, 1.4, 1.5 from code-quality-security-fixes spec.
 */

import sanitizer from '../utils/logSanitizer.js';

/**
 * Error Code Registry
 * Maps internal error types to standardized error codes
 */
const ERROR_CODES = {
  AUTH_FAILED: 'AUTH_FAILED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

/**
 * Standard Error Response Interface
 * @typedef {Object} ErrorResponse
 * @property {string} code - Error code from ERROR_CODES registry
 * @property {string} message - User-safe error message
 * @property {string} requestId - Request ID for support tracking
 * @property {string} timestamp - ISO 8601 timestamp
 */

/**
 * Patterns to detect and sanitize from error messages
 */
const SENSITIVE_PATTERNS = [
  // Database collection names
  /collection[s]?\s+['"`]?(\w+)['"`]?/gi,
  // Field names in queries
  /field[s]?\s+['"`]?(\w+)['"`]?/gi,
  // MongoDB operators
  /\$\w+/g,
  // File paths (Unix and Windows)
  /(?:\/[\w.-]+)+\.\w+/g,
  /(?:[A-Z]:\\[\w\\.-]+)/g,
  // Database query details
  /query[:\s]+\{[^}]+\}/gi,
  // Connection strings
  /mongodb:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,
  // IP addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // Port numbers in context
  /port\s+\d+/gi
];

/**
 * Map error types to appropriate HTTP status codes
 * @param {Error} error - The error object
 * @returns {number} HTTP status code
 */
function getStatusCode(error) {
  // Check for explicit status code
  if (error.status) {
    return error.status;
  }
  if (error.statusCode) {
    return error.statusCode;
  }

  // Map by error name or type
  const errorName = error.name || '';
  const errorMessage = (error.message || '').toLowerCase();

  // Authentication errors
  if (errorName === 'UnauthorizedError' || 
      errorName === 'AuthenticationError' ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication')) {
    return 401;
  }

  // Authorization errors
  if (errorName === 'ForbiddenError' ||
      errorName === 'AuthorizationError' ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('not authorized')) {
    return 403;
  }

  // Not found errors
  if (errorName === 'NotFoundError' ||
      errorMessage.includes('not found')) {
    return 404;
  }

  // Validation errors
  if (errorName === 'ValidationError' ||
      errorName === 'ValidatorError' ||
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid')) {
    return 400;
  }

  // Conflict errors (optimistic locking, race conditions)
  if (errorName === 'ConflictError' ||
      errorName === 'VersionError' ||
      errorMessage.includes('conflict') ||
      errorMessage.includes('version')) {
    return 409;
  }

  // Service unavailable
  if (errorMessage.includes('service unavailable') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout')) {
    return 503;
  }

  // Default to 500 for unknown errors
  return 500;
}

/**
 * Map HTTP status code to error code
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error code from ERROR_CODES registry
 */
function getErrorCode(statusCode) {
  switch (statusCode) {
    case 400:
      return ERROR_CODES.BAD_REQUEST;
    case 401:
      return ERROR_CODES.AUTH_FAILED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    case 503:
      return ERROR_CODES.SERVICE_UNAVAILABLE;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Sanitize error message to remove internal implementation details
 * @param {string} message - Original error message
 * @returns {string} Sanitized message
 */
function sanitizeMessage(message) {
  if (!message) {
    return 'An error occurred';
  }

  let sanitized = message;

  // Remove sensitive patterns
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // Remove stack trace snippets that might be in the message
  sanitized = sanitized.split('\n')[0];

  return sanitized;
}

/**
 * Get user-friendly message based on status code
 * @param {number} statusCode - HTTP status code
 * @param {string} originalMessage - Original error message
 * @returns {string} User-friendly message
 */
function getUserFriendlyMessage(statusCode, originalMessage) {
  // For 5xx errors, always return generic message
  if (statusCode >= 500) {
    return 'An internal server error occurred. Please try again later.';
  }

  // For 4xx errors, sanitize and return the message
  if (statusCode >= 400 && statusCode < 500) {
    const sanitized = sanitizeMessage(originalMessage);
    
    // If sanitization removed too much, provide a generic message
    if (sanitized === '[REDACTED]' || sanitized.length < 5) {
      switch (statusCode) {
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'Authentication required. Please log in.';
        case 403:
          return 'Access denied. You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return 'Conflict detected. The resource may have been modified.';
        default:
          return 'An error occurred processing your request.';
      }
    }
    
    return sanitized;
  }

  return 'An error occurred';
}

/**
 * Generate a unique request ID for tracking
 * @returns {string} Request ID
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize error for client response
 * Removes stack traces, database details, and internal paths
 * 
 * @param {Error} error - The error object
 * @param {string} requestId - Request ID for tracking
 * @returns {ErrorResponse} Sanitized error response
 */
function sanitizeError(error, requestId) {
  const statusCode = getStatusCode(error);
  const code = getErrorCode(statusCode);
  const message = getUserFriendlyMessage(statusCode, error.message);
  const timestamp = new Date().toISOString();

  return {
    code,
    message,
    requestId,
    timestamp
  };
}

/**
 * Log full error details server-side
 * Uses LogSanitizer to remove PII from error messages and stack traces
 * @param {Error} error - The error object
 * @param {Object} context - Request context
 */
function logError(error, context = {}) {
  // Sanitize error details to remove PII
  const sanitizedError = {
    name: error.name,
    message: sanitizer.sanitize(error.message || ''),
    stack: sanitizer.sanitizeStackTrace(error.stack || ''),
    code: error.code,
    status: error.status || error.statusCode
  };

  // Sanitize context to remove PII
  const sanitizedContext = sanitizer.sanitizeObject({
    requestId: context.requestId,
    path: context.path,
    method: context.method,
    userId: context.userId,
    ip: context.ip
  });

  const logEntry = {
    timestamp: new Date().toISOString(),
    error: sanitizedError,
    context: sanitizedContext
  };

  // In production, this should use a proper logging service
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', JSON.stringify(logEntry));
  } else {
    console.error('Error occurred:', logEntry);
  }

  // Log to debug portal if enabled
  if (process.env.DEBUG_ENABLED === 'true') {
    import('../internal/debug/logCollector.js')
      .then(({ logApiError }) => {
        logApiError(error, {
          path: context.path,
          method: context.method,
          statusCode: getStatusCode(error)
        });
      })
      .catch(() => {
        // Silently fail if debug portal is not available
      });
  }
}

/**
 * Express error handling middleware
 * Must be added after all routes
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Generate request ID if not already present
  const requestId = req.id || generateRequestId();

  // Build context for logging
  const context = {
    requestId,
    path: req.path || req.url,
    method: req.method,
    userId: req.user?.id || req.user?._id,
    ip: req.ip || req.connection?.remoteAddress
  };

  // Log full error details server-side
  logError(err, context);

  // Sanitize error for client response
  const sanitizedError = sanitizeError(err, requestId);
  const statusCode = getStatusCode(err);

  // Send sanitized response to client
  res.status(statusCode).json(sanitizedError);
}

/**
 * Create a custom error with a specific status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {Error} Error object with status code
 */
function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.status = statusCode;
  return error;
}

// Export functions and constants
export {
  errorHandler,
  sanitizeError,
  logError,
  getStatusCode,
  createError,
  ERROR_CODES
};
