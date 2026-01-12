/**
 * Unified Queue Module
 * 
 * This is the main entry point for queue operations.
 * It provides a unified interface that works with both Redis (BullMQ) and MongoDB backends.
 * 
 * Usage:
 *   import { emailQueue, createWorker } from './config/queue.js';
 *   
 *   // Add a job
 *   await emailQueue.add('sendWelcome', { userId: '123' });
 *   
 *   // Create a worker
 *   const worker = await createWorker('email', async (job) => {
 *     // Process job
 *   });
 */

import {
    initializeQueueSystem,
    getQueueBackend,
    getQueueBackendConfig,
    isRedisBackendAvailable,
    createUnifiedQueue,
    createUnifiedWorker,
    getQueueSystemStatus,
    switchQueueBackend,
} from './queueFactory.js';

// Re-export BullMQ module for backward compatibility
import * as bullmqModule from './queueBullMQ.js';

const isDev = process.env.NODE_ENV !== 'production';

// Track initialization state
let initialized = false;
let initPromise = null;
let queues = null;

/**
 * Initialize the queue system
 */
export const initializeQueues = async () => {
    if (initialized) return queues;

    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const result = await initializeQueueSystem();
            queues = result.queues;
            initialized = true;

            console.log(`Queue: System initialized with ${result.backend} backend`);

            return result;
        } catch (error) {
            console.error('Queue: Failed to initialize:', error.message);
            throw error;
        }
    })();

    return initPromise;
};

/**
 * Wait for queues to be ready (backward compatible with BullMQ module)
 */
export const waitForQueues = async () => {
    // For 'auto' mode, we try to initialize the queue system
    const backendConfig = getQueueBackendConfig();

    if (backendConfig === 'redis') {
        // Force Redis mode - use BullMQ's waitForQueues directly
        return bullmqModule.waitForQueues();
    }

    // Auto or MongoDB mode - initialize via factory
    await initializeQueues();
};

/**
 * Check if queues are available
 */
export const areQueuesAvailable = () => {
    // If we have MongoDB fallback, queues are always available
    const backendConfig = getQueueBackendConfig();

    if (backendConfig === 'redis') {
        return bullmqModule.areQueuesAvailable();
    }

    // In auto/mongodb mode, return true if we've initialized
    return initialized || bullmqModule.areQueuesAvailable();
};

/**
 * Get the current queue backend type
 */
export { getQueueBackend, isRedisBackendAvailable };

/**
 * Create a worker for processing jobs
 * This is the recommended way to create workers as it works with both backends
 */
export const createWorker = async (queueName, processor, options = {}) => {
    await initializeQueues();
    return createUnifiedWorker(queueName, processor, options);
};

/**
 * Queue name constants - use these for queue identification
 */
export const QUEUE_NAMES = {
    EMAIL: 'email',
    NOTIFICATION: 'notification',
    BALANCE: 'balance',
    RECURRING: 'recurring',
    DIGEST: 'digest',
    DUE_REMINDER: 'dueReminder',
};

/**
 * Lazy queue accessors - these return queue instances that work with either backend
 */
const createLazyQueue = (queueName) => {
    let queue = null;

    return {
        async add(jobName, data, opts) {
            if (!queue) {
                await initializeQueues();
                queue = queues?.[queueName] || createUnifiedQueue(queueName);
            }
            return queue.add(jobName, data, opts);
        },

        async addBulk(jobs) {
            if (!queue) {
                await initializeQueues();
                queue = queues?.[queueName] || createUnifiedQueue(queueName);
            }
            return queue.addBulk(jobs);
        },

        async getJobCounts() {
            if (!queue) {
                await initializeQueues();
                queue = queues?.[queueName] || createUnifiedQueue(queueName);
            }
            return queue.getJobCounts();
        },

        async close() {
            if (queue) {
                await queue.close();
            }
        },

        on(event, handler) {
            // Event handling - forward to underlying queue if available
            if (queue && typeof queue.on === 'function') {
                queue.on(event, handler);
            }
        },
    };
};

// Create lazy queue instances
export const emailQueue = createLazyQueue('email');
export const notificationQueue = createLazyQueue('notification');
export const balanceQueue = createLazyQueue('balance');
export const recurringQueue = createLazyQueue('recurring');
export const digestQueue = createLazyQueue('digest');
export const dueReminderQueue = createLazyQueue('dueReminder');

/**
 * Close all queues
 */
export const closeAllQueues = async () => {
    const backend = getQueueBackend();

    if (backend === 'redis') {
        // Use BullMQ's closeAllQueues
        return bullmqModule.closeAllQueues();
    }

    // For MongoDB, close our queue instances
    const closePromises = [
        emailQueue.close(),
        notificationQueue.close(),
        balanceQueue.close(),
        recurringQueue.close(),
        digestQueue.close(),
        dueReminderQueue.close(),
    ];

    await Promise.all(closePromises.map(p => p.catch(err => {
        console.error('Error closing queue:', err.message);
    })));

    console.log('Queue: All queues closed');
};

// Backward compatibility alias
export const closeQueues = closeAllQueues;

/**
 * Get queue system status for monitoring
 */
export { getQueueSystemStatus };

/**
 * Switch queue backend (for admin/emergency use)
 */
export { switchQueueBackend };

/**
 * Re-export BullMQ specific functions for workers that need direct access
 * These are used only when the Redis backend is active
 */
export const getSharedConnection = () => bullmqModule.getSharedConnection();
export const getSharedBlockingConnection = () => bullmqModule.getSharedBlockingConnection();
export const createConnection = () => bullmqModule.createConnection();
export const createQueueEvents = (name) => bullmqModule.createQueueEvents(name);
export const defaultJobOptions = bullmqModule.defaultJobOptions;

// BullMQ queue names (with hash tags for Redis Cluster)
export const BULLMQ_QUEUE_NAMES = bullmqModule.QUEUE_NAMES;

export default {
    // Queue instances
    emailQueue,
    notificationQueue,
    balanceQueue,
    recurringQueue,
    digestQueue,
    dueReminderQueue,

    // Functions
    initializeQueues,
    waitForQueues,
    areQueuesAvailable,
    createWorker,
    closeQueues: closeAllQueues,
    closeAllQueues,

    // Status and monitoring
    getQueueBackend,
    isRedisBackendAvailable,
    getQueueSystemStatus,
    switchQueueBackend,

    // Queue names
    QUEUE_NAMES,
    BULLMQ_QUEUE_NAMES,

    // BullMQ backward compatibility
    getSharedConnection,
    getSharedBlockingConnection,
    createConnection,
    createQueueEvents,
    defaultJobOptions,
};
