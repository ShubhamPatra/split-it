/**
 * Centralized Log Collection System
 * 
 * Collects and stores logs from various sources in the application.
 * Uses circular buffers to limit memory usage.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';

// Circular buffer sizes
const MAX_LOGS_PER_TYPE = 100;
const MAX_TOTAL_LOGS = 500;

// Log storage
const logs = {
  errors: [],
  warnings: [],
  info: [],
  socket: [],
  email: [],
  api: [],
  database: [],
  jobs: [],
};

// Combined log buffer (all types)
const allLogs = [];

// Original console methods (for interception)
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
};

// Flag to prevent infinite recursion
let isLogging = false;

/**
 * Add a log entry to the collection
 * @param {string} service - Service name (e.g., 'api', 'socket', 'email')
 * @param {string} severity - Log severity ('error', 'warning', 'info')
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export const addLog = (service, severity, message, metadata = {}) => {
  if (isLogging) return; // Prevent recursion
  isLogging = true;

  try {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      service,
      severity,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      metadata,
    };

    // Add to service-specific buffer
    const serviceBuffer = logs[service] || logs.info;
    serviceBuffer.push(entry);
    if (serviceBuffer.length > MAX_LOGS_PER_TYPE) {
      serviceBuffer.shift();
    }

    // Add to severity-specific buffer
    const severityBuffer = logs[severity === 'error' ? 'errors' : severity === 'warning' ? 'warnings' : 'info'];
    if (severityBuffer && severityBuffer !== serviceBuffer) {
      severityBuffer.push(entry);
      if (severityBuffer.length > MAX_LOGS_PER_TYPE) {
        severityBuffer.shift();
      }
    }

    // Add to combined buffer
    allLogs.push(entry);
    if (allLogs.length > MAX_TOTAL_LOGS) {
      allLogs.shift();
    }
  } finally {
    isLogging = false;
  }
};

/**
 * Safely serialize an argument to string (handles circular objects)
 * @param {any} arg - Argument to serialize
 * @returns {string} Safe string representation
 */
const safeSerialize = (arg) => {
  try {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    // Use util.inspect for objects - handles circular references safely
    return util.inspect(arg, { depth: 3, maxArrayLength: 50, breakLength: Infinity });
  } catch (e) {
    return '[Unserializable Object]';
  }
};

/**
 * Initialize console interception to capture logs
 * Call this once during server startup
 */
export const initializeLogInterception = () => {
  // Intercept console.error
  console.error = (...args) => {
    originalConsole.error(...args);
    try {
      const message = args.map(safeSerialize).join(' ');
      addLog('api', 'error', message, { source: 'console.error' });
    } catch (e) {
      // Never throw from console wrappers
    }
  };

  // Intercept console.warn
  console.warn = (...args) => {
    originalConsole.warn(...args);
    try {
      const message = args.map(safeSerialize).join(' ');
      addLog('api', 'warning', message, { source: 'console.warn' });
    } catch (e) {
      // Never throw from console wrappers
    }
  };

  // Intercept console.log for info-level logs
  // Filter by common prefixes to reduce noise
  console.log = (...args) => {
    originalConsole.log(...args);
    try {
      const message = args.map(safeSerialize).join(' ');
      // Capture logs with meaningful prefixes (scheduler, email, socket, db, api, etc.)
      // Skip very noisy logs like webpack dev server output
      const meaningfulPrefixes = /^\[(Scheduler|Email|Socket|Database|API|Server|Auth|Job|Push|Notification)\]|MongoDB|Socket\.IO|connected|disconnected|listening|started|completed/i;
      if (meaningfulPrefixes.test(message)) {
        addLog('api', 'info', message, { source: 'console.log' });
      }
    } catch (e) {
      // Never throw from console wrappers
    }
  };
};

/**
 * Log a socket event
 * @param {string} event - Event type (e.g., 'connection', 'disconnect', 'error')
 * @param {Object} data - Event data
 */
export const logSocketEvent = (event, data = {}) => {
  addLog('socket', event === 'error' ? 'error' : 'info', `Socket ${event}`, {
    event,
    ...data,
  });
};

/**
 * Log an email event
 * @param {string} event - Event type (e.g., 'sent', 'failed')
 * @param {Object} data - Event data
 */
export const logEmailEvent = (event, data = {}) => {
  addLog('email', event === 'failed' ? 'error' : 'info', `Email ${event}`, {
    event,
    ...data,
  });
};

/**
 * Log a database event
 * @param {string} event - Event type (e.g., 'connected', 'disconnected', 'error')
 * @param {Object} data - Event data
 */
export const logDatabaseEvent = (event, data = {}) => {
  addLog('database', event === 'error' ? 'error' : 'info', `Database ${event}`, {
    event,
    ...data,
  });
};

/**
 * Log a job event
 * @param {string} jobName - Job name
 * @param {string} event - Event type (e.g., 'started', 'completed', 'failed')
 * @param {Object} data - Event data
 */
export const logJobEvent = (jobName, event, data = {}) => {
  addLog('jobs', event === 'failed' ? 'error' : 'info', `Job ${jobName}: ${event}`, {
    jobName,
    event,
    ...data,
  });
};

/**
 * Log an API error
 * @param {Error} error - Error object
 * @param {Object} request - Request context
 */
export const logApiError = (error, request = {}) => {
  addLog('api', 'error', error.message, {
    stack: error.stack,
    path: request.path,
    method: request.method,
    statusCode: request.statusCode,
  });
};

/**
 * Query logs with filters
 * @param {Object} options - Query options
 * @param {string} options.service - Filter by service
 * @param {string} options.severity - Filter by severity
 * @param {string} options.search - Search in message
 * @param {number} options.limit - Maximum number of results
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.since - ISO timestamp to filter logs after
 * @returns {Object} Query result with logs and pagination info
 */
export const queryLogs = ({
  service,
  severity,
  search,
  limit = 50,
  offset = 0,
  since,
} = {}) => {
  let filteredLogs = [...allLogs].reverse(); // Most recent first

  // Filter by service
  if (service && logs[service]) {
    filteredLogs = filteredLogs.filter(log => log.service === service);
  }

  // Filter by severity
  if (severity) {
    filteredLogs = filteredLogs.filter(log => log.severity === severity);
  }

  // Filter by search term
  if (search) {
    const searchLower = search.toLowerCase();
    filteredLogs = filteredLogs.filter(log =>
      log.message.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
    );
  }

  // Filter by timestamp
  if (since) {
    const sinceTime = new Date(since).getTime();
    filteredLogs = filteredLogs.filter(log =>
      new Date(log.timestamp).getTime() > sinceTime
    );
  }

  const total = filteredLogs.length;
  const paginatedLogs = filteredLogs.slice(offset, offset + limit);

  return {
    logs: paginatedLogs,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
};

/**
 * Get recent errors
 * @param {number} limit - Maximum number of errors to return
 * @returns {Array} Array of error log entries
 */
export const getRecentErrors = (limit = 50) => {
  return [...logs.errors].reverse().slice(0, limit);
};

/**
 * Read PM2 logs (EC2-specific)
 * @param {number} lines - Number of lines to read
 * @returns {Object} PM2 log data
 */
export const readPM2Logs = async (lines = 100) => {
  const result = {
    available: false,
    error: null,
    out: [],
    err: [],
  };

  // PM2 log locations
  const homeDir = os.homedir();
  const pm2LogDir = path.join(homeDir, '.pm2', 'logs');

  try {
    // Check if PM2 log directory exists
    if (!fs.existsSync(pm2LogDir)) {
      result.error = 'PM2 log directory not found';
      return result;
    }

    result.available = true;

    // Find log files (look for common patterns)
    const files = fs.readdirSync(pm2LogDir);
    const outFiles = files.filter(f => f.includes('-out') && f.endsWith('.log'));
    const errFiles = files.filter(f => f.includes('-error') && f.endsWith('.log'));

    // Read most recent output log
    if (outFiles.length > 0) {
      const outFile = path.join(pm2LogDir, outFiles[outFiles.length - 1]);
      result.out = readLastLines(outFile, lines);
    }

    // Read most recent error log
    if (errFiles.length > 0) {
      const errFile = path.join(pm2LogDir, errFiles[errFiles.length - 1]);
      result.err = readLastLines(errFile, lines);
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
};

/**
 * Read last N lines from a file
 * @param {string} filePath - Path to file
 * @param {number} lines - Number of lines to read
 * @returns {Array} Array of log lines
 */
const readLastLines = (filePath, lines) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());
    return allLines.slice(-lines).map(line => ({
      timestamp: extractTimestamp(line),
      content: line,
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Extract timestamp from a log line (best effort)
 * @param {string} line - Log line
 * @returns {string|null} Extracted timestamp or null
 */
const extractTimestamp = (line) => {
  // Try ISO format
  const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (isoMatch) return isoMatch[0];

  // Try common PM2 format
  const pm2Match = line.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  if (pm2Match) return pm2Match[0];

  return null;
};

/**
 * Get log statistics
 * @returns {Object} Log statistics
 */
export const getLogStats = () => {
  return {
    totalLogs: allLogs.length,
    byService: {
      errors: logs.errors.length,
      warnings: logs.warnings.length,
      info: logs.info.length,
      socket: logs.socket.length,
      email: logs.email.length,
      api: logs.api.length,
      database: logs.database.length,
      jobs: logs.jobs.length,
    },
    oldestLog: allLogs.length > 0 ? allLogs[0].timestamp : null,
    newestLog: allLogs.length > 0 ? allLogs[allLogs.length - 1].timestamp : null,
  };
};

/**
 * Clear all logs (for testing)
 */
export const clearLogs = () => {
  Object.keys(logs).forEach(key => {
    logs[key].length = 0;
  });
  allLogs.length = 0;
};

export default {
  addLog,
  initializeLogInterception,
  logSocketEvent,
  logEmailEvent,
  logDatabaseEvent,
  logJobEvent,
  logApiError,
  queryLogs,
  getRecentErrors,
  readPM2Logs,
  getLogStats,
  clearLogs,
};
