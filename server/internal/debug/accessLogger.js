/**
 * Access Logger for Debug Portal
 * 
 * Logs all access attempts to the debug portal for security auditing.
 * Stores logs in memory with a circular buffer.
 */

// Circular buffer for access logs (max 200 entries)
const MAX_ACCESS_LOGS = 200;
const accessLogs = [];

/**
 * Log an access attempt to the debug portal
 * @param {Object} logData - Access log data
 * @param {string} logData.ip - Client IP address
 * @param {string} logData.userAgent - User agent string
 * @param {string} logData.action - Action attempted (e.g., 'authenticate', 'health_check')
 * @param {boolean} logData.success - Whether the attempt was successful
 * @param {string} logData.reason - Reason for failure (if applicable)
 * @param {string} logData.path - Request path
 * @param {string} logData.method - HTTP method
 */
export const logAccess = ({
  ip,
  userAgent,
  action,
  success,
  reason = null,
  path = '',
  method = 'GET',
}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: ip || 'unknown',
    userAgent: userAgent || 'unknown',
    action,
    success,
    reason,
    path,
    method,
  };

  accessLogs.push(logEntry);

  // Maintain circular buffer size
  if (accessLogs.length > MAX_ACCESS_LOGS) {
    accessLogs.shift();
  }

  // Console log for immediate visibility (especially failures)
  if (!success) {
    console.warn(`[Debug Portal] Access DENIED: ${action} from ${ip} - ${reason}`);
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(`[Debug Portal] Access granted: ${action} from ${ip}`);
  }
};

/**
 * Get recent access logs
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of logs to return (default: 50)
 * @param {boolean} options.failedOnly - Only return failed attempts
 * @returns {Array} Array of access log entries
 */
export const getAccessLogs = ({ limit = 50, failedOnly = false } = {}) => {
  let logs = [...accessLogs].reverse(); // Most recent first

  if (failedOnly) {
    logs = logs.filter(log => !log.success);
  }

  return logs.slice(0, limit);
};

/**
 * Get access statistics
 * @returns {Object} Access statistics
 */
export const getAccessStats = () => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const recentLogs = accessLogs.filter(log => new Date(log.timestamp).getTime() > oneHourAgo);
  const dailyLogs = accessLogs.filter(log => new Date(log.timestamp).getTime() > oneDayAgo);

  return {
    totalLogs: accessLogs.length,
    lastHour: {
      total: recentLogs.length,
      successful: recentLogs.filter(l => l.success).length,
      failed: recentLogs.filter(l => !l.success).length,
    },
    last24Hours: {
      total: dailyLogs.length,
      successful: dailyLogs.filter(l => l.success).length,
      failed: dailyLogs.filter(l => !l.success).length,
    },
    uniqueIPs: [...new Set(accessLogs.map(l => l.ip))].length,
  };
};

/**
 * Clear all access logs (for testing)
 */
export const clearAccessLogs = () => {
  accessLogs.length = 0;
};

export default {
  logAccess,
  getAccessLogs,
  getAccessStats,
  clearAccessLogs,
};
