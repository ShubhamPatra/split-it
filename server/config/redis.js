import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Track Redis availability
let redisAvailable = false;
let redis = null;

// Check if Redis should be enabled
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Build Redis configuration with support for:
 * - Local Redis (development)
 * - Amazon ElastiCache for Redis OSS (production)
 * - Redis Cluster mode
 * - TLS/SSL connections
 * 
 * Note: Configuration optimized for Redis OSS compatibility.
 * If migrating from Valkey, connection characteristics may differ.
 */
const buildRedisConfig = () => {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null, // Required for BullMQ and rate-limit-redis compatibility
    enableReadyCheck: false, // Disable for Bull queue compatibility (prevents LOADING errors)
    enableOfflineQueue: false, // Prevent commands from queuing when not connected
    lazyConnect: true, // Prevent immediate connection attempts during import
    retryStrategy: (times) => {
      if (times > 3) {
        if (isDev) {
          console.warn('Redis: Not available. Running without Redis (queues disabled).');
          return null; // Stop retrying in dev
        }
        if (times > 10) {
          console.error('Redis: Max retry attempts reached. Giving up.');
          return null;
        }
      }
      // More conservative retry strategy for production ElastiCache Redis OSS
      const delay = Math.min(times * 500, 5000);
      console.log(`Redis: Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    // Handle cluster-specific errors gracefully (Redis OSS compatible)
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'CLUSTERDOWN', 'LOADING'];
      if (targetErrors.some(e => err.message.includes(e))) {
        // Reconnect when the error is about cluster state
        return true;
      }
      return false;
    },
  };

  // Add password/auth token if provided (ElastiCache AUTH token or Redis password)
  if (process.env.REDIS_PASSWORD || process.env.REDIS_AUTH_TOKEN) {
    config.password = process.env.REDIS_AUTH_TOKEN || process.env.REDIS_PASSWORD;
  }

  // ElastiCache TLS configuration
  if (process.env.REDIS_TLS === 'true' || process.env.ELASTICACHE_TLS === 'true') {
    config.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
      servername: process.env.REDIS_HOST || 'localhost', // Required for TLS handshake with ElastiCache
    };
    console.log('Redis: TLS enabled for ElastiCache connection');
  }

  // ElastiCache cluster mode
  if (process.env.REDIS_CLUSTER_MODE === 'true') {
    // For cluster mode, we return cluster-specific config
    return { ...config, isCluster: true };
  }

  // Connection name for ElastiCache identification
  if (process.env.REDIS_CONNECTION_NAME) {
    config.connectionName = process.env.REDIS_CONNECTION_NAME;
  }

  // ElastiCache-specific timeouts
  if (process.env.REDIS_CONNECT_TIMEOUT) {
    config.connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10);
  }
  if (process.env.REDIS_COMMAND_TIMEOUT) {
    config.commandTimeout = parseInt(process.env.REDIS_COMMAND_TIMEOUT, 10);
  }

  // Keep-alive for long-lived connections (important for ElastiCache)
  config.keepAlive = parseInt(process.env.REDIS_KEEP_ALIVE, 10) || 30000;

  return config;
};

// Export config builder for use in other modules
export { buildRedisConfig };

if (REDIS_ENABLED) {
  const redisConfig = buildRedisConfig();

  // Create Redis client (cluster or standalone)
  if (redisConfig.isCluster) {
    // ElastiCache Cluster Mode Enabled
    const { isCluster, ...clusterNodeConfig } = redisConfig;
    const clusterNodes = [{ host: clusterNodeConfig.host, port: clusterNodeConfig.port }];
    
    redis = new Redis.Cluster(clusterNodes, {
      redisOptions: clusterNodeConfig,
      clusterRetryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: true,
      scaleReads: 'slave', // Read from replicas for better performance
    });
    console.log('Redis: Using ElastiCache Cluster Mode');
  } else {
    redis = new Redis(redisConfig);
  }

  // Connection event handlers
  redis.on('connect', () => {
    console.log('Redis: Connecting...');
  });

  redis.on('ready', () => {
    redisAvailable = true;
    console.log('Redis: Connected and ready');
  });

  redis.on('error', (err) => {
    redisAvailable = false;
    if (isDev && err.code === 'ECONNREFUSED') {
      // Suppress verbose errors in dev when Redis isn't running
      return;
    }
    console.error('Redis: Connection error:', err.message);
  });

  redis.on('close', () => {
    redisAvailable = false;
    console.log('Redis: Connection closed');
  });

  redis.on('reconnecting', (delay) => {
    console.log(`Redis: Reconnecting in ${delay}ms...`);
  });
} else {
  console.log('Redis: Disabled via REDIS_ENABLED=false');
}

// Helper to check if Redis is available
export const isRedisAvailable = () => redisAvailable;

// Export config for other modules that need Redis connection info
export const getRedisConfig = () => buildRedisConfig();

/**
 * Explicitly connect to Redis and wait for ready state.
 * Call this during server startup to ensure Redis is connected before use.
 * @returns {Promise<boolean>} - True if connected successfully, false otherwise
 */
export const connectRedis = async () => {
  if (!redis) return false;
  if (redis.status === 'ready') return true;
  
  try {
    // ioredis connect() returns a promise when lazyConnect is true
    await redis.connect();
    return true;
  } catch (err) {
    console.error('Redis: Failed to connect:', err.message);
    return false;
  }
};

/**
 * Verify Redis connection by attempting a ping with timeout.
 * Use this to check if Redis is truly ready for use.
 * @param {number} timeoutMs - Maximum time to wait for ping response (default: 3000ms)
 * @returns {Promise<boolean>} - True if ping succeeds, false otherwise
 */
export const verifyRedisConnection = async (timeoutMs = 3000) => {
  if (!redis) {
    console.warn('Redis: Client not initialized');
    return false;
  }
  
  if (redis.status !== 'ready' && redis.status !== 'connect') {
    console.warn(`Redis: Client not in ready state (status: ${redis.status})`);
    return false;
  }
  
  try {
    const pingPromise = redis.ping();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Ping timeout')), timeoutMs);
    });
    
    const result = await Promise.race([pingPromise, timeoutPromise]);
    if (result === 'PONG') {
      console.log('Redis: Connection verified with ping');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Redis: Ping verification failed:', err.message);
    return false;
  }
};

// Graceful shutdown helper
export const closeRedis = async () => {
  if (!redis) return;
  try {
    await redis.quit();
    console.log('Redis: Connection closed gracefully');
  } catch (err) {
    console.error('Redis: Error closing connection:', err.message);
    redis.disconnect();
  }
};

// Export the Redis client as default
export default redis;
