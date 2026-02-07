import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version info
let packageInfo = { version: 'unknown', name: 'split-it-api' };
try {
  const packagePath = join(__dirname, '..', 'package.json');
  const packageData = readFileSync(packagePath, 'utf8');
  packageInfo = JSON.parse(packageData);
} catch (error) {
  console.error('Failed to read package.json:', error.message);
}

// Track server start time
const serverStartTime = Date.now();

/**
 * @desc    Basic liveness check
 * @route   GET /health
 * @access  Public
 * 
 * Returns 200 if server is running. Used by load balancers
 * to determine if instance should receive traffic.
 */
export const healthCheck = async (req, res) => {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000);

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    service: packageInfo.name,
    version: packageInfo.version,
  });
};

/**
 * @desc    Readiness check with dependency health
 * @route   GET /ready
 * @access  Public
 * 
 * Returns 200 if server is ready to handle requests.
 * Checks database connectivity and other critical dependencies.
 * Used by orchestrators (Kubernetes, etc.) to determine readiness.
 */
export const readinessCheck = async (req, res) => {
  const checks = {
    database: { status: 'unknown', message: '', responseTime: 0 },
    memory: { status: 'unknown', message: '', usage: {} },
    uptime: { status: 'ok', seconds: 0 },
  };

  let overallStatus = 'ok';
  const startTime = Date.now();

  // Check database connectivity
  try {
    const dbStartTime = Date.now();
    const dbState = mongoose.connection.readyState;

    // Guard: Only ping if connection is established (readyState === 1)
    if (dbState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();

      const dbResponseTime = Date.now() - dbStartTime;
      checks.database.status = 'ok';
      checks.database.message = 'Connected';
      checks.database.responseTime = dbResponseTime;
    } else {
      checks.database.status = 'degraded';
      checks.database.message = `Connection state: ${dbState}`;
      checks.database.responseTime = 0;
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.database.status = 'error';
    checks.database.message = error.message;
    overallStatus = 'error';
  }

  // Check memory usage
  try {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    checks.memory.usage = {
      heapUsed: Math.round(usedMemory / 1024 / 1024), // MB
      heapTotal: Math.round(totalMemory / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      usagePercent: Math.round(memoryUsagePercent),
    };

    if (memoryUsagePercent > 90) {
      checks.memory.status = 'warning';
      checks.memory.message = 'High memory usage';
      if (overallStatus === 'ok') overallStatus = 'degraded';
    } else {
      checks.memory.status = 'ok';
      checks.memory.message = 'Normal';
    }
  } catch (error) {
    checks.memory.status = 'error';
    checks.memory.message = error.message;
    if (overallStatus === 'ok') overallStatus = 'degraded';
  }

  // Check uptime
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
  checks.uptime.seconds = uptime;
  checks.uptime.status = 'ok';

  // Determine HTTP status code
  const statusCode = overallStatus === 'error' ? 503 : 200;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: packageInfo.name,
    version: packageInfo.version,
    uptime: uptime,
    checks: checks,
    responseTime: Date.now() - startTime,
  });
};

/**
 * @desc    Detailed system information
 * @route   GET /health/info
 * @access  Private (requires authentication)
 * 
 * Returns detailed system information for monitoring and debugging.
 * Should only be accessible to authenticated users or monitoring systems.
 */
export const systemInfo = async (req, res) => {
  try {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const memUsage = process.memoryUsage();

    // Database info
    let dbInfo = {
      connected: false,
      host: 'unknown',
      name: 'unknown',
      collections: 0,
    };

    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      dbInfo.connected = true;
      dbInfo.host = mongoose.connection.host;
      dbInfo.name = mongoose.connection.name;

      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        dbInfo.collections = collections.length;
      } catch (error) {
        // Use -1 to indicate error while maintaining type consistency (number)
        dbInfo.collections = -1;
      }
    }

    // Process info
    const processInfo = {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: uptime,
      cpuUsage: process.cpuUsage(),
    };

    // Memory info
    const memoryInfo = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024), // MB
    };

    res.json({
      service: packageInfo.name,
      version: packageInfo.version,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      database: dbInfo,
      process: processInfo,
      memory: memoryInfo,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
