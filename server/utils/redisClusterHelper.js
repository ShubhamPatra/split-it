/**
 * Redis Cluster Helper Utilities
 * 
 * Provides cluster-safe operations for Redis:
 * - SCAN-based key pattern matching (instead of KEYS which is not supported in cluster mode)
 * - Safe key deletion for patterns
 * - Cluster mode detection
 */

/**
 * Safely retrieve all keys matching a pattern using SCAN
 * (KEYS command is not supported in Redis Cluster mode)
 * 
 * @param {object} redis - Redis client instance
 * @param {string} pattern - Key pattern (e.g., 'socket:typing:*')
 * @param {number} count - Scan batch size (default 100)
 * @returns {Promise<Array>} Array of matching keys
 */
export const scanKeys = async (redis, pattern, count = 100) => {
  if (!redis) return [];
  
  const keys = [];
  let cursor = '0';
  
  try {
    do {
      const [nextCursor, scanKeys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count
      );
      
      cursor = nextCursor;
      if (scanKeys && scanKeys.length > 0) {
        keys.push(...scanKeys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error(`Error scanning keys with pattern ${pattern}:`, error.message);
    return [];
  }
  
  return keys;
};

/**
 * Safely delete keys matching a pattern
 * Uses SCAN to find keys, then deletes them safely
 * 
 * @param {object} redis - Redis client instance
 * @param {string} pattern - Key pattern (e.g., 'membership:123:*')
 * @returns {Promise<number>} Number of keys deleted
 */
export const deleteKeysByPattern = async (redis, pattern) => {
  if (!redis) return 0;
  
  try {
    const keys = await scanKeys(redis, pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    // Check if cluster mode - if so, delete individually to avoid CROSSSLOT errors
    if (isClusterMode(redis)) {
      let deletedCount = 0;
      for (const key of keys) {
        try {
          const result = await redis.del(key);
          deletedCount += result;
        } catch (error) {
          console.error(`Error deleting key ${key}:`, error.message);
        }
      }
      return deletedCount;
    } else {
      // Standalone Redis - safe to use DEL with multiple keys
      return await redis.del(...keys);
    }
  } catch (error) {
    console.error(`Error deleting keys with pattern ${pattern}:`, error.message);
    return 0;
  }
};

/**
 * Check if Redis is running in cluster mode
 * 
 * @param {object} redis - Redis client instance
 * @returns {boolean} True if running in cluster mode
 */
export const isClusterMode = (redis) => {
  if (!redis) return false;
  
  // ioredis cluster instance has 'nodes' property
  return redis.nodes !== undefined || redis.cluster !== undefined;
};

export default {
  scanKeys,
  deleteKeysByPattern,
  isClusterMode,
};
