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

if (REDIS_ENABLED) {
  // Redis configuration from environment
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null, // Required for BullMQ compatibility
    enableReadyCheck: true,
    lazyConnect: true, // Don't connect immediately
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
      const delay = Math.min(times * 200, 2000);
      console.log(`Redis: Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
  };

  // Add password if provided
  if (process.env.REDIS_PASSWORD) {
    redisConfig.password = process.env.REDIS_PASSWORD;
  }

  // Create Redis client
  redis = new Redis(redisConfig);

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

  // Attempt initial connection (non-blocking)
  redis.connect().catch(() => {
    if (isDev) {
      console.warn('Redis: Not available in development. Queued features disabled.');
    }
  });
} else {
  console.log('Redis: Disabled via REDIS_ENABLED=false');
}

// Helper to check if Redis is available
export const isRedisAvailable = () => redisAvailable;

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
