/**
 * Metrics Tracker Utility
 * 
 * Provides easy-to-use functions for tracking metrics throughout the application.
 * Integrates with Prometheus for metrics collection and monitoring.
 */

import {
  dbQueryDuration,
  dbQueryTotal,
  cacheHits,
  cacheMisses,
  cacheSize,
  socketConnections,
  socketEvents,
  authAttempts,
  authSessions,
  expensesCreated,
  settlementsCreated,
  groupsCreated,
  usersRegistered,
  errors,
  jobExecutions,
  jobDuration,
  emailsSent,
  rateLimitHits,
} from '../config/metrics.js';

/**
 * Metrics Tracker Class
 * Provides methods for tracking various application metrics
 */
class MetricsTracker {
  /**
   * Track database query
   * @param {string} operation - Database operation (find, create, update, delete)
   * @param {string} collection - Collection name
   * @param {number} duration - Query duration in milliseconds
   * @param {string} status - Query status (success, error)
   */
  trackDbQuery(operation, collection, duration, status = 'success') {
    dbQueryDuration.observe(
      { operation, collection, status },
      duration / 1000 // Convert to seconds
    );
    dbQueryTotal.inc({ operation, collection, status });
  }

  /**
   * Track cache hit
   * @param {string} cacheType - Cache type (memory, redis, etc.)
   * @param {string} keyPrefix - Key prefix for grouping
   */
  trackCacheHit(cacheType, keyPrefix = 'default') {
    cacheHits.inc({ cache_type: cacheType, key_prefix: keyPrefix });
  }

  /**
   * Track cache miss
   * @param {string} cacheType - Cache type (memory, redis, etc.)
   * @param {string} keyPrefix - Key prefix for grouping
   */
  trackCacheMiss(cacheType, keyPrefix = 'default') {
    cacheMisses.inc({ cache_type: cacheType, key_prefix: keyPrefix });
  }

  /**
   * Update cache size
   * @param {string} cacheType - Cache type
   * @param {number} sizeBytes - Cache size in bytes
   */
  updateCacheSize(cacheType, sizeBytes) {
    cacheSize.set({ cache_type: cacheType }, sizeBytes);
  }

  /**
   * Track socket connection change
   * @param {number} count - Current connection count
   */
  updateSocketConnections(count) {
    socketConnections.set(count);
  }

  /**
   * Track socket event
   * @param {string} eventType - Event type (message, join, leave, etc.)
   * @param {string} status - Event status (success, error)
   */
  trackSocketEvent(eventType, status = 'success') {
    socketEvents.inc({ event_type: eventType, status });
  }

  /**
   * Track authentication attempt
   * @param {string} method - Auth method (password, google, etc.)
   * @param {string} status - Auth status (success, failure)
   */
  trackAuthAttempt(method, status) {
    authAttempts.inc({ method, status });
  }

  /**
   * Update active session count
   * @param {number} count - Current session count
   */
  updateAuthSessions(count) {
    authSessions.set(count);
  }

  /**
   * Track expense creation
   * @param {string} currency - Expense currency
   */
  trackExpenseCreated(currency = 'INR') {
    expensesCreated.inc({ currency });
  }

  /**
   * Track settlement creation
   * @param {string} type - Settlement type (in-group, cross-group)
   * @param {string} status - Settlement status (pending, confirmed, failed)
   */
  trackSettlementCreated(type, status = 'pending') {
    settlementsCreated.inc({ type, status });
  }

  /**
   * Track group creation
   */
  trackGroupCreated() {
    groupsCreated.inc();
  }

  /**
   * Track user registration
   * @param {string} method - Registration method (email, google)
   */
  trackUserRegistered(method = 'email') {
    usersRegistered.inc({ method });
  }

  /**
   * Track error
   * @param {string} type - Error type (validation, database, external, etc.)
   * @param {string} severity - Error severity (low, medium, high, critical)
   * @param {string} endpoint - API endpoint where error occurred
   */
  trackError(type, severity = 'medium', endpoint = 'unknown') {
    errors.inc({ type, severity, endpoint });
  }

  /**
   * Track job execution
   * @param {string} jobName - Job name
   * @param {string} status - Job status (success, failure)
   */
  trackJobExecution(jobName, status) {
    jobExecutions.inc({ job_name: jobName, status });
  }

  /**
   * Track job duration
   * @param {string} jobName - Job name
   * @param {number} duration - Job duration in milliseconds
   */
  trackJobDuration(jobName, duration) {
    jobDuration.observe({ job_name: jobName }, duration / 1000);
  }

  /**
   * Track email sent
   * @param {string} template - Email template name
   * @param {string} status - Email status (success, failure)
   */
  trackEmailSent(template, status) {
    emailsSent.inc({ template, status });
  }

  /**
   * Track rate limit hit
   * @param {string} endpoint - API endpoint
   * @param {string} limitType - Limit type (auth, api, invite, etc.)
   */
  trackRateLimitHit(endpoint, limitType) {
    rateLimitHits.inc({ endpoint, limit_type: limitType });
  }

  /**
   * Create a timer for tracking operation duration
   * @param {Function} trackFn - Function to call with duration
   * @returns {Function} Function to end timer
   */
  createTimer(trackFn) {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      trackFn(duration);
      return duration;
    };
  }

  /**
   * Wrap async function with metrics tracking
   * @param {Function} fn - Async function to wrap
   * @param {Object} options - Tracking options
   * @returns {Function} Wrapped function
   */
  wrapWithMetrics(fn, options = {}) {
    const { 
      operation, 
      collection, 
      errorType = 'unknown',
      errorSeverity = 'medium',
    } = options;

    return async (...args) => {
      const start = Date.now();
      try {
        const result = await fn(...args);
        const duration = Date.now() - start;
        
        if (operation && collection) {
          this.trackDbQuery(operation, collection, duration, 'success');
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        
        if (operation && collection) {
          this.trackDbQuery(operation, collection, duration, 'error');
        }
        
        this.trackError(errorType, errorSeverity);
        throw error;
      }
    };
  }
}

// Create singleton instance
const metricsTracker = new MetricsTracker();

/**
 * Express middleware for tracking request metrics
 * Adds metrics tracking to req object
 */
export const metricsMiddleware = (req, res, next) => {
  req.metrics = metricsTracker;
  next();
};

/**
 * Express middleware for tracking errors
 * Should be added as error handler
 */
export const errorMetricsMiddleware = (err, req, res, next) => {
  const endpoint = req.originalUrl || req.url;
  const severity = err.statusCode >= 500 ? 'high' : 'medium';
  const type = err.name || 'unknown';
  
  metricsTracker.trackError(type, severity, endpoint);
  next(err);
};

export default metricsTracker;
