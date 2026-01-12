/**
 * Queue Backend Monitoring
 * 
 * Provides monitoring and metrics for the queue system.
 * Tracks job counts, processing rates, error rates, and health status.
 */

import { getQueueBackend, isRedisBackendAvailable, getQueueSystemStatus } from '../config/queueFactory.js';
import JobQueue from '../models/JobQueue.js';

const isDev = process.env.NODE_ENV !== 'production';

// Metrics tracking
const metrics = {
    processedJobs: new Map(), // Queue -> count
    failedJobs: new Map(), // Queue -> count
    processingTimes: new Map(), // Queue -> Array of recent times
    lastResetTime: Date.now(),
    windowMs: 60000, // 1 minute window for rates
};

/**
 * Record a job completion
 */
export const recordJobCompleted = (queueName, processingTimeMs) => {
    // Update processed count
    const current = metrics.processedJobs.get(queueName) || 0;
    metrics.processedJobs.set(queueName, current + 1);

    // Update processing times (keep last 100)
    let times = metrics.processingTimes.get(queueName) || [];
    times.push({ time: processingTimeMs, timestamp: Date.now() });
    if (times.length > 100) {
        times = times.slice(-100);
    }
    metrics.processingTimes.set(queueName, times);
};

/**
 * Record a job failure
 */
export const recordJobFailed = (queueName) => {
    const current = metrics.failedJobs.get(queueName) || 0;
    metrics.failedJobs.set(queueName, current + 1);
};

/**
 * Reset metrics (called periodically)
 */
const resetMetricsIfNeeded = () => {
    const now = Date.now();
    if (now - metrics.lastResetTime > metrics.windowMs) {
        // Keep the data but mark the reset time
        metrics.lastResetTime = now;
    }
};

/**
 * Get queue metrics for all queues
 * @returns {Promise<Object>} Metrics object
 */
export const getQueueMetrics = async () => {
    resetMetricsIfNeeded();

    const backend = getQueueBackend();
    const status = await getQueueSystemStatus();

    const result = {
        backend: backend || 'not_initialized',
        redisAvailable: isRedisBackendAvailable(),
        timestamp: new Date().toISOString(),
        queues: {},
        totals: {
            processed: 0,
            failed: 0,
            waiting: 0,
            active: 0,
            delayed: 0,
        },
    };

    // Get job counts from status
    for (const [queueName, counts] of Object.entries(status.queues || {})) {
        if (counts.error) {
            result.queues[queueName] = { error: counts.error };
            continue;
        }

        const processedCount = metrics.processedJobs.get(queueName) || 0;
        const failedCount = metrics.failedJobs.get(queueName) || 0;
        const times = metrics.processingTimes.get(queueName) || [];

        // Calculate average processing time
        let avgProcessingTime = 0;
        if (times.length > 0) {
            const sum = times.reduce((acc, t) => acc + t.time, 0);
            avgProcessingTime = Math.round(sum / times.length);
        }

        // Calculate processing rate (jobs per minute)
        const recentTimes = times.filter(t => Date.now() - t.timestamp < metrics.windowMs);
        const processingRate = recentTimes.length;

        // Calculate error rate
        const totalJobs = processedCount + failedCount;
        const errorRate = totalJobs > 0 ? (failedCount / totalJobs * 100).toFixed(2) : 0;

        result.queues[queueName] = {
            ...counts,
            processed: processedCount,
            failed: failedCount,
            avgProcessingTimeMs: avgProcessingTime,
            processingRatePerMin: processingRate,
            errorRate: `${errorRate}%`,
        };

        // Update totals
        result.totals.processed += processedCount;
        result.totals.failed += failedCount;
        result.totals.waiting += counts.waiting || 0;
        result.totals.active += counts.active || 0;
        result.totals.delayed += counts.delayed || 0;
    }

    return result;
};

/**
 * Check queue health
 * @returns {Promise<Object>} Health status object
 */
export const checkQueueHealth = async () => {
    const backend = getQueueBackend();
    const startTime = Date.now();

    const health = {
        healthy: false,
        status: 'unknown',
        backend: backend || 'not_initialized',
        latency: null,
        details: {},
        timestamp: new Date().toISOString(),
    };

    try {
        if (!backend) {
            health.status = 'not_initialized';
            health.details.message = 'Queue system not initialized';
            return health;
        }

        if (backend === 'redis') {
            // Test Redis connectivity via a queue operation
            const status = await getQueueSystemStatus();
            health.latency = Date.now() - startTime;

            if (status.error) {
                health.status = 'degraded';
                health.details.error = status.error;
            } else {
                health.healthy = true;
                health.status = 'healthy';
            }
        } else if (backend === 'mongodb') {
            // Test MongoDB queue connectivity
            const testStart = Date.now();
            await JobQueue.countDocuments({ status: 'pending' }).limit(1);
            health.latency = Date.now() - testStart;

            // MongoDB fallback is considered "degraded" even when working
            health.healthy = true;
            health.status = 'degraded';
            health.details.message = 'Using MongoDB fallback - higher latency expected';
        }

        // Check for stuck jobs (processing > 10 minutes)
        if (backend === 'mongodb') {
            const stuckJobCutoff = new Date(Date.now() - 10 * 60 * 1000);
            const stuckJobs = await JobQueue.countDocuments({
                status: 'processing',
                processingStartedAt: { $lt: stuckJobCutoff }
            });

            if (stuckJobs > 0) {
                health.details.stuckJobs = stuckJobs;
                health.status = 'degraded';
            }
        }

        // Check error rates
        const metrics = await getQueueMetrics();
        const totalProcessed = metrics.totals.processed;
        const totalFailed = metrics.totals.failed;

        if (totalProcessed + totalFailed > 0) {
            const errorRate = totalFailed / (totalProcessed + totalFailed);
            if (errorRate > 0.05) { // > 5% error rate
                health.status = 'degraded';
                health.details.highErrorRate = `${(errorRate * 100).toFixed(2)}%`;
            }
        }

    } catch (error) {
        health.status = 'down';
        health.healthy = false;
        health.details.error = error.message;
        health.latency = Date.now() - startTime;
    }

    return health;
};

/**
 * Get detailed queue diagnostics
 */
export const getQueueDiagnostics = async () => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {
            nodeEnv: process.env.NODE_ENV,
            redisEnabled: process.env.REDIS_ENABLED,
            queueBackend: process.env.QUEUE_BACKEND,
            redisHost: process.env.REDIS_HOST ? '***configured***' : 'not_set',
            redisClusterMode: process.env.REDIS_CLUSTER_MODE,
            redisTls: process.env.REDIS_TLS,
        },
        status: await getQueueSystemStatus(),
        health: await checkQueueHealth(),
        metrics: await getQueueMetrics(),
    };

    return diagnostics;
};

export default {
    recordJobCompleted,
    recordJobFailed,
    getQueueMetrics,
    checkQueueHealth,
    getQueueDiagnostics,
};
