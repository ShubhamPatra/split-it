/**
 * Debug Portal Controller
 * 
 * Handles all debug portal endpoints.
 */

import os from 'os';
import {
  checkAllServices,
  checkMongoDB,
  checkSocketIO,
  checkEmail,
  checkAPIServer,
  checkNotifications,
  checkBackgroundJobs,
} from './serviceHealth.js';
import {
  queryLogs,
  getRecentErrors,
  readPM2Logs,
  getLogStats,
} from './logCollector.js';
import {
  testEmail,
  testSocket,
  testDatabase,
  testNotification,
  testAll,
} from './testActions.js';
import { getAccessLogs, getAccessStats } from './accessLogger.js';
import { getBruteForceStatus } from './debug.middleware.js';

/**
 * GET /health - Service health dashboard
 */
export const getHealth = async (req, res) => {
  try {
    const health = await checkAllServices();
    
    // Add system metrics
    const memUsage = process.memoryUsage();
    health.system = {
      uptime: process.uptime(),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        rss: memUsage.rss,
      },
      cpu: process.cpuUsage(),
      loadAverage: os.loadavg(),
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to check health',
      error: error.message,
    });
  }
};

/**
 * GET /logs - View recent logs
 * Query params: service, severity, limit, offset, search, since
 */
export const getLogs = async (req, res) => {
  try {
    const { service, severity, limit, offset, search, since } = req.query;
    
    const result = queryLogs({
      service,
      severity,
      search,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      since,
    });

    res.json({
      ...result,
      stats: getLogStats(),
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to query logs',
      error: error.message,
    });
  }
};

/**
 * GET /logs/errors - View recent errors only
 */
export const getErrors = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const errors = getRecentErrors(limit);

    res.json({
      count: errors.length,
      errors,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get errors',
      error: error.message,
    });
  }
};

/**
 * GET /logs/pm2 - Read PM2 logs (EC2-specific)
 */
export const getPM2Logs = async (req, res) => {
  try {
    const lines = parseInt(req.query.lines, 10) || 100;
    const pm2Logs = await readPM2Logs(lines);

    res.json(pm2Logs);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to read PM2 logs',
      error: error.message,
    });
  }
};

/**
 * GET /system - System information
 */
export const getSystemInfo = async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        cwd: process.cwd(),
      },
      environment: process.env.NODE_ENV || 'development',
      memory: {
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        rss: formatBytes(memUsage.rss),
        external: formatBytes(memUsage.external),
        arrayBuffers: formatBytes(memUsage.arrayBuffers || 0),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      os: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        loadAverage: os.loadavg(),
        cpus: os.cpus().length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get system info',
      error: error.message,
    });
  }
};

/**
 * GET /config - Configuration status (sanitized)
 */
export const getConfigStatus = async (req, res) => {
  try {
    res.json({
      services: {
        mongodb: !!process.env.MONGODB_URI,
        smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
        redis: !!process.env.REDIS_URL,
        vapid: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      },
      features: {
        debugPortal: process.env.DEBUG_ENABLED === 'true',
        pushNotifications: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        emailNotifications: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      },
      environment: process.env.NODE_ENV || 'development',
      clientUrl: process.env.CLIENT_URL || 'not configured',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get config status',
      error: error.message,
    });
  }
};

/**
 * GET /access-log - View debug portal access log
 */
export const getAccessLog = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const failedOnly = req.query.failedOnly === 'true';

    res.json({
      logs: getAccessLogs({ limit, failedOnly }),
      stats: getAccessStats(),
      bruteForceStatus: getBruteForceStatus(),
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get access log',
      error: error.message,
    });
  }
};

/**
 * POST /test/email - Send test email
 */
export const handleTestEmail = async (req, res) => {
  try {
    const { to } = req.body || {};
    const result = await testEmail(to);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      action: 'test_email',
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /test/socket - Test socket event
 */
export const handleTestSocket = async (req, res) => {
  try {
    const { room, event, data } = req.body || {};
    const result = await testSocket({ room, event, data });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      action: 'test_socket',
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /test/database - Test database operations
 */
export const handleTestDatabase = async (req, res) => {
  try {
    const result = await testDatabase();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      action: 'test_database',
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /test/notification - Test notification system
 */
export const handleTestNotification = async (req, res) => {
  try {
    const { userId } = req.body || {};
    const result = await testNotification(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      action: 'test_notification',
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /test/all - Run all tests
 */
export const handleTestAll = async (req, res) => {
  try {
    const result = await testAll();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      overallSuccess: false,
      error: error.message,
    });
  }
};

/**
 * POST /trigger-job/:jobName - Manually trigger background job
 */
export const handleTriggerJob = async (req, res) => {
  try {
    const { jobName } = req.params;
    const { triggerJob } = await import('../../jobs/scheduler.js');
    
    const result = await triggerJob(jobName);
    
    res.json({
      jobName,
      triggered: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(400).json({
      jobName: req.params.jobName,
      triggered: false,
      error: error.message,
    });
  }
};

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format uptime to human readable string
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
};

export default {
  getHealth,
  getLogs,
  getErrors,
  getPM2Logs,
  getSystemInfo,
  getConfigStatus,
  getAccessLog,
  handleTestEmail,
  handleTestSocket,
  handleTestDatabase,
  handleTestNotification,
  handleTestAll,
  handleTriggerJob,
};
