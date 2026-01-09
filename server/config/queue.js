/**
 * Bull Queue Configuration
 * 
 * Provides job queues for background processing of emails, notifications,
 * balance calculations, and recurring expenses.
 */

import Bull from 'bull';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Redis connection configuration for Bull
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
};

// Add password if provided
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50, // Keep last 50 failed jobs
};

/**
 * Email Queue
 * Handles sending emails (welcome, notifications, password reset, etc.)
 */
export const emailQueue = new Bull('email', {
  redis: redisConfig,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5, // More retries for emails
  },
});

/**
 * Notification Queue
 * Handles creating in-app notifications and emitting socket events
 * Configured with higher concurrency and rate limiting for burst control
 */
export const notificationQueue = new Bull('notification', {
  redis: redisConfig,
  defaultJobOptions,
  limiter: {
    max: 100, // Max 100 jobs
    duration: 1000, // Per 1 second
    bounceBack: false, // Don't requeue rate-limited jobs, wait instead
  },
});

/**
 * Balance Queue
 * Handles complex balance calculations for groups
 */
export const balanceQueue = new Bull('balance', {
  redis: redisConfig,
  defaultJobOptions: {
    ...defaultJobOptions,
    timeout: 30000, // 30 second timeout for balance calculations
  },
});

/**
 * Recurring Expense Queue
 * Handles scheduled generation of recurring expenses
 */
export const recurringQueue = new Bull('recurring', {
  redis: redisConfig,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1, // Don't retry recurring jobs to avoid duplicates
  },
});

// Queue event handlers for logging and monitoring
const setupQueueEvents = (queue, name) => {
  queue.on('error', (error) => {
    console.error(`Queue ${name} error:`, error.message);
  });

  queue.on('failed', (job, err) => {
    console.error(`Queue ${name} job ${job.id} failed:`, err.message);
  });

  if (process.env.NODE_ENV === 'development') {
    queue.on('completed', (job) => {
      console.log(`Queue ${name} job ${job.id} completed`);
    });
  }
};

// Setup event handlers for all queues
setupQueueEvents(emailQueue, 'email');
setupQueueEvents(notificationQueue, 'notification');
setupQueueEvents(balanceQueue, 'balance');
setupQueueEvents(recurringQueue, 'recurring');

/**
 * Gracefully close all queues
 */
export const closeQueues = async () => {
  console.log('Closing Bull queues...');
  await Promise.all([
    emailQueue.close(),
    notificationQueue.close(),
    balanceQueue.close(),
    recurringQueue.close(),
  ]);
  console.log('Bull queues closed');
};

// Export all queues as named exports (for selective imports)
export default {
  emailQueue,
  notificationQueue,
  balanceQueue,
  recurringQueue,
  closeQueues,
};
