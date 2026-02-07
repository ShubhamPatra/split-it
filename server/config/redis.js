/**
 * Redis Configuration and Client Management
 * 
 * Provides Redis client instances for caching and pub/sub operations.
 * Gracefully falls back to in-memory caching when Redis is not available.
 * 
 * Environment Variables:
 *   REDIS_URL - Redis connection URL (e.g., redis://localhost:6379)
 *   REDIS_PASSWORD - Redis password (optional)
 *   REDIS_TLS - Enable TLS for Redis connection (optional, default: false)
 */

import { createClient } from 'redis';

// Redis clients
let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;
let isRedisAvailable = false;

// Connection state
let isConnecting = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000; // 5 seconds

/**
 * Create Redis client with configuration
 */
function createRedisClient(clientName = 'default') {
  const config = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error(`Redis ${clientName}: Too many reconnection attempts, giving up`);
          return new Error('Too many reconnection attempts');
        }
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, 5000ms (max)
        const delay = Math.min(100 * Math.pow(2, retries), 5000);
        console.log(`Redis ${clientName}: Reconnecting in ${delay}ms (attempt ${retries + 1})`);
        return delay;
      },
    },
  };

  // Add password if provided
  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  // Enable TLS if specified
  if (process.env.REDIS_TLS === 'true') {
    config.socket.tls = true;
    // Set rejectUnauthorized based on env var, defaulting to true for security
    // Only set to false if explicitly disabled (for self-signed certificates)
    config.socket.rejectUnauthorized = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false';
  }

  const client = createClient(config);

  // Error handling
  client.on('error', (err) => {
    console.error(`Redis ${clientName} error:`, err.message);
    isRedisAvailable = false;
  });

  client.on('connect', () => {
    console.log(`Redis ${clientName}: Connected`);
  });

  client.on('ready', () => {
    console.log(`Redis ${clientName}: Ready`);
    isRedisAvailable = true;
    connectionAttempts = 0;
  });

  client.on('reconnecting', () => {
    console.log(`Redis ${clientName}: Reconnecting...`);
    isRedisAvailable = false;
  });

  client.on('end', () => {
    console.log(`Redis ${clientName}: Connection closed`);
    isRedisAvailable = false;
  });

  return client;
}

/**
 * Initialize Redis clients
 */
export async function initializeRedis() {
  // Skip if Redis URL is not configured
  if (!process.env.REDIS_URL) {
    console.log('Redis: Not configured (REDIS_URL not set), using in-memory cache');
    return false;
  }

  // Skip if already connecting
  if (isConnecting) {
    console.log('Redis: Connection already in progress');
    return false;
  }

  // Skip if max connection attempts reached
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    console.error('Redis: Max connection attempts reached, using in-memory cache');
    return false;
  }

  isConnecting = true;
  connectionAttempts++;

  try {
    console.log(`Redis: Initializing connection (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`);

    // Create main client for caching
    redisClient = createRedisClient('main');
    await redisClient.connect();

    // Create pub/sub clients for Socket.IO adapter
    // These are always created when Redis is available for Socket.IO horizontal scaling
    redisPubClient = createRedisClient('pub');
    redisSubClient = createRedisClient('sub');

    await Promise.all([
      redisPubClient.connect(),
      redisSubClient.connect(),
    ]);

    console.log('Redis: Pub/Sub clients initialized for Socket.IO adapter');

    isRedisAvailable = true;
    isConnecting = false;

    console.log('Redis: Initialization complete');
    return true;

  } catch (error) {
    console.error('Redis: Initialization failed:', error.message);
    isRedisAvailable = false;
    isConnecting = false;

    // Clean up partial connections
    await cleanupRedis();

    // Retry after delay if not max attempts
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      console.log(`Redis: Retrying in ${RECONNECT_DELAY / 1000} seconds...`);
      setTimeout(() => initializeRedis(), RECONNECT_DELAY);
    } else {
      console.log('Redis: Falling back to in-memory cache');
    }

    return false;
  }
}

/**
 * Get Redis client
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Get Redis pub/sub clients
 */
export function getRedisPubSubClients() {
  return {
    pubClient: redisPubClient,
    subClient: redisSubClient,
  };
}

/**
 * Check if Redis is available
 */
export function isRedisConnected() {
  return isRedisAvailable && redisClient?.isReady;
}

/**
 * Cleanup Redis connections
 */
export async function cleanupRedis() {
  console.log('Redis: Cleaning up connections...');

  const clients = [
    { client: redisClient, name: 'main' },
    { client: redisPubClient, name: 'pub' },
    { client: redisSubClient, name: 'sub' },
  ];

  for (const { client, name } of clients) {
    if (client) {
      try {
        if (client.isOpen) {
          await client.quit();
          console.log(`Redis ${name}: Disconnected gracefully`);
        }
      } catch (error) {
        console.error(`Redis ${name}: Error during cleanup:`, error.message);
        try {
          await client.disconnect();
        } catch (disconnectError) {
          console.error(`Redis ${name}: Force disconnect failed:`, disconnectError.message);
        }
      }
    }
  }

  redisClient = null;
  redisPubClient = null;
  redisSubClient = null;
  isRedisAvailable = false;
  isConnecting = false;

  console.log('Redis: Cleanup complete');
}

/**
 * Redis cache wrapper with fallback
 */
export class RedisCache {
  constructor(keyPrefix = '', defaultTTL = 900) {
    this.keyPrefix = keyPrefix;
    this.defaultTTL = defaultTTL; // seconds
    this.inMemoryCache = new Map(); // Fallback cache
  }

  /**
   * Build cache key with prefix
   */
  _buildKey(key) {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  /**
   * Get value from cache
   */
  async get(key) {
    const fullKey = this._buildKey(key);

    // Try Redis first
    if (isRedisConnected()) {
      try {
        const value = await redisClient.get(fullKey);
        if (value) {
          return JSON.parse(value);
        }
        return null;
      } catch (error) {
        console.error('Redis get error:', error.message);
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache
    const cached = this.inMemoryCache.get(fullKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    return null;
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = null) {
    const fullKey = this._buildKey(key);
    const ttlSeconds = ttl || this.defaultTTL;

    // Try Redis first
    if (isRedisConnected()) {
      try {
        await redisClient.setEx(fullKey, ttlSeconds, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('Redis set error:', error.message);
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache
    this.inMemoryCache.set(fullKey, {
      data: value,
      expiry: Date.now() + (ttlSeconds * 1000),
    });

    return true;
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    const fullKey = this._buildKey(key);

    // Try Redis first
    if (isRedisConnected()) {
      try {
        await redisClient.del(fullKey);
      } catch (error) {
        console.error('Redis delete error:', error.message);
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache
    this.inMemoryCache.delete(fullKey);

    return true;
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    const fullKey = this._buildKey(key);

    // Try Redis first
    if (isRedisConnected()) {
      try {
        const exists = await redisClient.exists(fullKey);
        return exists === 1;
      } catch (error) {
        console.error('Redis exists error:', error.message);
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache
    const cached = this.inMemoryCache.get(fullKey);
    return cached && cached.expiry > Date.now();
  }

  /**
   * Get TTL for key
   */
  async ttl(key) {
    const fullKey = this._buildKey(key);

    // Try Redis first
    if (isRedisConnected()) {
      try {
        const ttl = await redisClient.ttl(fullKey);
        return ttl;
      } catch (error) {
        console.error('Redis ttl error:', error.message);
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache
    const cached = this.inMemoryCache.get(fullKey);
    if (cached && cached.expiry > Date.now()) {
      return Math.floor((cached.expiry - Date.now()) / 1000);
    }

    return -2; // Key doesn't exist
  }

  /**
   * Clear all keys with prefix
   * Uses SCAN instead of KEYS for production safety (non-blocking)
   */
  async clear() {
    // Try Redis first
    if (isRedisConnected()) {
      try {
        const pattern = this.keyPrefix ? `${this.keyPrefix}:*` : '*';
        let cursor = 0;
        let keysToDelete = [];

        // Use SCAN to iterate through keys without blocking
        do {
          const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
          cursor = result.cursor;
          if (result.keys && result.keys.length > 0) {
            keysToDelete = keysToDelete.concat(result.keys);
          }
        } while (cursor !== 0);

        // Delete keys in batches
        if (keysToDelete.length > 0) {
          // Delete in batches of 100 to avoid blocking
          for (let i = 0; i < keysToDelete.length; i += 100) {
            const batch = keysToDelete.slice(i, i + 100);
            await redisClient.del(batch);
          }
        }
      } catch (error) {
        console.error('Redis clear error:', error.message);
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache
    if (this.keyPrefix) {
      for (const key of this.inMemoryCache.keys()) {
        if (key.startsWith(this.keyPrefix)) {
          this.inMemoryCache.delete(key);
        }
      }
    } else {
      this.inMemoryCache.clear();
    }

    return true;
  }

  /**
   * Get cache size
   * Uses SCAN instead of KEYS for production safety (non-blocking)
   */
  async size() {
    // Try Redis first
    if (isRedisConnected()) {
      try {
        const pattern = this.keyPrefix ? `${this.keyPrefix}:*` : '*';
        let count = 0;
        let cursor = 0;

        // Use SCAN to count keys without blocking
        do {
          const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
          cursor = result.cursor;
          if (result.keys) {
            count += result.keys.length;
          }
        } while (cursor !== 0);

        return count;
      } catch (error) {
        console.error('Redis size error:', error.message);
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache
    if (this.keyPrefix) {
      let count = 0;
      for (const key of this.inMemoryCache.keys()) {
        if (key.startsWith(this.keyPrefix)) {
          count++;
        }
      }
      return count;
    }

    return this.inMemoryCache.size;
  }

  /**
   * Clean up expired entries (for in-memory cache)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.inMemoryCache.entries()) {
      if (value.expiry < now) {
        this.inMemoryCache.delete(key);
      }
    }
  }
}

const redisModule = {
  initializeRedis,
  getRedisClient,
  getRedisPubSubClients,
  isRedisConnected,
  cleanupRedis,
  RedisCache,
};

export default redisModule;
