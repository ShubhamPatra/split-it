/**
 * Service Health Check Utilities
 * 
 * Provides health check functions for all core services.
 */

import mongoose from 'mongoose';

// Health check result cache (10 second TTL)
const healthCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

/**
 * Get cached health check result or run check
 * @param {string} serviceName - Service name
 * @param {Function} checkFn - Health check function
 * @returns {Promise<Object>} Health check result
 */
const getCachedOrCheck = async (serviceName, checkFn) => {
  const cached = healthCache.get(serviceName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { ...cached.result, cached: true };
  }

  const startTime = Date.now();
  try {
    const result = await Promise.race([
      checkFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      ),
    ]);
    
    const healthResult = {
      service: serviceName,
      status: result.status || 'working',
      lastChecked: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: result.details || {},
      error: null,
    };

    healthCache.set(serviceName, { result: healthResult, timestamp: Date.now() });
    return healthResult;
  } catch (error) {
    const healthResult = {
      service: serviceName,
      status: 'failed',
      lastChecked: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      details: {},
      error: error.message,
    };

    healthCache.set(serviceName, { result: healthResult, timestamp: Date.now() });
    return healthResult;
  }
};

/**
 * Check MongoDB health
 * @returns {Promise<Object>} Health check result
 */
export const checkMongoDB = async () => {
  return getCachedOrCheck('MongoDB', async () => {
    const readyState = mongoose.connection.readyState;
    const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    if (readyState !== 1) {
      return {
        status: readyState === 2 ? 'warning' : 'failed',
        details: {
          readyState,
          stateName: stateNames[readyState] || 'unknown',
        },
      };
    }

    // Test actual database connectivity
    await mongoose.connection.db.admin().ping();

    // Get connection pool stats if available
    let poolStats = {};
    try {
      const serverStatus = await mongoose.connection.db.admin().serverStatus();
      poolStats = {
        currentConnections: serverStatus.connections?.current,
        availableConnections: serverStatus.connections?.available,
        totalCreated: serverStatus.connections?.totalCreated,
      };
    } catch (e) {
      // Server status may not be available in all configurations
    }

    return {
      status: 'working',
      details: {
        readyState,
        stateName: stateNames[readyState],
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        ...poolStats,
      },
    };
  });
};

/**
 * Check Socket.IO health
 * @returns {Promise<Object>} Health check result
 */
export const checkSocketIO = async () => {
  return getCachedOrCheck('Socket.IO', async () => {
    const { getSocketIO } = await import('../../config/socket.js');
    const io = getSocketIO();

    if (!io) {
      return {
        status: 'failed',
        details: { message: 'Socket.IO instance not initialized' },
      };
    }

    const connectedClients = io.sockets.sockets.size;
    
    // Check if Redis adapter is being used
    let redisEnabled = false;
    try {
      redisEnabled = io.adapter?.constructor?.name === 'RedisAdapter';
    } catch (e) {
      // Adapter check failed, assume not using Redis
    }

    return {
      status: 'working',
      details: {
        connectedClients,
        redisEnabled,
        serverRunning: true,
      },
    };
  });
};

/**
 * Check Email service health
 * @returns {Promise<Object>} Health check result
 */
export const checkEmail = async () => {
  return getCachedOrCheck('Email', async () => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;

    if (!smtpHost || !smtpUser) {
      return {
        status: 'warning',
        details: { 
          configured: false,
          message: 'SMTP not configured',
        },
      };
    }

    // Test SMTP connection
    const { transporter } = await import('../../config/email.js');
    
    try {
      await transporter.verify();
      return {
        status: 'working',
        details: {
          configured: true,
          host: smtpHost,
          verified: true,
        },
      };
    } catch (error) {
      return {
        status: 'failed',
        details: {
          configured: true,
          host: smtpHost,
          verified: false,
          error: error.message,
        },
      };
    }
  });
};

/**
 * Check API Server health
 * @returns {Promise<Object>} Health check result
 */
export const checkAPIServer = async () => {
  return getCachedOrCheck('API Server', async () => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      status: 'working',
      details: {
        uptime: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        memory: {
          heapUsed: formatBytes(memUsage.heapUsed),
          heapTotal: formatBytes(memUsage.heapTotal),
          rss: formatBytes(memUsage.rss),
          external: formatBytes(memUsage.external),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        activeHandles: process._getActiveHandles?.()?.length || 'N/A',
        activeRequests: process._getActiveRequests?.()?.length || 'N/A',
      },
    };
  });
};

/**
 * Check Notification system health
 * @returns {Promise<Object>} Health check result
 */
export const checkNotifications = async () => {
  return getCachedOrCheck('Notifications', async () => {
    const { getSocketIO } = await import('../../jobs/notificationService.js');
    const socketAvailable = !!getSocketIO();

    // Check VAPID configuration
    const vapidConfigured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

    // Count push subscriptions
    let pushSubscriptionCount = 0;
    try {
      const PushSubscription = (await import('../../models/PushSubscription.js')).default;
      pushSubscriptionCount = await PushSubscription.countDocuments();
    } catch (e) {
      // Count failed, ignore
    }

    const status = socketAvailable ? 'working' : 'warning';

    return {
      status,
      details: {
        socketIOAvailable: socketAvailable,
        vapidConfigured,
        pushSubscriptionCount,
        realtimeEnabled: socketAvailable,
        pushEnabled: vapidConfigured,
      },
    };
  });
};

/**
 * Check Background Jobs health
 * @returns {Promise<Object>} Health check result
 */
export const checkBackgroundJobs = async () => {
  return getCachedOrCheck('Background Jobs', async () => {
    const { getSchedulerStatus } = await import('../../jobs/scheduler.js');
    
    let schedulerStatus = [];
    let schedulerRunning = false;

    try {
      schedulerStatus = getSchedulerStatus();
      schedulerRunning = schedulerStatus.length > 0;
    } catch (e) {
      return {
        status: 'failed',
        details: {
          message: 'Scheduler not initialized',
          error: e.message,
        },
      };
    }

    return {
      status: schedulerRunning ? 'working' : 'warning',
      details: {
        schedulerRunning,
        activeJobs: schedulerStatus.length,
        jobs: schedulerStatus,
      },
    };
  });
};

/**
 * Run all health checks
 * @returns {Promise<Object>} Combined health check results
 */
export const checkAllServices = async () => {
  const startTime = Date.now();

  const [mongodb, socketio, email, apiServer, notifications, jobs] = await Promise.all([
    checkMongoDB(),
    checkSocketIO(),
    checkEmail(),
    checkAPIServer(),
    checkNotifications(),
    checkBackgroundJobs(),
  ]);

  const services = { mongodb, socketio, email, apiServer, notifications, jobs };

  // Determine overall status
  const statuses = Object.values(services).map(s => s.status);
  let overallStatus = 'healthy';
  if (statuses.includes('failed')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('warning')) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalCheckTime: Date.now() - startTime,
    services,
  };
};

/**
 * Clear health cache (for testing)
 */
export const clearHealthCache = () => {
  healthCache.clear();
};

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
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
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted string
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
  checkMongoDB,
  checkSocketIO,
  checkEmail,
  checkAPIServer,
  checkNotifications,
  checkBackgroundJobs,
  checkAllServices,
  clearHealthCache,
};
