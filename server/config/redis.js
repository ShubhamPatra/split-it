import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Redis configuration from environment
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
  enableReadyCheck: true,
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('Redis: Max retry attempts reached. Giving up.');
      return null; // Stop retrying
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
const redis = new Redis(redisConfig);

// Connection event handlers
redis.on('connect', () => {
  console.log('Redis: Connecting...');
});

redis.on('ready', () => {
  console.log('Redis: Connected and ready');
});

redis.on('error', (err) => {
  console.error('Redis: Connection error:', err.message);
});

redis.on('close', () => {
  console.log('Redis: Connection closed');
});

redis.on('reconnecting', (delay) => {
  console.log(`Redis: Reconnecting in ${delay}ms...`);
});

// Graceful shutdown helper
export const closeRedis = async () => {
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
