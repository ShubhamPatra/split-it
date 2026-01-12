/**
 * MongoDB Queue Adapter
 * 
 * Provides BullMQ-compatible queue interface using MongoDB as backend.
 * Used as fallback when Redis is unavailable.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import JobQueue from '../models/JobQueue.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * MongoDB-based Queue implementation
 * Provides BullMQ-compatible interface for job management
 */
export class MongoQueue extends EventEmitter {
    constructor(queueName, options = {}) {
        super();
        this.name = queueName;
        this.options = options;
        this.defaultJobOptions = options.defaultJobOptions || {};
    }

    /**
     * Add a job to the queue
     * @param {string} jobName - Name/type of the job
     * @param {Object} data - Job payload data
     * @param {Object} opts - Job options (delay, priority, attempts, etc.)
     */
    async add(jobName, data, opts = {}) {
        try {
            const jobOptions = { ...this.defaultJobOptions, ...opts };

            const job = new JobQueue({
                queueName: this.name,
                jobName,
                data,
                status: 'pending',
                priority: jobOptions.priority || 0,
                maxAttempts: jobOptions.attempts || 3,
                scheduledFor: jobOptions.delay
                    ? new Date(Date.now() + jobOptions.delay)
                    : new Date(),
                opts: jobOptions,
            });

            await job.save();

            if (isDev) {
                console.log(`[MongoQueue:${this.name}] Job added:`, jobName, job._id.toString());
            }

            return {
                id: job._id.toString(),
                name: jobName,
                data,
                opts: jobOptions,
            };
        } catch (error) {
            console.error(`[MongoQueue:${this.name}] Failed to add job:`, error.message);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Add multiple jobs to the queue in bulk
     * @param {Array} jobs - Array of { name, data, opts } objects
     */
    async addBulk(jobs) {
        try {
            const documents = jobs.map(job => ({
                queueName: this.name,
                jobName: job.name || 'default',
                data: job.data,
                status: 'pending',
                priority: job.opts?.priority || 0,
                maxAttempts: job.opts?.attempts || this.defaultJobOptions.attempts || 3,
                scheduledFor: job.opts?.delay
                    ? new Date(Date.now() + job.opts.delay)
                    : new Date(),
                opts: { ...this.defaultJobOptions, ...job.opts },
            }));

            const result = await JobQueue.insertMany(documents);

            if (isDev) {
                console.log(`[MongoQueue:${this.name}] Bulk added ${result.length} jobs`);
            }

            return result.map(doc => ({
                id: doc._id.toString(),
                name: doc.jobName,
                data: doc.data,
            }));
        } catch (error) {
            console.error(`[MongoQueue:${this.name}] Failed to bulk add jobs:`, error.message);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Get job counts by status
     */
    async getJobCounts() {
        try {
            return await JobQueue.getJobCounts(this.name);
        } catch (error) {
            console.error(`[MongoQueue:${this.name}] Failed to get job counts:`, error.message);
            return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
        }
    }

    /**
     * Close the queue (no-op for MongoDB, but needed for interface compatibility)
     */
    async close() {
        // No-op - MongoDB connections are managed globally
        return;
    }

    /**
     * Drain the queue (remove all waiting jobs)
     */
    async drain() {
        await JobQueue.deleteMany({ queueName: this.name, status: 'pending' });
    }

    /**
     * Clean old jobs
     * @param {number} grace - Grace period in ms
     * @param {number} limit - Max jobs to clean
     * @param {string} status - Status to clean ('completed' or 'failed')
     */
    async clean(grace, limit, status = 'completed') {
        const cutoffDate = new Date(Date.now() - grace);
        const result = await JobQueue.deleteMany({
            queueName: this.name,
            status,
            updatedAt: { $lt: cutoffDate },
        }).limit(limit);
        return result.deletedCount;
    }
}

/**
 * MongoDB-based Worker implementation
 * Polls MongoDB for jobs and processes them
 */
export class MongoWorker extends EventEmitter {
    constructor(queueName, processor, options = {}) {
        super();
        this.queueName = queueName;
        this.processor = processor;
        this.options = {
            concurrency: options.concurrency || 5,
            pollInterval: options.pollInterval || parseInt(process.env.QUEUE_MONGODB_POLL_INTERVAL, 10) || 2000,
            lockTimeout: options.lockTimeout || 300000, // 5 minutes
            ...options,
        };

        this.workerId = `worker-${uuidv4()}`;
        this.running = false;
        this.activeJobs = 0;
        this.pollTimer = null;
        this.staleJobRecoveryTimer = null;
    }

    /**
     * Start the worker
     */
    start() {
        if (this.running) return;

        this.running = true;
        console.log(`[MongoWorker:${this.queueName}] Starting worker ${this.workerId}`);

        // Start polling for jobs
        this.poll();

        // Set up periodic stale job recovery (every 60 seconds)
        this.staleJobRecoveryTimer = setInterval(async () => {
            try {
                await JobQueue.recoverStaleJobs(this.options.lockTimeout);
            } catch (error) {
                console.error(`[MongoWorker:${this.queueName}] Stale job recovery failed:`, error.message);
            }
        }, 60000);
    }

    /**
     * Stop the worker
     */
    async stop() {
        this.running = false;

        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }

        if (this.staleJobRecoveryTimer) {
            clearInterval(this.staleJobRecoveryTimer);
            this.staleJobRecoveryTimer = null;
        }

        // Wait for active jobs to complete (with timeout)
        const timeout = 30000;
        const startTime = Date.now();

        while (this.activeJobs > 0 && Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.activeJobs > 0) {
            console.warn(`[MongoWorker:${this.queueName}] Stopped with ${this.activeJobs} active jobs`);
        } else {
            console.log(`[MongoWorker:${this.queueName}] Stopped gracefully`);
        }
    }

    /**
     * Alias for stop() to match BullMQ Worker interface
     */
    async close() {
        return this.stop();
    }

    /**
     * Poll for and process jobs
     */
    async poll() {
        if (!this.running) return;

        try {
            // Process jobs up to concurrency limit
            while (this.running && this.activeJobs < this.options.concurrency) {
                const job = await JobQueue.findAndLockNextJob(
                    this.queueName,
                    this.workerId,
                    this.options.lockTimeout
                );

                if (!job) break; // No more jobs available

                this.activeJobs++;
                this.processJob(job).finally(() => {
                    this.activeJobs--;
                });
            }
        } catch (error) {
            console.error(`[MongoWorker:${this.queueName}] Poll error:`, error.message);
            this.emit('error', error);
        }

        // Schedule next poll
        if (this.running) {
            this.pollTimer = setTimeout(() => this.poll(), this.options.pollInterval);
        }
    }

    /**
     * Process a single job
     */
    async processJob(job) {
        const startTime = Date.now();

        // Create a job object compatible with BullMQ job interface
        const jobWrapper = {
            id: job._id.toString(),
            name: job.jobName,
            data: job.data,
            opts: job.opts,
            attemptsMade: job.attempts,
            timestamp: job.createdAt.getTime(),
            processedOn: Date.now(),

            // Methods for job control (limited support)
            updateProgress: async () => { },
            log: async (message) => {
                if (isDev) {
                    console.log(`[MongoWorker:${this.queueName}] Job ${job._id} log:`, message);
                }
            },
            moveToFailed: async (error) => {
                await JobQueue.markFailed(job._id, error, false);
            },
        };

        try {
            // Execute the processor function
            const result = await this.processor(jobWrapper);

            // Mark job as completed
            await JobQueue.markCompleted(job._id);

            const duration = Date.now() - startTime;

            this.emit('completed', jobWrapper, result);

            if (isDev) {
                console.log(`[MongoWorker:${this.queueName}] Job ${job._id} completed in ${duration}ms`);
            }
        } catch (error) {
            console.error(`[MongoWorker:${this.queueName}] Job ${job._id} failed:`, error.message);

            // Mark job as failed (with retry if attempts remaining)
            const updatedJob = await JobQueue.markFailed(job._id, error, true);

            this.emit('failed', jobWrapper, error);

            // If job was requeued, log it
            if (updatedJob && updatedJob.status === 'pending') {
                console.log(`[MongoWorker:${this.queueName}] Job ${job._id} will be retried (attempt ${job.attempts}/${job.maxAttempts})`);
            }
        }
    }
}

/**
 * Create a MongoDB queue instance
 */
export const createMongoQueue = (name, options = {}) => {
    return new MongoQueue(name, options);
};

/**
 * Create a MongoDB worker instance
 */
export const createMongoWorker = (name, processor, options = {}) => {
    const worker = new MongoWorker(name, processor, options);
    worker.start();
    return worker;
};

/**
 * Get standard queue names for MongoDB backend (without hash tags)
 */
export const MONGO_QUEUE_NAMES = {
    EMAIL: 'email',
    NOTIFICATION: 'notification',
    BALANCE: 'balance',
    RECURRING: 'recurring',
    DIGEST: 'digest',
    DUE_REMINDER: 'dueReminder',
};

export default {
    MongoQueue,
    MongoWorker,
    createMongoQueue,
    createMongoWorker,
    MONGO_QUEUE_NAMES,
};
