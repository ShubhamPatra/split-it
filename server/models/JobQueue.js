/**
 * MongoDB Job Queue Schema
 * 
 * Fallback queue system using MongoDB for job persistence.
 * Used when Redis is unavailable to ensure zero-downtime operation.
 */

import mongoose from 'mongoose';

const jobQueueSchema = new mongoose.Schema({
    // Queue identification
    queueName: {
        type: String,
        required: true,
        index: true,
        enum: ['email', 'notification', 'balance', 'recurring', 'digest', 'dueReminder'],
    },

    // Job identification
    jobName: {
        type: String,
        required: true,
        default: 'default',
    },

    // Job payload
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },

    // Job status
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true,
    },

    // Retry tracking
    attempts: {
        type: Number,
        default: 0,
    },
    maxAttempts: {
        type: Number,
        default: 3,
    },

    // Priority (higher = more urgent)
    priority: {
        type: Number,
        default: 0,
        index: true,
    },

    // Scheduling
    scheduledFor: {
        type: Date,
        default: Date.now,
        index: true,
    },

    // Processing metadata
    processedAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    },
    failedAt: {
        type: Date,
    },

    // Worker tracking for job locking
    processingBy: {
        type: String,
        default: null,
    },
    processingStartedAt: {
        type: Date,
        default: null,
    },

    // Error tracking
    error: {
        type: String,
    },
    errorStack: {
        type: String,
    },

    // Job options (for compatibility with BullMQ)
    opts: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});

// Compound indexes for efficient job fetching
jobQueueSchema.index({ queueName: 1, status: 1, scheduledFor: 1 });
jobQueueSchema.index({ queueName: 1, status: 1, priority: -1 });
jobQueueSchema.index({ processingBy: 1, processingStartedAt: 1 });

// TTL index - automatically delete completed jobs after 7 days
jobQueueSchema.index(
    { completedAt: 1 },
    { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: 'completed' } }
);

// TTL index - automatically delete failed jobs after 30 days
jobQueueSchema.index(
    { failedAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { status: 'failed' } }
);

/**
 * Static method to find and lock the next available job for processing
 * Uses atomic findOneAndUpdate to prevent race conditions
 */
jobQueueSchema.statics.findAndLockNextJob = async function (queueName, workerId, lockTimeout = 300000) {
    const now = new Date();
    const lockExpiry = new Date(now.getTime() - lockTimeout);

    return this.findOneAndUpdate(
        {
            queueName,
            status: { $in: ['pending', 'processing'] },
            scheduledFor: { $lte: now },
            $or: [
                { status: 'pending' },
                // Also pick up stale processing jobs (worker crashed)
                {
                    status: 'processing',
                    processingStartedAt: { $lt: lockExpiry }
                }
            ]
        },
        {
            $set: {
                status: 'processing',
                processingBy: workerId,
                processingStartedAt: now,
            },
            $inc: { attempts: 1 }
        },
        {
            new: true,
            sort: { priority: -1, scheduledFor: 1 }
        }
    );
};

/**
 * Static method to mark a job as completed
 */
jobQueueSchema.statics.markCompleted = async function (jobId) {
    return this.findByIdAndUpdate(
        jobId,
        {
            $set: {
                status: 'completed',
                completedAt: new Date(),
                processingBy: null,
            }
        },
        { new: true }
    );
};

/**
 * Static method to mark a job as failed
 */
jobQueueSchema.statics.markFailed = async function (jobId, error, shouldRetry = true) {
    const job = await this.findById(jobId);
    if (!job) return null;

    const shouldRequeue = shouldRetry && job.attempts < job.maxAttempts;

    return this.findByIdAndUpdate(
        jobId,
        {
            $set: {
                status: shouldRequeue ? 'pending' : 'failed',
                failedAt: shouldRequeue ? null : new Date(),
                error: error?.message || String(error),
                errorStack: error?.stack,
                processingBy: null,
                processingStartedAt: null,
                // Add exponential backoff for retries
                scheduledFor: shouldRequeue
                    ? new Date(Date.now() + Math.pow(2, job.attempts) * 1000)
                    : job.scheduledFor,
            }
        },
        { new: true }
    );
};

/**
 * Static method to get job counts by status for a queue
 */
jobQueueSchema.statics.getJobCounts = async function (queueName) {
    const counts = await this.aggregate([
        { $match: { queueName } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
    };

    for (const item of counts) {
        if (item._id === 'pending') {
            // Check how many are delayed vs waiting
            const now = new Date();
            const delayed = await this.countDocuments({
                queueName,
                status: 'pending',
                scheduledFor: { $gt: now }
            });
            result.delayed = delayed;
            result.waiting = item.count - delayed;
        } else if (item._id === 'processing') {
            result.active = item.count;
        } else {
            result[item._id] = item.count;
        }
    }

    return result;
};

/**
 * Static method to clean up stale processing jobs
 * Call periodically to recover from worker crashes
 */
jobQueueSchema.statics.recoverStaleJobs = async function (lockTimeout = 300000) {
    const lockExpiry = new Date(Date.now() - lockTimeout);

    const result = await this.updateMany(
        {
            status: 'processing',
            processingStartedAt: { $lt: lockExpiry }
        },
        {
            $set: {
                status: 'pending',
                processingBy: null,
                processingStartedAt: null,
            }
        }
    );

    if (result.modifiedCount > 0) {
        console.log(`MongoDB Queue: Recovered ${result.modifiedCount} stale jobs`);
    }

    return result.modifiedCount;
};

const JobQueue = mongoose.model('JobQueue', jobQueueSchema);

export default JobQueue;
