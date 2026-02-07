import promBundle from 'express-prom-bundle';
import { register, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Normalize path to prevent cardinality explosion in Prometheus metrics
 * Replaces dynamic path parameters (ObjectIds, UUIDs, numbers) with placeholders
 */
const normalizePath = (req) => {
  let path = req.path || req.url;

  // Replace MongoDB ObjectIds (24 hex chars)
  path = path.replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id');

  // Replace UUIDs
  path = path.replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g, '/:uuid');

  // Replace numeric IDs
  path = path.replace(/\/\d+(?=\/|$)/g, '/:num');

  // Replace invite codes (8 alphanumeric chars)
  path = path.replace(/\/[A-Z0-9]{8}(?=\/|$)/g, '/:code');

  return path;
};

/**
 * Normalize a raw path string for use in metrics labels
 * Exported for use by error handlers and rate limiters
 */
export const normalizeRoute = (path) => {
  if (!path) return 'unknown';

  // Replace MongoDB ObjectIds (24 hex chars)
  let normalized = path.replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id');

  // Replace UUIDs
  normalized = normalized.replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g, '/:uuid');

  // Replace numeric IDs
  normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/:num');

  // Replace invite codes (8 alphanumeric chars)
  normalized = normalized.replace(/\/[A-Z0-9]{8}(?=\/|$)/g, '/:code');

  return normalized;
};

// Express metrics middleware (HTTP request metrics)
export const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: 'split-it' },
  // Normalize paths to prevent cardinality explosion
  normalizePath,
  promClient: {
    collectDefaultMetrics: {
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    }
  },
  metricsPath: '/metrics',
  autoregister: true,
});

// Database query metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'collection', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const dbQueryTotal = new Counter({
  name: 'db_query_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'collection', 'status'],
});

// Cache metrics
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'key_prefix'],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'key_prefix'],
});

export const cacheSize = new Gauge({
  name: 'cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type'],
});

// Socket.IO metrics
export const socketConnections = new Gauge({
  name: 'socket_connections_active',
  help: 'Number of active socket connections',
});

export const socketEvents = new Counter({
  name: 'socket_events_total',
  help: 'Total number of socket events',
  labelNames: ['event_type', 'status'],
});

// Authentication metrics
export const authAttempts = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'],
});

export const authSessions = new Gauge({
  name: 'auth_sessions_active',
  help: 'Number of active authentication sessions',
});

// Business metrics
export const expensesCreated = new Counter({
  name: 'expenses_created_total',
  help: 'Total number of expenses created',
  labelNames: ['currency'],
});

export const settlementsCreated = new Counter({
  name: 'settlements_created_total',
  help: 'Total number of settlements created',
  labelNames: ['type', 'status'],
});

export const groupsCreated = new Counter({
  name: 'groups_created_total',
  help: 'Total number of groups created',
});

export const usersRegistered = new Counter({
  name: 'users_registered_total',
  help: 'Total number of users registered',
  labelNames: ['method'],
});

// Error metrics (use normalized 'route' instead of raw 'endpoint' to prevent cardinality explosion)
export const errors = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity', 'route'],
});

// Background job metrics
export const jobExecutions = new Counter({
  name: 'job_executions_total',
  help: 'Total number of job executions',
  labelNames: ['job_name', 'status'],
});

export const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Job execution duration in seconds',
  labelNames: ['job_name'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

// Email metrics
export const emailsSent = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['template', 'status'],
});

// API rate limiting metrics (use normalized 'route' instead of raw 'endpoint')
export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['route', 'limit_type'],
});

// Export Prometheus registry for custom metrics endpoint
export { register };

