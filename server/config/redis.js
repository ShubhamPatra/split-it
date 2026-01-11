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
 * - Amazon ElastiCache (production)
 * - Redis Cluster mode
 * - TLS/SSL connections
 */
const buildRedisConfig = () => {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null, // Required for BullMQ compatibility
    enableReadyCheck: true,
    enableOfflineQueue: true, // Queue commands while connecting - CRITICAL for stability
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT, 10) || 5000,
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE, 10) || 30000,
    retryStrategy: (times) => {
      // NEVER return null/undefined - always return a delay to prevent "undefinedms" errors
      if (times > 20) {
        console.error(`Redis: Max retry attempts (${times}) reached. Continuing with 30s delay.`);
        return 30000; // 30 seconds max delay, but keep retrying
      }
      if (isDev && times > 3) {
        console.warn('Redis: Not available in dev mode. Retrying with longer delay.');
        return 5000; // 5 seconds in dev mode
      }
      // Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
      const delay = Math.min(times * 1000, 30000);
      console.log(`Redis: Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    // Handle cluster-specific errors gracefully
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'CLUSTERDOWN', 'LOADING', 'MOVED', 'ASK'];
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
    
    // Use Configuration Endpoint for ElastiCache Cluster
    const clusterNodes = [{ host: clusterNodeConfig.host, port: clusterNodeConfig.port }];
    
    redis = new Redis.Cluster(clusterNodes, {
      // DNS lookup for proper resolution of cluster configuration endpoint
      dnsLookup: (address, callback) => callback(null, address),
      enableReadyCheck: true,
      slotsRefreshTimeout: 10000, // Prevent "Failed to refresh slots cache" errors
      slotsRefreshInterval: 5000, // Refresh slots every 5 seconds
      redisOptions: {
        ...clusterNodeConfig,
        enableOfflineQueue: true, // CRITICAL: Allow commands to queue during reconnections
        connectTimeout: clusterNodeConfig.connectTimeout || 10000,
        commandTimeout: clusterNodeConfig.commandTimeout || 5000,
        keepAlive: clusterNodeConfig.keepAlive || 30000,
      },
      clusterRetryStrategy: (times) => {
        // NEVER return null - always return a delay
        if (times > 20) {
          console.error(`Redis Cluster: Max retry attempts (${times}) reached. Continuing with 30s delay.`);
          return 30000;
        }
        const delay = Math.min(times * 1000, 30000);
        console.log(`Redis Cluster: Retrying connection in ${delay}ms (attempt ${times})`);
        return delay;
      },
      scaleReads: 'slave', // Read from replicas for better performance
    });
    console.log('Redis: Using ElastiCache Cluster Mode');
    
    // Cluster-specific event handlers
    redis.on('node error', (err, node) => {
      console.error(`Redis Cluster: Node error on ${node?.options?.host}:${node?.options?.port}:`, err.message);
    });
    
    redis.on('+node', (node) => {
      console.log(`Redis Cluster: Node added - ${node?.options?.host}:${node?.options?.port}`);
    });
    
    redis.on('-node', (node) => {
      console.log(`Redis Cluster: Node removed - ${node?.options?.host}:${node?.options?.port}`);
    });
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
