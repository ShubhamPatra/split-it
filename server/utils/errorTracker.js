/**
 * Error Tracker for Split-It
 * 
 * Provides error tracking and reporting with:
 * - Sentry integration (optional)
 * - Local error logging
 * - Error context capture (user, request, environment)
 * - Error grouping and deduplication
 * - Performance monitoring
 * - Release tracking
 * 
 * Can work standalone or with Sentry
 */

import logger from './structuredLogger.js';
import metricsTracker from './metricsTracker.js';

// Sentry will be imported dynamically if available
let Sentry = null;
let sentryEnabled = false;

/**
 * Initialize Sentry if available and configured
 */
const initializeSentry = () => {
  try {
    // Check if Sentry is configured
    if (!process.env.SENTRY_DSN) {
      logger.info('Sentry DSN not configured, using local error tracking only');
      return false;
    }

    // Try to import Sentry
    import('@sentry/node').then((SentryModule) => {
      Sentry = SentryModule;
      
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.APP_VERSION || 'unknown',
        
        // Performance monitoring
        tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE 
          ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) 
          : 0.1, // 10% of transactions
        
        // Error sampling
        sampleRate: 1.0, // Capture 100% of errors
        
        // Integrations
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: true }),
          new Sentry.Integrations.Mongo({ useMongoose: true }),
        ],
        
        // Filter sensitive data
        beforeSend(event, hint) {
          // Remove sensitive data from event
          if (event.request) {
            // Remove authorization headers
            if (event.request.headers) {
              delete event.request.headers.authorization;
              delete event.request.headers.cookie;
            }
            
            // Remove sensitive query params
            if (event.request.query_string) {
              event.request.query_string = event.request.query_string
                .replace(/password=[^&]*/gi, 'password=[REDACTED]')
                .replace(/token=[^&]*/gi, 'token=[REDACTED]');
            }
          }
          
          // Remove sensitive data from extra context
          if (event.extra) {
            delete event.extra.password;
            delete event.extra.token;
            delete event.extra.refreshToken;
          }
          
          return event;
        },
        
        // Ignore certain errors
        ignoreErrors: [
          'Non-Error promise rejection captured',
          'ResizeObserver loop limit exceeded',
          'Network request failed',
        ],
      });
      
      sentryEnabled = true;
      logger.info('Sentry error tracking initialized', {
        environment: process.env.NODE_ENV,
        release: process.env.APP_VERSION,
      });
    }).catch((error) => {
      logger.warn('Failed to initialize Sentry', { error: error.message });
    });
    
    return true;
  } catch (error) {
    logger.warn('Sentry initialization failed', { error: error.message });
    return false;
  }
};

/**
 * Error Tracker Class
 */
class ErrorTracker {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize error tracker
   */
  async initialize() {
    if (this.initialized) return;
    
    initializeSentry();
    this.initialized = true;
  }

  /**
   * Capture an error
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  captureError(error, context = {}) {
    // Log error locally
    logger.error('Error captured', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      ...context,
    });
    
    // Track error metric
    const severity = this._getSeverity(error, context);
    const endpoint = context.endpoint || context.url || 'unknown';
    metricsTracker.trackError(error.name || 'Error', severity, endpoint);
    
    // Send to Sentry if enabled
    if (sentryEnabled && Sentry) {
      Sentry.captureException(error, {
        level: this._getSentryLevel(severity),
        tags: {
          errorType: error.name,
          endpoint,
          ...context.tags,
        },
        extra: {
          ...context,
          errorCode: error.code,
          statusCode: error.statusCode,
        },
        user: context.user ? {
          id: context.user.id || context.user._id,
          email: context.user.email,
          username: context.user.name,
        } : undefined,
      });
    }
  }

  /**
   * Capture a message (non-error)
   * @param {string} message - Message to capture
   * @param {string} level - Message level (info, warning, error)
   * @param {Object} context - Additional context
   */
  captureMessage(message, level = 'info', context = {}) {
    // Log message locally
    logger[level](message, context);
    
    // Send to Sentry if enabled
    if (sentryEnabled && Sentry) {
      Sentry.captureMessage(message, {
        level: this._getSentryLevel(level),
        tags: context.tags,
        extra: context,
      });
    }
  }

  /**
   * Set user context
   * @param {Object} user - User object
   */
  setUser(user) {
    if (sentryEnabled && Sentry && user) {
      Sentry.setUser({
        id: user.id || user._id?.toString(),
        email: user.email,
        username: user.name,
      });
    }
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (sentryEnabled && Sentry) {
      Sentry.setUser(null);
    }
  }

  /**
   * Add breadcrumb (trail of events leading to error)
   * @param {Object} breadcrumb - Breadcrumb data
   */
  addBreadcrumb(breadcrumb) {
    if (sentryEnabled && Sentry) {
      Sentry.addBreadcrumb({
        message: breadcrumb.message,
        category: breadcrumb.category || 'custom',
        level: breadcrumb.level || 'info',
        data: breadcrumb.data,
        timestamp: Date.now() / 1000,
      });
    }
  }

  /**
   * Set custom context
   * @param {string} key - Context key
   * @param {Object} value - Context value
   */
  setContext(key, value) {
    if (sentryEnabled && Sentry) {
      Sentry.setContext(key, value);
    }
  }

  /**
   * Set tag
   * @param {string} key - Tag key
   * @param {string} value - Tag value
   */
  setTag(key, value) {
    if (sentryEnabled && Sentry) {
      Sentry.setTag(key, value);
    }
  }

  /**
   * Start a transaction (for performance monitoring)
   * @param {Object} options - Transaction options
   * @returns {Object} Transaction object
   */
  startTransaction(options) {
    if (sentryEnabled && Sentry) {
      return Sentry.startTransaction(options);
    }
    
    // Return mock transaction for local tracking
    const start = Date.now();
    return {
      finish: () => {
        const duration = Date.now() - start;
        logger.debug('Transaction completed', {
          name: options.name,
          op: options.op,
          duration,
        });
      },
      setStatus: () => {},
      setTag: () => {},
      setData: () => {},
    };
  }

  /**
   * Wrap async function with error tracking
   * @param {Function} fn - Async function to wrap
   * @param {Object} options - Tracking options
   * @returns {Function} Wrapped function
   */
  wrapAsync(fn, options = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.captureError(error, {
          functionName: fn.name || 'anonymous',
          ...options,
        });
        throw error;
      }
    };
  }

  /**
   * Get error severity
   * @private
   */
  _getSeverity(error, context) {
    // Critical errors
    if (error.name === 'DatabaseError' || error.code === 'ECONNREFUSED') {
      return 'critical';
    }
    
    // High severity
    if (error.statusCode >= 500 || context.severity === 'high') {
      return 'high';
    }
    
    // Medium severity
    if (error.statusCode >= 400 || context.severity === 'medium') {
      return 'medium';
    }
    
    // Low severity
    return 'low';
  }

  /**
   * Convert severity to Sentry level
   * @private
   */
  _getSentryLevel(severity) {
    const levelMap = {
      critical: 'fatal',
      high: 'error',
      medium: 'warning',
      low: 'info',
      info: 'info',
      warning: 'warning',
      error: 'error',
    };
    
    return levelMap[severity] || 'error';
  }

  /**
   * Check if Sentry is enabled
   */
  isSentryEnabled() {
    return sentryEnabled;
  }
}

// Create singleton instance
const errorTracker = new ErrorTracker();

/**
 * Express middleware for Sentry request handler
 * Must be added before routes
 */
export const sentryRequestHandler = (req, res, next) => {
  if (sentryEnabled && Sentry) {
    return Sentry.Handlers.requestHandler()(req, res, next);
  }
  next();
};

/**
 * Express middleware for Sentry tracing
 * Must be added before routes
 */
export const sentryTracingHandler = (req, res, next) => {
  if (sentryEnabled && Sentry) {
    return Sentry.Handlers.tracingHandler()(req, res, next);
  }
  next();
};

/**
 * Express middleware for Sentry error handler
 * Must be added after routes but before other error handlers
 */
export const sentryErrorHandler = (err, req, res, next) => {
  if (sentryEnabled && Sentry) {
    return Sentry.Handlers.errorHandler()(err, req, res, next);
  }
  next(err);
};

/**
 * Express middleware for capturing errors with context
 */
export const errorTrackingMiddleware = (err, req, res, next) => {
  errorTracker.captureError(err, {
    endpoint: req.originalUrl || req.url,
    method: req.method,
    statusCode: err.statusCode || 500,
    user: req.user ? {
      id: req.user._id?.toString(),
      email: req.user.email,
      name: req.user.name,
    } : undefined,
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  next(err);
};

/**
 * Graceful shutdown handler
 */
export const closeErrorTracker = async () => {
  if (sentryEnabled && Sentry) {
    logger.info('Closing Sentry connection...');
    await Sentry.close(2000); // Wait up to 2 seconds
    logger.info('Sentry connection closed');
  }
};

export default errorTracker;
