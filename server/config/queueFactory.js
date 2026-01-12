/**
 * Queue Factory with Feature Flags
 * 
 * Provides a unified queue interface that can use either Redis (BullMQ) or MongoDB backend.
 * Supports automatic fallback from Redis to MongoDB when Redis is unavailable.
 */

import { EventEmitter } from 'events';

// Lazy imports to avoid circular dependencies
let bullmqModule = null;
let mongodbModule = null;

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Current queue backend state
 */
let currentBackend = null;
let backendInitialized = false;
let redisAvailable = false;

/**
 * Get the queue backend type from environment
 * @returns {'redis' | 'mongodb' | 'auto'}
 */
export const getQueueBackendConfig = () => {
    return process.env.QUEUE_BACKEND || 'auto';
};

/**
 * Get the currently active queue backend
 * @returns {'redis' | 'mongodb' | null}
 */
export const getQueueBackend = () => currentBackend;

/**
 * Check if Redis backend is available
 */
export const isRedisBackendAvailable = () => redisAvailable;

/**
 * Load BullMQ module (lazy)
 */
const loadBullMQModule = async () => {
    if (!bullmqModule) {
        bullmqModule = await import('./queueBullMQ.js');
    }
    return bullmqModule;
};

/**
 * Load MongoDB queue module (lazy)
 */
const loadMongoDBModule = async () => {
    if (!mongodbModule) {
        mongodbModule = await import('./queueMongoDB.js');
    }
    return mongodbModule;
};

/**
 * Initialize the queue system based on configuration
 * @returns {Promise<{backend: string, queues: Object, createWorker: Function}>}
 */
export const initializeQueueSystem = async () => {
    if (backendInitialized) {
        return { backend: currentBackend };
    }

    const backendConfig = getQueueBackendConfig();
    console.log(`Queue Factory: Initializing with backend config: ${backendConfig}`);

    if (backendConfig === 'redis') {
        // Force Redis - fail if not available
        return await initializeRedisBackend(true);
    } else if (backendConfig === 'mongodb') {
        // Force MongoDB
        return await initializeMongoDBBackend();
    } else {
        // Auto mode - try Redis first, fall back to MongoDB
        try {
            const result = await initializeRedisBackend(false);
            if (result.available) {
                return result;
            }
        } catch (error) {
            console.warn('Queue Factory: Redis backend failed, falling back to MongoDB:', error.message);
        }

        return await initializeMongoDBBackend();
    }
};

/**
 * Initialize Redis (BullMQ) backend
 */
const initializeRedisBackend = async (required = false) => {
    try {
        const bullmq = await loadBullMQModule();

        // Wait for BullMQ queues to be ready
        await bullmq.waitForQueues();

        // Check if queues are actually available (not mocks)
        if (!bullmq.areQueuesAvailable()) {
            if (required) {
                throw new Error('Redis queues are required but not available');
            }
            return { available: false };
        }

        currentBackend = 'redis';
        backendInitialized = true;
        redisAvailable = true;

        console.log('Queue Factory: Using Redis (BullMQ) backend');

        return {
            backend: 'redis',
            available: true,
            queues: {
                email: bullmq.emailQueue,
                notification: bullmq.notificationQueue,
                balance: bullmq.balanceQueue,
                recurring: bullmq.recurringQueue,
                digest: bullmq.digestQueue,
                dueReminder: bullmq.dueReminderQueue,
            },
            createWorker: bullmq.createWorker,
            QUEUE_NAMES: bullmq.QUEUE_NAMES,
        };
    } catch (error) {
        if (required) {
            throw error;
        }
        console.warn('Queue Factory: Redis backend initialization failed:', error.message);
        return { available: false };
    }
};

/**
 * Initialize MongoDB backend
 */
const initializeMongoDBBackend = async () => {
    try {
        const mongodb = await loadMongoDBModule();

        currentBackend = 'mongodb';
        backendInitialized = true;
        redisAvailable = false;

        console.log('Queue Factory: Using MongoDB fallback backend');
        console.warn('Queue Factory: MongoDB backend has higher latency than Redis. Consider fixing Redis connection.');

        // Create queue instances
        const queues = {
            email: mongodb.createMongoQueue(mongodb.MONGO_QUEUE_NAMES.EMAIL, {
                defaultJobOptions: { attempts: 5 }
            }),
            notification: mongodb.createMongoQueue(mongodb.MONGO_QUEUE_NAMES.NOTIFICATION),
            balance: mongodb.createMongoQueue(mongodb.MONGO_QUEUE_NAMES.BALANCE, {
                defaultJobOptions: { timeout: 30000 }
            }),
            recurring: mongodb.createMongoQueue(mongodb.MONGO_QUEUE_NAMES.RECURRING, {
                defaultJobOptions: { attempts: 1 }
            }),
            digest: mongodb.createMongoQueue(mongodb.MONGO_QUEUE_NAMES.DIGEST),
            dueReminder: mongodb.createMongoQueue(mongodb.MONGO_QUEUE_NAMES.DUE_REMINDER),
        };

        return {
            backend: 'mongodb',
            available: true,
            queues,
            createWorker: mongodb.createMongoWorker,
            QUEUE_NAMES: mongodb.MONGO_QUEUE_NAMES,
        };
    } catch (error) {
        console.error('Queue Factory: MongoDB backend initialization failed:', error.message);
        throw error;
    }
};

/**
 * Unified queue interface that delegates to the active backend
 */
class UnifiedQueue extends EventEmitter {
    constructor(queueName) {
        super();
        this.queueName = queueName;
        this._queue = null;
    }

    async _getQueue() {
        if (this._queue) return this._queue;

        await initializeQueueSystem();

        if (currentBackend === 'redis') {
            const bullmq = await loadBullMQModule();
            const queueMap = {
                email: bullmq.emailQueue,
                notification: bullmq.notificationQueue,
                balance: bullmq.balanceQueue,
                recurring: bullmq.recurringQueue,
                digest: bullmq.digestQueue,
                dueReminder: bullmq.dueReminderQueue,
            };
            this._queue = queueMap[this.queueName];
        } else {
            const mongodb = await loadMongoDBModule();
            this._queue = mongodb.createMongoQueue(this.queueName);
        }

        return this._queue;
    }

    async add(jobName, data, opts) {
        const queue = await this._getQueue();
        return queue.add(jobName, data, opts);
    }

    async addBulk(jobs) {
        const queue = await this._getQueue();
        return queue.addBulk(jobs);
    }

    async getJobCounts() {
        const queue = await this._getQueue();
        return queue.getJobCounts();
    }

    async close() {
        const queue = await this._getQueue();
        return queue.close();
    }
}

/**
 * Create a unified queue that works with either backend
 */
export const createUnifiedQueue = (queueName) => {
    return new UnifiedQueue(queueName);
};

/**
 * Create a worker using the appropriate backend
 */
export const createUnifiedWorker = async (queueName, processor, options = {}) => {
    await initializeQueueSystem();

    if (currentBackend === 'redis') {
        const bullmq = await loadBullMQModule();
        // Map simple queue name to BullMQ queue name with hash tags
        const queueNameMap = {
            email: bullmq.QUEUE_NAMES.EMAIL,
            notification: bullmq.QUEUE_NAMES.NOTIFICATION,
            balance: bullmq.QUEUE_NAMES.BALANCE,
            recurring: bullmq.QUEUE_NAMES.RECURRING,
            digest: bullmq.QUEUE_NAMES.DIGEST,
            dueReminder: bullmq.QUEUE_NAMES.DUE_REMINDER,
        };
        return bullmq.createWorker(queueNameMap[queueName] || queueName, processor, options);
    } else {
        const mongodb = await loadMongoDBModule();
        return mongodb.createMongoWorker(queueName, processor, options);
    }
};

/**
 * Get queue status for monitoring
 */
export const getQueueSystemStatus = async () => {
    await initializeQueueSystem();

    const status = {
        backend: currentBackend,
        redisAvailable,
        initialized: backendInitialized,
        queues: {},
    };

    try {
        // Get counts for all queues
        const queueNames = ['email', 'notification', 'balance', 'recurring', 'digest', 'dueReminder'];

        for (const name of queueNames) {
            const queue = new UnifiedQueue(name);
            try {
                status.queues[name] = await queue.getJobCounts();
            } catch (error) {
                status.queues[name] = { error: error.message };
            }
        }
    } catch (error) {
        status.error = error.message;
    }

    return status;
};

/**
 * Switch queue backend at runtime (use with caution)
 * @param {'redis' | 'mongodb'} backend - Target backend
 */
export const switchQueueBackend = async (backend) => {
    if (backend === currentBackend) {
        console.log(`Queue Factory: Already using ${backend} backend`);
        return;
    }

    console.log(`Queue Factory: Switching from ${currentBackend} to ${backend} backend...`);

    // Reset state
    backendInitialized = false;
    currentBackend = null;

    // Force the specified backend
    process.env.QUEUE_BACKEND = backend;

    // Reinitialize
    await initializeQueueSystem();

    console.log(`Queue Factory: Now using ${currentBackend} backend`);
};

export default {
    initializeQueueSystem,
    getQueueBackend,
    getQueueBackendConfig,
    isRedisBackendAvailable,
    createUnifiedQueue,
    createUnifiedWorker,
    getQueueSystemStatus,
    switchQueueBackend,
};
