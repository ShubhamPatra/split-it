/**
 * Redis Health Check Utilities
 * 
 * Provides health check functions for Redis Cluster connections,
 * including ping tests, slot coverage verification, and TLS status.
 */

import Redis from 'ioredis';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Check health of a Redis Cluster connection
 * @param {Redis.Cluster|Redis} connection - Redis connection instance
 * @returns {Promise<Object>} Health status object
 */
export const checkRedisClusterHealth = async (connection) => {
    const health = {
        healthy: false,
        timestamp: new Date().toISOString(),
        latency: null,
        clusterMode: false,
        nodeCount: 0,
        slotCoverage: null,
        tlsEnabled: false,
        errors: [],
    };

    if (!connection) {
        health.errors.push('No connection provided');
        return health;
    }

    try {
        // Check if this is a cluster connection
        health.clusterMode = connection instanceof Redis.Cluster;

        // Measure ping latency
        const startTime = Date.now();
        const pingResult = await Promise.race([
            connection.ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 5000))
        ]);
        health.latency = Date.now() - startTime;

        if (pingResult !== 'PONG') {
            health.errors.push(`Unexpected ping response: ${pingResult}`);
            return health;
        }

        // Check TLS status (if available in options)
        if (connection.options?.tls || connection.options?.redisOptions?.tls) {
            health.tlsEnabled = true;
        }

        if (health.clusterMode) {
            // Get cluster-specific health info
            try {
                const nodes = connection.nodes('all');
                health.nodeCount = nodes.length;

                // Check cluster info from a random node
                const clusterInfo = await connection.cluster('INFO');
                if (clusterInfo) {
                    // Parse cluster_state from response
                    const stateMatch = clusterInfo.match(/cluster_state:(\w+)/);
                    if (stateMatch && stateMatch[1] === 'ok') {
                        health.slotCoverage = 'complete';
                    } else {
                        health.slotCoverage = 'incomplete';
                        health.errors.push('Cluster state is not OK');
                    }

                    // Parse cluster_slots_assigned
                    const slotsMatch = clusterInfo.match(/cluster_slots_assigned:(\d+)/);
                    if (slotsMatch) {
                        const slotsAssigned = parseInt(slotsMatch[1], 10);
                        if (slotsAssigned !== 16384) {
                            health.errors.push(`Only ${slotsAssigned}/16384 slots assigned`);
                            health.slotCoverage = 'incomplete';
                        }
                    }
                }
            } catch (clusterErr) {
                // CLUSTER commands may not be available on all Redis setups
                if (isDev) {
                    console.log('Redis health check: CLUSTER INFO not available:', clusterErr.message);
                }
                health.nodeCount = 1; // Assume single node if cluster info unavailable
            }
        } else {
            health.nodeCount = 1;
            health.slotCoverage = 'n/a (standalone)';
        }

        health.healthy = health.errors.length === 0;
    } catch (err) {
        health.errors.push(err.message);
    }

    return health;
};

/**
 * Wait for Redis connection to be ready with exponential backoff
 * @param {Redis|Redis.Cluster} connection - Redis connection instance
 * @param {number} timeout - Maximum time to wait in ms (default: 30000)
 * @param {number} initialDelay - Initial retry delay in ms (default: 1000)
 * @returns {Promise<boolean>} True if connection is ready, false if timeout
 */
export const waitForRedisReady = async (connection, timeout = 30000, initialDelay = 1000) => {
    if (!connection) {
        console.error('waitForRedisReady: No connection provided');
        return false;
    }

    const startTime = Date.now();
    let delay = initialDelay;
    let attempt = 0;

    while (Date.now() - startTime < timeout) {
        attempt++;

        try {
            // Check if already connected
            if (connection.status === 'ready') {
                // Verify with ping
                const pong = await Promise.race([
                    connection.ping(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 3000))
                ]);
                if (pong === 'PONG') {
                    if (isDev) {
                        console.log(`Redis connection ready after ${attempt} attempt(s), ${Date.now() - startTime}ms`);
                    }
                    return true;
                }
            }

            // Wait for ready event or delay
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    connection.removeListener('ready', onReady);
                    connection.removeListener('error', onError);
                    resolve();
                }, delay);

                const onReady = () => {
                    clearTimeout(timeoutId);
                    connection.removeListener('error', onError);
                    resolve();
                };

                const onError = (err) => {
                    clearTimeout(timeoutId);
                    connection.removeListener('ready', onReady);
                    // Don't reject, just continue loop
                    resolve();
                };

                connection.once('ready', onReady);
                connection.once('error', onError);
            });

            // Exponential backoff (max 10s)
            delay = Math.min(delay * 2, 10000);
        } catch (err) {
            if (isDev) {
                console.log(`Redis connection attempt ${attempt} failed:`, err.message);
            }
            // Continue loop
        }
    }

    console.error(`Redis connection timeout after ${timeout}ms and ${attempt} attempts`);
    return false;
};

/**
 * Perform a quick connectivity test
 * @param {Redis|Redis.Cluster} connection - Redis connection instance
 * @returns {Promise<{connected: boolean, latency: number|null, error: string|null}>}
 */
export const quickConnectionTest = async (connection) => {
    const result = {
        connected: false,
        latency: null,
        error: null,
    };

    if (!connection) {
        result.error = 'No connection provided';
        return result;
    }

    try {
        const startTime = Date.now();
        const pong = await Promise.race([
            connection.ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout (3s)')), 3000))
        ]);
        result.latency = Date.now() - startTime;
        result.connected = pong === 'PONG';
        if (!result.connected) {
            result.error = `Unexpected ping response: ${pong}`;
        }
    } catch (err) {
        result.error = err.message;
    }

    return result;
};

/**
 * Circuit breaker state for reconnection attempts
 */
const circuitBreaker = {
    failures: [],
    maxFailures: 10,
    windowMs: 60000, // 60 second window
    isOpen: false,
    lastOpenTime: null,
    cooldownMs: 30000, // 30 second cooldown when open
};

/**
 * Check if circuit breaker allows a reconnection attempt
 * @returns {boolean} True if reconnection is allowed
 */
export const canAttemptReconnection = () => {
    const now = Date.now();

    // Clean up old failures outside the window
    circuitBreaker.failures = circuitBreaker.failures.filter(
        (time) => now - time < circuitBreaker.windowMs
    );

    // If circuit is open, check if cooldown has passed
    if (circuitBreaker.isOpen) {
        if (now - circuitBreaker.lastOpenTime > circuitBreaker.cooldownMs) {
            circuitBreaker.isOpen = false;
            circuitBreaker.failures = [];
            console.log('Redis circuit breaker: Closed, allowing reconnection attempts');
            return true;
        }
        return false;
    }

    return true;
};

/**
 * Record a reconnection failure
 */
export const recordReconnectionFailure = () => {
    const now = Date.now();
    circuitBreaker.failures.push(now);

    // Check if we've exceeded the failure threshold
    if (circuitBreaker.failures.length >= circuitBreaker.maxFailures) {
        circuitBreaker.isOpen = true;
        circuitBreaker.lastOpenTime = now;
        console.error(
            `Redis circuit breaker: OPEN - Too many reconnection attempts (${circuitBreaker.failures.length}) in ${circuitBreaker.windowMs / 1000}s window. Cooling down for ${circuitBreaker.cooldownMs / 1000}s.`
        );
    }
};

/**
 * Record a successful reconnection
 */
export const recordReconnectionSuccess = () => {
    circuitBreaker.failures = [];
    circuitBreaker.isOpen = false;
    circuitBreaker.lastOpenTime = null;
};

/**
 * Get circuit breaker status
 * @returns {Object} Circuit breaker state
 */
export const getCircuitBreakerStatus = () => ({
    isOpen: circuitBreaker.isOpen,
    failureCount: circuitBreaker.failures.length,
    maxFailures: circuitBreaker.maxFailures,
    windowMs: circuitBreaker.windowMs,
    cooldownMs: circuitBreaker.cooldownMs,
    lastOpenTime: circuitBreaker.lastOpenTime,
});

export default {
    checkRedisClusterHealth,
    waitForRedisReady,
    quickConnectionTest,
    canAttemptReconnection,
    recordReconnectionFailure,
    recordReconnectionSuccess,
    getCircuitBreakerStatus,
};
